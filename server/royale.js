import { createHash, randomBytes } from 'node:crypto';
import { loadQuestionBank, shuffleOptions } from './questions.js';
import { promptIdentity } from './question-identity.js';
import { redis } from './redis.js';
import { playerIdFor } from './session.js';

export const ROYALE_CAPACITY = 100;
export const ROYALE_QUESTION_MS = 15_000;
export const ROYALE_REVIEW_MS = 5_000;
export const ROYALE_TTL = 24 * 60 * 60;
export const royaleKey = code => `geek:royale:${code}`;
export const royaleQuestionsKey = code => `${royaleKey(code)}:questions`;
const codePattern = /^ROY-[A-Z2-9]{8}$/;
const checksum = text => createHash('sha1').update(text).digest('hex');
const snapshots = new Map();
const cache = (hash, questions) => {
  if (snapshots.size >= 50) snapshots.delete(snapshots.keys().next().value);
  snapshots.set(hash, questions); return questions;
};

// Freeze distinct active questions for this event; retired rows never enter selection.
export const buildRoyaleQuestions = category => {
  const concepts = new Set(), prompts = new Set(), selected = [];
  for (const q of shuffleOptions(loadQuestionBank(category).questions)) {
    const concept = q.conceptId || q.id, prompt = promptIdentity(q.prompt);
    if (concepts.has(concept) || prompts.has(prompt)) continue;
    concepts.add(concept); prompts.add(prompt);
    const options = shuffleOptions(q.options);
    selected.push({ prompt: q.prompt, options, correctIndex: options.indexOf(q.options[q.correctIndex]),
      explanation: q.explanation || q.funFact || '', source: q.source || '', difficulty: q.difficulty });
    if (selected.length === 100) break;
  }
  if (selected.length !== 100) throw new Error('ROYALE_CONTENT_UNAVAILABLE');
  const tiers = { easy: 0, medium: 1, hard: 2 };
  return selected.sort((a, b) => (tiers[a.difficulty] ?? 1) - (tiers[b.difficulty] ?? 1));
};

const CREATE_LUA = `-- geek-royale-create-v1
if redis.call('EXISTS', KEYS[1]) == 1 or redis.call('EXISTS', KEYS[2]) == 1 then return 0 end
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
local room = cjson.decode(ARGV[1])
room.createdAt = now
room.expiresAt = now + tonumber(ARGV[3]) * 1000
room.players[room.hostId].lastSeen = now
redis.call('SET', KEYS[1], cjson.encode(room), 'EX', ARGV[3])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
return 1
`;

// One Redis transaction owns membership, time, answer locking and elimination.
// Correctness is withheld until the shared question deadline, even from its author.
export const ROYALE_TRANSITION_LUA = `-- geek-royale-transition-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 'ROYALE_NOT_FOUND' end
local room = cjson.decode(raw)
local who, action = ARGV[1], ARGV[2]
local data = cjson.decode(ARGV[3])
local t = redis.call('TIME')
local now = tonumber(t[1]) * 1000 + math.floor(tonumber(t[2]) / 1000)
if now >= room.expiresAt then return 'ROYALE_NOT_FOUND' end
local player = room.players[who]
if action ~= 'join' and not player then return 'ROYALE_NOT_PLAYER' end
if action ~= 'view' and action ~= 'join' and data.eventId ~= room.id then return 'ROYALE_CHANGED' end
if action == 'join' and not player and room.phase ~= 'waiting' then return 'ROYALE_CLOSED' end
local dirty = false
local function livePlayers()
  local list = {}
  for id, p in pairs(room.players) do if p.alive then table.insert(list, p) end end
  return list
end
local function eliminate(p, reason)
  p.alive = false
  p.eliminatedAt = room.questionNumber
  p.eliminationReason = reason
end
local questions
if room.phase ~= 'finished' and room.phase ~= 'cancelled' then
  local pack = redis.call('GET', KEYS[2])
  if not pack or redis.sha1hex(pack) ~= room.questionHash then return 'ROYALE_SNAPSHOT_INVALID' end
  questions = cjson.decode(pack)
end
if room.phase ~= 'waiting' and room.phase ~= 'finished' and room.phase ~= 'cancelled' then
  while true do
    local begins = room.startsAt + (room.questionNumber - 1) * (room.questionMs + room.reviewMs)
    local closes = begins + room.questionMs
    local nextAt = closes + room.reviewMs
    if now < begins then room.phase = 'starting'; break end
    if now < closes then room.phase = 'question'; break end
    if room.reviewedQuestion < room.questionNumber then
      local correct = questions[room.questionNumber].correctIndex
      local survivors, fastest, slowest = {}, nil, nil
      for id, p in pairs(room.players) do
        if p.alive then
          local a = p.answer
          if not a or a == cjson.null or a.questionNumber ~= room.questionNumber then eliminate(p, 'timeout')
          elseif a.selectedIndex ~= correct then eliminate(p, 'wrong')
          else
            p.correct = p.correct + 1
            table.insert(survivors, p)
            fastest = math.min(fastest or a.elapsedMs, a.elapsedMs)
            slowest = math.max(slowest or a.elapsedMs, a.elapsedMs)
          end
        end
      end
      -- Eliminate the whole slowest time group; an all-equal group survives.
      if #survivors > 1 and fastest < slowest then
        for _, p in ipairs(survivors) do if p.answer.elapsedMs == slowest then eliminate(p, 'slowest') end end
      end
      local alive = livePlayers()
      room.lastReview = {questionNumber = room.questionNumber, remaining = #alive, speedTie = #survivors > 1 and fastest == slowest}
      if #alive <= 1 or room.questionNumber == room.questionCount then
        room.pendingResult = {reason = #alive == 0 and 'no-survivors' or #alive == 1 and 'last-mind' or 'shared-victory', winners = {}}
        for _, p in ipairs(alive) do table.insert(room.pendingResult.winners, p.slot) end
      end
      room.reviewedQuestion = room.questionNumber
      dirty = true
    end
    room.phase = 'review'
    if now < nextAt then break end
    if room.pendingResult and room.pendingResult ~= cjson.null then
      room.phase = 'finished'
      room.result = room.pendingResult
      room.result.finishedAt = nextAt
      dirty = true
      break
    end
    room.questionNumber = room.questionNumber + 1
    dirty = true
  end
end
local errorCode
if action == 'join' and not player then
  local count = 0
  for _ in pairs(room.players) do count = count + 1 end
  if count >= room.capacity then errorCode = 'ROYALE_FULL'
  else
    player = {slot = room.nextSlot, name = ARGV[4], ready = false, alive = true, lastSeen = now, correct = 0, eliminatedAt = 0, eliminationReason = '', answer = cjson.null}
    room.players[who] = player
    room.nextSlot = room.nextSlot + 1
    dirty = true
  end
elseif action == 'ready' then
  if room.phase ~= 'waiting' then errorCode = 'ROYALE_CLOSED'
  else player.ready = data.ready; dirty = true end
elseif action == 'start' then
  if who ~= room.hostId then errorCode = 'ROYALE_HOST_REQUIRED'
  elseif room.phase ~= 'waiting' then errorCode = 'ROYALE_CLOSED'
  else
    local count, allReady = 0, true
    for id, p in pairs(room.players) do
      count = count + 1
      if not p.ready or (id ~= who and now - p.lastSeen >= 60000) then allReady = false end
    end
    if count < 2 or not allReady then errorCode = 'ROYALE_NOT_READY'
    else room.startsAt = now + 5000; room.phase = 'starting'; room.rosterCount = count; dirty = true end
  end
elseif action == 'answer' then
  local begins = room.startsAt + (room.questionNumber - 1) * (room.questionMs + room.reviewMs)
  if room.phase ~= 'question' or data.questionNumber ~= room.questionNumber then errorCode = 'ROYALE_QUESTION_CLOSED'
  elseif not player.alive then errorCode = 'ROYALE_ELIMINATED'
  elseif player.answer ~= cjson.null and player.answer and player.answer.questionNumber == room.questionNumber then
    -- Lost responses may safely retry the identical answer, never change it.
    if player.answer.selectedIndex ~= data.selectedIndex then errorCode = 'ROYALE_ANSWER_LOCKED' end
  else
    player.answer = {questionNumber = room.questionNumber, selectedIndex = data.selectedIndex, elapsedMs = now - begins}
    dirty = true
  end
elseif action == 'kick' then
  if who ~= room.hostId then errorCode = 'ROYALE_HOST_REQUIRED'
  elseif room.phase ~= 'waiting' then errorCode = 'ROYALE_CLOSED'
  else
    local found = false
    for id, p in pairs(room.players) do
      if p.slot == data.slot and id ~= room.hostId then room.players[id] = nil; found = true; break end
    end
    if not found then errorCode = 'INVALID_REQUEST' else dirty = true end
  end
elseif action == 'cancel' then
  if who ~= room.hostId then errorCode = 'ROYALE_HOST_REQUIRED'
  elseif room.phase == 'finished' or room.phase == 'cancelled' then errorCode = 'ROYALE_CLOSED'
  else room.phase = 'cancelled'; room.result = {reason = 'host-ended', winners = {}, finishedAt = now}; dirty = true end
elseif action == 'leave' then
  if room.phase == 'waiting' then
    if who == room.hostId then errorCode = 'ROYALE_HOST_REQUIRED' else room.players[who] = nil; dirty = true end
  elseif player.alive and room.phase ~= 'finished' and room.phase ~= 'cancelled' then eliminate(player, 'left'); dirty = true end
elseif action ~= 'view' and action ~= 'join' then errorCode = 'INVALID_REQUEST' end
if player and room.players[who] and now - player.lastSeen >= 10000 then player.lastSeen = now; dirty = true end
if dirty then redis.call('SET', KEYS[1], cjson.encode(room), 'PX', math.max(1, room.expiresAt - now)) end
if errorCode then return errorCode end
room.serverNow = now
return cjson.encode(room)
`;

export const createRoyale = async (session, category, capacity = ROYALE_CAPACITY) => {
  const questions = buildRoyaleQuestions(category), pack = JSON.stringify(questions), hash = checksum(pack);
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = `ROY-${[...randomBytes(8)].map(v => alphabet[v % alphabet.length]).join('')}`;
    const playerId = playerIdFor(session);
    const room = { version: 1, id: randomBytes(16).toString('hex'), code, category, hostId: playerId,
      capacity, questionCount: questions.length, questionHash: hash,
      questionMs: ROYALE_QUESTION_MS, reviewMs: ROYALE_REVIEW_MS, phase: 'waiting',
      startsAt: 0, questionNumber: 1, reviewedQuestion: 0, nextSlot: 2, rosterCount: 0,
      pendingResult: null, result: null, lastReview: null,
      players: { [playerId]: { slot: 1, name: session.name, ready: false, alive: true,
        lastSeen: 0, correct: 0, eliminatedAt: 0, eliminationReason: '', answer: null } } };
    const created = await redis('EVAL', CREATE_LUA, 2, royaleKey(code), royaleQuestionsKey(code), JSON.stringify(room), pack, ROYALE_TTL);
    if (Number(created) === 1) { cache(hash, questions); return transitionRoyale(session, code, 'view'); }
  }
  throw new Error('ROYALE_CODE_UNAVAILABLE');
};

export const transitionRoyale = async (session, rawCode, action, data = {}) => {
  const code = String(rawCode || '').trim().toUpperCase();
  if (!codePattern.test(code)) throw new Error('ROYALE_NOT_FOUND');
  const result = await redis('EVAL', ROYALE_TRANSITION_LUA, 2, royaleKey(code), royaleQuestionsKey(code), playerIdFor(session), action, JSON.stringify(data), session.name);
  if (typeof result !== 'string' || !result.startsWith('{')) throw new Error(result || 'ROYALE_STATE_INVALID');
  return JSON.parse(result);
};

export const royaleView = async (room, session) => {
  const playerId = playerIdFor(session), you = room.players[playerId];
  const players = Object.entries(room.players).map(([id, p]) => ({ slot: p.slot, name: p.name,
    host: id === room.hostId, ready: p.ready, alive: p.alive, online: room.serverNow - p.lastSeen < 60000,
    correct: p.correct, eliminatedAt: p.eliminatedAt, eliminationReason: p.eliminationReason,
    answered: Boolean(p.answer?.questionNumber === room.questionNumber) })).sort((a, b) => a.slot - b.slot);
  let question = null, review = null;
  if (['question', 'review'].includes(room.phase)) {
    let questions = snapshots.get(room.questionHash);
    if (!questions) {
      const raw = await redis('GET', royaleQuestionsKey(room.code));
      if (!raw || checksum(raw) !== room.questionHash) throw new Error('ROYALE_SNAPSHOT_INVALID');
      questions = cache(room.questionHash, JSON.parse(raw));
    }
    const q = questions[room.questionNumber - 1];
    question = { prompt: q.prompt, options: q.options };
    if (room.phase === 'review') review = { correctIndex: q.correctIndex, explanation: q.explanation, source: q.source, ...room.lastReview };
  }
  const answer = you?.answer?.questionNumber === room.questionNumber ? { selectedIndex: you.answer.selectedIndex,
    ...(room.phase === 'review' ? { elapsedMs: you.answer.elapsedMs, correct: you.answer.selectedIndex === review.correctIndex } : {}) } : null;
  const begins = room.startsAt + (room.questionNumber - 1) * (room.questionMs + room.reviewMs);
  return { id: room.id, code: room.code, category: room.category, capacity: room.capacity,
    state: room.phase, serverNow: room.serverNow, expiresAt: room.expiresAt,
    startsAt: room.startsAt, questionNumber: room.questionNumber, questionCount: room.questionCount,
    questionEndsAt: room.startsAt ? begins + room.questionMs : 0,
    reviewEndsAt: room.startsAt ? begins + room.questionMs + room.reviewMs : 0,
    isHost: playerId === room.hostId, yourSlot: you?.slot || 0, yourAnswer: answer,
    canAnswer: room.phase === 'question' && Boolean(you?.alive) && !answer,
    canStart: room.phase === 'waiting' && playerId === room.hostId && players.length >= 2 && players.every(p => p.ready && p.online),
    players, remaining: players.filter(p => p.alive).length, question, review,
    result: room.result ? { ...room.result, winners: Array.isArray(room.result.winners) ? [...room.result.winners].sort((a, b) => a - b) : [] } : null,
    rewardsEnabled: false };
};
