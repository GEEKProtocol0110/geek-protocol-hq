import { randomBytes } from 'node:crypto';
import { questionById, selectRoundQuestionIds, shuffleOptions } from './questions.js';
import { redis } from './redis.js';

export const LOBBY_QUESTION_COUNT = 10;
export const LOBBY_QUESTION_MS = 15_000;
const MATCH_TTL = 60 * 60;
const START_DELAY_MS = 3_000;
export const matchKey = (code) => `geek:lobby:${code}:match`;

// The answer and score are both decided inside one Redis transaction. Neither
// the browser's score nor a second concurrent submission can change a result.
export const ANSWER_MATCH_LUA = `
-- geek-lobby-answer-v1
local raw = redis.call('GET', KEYS[1])
if not raw then return 'MATCH_NOT_FOUND' end
local match = cjson.decode(raw)
local index = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
if match.id ~= ARGV[1] then return 'MATCH_CHANGED' end
if index < 0 or index >= #match.questions then return 'MATCH_QUESTION_CLOSED' end
local begins = match.startsAt + index * match.questionMs
if now < begins or now >= begins + match.questionMs then return 'MATCH_QUESTION_CLOSED' end
local player = match.players[ARGV[4]]
if not player then return 'MATCH_NOT_PLAYER' end
local key = tostring(index)
if player.answers[key] then return 'MATCH_ANSWER_RECORDED' end
local selected = tonumber(ARGV[5])
local correct = selected == match.questions[index + 1].correctIndex
local added = 0
if correct then
  added = 1000 + math.floor((begins + match.questionMs - now) / 1000) * 30
  player.score = player.score + added
end
player.answers[key] = { correct = correct, scoreAdded = added }
redis.call('SET', KEYS[1], cjson.encode(match), 'EX', tonumber(ARGV[6]))
return cjson.encode({ correct = correct, scoreAdded = added, score = player.score })
`;

export const loadMatch = async (code) => {
  const value = await redis('GET', matchKey(code));
  return value ? JSON.parse(value) : null;
};

export const matchView = (match, sessionId, now = Date.now()) => {
  if (!match) return null;
  const player = match.players[sessionId];
  const elapsed = now - match.startsAt;
  const index = Math.floor(elapsed / match.questionMs);
  const finished = index >= match.questions.length;
  const active = elapsed >= 0 && !finished;
  const question = active ? match.questions[index] : null;
  const answer = active ? player?.answers[String(index)] : null;
  return {
    id: match.id,
    state: finished ? 'finished' : active ? 'playing' : 'starting',
    startsAt: match.startsAt,
    serverNow: now,
    questionMs: match.questionMs,
    questionCount: match.questions.length,
    questionNumber: active ? index + 1 : finished ? match.questions.length : 0,
    questionEndsAt: active ? match.startsAt + (index + 1) * match.questionMs : 0,
    question: question && player ? { prompt: question.prompt, options: question.options, topic: question.topic } : null,
    yourAnswer: answer || null,
    canPlay: Boolean(player),
    scores: Object.values(match.players)
      .map(({ name, score }, order) => ({ name, score, order }))
      .sort((a, b) => b.score - a.score || a.order - b.order)
      .map(({ name, score }) => ({ name, score }))
  };
};

export const createMatch = async ({ code, category, focus, roster }) => {
  const questionIds = await selectRoundQuestionIds(category, 1, [], focus);
  const questions = await Promise.all(questionIds.slice(0, LOBBY_QUESTION_COUNT).map(async (id) => {
    const question = await questionById(category, id);
    const options = shuffleOptions(question.options);
    return {
      prompt: question.prompt,
      topic: question.topic,
      options,
      correctIndex: options.indexOf(question.options[question.correctIndex])
    };
  }));
  const match = {
    id: randomBytes(16).toString('hex'),
    startsAt: Date.now() + START_DELAY_MS,
    questionMs: LOBBY_QUESTION_MS,
    questions,
    players: Object.fromEntries(roster.map(({ id, name }) => [id, { name, score: 0, answers: {} }]))
  };
  const claimed = await redis('SET', matchKey(code), JSON.stringify(match), 'EX', MATCH_TTL, 'NX');
  if (claimed !== 'OK') throw new Error('MATCH_ALREADY_STARTED');
  return match;
};

export const submitMatchAnswer = async ({ code, match, sessionId, questionNumber, selectedIndex }) => {
  const now = Date.now();
  const index = Number(questionNumber) - 1;
  if (!Number.isInteger(index) || index < 0 || index >= LOBBY_QUESTION_COUNT
    || !Number.isInteger(selectedIndex) || selectedIndex < 0 || selectedIndex > 3) throw new Error('INVALID_REQUEST');
  const result = await redis('EVAL', ANSWER_MATCH_LUA, 1, matchKey(code), match.id, index, now, sessionId, selectedIndex, MATCH_TTL);
  if (typeof result !== 'string' || !result.startsWith('{')) throw new Error(result || 'MATCH_QUESTION_CLOSED');
  return JSON.parse(result);
};
