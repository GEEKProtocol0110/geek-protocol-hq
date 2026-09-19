import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sessionHandler from '../api/session.js';
import lobbiesHandler from '../api/lobbies.js';
import leaderboardHandler from '../api/leaderboard.js';
import rankedHandler from '../api/ranked.js';
import contentHandler from '../api/content.js';
import moderationHandler from '../api/moderation.js';
import rewardsHandler from '../api/rewards.js';
import { isValidKaspaMainnetAddress } from '../server/kaspa-address.js';
import { loadQuestionBank } from '../server/questions.js';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
process.env.CCE_ADMIN_TOKEN = 'test-cce-admin-token-123456789';
process.env.CCE_REWARD_AMOUNT = '25';

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
  if (name === 'HSETNX') {
    const map = hashes.get(args[0]) || new Map();
    if (map.has(String(args[1]))) return 0;
    map.set(String(args[1]), String(args[2]));
    hashes.set(args[0], map);
    return 1;
  }
  if (name === 'HINCRBY') {
    const map = hashes.get(args[0]) || new Map();
    const value = Number(map.get(String(args[1])) || 0) + Number(args[2]);
    map.set(String(args[1]), String(value));
    hashes.set(args[0], map);
    return value;
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
  if (name === 'EVAL') {
    const keyCount = Number(args[1]);
    const keys = args.slice(2, 2 + keyCount);
    const values = args.slice(2 + keyCount);
    const added = execute(['HSETNX', keys[0], values[0], values[1]]);
    if (added === 1) {
      execute(['HINCRBY', keys[1], 'earned', values[2]]);
      execute(['HINCRBY', keys[1], 'used', 1]);
      const stored = strings.get(keys[2]);
      if (stored) {
        const submission = JSON.parse(stored);
        submission.firstUsedAt = Number(values[3]);
        submission.updatedAt = Number(values[3]);
        submission.reward.status = 'earned';
        strings.set(keys[2], JSON.stringify(submission));
      }
    }
    return added;
  }
  throw new Error(`Unsupported Redis command: ${name}`);
};

global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const isBatch = url.endsWith('/pipeline') || url.endsWith('/multi-exec');
  const payload = isBatch ? body.map((command) => ({ result: execute(command) })) : { result: execute(body) };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const request = (method, body = undefined, cookie = '', query = {}, headers = {}) => ({
  method,
  body,
  query,
  headers: { cookie, ...headers }
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

test('community questions move through review, enter ranked play, and earn once on first use', async () => {
  const contributorCookie = await startSession('Question Smith');
  const playerCookie = await startSession('CCE Tester');
  const question = {
    action: 'submit',
    displayName: 'Question Smith',
    category: 'kaspa',
    difficulty: 'easy',
    topic: 'Consensus',
    prompt: 'What does GHOSTDAG preserve when Kaspa receives parallel blocks?',
    options: ['Useful proof-of-work', 'Only the oldest block', 'Private account balances', 'A validator committee'],
    correctIndex: 0,
    explanation: 'GHOSTDAG orders parallel blocks so useful proof-of-work can remain in the blockDAG.',
    source: 'https://docs.kaspa.org/',
    original: true
  };

  const submitRes = response();
  await contentHandler(request('POST', question, contributorCookie), submitRes);
  assert.equal(submitRes.statusCode, 201);
  assert.equal(submitRes.body.submission.status, 'submitted');
  assert.equal(submitRes.body.stats.submitted, 1);
  assert.equal(submitRes.body.stats.earned, 0);
  const submissionId = submitRes.body.submission.id;

  const deniedRes = response();
  await moderationHandler(request('GET', undefined, '', {}, { 'x-cce-admin': 'wrong-token' }), deniedRes);
  assert.equal(deniedRes.statusCode, 403);

  const moderatorHeaders = { 'x-cce-admin': process.env.CCE_ADMIN_TOKEN };
  const approveRes = response();
  await moderationHandler(request('POST', { action: 'approve', id: submissionId, note: 'Source and wording checked.' }, '', {}, moderatorHeaders), approveRes);
  assert.equal(approveRes.body.submission.status, 'approved');

  const publishRes = response();
  await moderationHandler(request('POST', { action: 'publish', id: submissionId }, '', {}, moderatorHeaders), publishRes);
  assert.equal(publishRes.body.submission.status, 'published');

  const startRes = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa' }, playerCookie), startRes);
  assert.equal(startRes.statusCode, 201);
  let rankedPayload = startRes.body;
  let communityWasUsed = false;
  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    const isCommunityQuestion = rankedPayload.question.prompt === question.prompt;
    const privateQuestion = isCommunityQuestion
      ? question
      : loadQuestionBank('kaspa').questions.find((item) => item.prompt === rankedPayload.question.prompt);
    const correctAnswer = privateQuestion.options[privateQuestion.correctIndex];
    const selectedIndex = rankedPayload.question.options.indexOf(correctAnswer);
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
    }, playerCookie), answerRes);
    assert.equal(answerRes.statusCode, 200);
    if (isCommunityQuestion) {
      communityWasUsed = true;
      assert.equal(answerRes.body.result.contributorCredit, true);
      assert.equal(answerRes.body.result.sourceState, 'Community-reviewed contribution');
      const retryRes = response();
      await rankedHandler(request('POST', {
        action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
      }, playerCookie), retryRes);
      assert.equal(retryRes.body.result.contributorCredit, true);
    }
    rankedPayload = answerRes.body;
    if (questionNumber < 10) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: rankedPayload.run.id }, playerCookie), nextRes);
      rankedPayload = nextRes.body;
    }
  }
  assert.equal(communityWasUsed, true);

  const dashboardRes = response();
  await contentHandler(request('GET', undefined, contributorCookie), dashboardRes);
  assert.equal(dashboardRes.body.stats.accepted, 1);
  assert.equal(dashboardRes.body.stats.used, 1);
  assert.equal(dashboardRes.body.stats.earned, 25);
  assert.equal(dashboardRes.body.stats.paid, 0);
  assert.equal(dashboardRes.body.stats.settlement, 'launch-gated');
  assert.equal(dashboardRes.body.submissions[0].reward.status, 'earned');
});

test('a player can register any valid Kaspa mainnet payout address without exposing wallet secrets', async () => {
  const cookie = await startSession('Open Wallet Geek');
  const address = 'kaspa:qrahfynex4wsv6u283mvr77yc65ks9ze3assz3w4zegashgwupu6umagljg84';
  assert.equal(isValidKaspaMainnetAddress(address), true);
  assert.equal(isValidKaspaMainnetAddress(address.replace(/.$/, 'q')), false);
  assert.equal(isValidKaspaMainnetAddress(address.replace('kaspa:', 'kaspatest:')), false);

  const rejectedRes = response();
  await rewardsHandler(request('POST', { address, acknowledged: false }, cookie), rejectedRes);
  assert.equal(rejectedRes.statusCode, 400);

  const saveRes = response();
  await rewardsHandler(request('POST', { address, acknowledged: true }, cookie), saveRes);
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.body.payout.address, address);
  assert.equal(saveRes.body.payout.withdrawalsEnabled, false);
  assert.equal('privateKey' in saveRes.body, false);
  assert.equal('mnemonic' in saveRes.body, false);

  const getRes = response();
  await rewardsHandler(request('GET', undefined, cookie), getRes);
  assert.equal(getRes.body.payout.address, address);
  assert.equal(getRes.body.payout.network, 'kaspa-mainnet');
});

test('Daily and Speed modes keep answers and timing under server control', async () => {
  const dailyCookie = await startSession('Daily Geek');
  const dailyStart = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'daily' }, dailyCookie), dailyStart);
  assert.equal(dailyStart.statusCode, 201);
  assert.equal(dailyStart.body.run.mode, 'daily');
  assert.equal(dailyStart.body.run.questionCount, 5);
  assert.equal('correctIndex' in dailyStart.body.question, false);

  let dailyPayload = dailyStart.body;
  for (let number = 1; number <= 5; number += 1) {
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: dailyPayload.run.id, questionToken: dailyPayload.question.token, selectedIndex: 0
    }, dailyCookie), answerRes);
    dailyPayload = answerRes.body;
    if (number < 5) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: dailyPayload.run.id }, dailyCookie), nextRes);
      dailyPayload = nextRes.body;
    }
  }
  assert.equal(dailyPayload.roundResult.modeComplete, true);
  assert.equal(dailyPayload.roundResult.questionCount, 5);
  assert.equal(dailyPayload.roundResult.reward, 0);

  const dailyRetry = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'daily' }, dailyCookie), dailyRetry);
  assert.equal(dailyRetry.statusCode, 409);
  assert.equal(dailyRetry.body.code, 'DAILY_ALREADY_PLAYED');

  const speedCookie = await startSession('Speed Geek');
  const speedStart = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'speed' }, speedCookie), speedStart);
  assert.equal(speedStart.statusCode, 201);
  assert.equal(speedStart.body.run.mode, 'speed');
  assert.ok(speedStart.body.question.durationMs <= 30_000);

  const storedKey = `geek:run:${speedStart.body.run.id}`;
  const storedRun = JSON.parse(strings.get(storedKey));
  storedRun.overallDeadline = Date.now() - 1_000;
  storedRun.current.deadline = Date.now() - 1_000;
  strings.set(storedKey, JSON.stringify(storedRun));
  const speedAnswer = response();
  await rankedHandler(request('POST', {
    action: 'answer', runId: speedStart.body.run.id, questionToken: speedStart.body.question.token, selectedIndex: -1
  }, speedCookie), speedAnswer);
  assert.equal(speedAnswer.body.result.timedOut, true);
  assert.equal(speedAnswer.body.roundResult.modeComplete, true);
  assert.equal(speedAnswer.body.roundResult.reward, 0);
});
