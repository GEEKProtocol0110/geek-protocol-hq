import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sessionHandler from '../api/session.js';
import lobbiesHandler from '../api/lobbies.js';
import leaderboardHandler from '../api/leaderboard.js';
import rankedHandler from '../api/ranked.js';
import { loadQuestionBank } from '../server/questions.js';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';

const strings = new Map();
const hashes = new Map();
const sorted = new Map();

const execute = (command) => {
  const [rawName, ...args] = command;
  const name = String(rawName).toUpperCase();
  if (name === 'PING') return 'PONG';
  if (name === 'GET') return strings.get(args[0]) ?? null;
  if (name === 'SET') {
    const [key, value] = args;
    const nx = args.some((item) => String(item).toUpperCase() === 'NX');
    if (nx && strings.has(key)) return null;
    strings.set(key, String(value));
    return 'OK';
  }
  if (name === 'INCR') {
    const value = Number(strings.get(args[0]) || 0) + 1;
    strings.set(args[0], String(value));
    return value;
  }
  if (name === 'EXPIRE') return 1;
  if (name === 'HSET') {
    const map = hashes.get(args[0]) || new Map();
    map.set(String(args[1]), String(args[2]));
    hashes.set(args[0], map);
    return 1;
  }
  if (name === 'HGET') return hashes.get(args[0])?.get(String(args[1])) ?? null;
  if (name === 'HDEL') return hashes.get(args[0])?.delete(String(args[1])) ? 1 : 0;
  if (name === 'ZADD') {
    const map = sorted.get(args[0]) || new Map();
    for (let index = 1; index < args.length; index += 2) map.set(String(args[index + 1]), Number(args[index]));
    sorted.set(args[0], map);
    return 1;
  }
  if (name === 'ZSCORE') {
    const value = sorted.get(args[0])?.get(String(args[1]));
    return value === undefined ? null : String(value);
  }
  if (name === 'ZREM') return sorted.get(args[0])?.delete(String(args[1])) ? 1 : 0;
  if (name === 'ZCOUNT') {
    const min = args[1] === '-inf' ? -Infinity : Number(args[1]);
    const max = args[2] === '+inf' ? Infinity : Number(args[2]);
    return [...(sorted.get(args[0])?.values() || [])].filter((score) => score >= min && score <= max).length;
  }
  if (name === 'ZRANGEBYSCORE') {
    const min = args[1] === '-inf' ? -Infinity : Number(args[1]);
    const max = args[2] === '+inf' ? Infinity : Number(args[2]);
    return [...(sorted.get(args[0])?.entries() || [])].filter(([, score]) => score >= min && score <= max).sort((a, b) => a[1] - b[1]).map(([member]) => member);
  }
  if (name === 'ZREVRANGE') {
    const withScores = String(args[3] || '').toUpperCase() === 'WITHSCORES';
    const entries = [...(sorted.get(args[0])?.entries() || [])].sort((a, b) => b[1] - a[1]).slice(Number(args[1]), Number(args[2]) + 1);
    return withScores ? entries.flatMap(([member, score]) => [member, String(score)]) : entries.map(([member]) => member);
  }
  throw new Error(`Unsupported Redis command: ${name}`);
};

global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const isBatch = url.endsWith('/pipeline') || url.endsWith('/multi-exec');
  const payload = isBatch ? body.map((command) => ({ result: execute(command) })) : { result: execute(body) };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const request = (method, body = undefined, cookie = '', query = {}) => ({
  method,
  body,
  query,
  headers: { cookie }
});

const response = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
  end() { return this; }
});

const startSession = async (displayName) => {
  const res = response();
  await sessionHandler(request('POST', { displayName }), res);
  assert.equal(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
};

test('sessions, live rooms, and server-authoritative leaderboard work together', async () => {
  const hostCookie = await startSession('Host Geek');
  const guestCookie = await startSession('Guest Geek');

  const createRes = response();
  await lobbiesHandler(request('POST', { action: 'create', name: 'Kaspa Lab', category: 'kaspa', seats: 4 }, hostCookie), createRes);
  assert.equal(createRes.statusCode, 201);
  assert.match(createRes.body.room.code, /^GEEK-[A-Z2-9]{6}$/);
  assert.equal(createRes.body.room.online, 1);
  assert.equal('hostId' in createRes.body.room, false);

  const code = createRes.body.room.code;
  const joinRes = response();
  await lobbiesHandler(request('POST', { action: 'join', code }, guestCookie), joinRes);
  assert.equal(joinRes.body.room.online, 2);
  assert.deepEqual(joinRes.body.room.members.map((member) => member.name).sort(), ['Guest Geek', 'Host Geek']);

  const listRes = response();
  await lobbiesHandler(request('GET'), listRes);
  assert.equal(listRes.body.rooms[0].code, code);
  assert.equal(listRes.body.rooms[0].online, 2);

  const startRes = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa' }, hostCookie), startRes);
  assert.equal(startRes.statusCode, 201);
  assert.equal(startRes.body.verified, true);
  assert.equal('answer' in startRes.body.question, false);
  assert.equal('correctIndex' in startRes.body.question, false);
  assert.equal(existsSync(new URL('../public/play/assets/kaspa-questions.json', import.meta.url)), false);

  let rankedPayload = startRes.body;
  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    const privateQuestion = loadQuestionBank('kaspa').questions.find((item) => item.prompt === rankedPayload.question.prompt);
    const correctAnswer = privateQuestion.options[privateQuestion.correctIndex];
    const selectedIndex = rankedPayload.question.options.indexOf(correctAnswer);
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
    }, hostCookie), answerRes);
    assert.equal(answerRes.statusCode, 200);
    assert.equal(answerRes.body.result.correct, true);
    rankedPayload = answerRes.body;
    if (questionNumber === 1) {
      const retryRes = response();
      await rankedHandler(request('POST', {
        action: 'answer', runId: rankedPayload.run.id, questionToken: startRes.body.question.token, selectedIndex: (selectedIndex + 1) % 4
      }, hostCookie), retryRes);
      assert.equal(retryRes.statusCode, 200);
      assert.equal(retryRes.body.result.correct, true);
      assert.equal(retryRes.body.run.roundScore, rankedPayload.run.roundScore);
    }
    if (questionNumber < 10) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: rankedPayload.run.id }, hostCookie), nextRes);
      assert.equal(nextRes.statusCode, 200);
      rankedPayload = nextRes.body;
    }
  }
  assert.equal(rankedPayload.roundResult.correct, 10);
  assert.equal(rankedPayload.run.status, 'between-rounds');

  const finishRes = response();
  await rankedHandler(request('POST', { action: 'finish', runId: rankedPayload.run.id }, hostCookie), finishRes);
  assert.equal(finishRes.statusCode, 200);
  assert.equal(finishRes.body.leaderboard.entries[0].name, 'Host Geek');
  assert.ok(finishRes.body.leaderboard.entries[0].score > 0);

  const boardRes = response();
  await leaderboardHandler(request('GET', undefined, '', { category: 'kaspa' }), boardRes);
  assert.equal(boardRes.body.entries.length, 1);
  assert.equal(boardRes.body.verified, true);
  assert.equal(boardRes.body.entries[0].round, 1);

  const forgedScoreRes = response();
  await leaderboardHandler(request('POST', { category: 'kaspa', score: 250000, round: 10 }, hostCookie), forgedScoreRes);
  assert.equal(forgedScoreRes.statusCode, 405);
});
