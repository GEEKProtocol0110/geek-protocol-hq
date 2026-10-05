import { randomBytes } from 'node:crypto';
import { collectibleProfile } from './collectibles.js';
import { loadProfile } from './profile.js';
import { deriveProgression } from './progression.js';
import { questionById, selectRoundQuestionIds, shuffleOptions } from './questions.js';
import { redis } from './redis.js';
import { playerIdFor } from './session.js';

export const DUEL_TTL = 3600;
export const DUEL_GRACE_MS = 45_000;
export const duelKey = code => `geek:duel:${code}`;
export const duelCodePattern = /^DUEL-[A-Z2-9]{6}$/;

// All transitions, answer claims, presence, results and mutual rematches use the
// same Redis record and clock. Reads settle elapsed matches too; no worker is needed.
export const DUEL_LUA = `
-- geek-duel-transition-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 'DUEL_NOT_FOUND' end
local d = cjson.decode(raw)
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local who, action, expected = ARGV[1], ARGV[2], ARGV[3]
local grace, ttl = tonumber(ARGV[7]), tonumber(ARGV[8])
local player = d.players[who]
if action ~= 'join' and not player then return 'DUEL_NOT_PLAYER' end
if action ~= 'join' and action ~= 'view' and d.id ~= expected then return 'DUEL_CHANGED' end
local function finish(reason, winner)
  d.state = 'finished'
  d.result = {reason=reason, winner=winner, finishedAt=now}
  for _, p in pairs(d.players) do p.rematch = false end
end
if d.state == 'starting' or d.state == 'playing' then
  if now >= d.startsAt + #d.questions * d.questionMs then
    local a, b = nil, nil
    for _, p in pairs(d.players) do if p.slot == 1 then a = p else b = p end end
    finish('completed', a.score == b.score and 0 or (a.score > b.score and 1 or 2))
  else
    local gone = {}
    for _, p in pairs(d.players) do if now - p.lastSeen >= grace then table.insert(gone, p.slot) end end
    if #gone == 2 then finish('abandoned', 0)
    elseif #gone == 1 then finish('disconnect', gone[1] == 1 and 2 or 1)
    elseif now >= d.startsAt then d.state = 'playing' end
  end
end
if d.state == 'waiting' or d.state == 'finished' then
  for _, p in pairs(d.players) do
    if now - p.lastSeen >= grace then p.ready, p.rematch = false, false end
  end
end
if action == 'join' then
  if not player then
    local count = 0
    for _ in pairs(d.players) do count = count + 1 end
    if count >= 2 or d.state ~= 'waiting' then return 'DUEL_FULL' end
    player = cjson.decode(ARGV[6])
    player.slot, player.score, player.correct = 2, 0, 0
    player.answers, player.ready, player.rematch, player.left = {}, false, false, false
    d.players[who] = player
  end
elseif action == 'ready' then
  if d.state ~= 'waiting' or player.left then return 'DUEL_STATE_INVALID' end
  player.ready = true
elseif action == 'answer' then
  local index, selected = tonumber(ARGV[4]), tonumber(ARGV[5])
  if d.state ~= 'playing' or player.left then return 'DUEL_QUESTION_CLOSED' end
  if index ~= math.floor((now - d.startsAt) / d.questionMs) then return 'DUEL_QUESTION_CLOSED' end
  local answerKey = tostring(index)
  if player.answers[answerKey] then return 'DUEL_ANSWER_RECORDED' end
  local correct = selected == d.questions[index + 1].correctIndex
  local added = correct and (1000 + math.floor((d.startsAt + (index + 1) * d.questionMs - now) / 1000) * 30) or 0
  player.score = player.score + added
  player.correct = player.correct + (correct and 1 or 0)
  player.answers[answerKey] = {selectedIndex=selected, correct=correct, scoreAdded=added}
elseif action == 'rematch' then
  if d.state ~= 'finished' or player.left then return 'DUEL_STATE_INVALID' end
  for _, p in pairs(d.players) do if p.left then return 'DUEL_STATE_INVALID' end end
  player.rematch = true
  local visual = cjson.decode(ARGV[6])
  player.name, player.avatar = visual.name, visual.avatar
elseif action == 'leave' then
  player.left = true
  player.ready, player.rematch = false, false
  if d.state == 'waiting' then finish('cancelled', 0)
  elseif d.state ~= 'finished' then finish('forfeit', player.slot == 1 and 2 or 1) end
elseif action ~= 'view' then return 'INVALID_REQUEST' end
if not player.left then player.lastSeen = now end
local count, allReady, allRematch = 0, true, true
for _, p in pairs(d.players) do
  count = count + 1
  if not p.ready or p.left or now - p.lastSeen >= grace then allReady = false end
  if not p.rematch or p.left or now - p.lastSeen >= grace then allRematch = false end
end
if d.state == 'waiting' and count == 2 and allReady then
  d.state, d.startsAt = 'starting', now + 3000
elseif action == 'rematch' and count == 2 and allRematch then
  local next = cjson.decode(ARGV[9])
  d.id, d.questions = next.id, next.questions
  d.generation, d.state, d.startsAt, d.result = d.generation + 1, 'starting', now + 3000, nil
  for _, p in pairs(d.players) do p.score, p.correct, p.answers, p.ready, p.rematch = 0, 0, {}, false, false end
end
d.serverNow = now
redis.call('SET', KEYS[1], cjson.encode(d), 'EX', ttl)
return cjson.encode(d)
`;

const redisNow = async () => {
  const time = await redis('TIME');
  return Number(time[0]) * 1000 + Math.floor(Number(time[1]) / 1000);
};

const questionsFor = async category => {
  const ids = await selectRoundQuestionIds(category, 1, []);
  if (ids.length < 10) throw new Error('QUESTION_BANK_UNAVAILABLE');
  return Promise.all(ids.slice(0, 10).map(async id => {
    const q = await questionById(category, id);
    const options = shuffleOptions(q.options);
    return { prompt: q.prompt, topic: q.topic, options, correctIndex: options.indexOf(q.options[q.correctIndex]) };
  }));
};

const visualFor = async session => {
  const profile = await loadProfile(playerIdFor(session));
  const collection = collectibleProfile(profile, { progression: deriveProgression(profile), walletProtected: Boolean(session.identityVersion) });
  return { name: session.name, avatar: { id: collection.avatar.id, name: collection.avatar.name, asset: collection.avatar.asset, ...(collection.avatar.id === 'giga-builder' ? { customization: collection.customization } : {}) } };
};

export const createDuel = async (session, category) => {
  const questions = await questionsFor(category);
  const visual = await visualFor(session);
  for (let attempt = 0; attempt < 6; attempt++) {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const code = `DUEL-${[...randomBytes(6)].map(n => alphabet[n % alphabet.length]).join('')}`;
    const now = await redisNow();
    const duel = { code, category, id: randomBytes(16).toString('hex'), generation: 1, state: 'waiting', startsAt: 0, questionMs: 15_000, questions, serverNow: now,
      players: { [playerIdFor(session)]: { ...visual, slot: 1, score: 0, correct: 0, answers: {}, ready: false, rematch: false, left: false, lastSeen: now } } };
    if (await redis('SET', duelKey(code), JSON.stringify(duel), 'EX', DUEL_TTL, 'NX') === 'OK') return duel;
  }
  throw new Error('ROOM_CODE_UNAVAILABLE');
};

export const transitionDuel = async (session, code, action, body = {}) => {
  if (!duelCodePattern.test(code)) throw new Error('DUEL_NOT_FOUND');
  if (!['join', 'view', 'ready', 'answer', 'rematch', 'leave'].includes(action)) throw new Error('INVALID_REQUEST');
  if (!['join', 'view'].includes(action) && !/^[a-f0-9]{32}$/.test(body.matchId || '')) throw new Error('INVALID_REQUEST');
  if (action === 'answer' && (!Number.isInteger(body.questionNumber) || body.questionNumber < 1 || body.questionNumber > 10
    || !Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 3)) throw new Error('INVALID_REQUEST');
  const visual = ['join', 'rematch'].includes(action) ? await visualFor(session) : {};
  let candidate = {};
  if (action === 'rematch') {
    const raw = await redis('GET', duelKey(code));
    if (!raw) throw new Error('DUEL_NOT_FOUND');
    const previous = JSON.parse(raw);
    if (!previous.players[playerIdFor(session)]) throw new Error('DUEL_NOT_PLAYER');
    candidate = { id: randomBytes(16).toString('hex'), questions: await questionsFor(previous.category) };
  }
  const result = await redis('EVAL', DUEL_LUA, 1, duelKey(code), playerIdFor(session), action, body.matchId || '',
    Number(body.questionNumber || 0) - 1, Number(body.selectedIndex || 0), JSON.stringify(visual), DUEL_GRACE_MS, DUEL_TTL, JSON.stringify(candidate));
  if (typeof result !== 'string' || !result.startsWith('{')) throw new Error(result || 'DUEL_STATE_INVALID');
  return JSON.parse(result);
};

export const duelView = (duel, session) => {
  const you = duel.players[playerIdFor(session)];
  if (!you) throw new Error('DUEL_NOT_PLAYER');
  const index = Math.floor((duel.serverNow - duel.startsAt) / duel.questionMs);
  const active = duel.state === 'playing';
  return { code: duel.code, id: duel.id, category: duel.category, generation: duel.generation, state: duel.state, serverNow: duel.serverNow,
    startsAt: duel.startsAt, questionCount: duel.questions.length, questionNumber: active ? index + 1 : 0,
    questionEndsAt: active ? duel.startsAt + (index + 1) * duel.questionMs : 0, graceMs: DUEL_GRACE_MS, yourSlot: you.slot,
    question: active && !you.left ? { prompt: duel.questions[index].prompt, options: duel.questions[index].options, topic: duel.questions[index].topic } : null,
    yourAnswer: active ? you.answers[String(index)] || null : null, result: duel.result || null,
    players: Object.values(duel.players).sort((a, b) => a.slot - b.slot).map(p => ({ slot: p.slot, name: p.name, avatar: p.avatar,
      score: p.score, correct: p.correct, ready: p.ready, rematch: p.rematch, left: p.left, lastSeen: p.lastSeen })) };
};
