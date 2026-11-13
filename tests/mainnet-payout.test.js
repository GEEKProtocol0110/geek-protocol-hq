import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import { loadQuestionBank } from '../server/questions.js';
import { rewardAddressKey } from '../server/reward-addresses.js';
import { GEEK_DEPLOYMENT } from '../server/geek-deployment.js';
import { ROUND_CONFIG } from '../server/game-economy.js';
import {
  PAYOUT_INDEX_CEILING, STUCK_AFTER_MS, earningId, mainnetPayoutConfig, mainnetPayoutFlags, payoutAddressDayKey, payoutDay, payoutDayKey,
  payoutEarnKey, payoutIdentityFingerprint, payoutIndexKey, payoutJobKey, payoutPlayerDayKey, payoutQuarantineKey, payoutSignedKey, payoutStuckKey
} from '../server/mainnet-payout.js';
import { createCronHandler } from '../workers/mainnet/cron.mjs';
import { workerRequest } from '../workers/mainnet/request.mjs';
import { jobMac, jobMacMatches } from '../workers/mainnet/job-mac.mjs';
import { processPayment } from '../workers/mainnet/process.mjs';
import {
  DAILY_CAP_WHOLE, DAILY_WHOLE, GAUNTLET_PERFECT_WHOLE, GAUNTLET_REWARD_WHOLE, GEEK_DEPLOYMENT_HASH, GEEK_TICKER,
  MAINNET_PAYOUT_SENDER, PERFECT_GAUNTLET_WHOLE, PLAYER_DAILY_CAP_WHOLE, allowedRawAmounts, expectedRaw, quoteGeekReward, toRaw
} from '../workers/mainnet/schedule.mjs';

const token = 'e'.repeat(64);
const recipient = (() => {
  const key = new kaspa.PrivateKey('3'.padStart(64, '0'));
  try { return key.toAddress('mainnet').toString(); } finally { key.free(); }
})();
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let indexerPayload = null, beforeRedisCommand = null, afterRedisCommand = null;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target.includes('kasplex.org')) {
    if (!indexerPayload) throw new Error('mainnet payout test must not contact an indexer');
    return Response.json(indexerPayload(target));
  }
  assert.ok(target.startsWith(process.env.UPSTASH_REDIS_REST_URL), 'No production data or network sends');
  const values = JSON.parse(options.body);
  await beforeRedisCommand?.(values);
  const result = target.endsWith('/pipeline') ? (await fixture.commands(values)).map(item => ({ result: item }))
    : target.endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(item => ({ result: item }))
      : { result: await fixture.command(...values) };
  await afterRedisCommand?.(values);
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => {
  await fixture.command('FLUSHDB');
  delete process.env.MAINNET_PAYOUT_ENABLED;
  delete process.env.MAINNET_SIGNER_ENABLED;
  delete process.env.MAINNET_PAYOUT_WORKER_TOKEN;
  delete process.env.MAINNET_PAYOUT_JOB_HMAC;
  delete process.env.VERCEL_ENV;
  indexerPayload = null;
  beforeRedisCommand = null; afterRedisCommand = null;
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://redis.mainnet-payout.test', UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
    AUDIT_LOG_SECRET: 'synthetic-mainnet-payout-audit-32-characters'
  });
});

const call = async (handler, method, body = {}, cookie = '', query = {}, extra = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'content-type': 'application/json', 'x-forwarded-for': '192.0.2.10', 'user-agent': 'mainnet-payout-test', ...extra } }, res);
  return res;
};
const player = async () => (await call(sessionHandler, 'POST', { displayName: 'Mainnet payout fixture' })).headers['Set-Cookie'].split(';')[0];
const playerId = cookie => cookie.split('=')[1];
const play = (cookie, action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
const choice = (payload, correct) => {
  const question = loadQuestionBank('kaspa').questions.find(item => item.prompt === payload.question.prompt);
  const right = payload.question.options.indexOf(question.options[question.correctIndex]);
  return correct ? right : (right === 0 ? 1 : 0);
};
const answerRound = async (cookie, payload, correctAt = () => true) => {
  let current = payload;
  for (let i = 0; i < current.run.questionCount; i++) {
    const answered = await play(cookie, 'answer', { runId: current.run.id, questionToken: current.question.token, selectedIndex: choice(current, correctAt(i)) });
    assert.equal(answered.statusCode, 200, JSON.stringify(answered.body));
    if (i < current.run.questionCount - 1) current = (await play(cookie, 'next', { runId: current.run.id })).body;
    else current = answered.body;
  }
  return current;
};
const saveAddress = async (cookie) => {
  const id = playerId(cookie);
  const record = { schema: 1, playerId: id, version: 'a'.repeat(24), updatedAt: Date.now() - 10_000, authorizedBy: 'passkey',
    mainnetEligibleAt: Date.now() - 1000, mainnet: recipient, 'testnet-10': '' };
  await fixture.command('SET', rewardAddressKey(id), JSON.stringify(record));
};
const hmacSecret = 'cd'.repeat(32);
const enable = () => {
  process.env.MAINNET_PAYOUT_ENABLED = 'true';
  process.env.MAINNET_PAYOUT_WORKER_TOKEN = token;
  process.env.MAINNET_PAYOUT_JOB_HMAC = hmacSecret;
  process.env.VERCEL_ENV = 'production';
};
const jobs = async () => {
  const ids = await fixture.command('ZRANGE', payoutIndexKey, 0, -1);
  return Promise.all(ids.map(async id => JSON.parse(await fixture.command('GET', payoutJobKey(id)))));
};
const daySpend = async () => await fixture.command('GET', payoutDayKey(payoutDay()));

test('reward ladder, daily amount, and deployment pin match the current KRC-20 rules', () => {
  assert.deepEqual(GAUNTLET_PERFECT_WHOLE, ROUND_CONFIG.map(round => round.max));
  assert.equal(PERFECT_GAUNTLET_WHOLE, 46300);
  assert.equal(DAILY_WHOLE, 100);
  assert.equal(DAILY_CAP_WHOLE, 100_000);
  assert.equal(toRaw(DAILY_WHOLE), '10000000000');
  assert.deepEqual(GAUNTLET_REWARD_WHOLE, ROUND_CONFIG.map(round => round.reward));
  assert.equal(toRaw(GAUNTLET_PERFECT_WHOLE[9]), '1800000000000');
  assert.equal(expectedRaw({ kind: 'gauntlet', round: 1, correctCount: 7 }), toRaw(70));
  assert.equal(expectedRaw({ kind: 'gauntlet', round: 1, correctCount: 0 }), null);
  assert.equal(expectedRaw({ kind: 'gauntlet', round: 10, correctCount: 1 }), toRaw(1800));
  assert.equal(expectedRaw({ kind: 'gauntlet', round: 10, correctCount: 10 }), toRaw(18000));
  assert.equal(expectedRaw({ kind: 'gauntlet', round: 10, correct: 10, correctCount: 1 }), toRaw(1800));
  assert.equal(expectedRaw({ kind: 'daily', round: 1, correctCount: 1 }), toRaw(100));
  assert.equal(expectedRaw({ kind: 'daily', round: 1, correct: 5 }), null);
  for (const [index, reward] of GAUNTLET_REWARD_WHOLE.entries()) {
    for (let correct = 1; correct <= 10; correct += 1) assert.equal(allowedRawAmounts.includes(toRaw(reward * correct)), true, `round ${index + 1} x ${correct}`);
  }
  assert.equal(allowedRawAmounts.includes(toRaw(DAILY_WHOLE)), true);
  assert.equal(GEEK_TICKER, GEEK_DEPLOYMENT.ticker);
  assert.equal(GEEK_DEPLOYMENT_HASH, GEEK_DEPLOYMENT.deploymentHash);
  assert.equal(GEEK_DEPLOYMENT.protocol, 'KRC-20');
  assert.equal(GEEK_DEPLOYMENT.decimals, 8);
  assert.notEqual(MAINNET_PAYOUT_SENDER, GEEK_DEPLOYMENT.deployer);
  assert.equal(new kaspa.Address(MAINNET_PAYOUT_SENDER).toString(), MAINNET_PAYOUT_SENDER);
  const daily = { mode: 'daily', status: 'finished', completedRound: 1, round: 1, questionCount: 5, correct: 1, roundAnswers: [{ correct: true }, { correct: false }, { correct: false }, { correct: false }, { correct: false }] };
  assert.equal(quoteGeekReward(daily).raw, toRaw(100));
  assert.equal(quoteGeekReward({ ...daily, correct: 0, roundAnswers: daily.roundAnswers.map(() => ({ correct: false })) }), null);
  assert.equal(quoteGeekReward({ mode: 'speed', status: 'between-rounds', completedRound: 1, round: 1, questionCount: 10, roundAnswers: Array(10).fill({ correct: true }) }), null);
  const answers = correct => Array.from({ length: 10 }, (_, index) => ({ correct: index < correct }));
  for (const [index, reward] of GAUNTLET_REWARD_WHOLE.entries()) {
    const round = index + 1;
    const quote = quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: round, round, questionCount: 10, correct: 10, roundAnswers: answers(10) });
    assert.equal(quote.whole, reward * 10);
    assert.equal(quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: round, round, questionCount: 10, correct: 0, roundAnswers: answers(0) }), null);
    assert.equal(quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: round, round, questionCount: 10, correct: 7, roundAnswers: answers(7) }).whole, reward * 7);
    assert.equal(quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: round, round, questionCount: 10, correct: 10, correctCount: 10, amount: reward * 10, roundAnswers: answers(1) }), null);
  }
  const oneLast = quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: 10, round: 10, questionCount: 10, correct: 1, correctCount: 10, amount: 18000, roundAnswers: answers(1) });
  assert.equal(oneLast.whole, 1800);
  assert.equal(oneLast.correctCount, 1);
  assert.equal(oneLast.raw, toRaw(1800));
  const quote = quoteGeekReward(daily);
  assert.equal(earningId('a'.repeat(32), { id: 'b'.repeat(40) }, quote, Date.parse('2026-11-12T00:00:00Z')), earningId('a'.repeat(32), { id: 'c'.repeat(40) }, quote, Date.parse('2026-11-12T23:00:00Z')));
  assert.notEqual(earningId('a'.repeat(32), { id: 'b'.repeat(40) }, { kind: 'gauntlet', round: 1 }, 0), earningId('a'.repeat(32), { id: 'b'.repeat(40) }, { kind: 'gauntlet', round: 2 }, 0));
});

test('operational flags default off and cannot turn settlement eligibility on', () => {
  assert.deepEqual(mainnetPayoutFlags(), { settlementEligible: false, withdrawalsEnabled: false, payoutEnabled: false, signerEnabled: false });
  process.env.MAINNET_PAYOUT_ENABLED = 'true';
  process.env.MAINNET_SIGNER_ENABLED = 'true';
  const flags = mainnetPayoutFlags();
  assert.equal(flags.settlementEligible, false);
  assert.equal(flags.withdrawalsEnabled, false);
  const rewards = readFileSync(new URL('../api/rewards.js', import.meta.url), 'utf8');
  const example = readFileSync(new URL('../.env.example', import.meta.url), 'utf8');
  assert.match(rewards, /settlementEligible: false/);
  assert.match(rewards, /withdrawalsEnabled: false/);
  assert.match(example, /MAINNET_PAYOUT_ENABLED=false/);
  assert.match(example, /MAINNET_SIGNER_ENABLED=false/);
  assert.doesNotMatch(example, /MAINNET_SIGNER_PRIVATE_KEY\s*=\s*\S/);
  for (const name of readdirSync(new URL('../workers/mainnet/', import.meta.url))) {
    if (!name.endsWith('.mjs') && !name.endsWith('.js')) continue;
    const source = readFileSync(new URL(`../workers/mainnet/${name}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /(?:PRIVATE_KEY|SEED|MNEMONIC)\s*=\s*['"][^'"]+['"]/);
  }
});

test('scheduled mainnet signer stays paused unless production and the explicit flag are set', async () => {
  let runs = 0;
  const handler = createCronHandler(async () => { runs += 1; return 'idle'; });
  const secret = 'a'.repeat(64);
  const invoke = () => handler({ method: 'GET', headers: { authorization: `Bearer ${secret}` } }, { setHeader() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } });
  process.env.CRON_SECRET = secret;
  assert.equal((await invoke()).body.state, 'paused');
  process.env.MAINNET_SIGNER_ENABLED = 'true';
  assert.equal((await invoke()).body.state, 'paused');
  process.env.VERCEL_ENV = 'production';
  assert.equal((await invoke()).body.state, 'idle');
  assert.equal(runs, 1);
  delete process.env.CRON_SECRET;
});

test('the worker client calls the mainnet HQ route and a disabled worker does not claim', async () => {
  const previous = globalThis.fetch;
  let seen = '';
  globalThis.fetch = async (url) => { seen = String(url); return Response.json({ ok: true, busy: true }); };
  try {
    const request = workerRequest({ HQ_REWARD_ORIGIN: 'https://www.geekprotocol.xyz', MAINNET_PAYOUT_WORKER_TOKEN: token });
    assert.equal((await request({ action: 'claim' })).busy, true);
    assert.equal(seen, 'https://www.geekprotocol.xyz/api/session/?service=mainnet-worker');
  } finally { globalThis.fetch = previous; }
  const cookie = await player();
  process.env.MAINNET_PAYOUT_WORKER_TOKEN = token;
  assert.equal((await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` })).statusCode, 503);
  assert.equal((await call(sessionHandler, 'POST', { action: 'claim' }, cookie, { service: 'mainnet-worker' }, { authorization: `Bearer ${token}` })).statusCode, 401);
  enable();
  const claimed = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.body.job, null);
  assert.equal((await call(sessionHandler, 'POST', { action: 'release' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}`, lease: claimed.body.lease })).statusCode, 400);
  const released = await call(sessionHandler, 'POST', { action: 'release', lease: claimed.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(released.statusCode, 200);
});

test('flags off admit no mainnet job for a finished Daily', async () => {
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(cookie, result.body);
  const finished = await play(cookie, 'finish', { runId: result.run.id });
  assert.equal(finished.statusCode, 200);
  assert.deepEqual(await jobs(), []);
  assert.equal(await daySpend(), null);
});

test('one qualifying Daily pays 100 GEEK once, a retry does not, and the daily cap blocks the next payout', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(cookie, result.body, index => index === 0);
  const finished = await play(cookie, 'finish', { runId: result.run.id });
  assert.equal(finished.statusCode, 200);
  const admitted = await jobs();
  assert.equal(admitted.length, 1);
  assert.equal(admitted[0].amount, toRaw(100));
  assert.equal(admitted[0].ticker, 'GEEK');
  assert.equal(admitted[0].protocol, 'KRC-20');
  assert.equal(admitted[0].sender, MAINNET_PAYOUT_SENDER);
  assert.equal(admitted[0].recipient, recipient);
  assert.equal(admitted[0].state, 'queued');
  assert.equal(await fixture.command('GET', payoutEarnKey(admitted[0].id)), admitted[0].id);
  assert.equal(await daySpend(), toRaw(100));
  assert.equal(await fixture.command('GET', payoutPlayerDayKey(payoutDay(), playerId(cookie))), toRaw(100));
  assert.equal(await fixture.command('GET', payoutAddressDayKey(payoutDay(), recipient)), toRaw(100));
  assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200);
  assert.equal((await jobs()).length, 1);
  assert.equal(await daySpend(), toRaw(100));
  await fixture.command('FLUSHDB');
  const blocked = await player();
  await saveAddress(blocked);
  await fixture.command('SET', payoutDayKey(payoutDay()), (BigInt(toRaw(DAILY_CAP_WHOLE)) - 50n * 100_000_000n).toString());
  let again = await play(blocked, 'start', { mode: 'daily', category: 'kaspa' });
  again = await answerRound(blocked, again.body);
  assert.equal((await play(blocked, 'finish', { runId: again.run.id })).statusCode, 200);
  assert.deepEqual(await jobs(), []);
  const id = playerId(blocked);
  const quote = quoteGeekReward({ mode: 'daily', status: 'finished', completedRound: 1, round: 1, questionCount: 5, correct: 5, roundAnswers: Array(5).fill({ correct: true }) });
  const earn = await fixture.command('GET', payoutEarnKey(earningId(id, { id: again.run.id }, quote)));
  assert.equal(earn, 'not-paid');
  assert.equal(await daySpend(), (BigInt(toRaw(DAILY_CAP_WHOLE)) - 50n * 100_000_000n).toString());
});

test('Gauntlet pays reward times correct answers, and a zero-correct round pays nothing', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const missed = await answerRound(cookie, result.body, () => false);
  assert.equal(missed.roundResult.correct, 0);
  assert.deepEqual(await jobs(), []);
  await fixture.command('FLUSHDB');
  const seven = await player();
  await saveAddress(seven);
  result = await play(seven, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const partial = await answerRound(seven, result.body, index => index < 7);
  assert.equal(partial.roundResult.correct, 7);
  let admitted = await jobs();
  assert.equal(admitted.length, 1);
  assert.equal(admitted[0].amount, toRaw(70));
  assert.equal(admitted[0].proof.correctCount, 7);
  assert.equal(admitted[0].proof.correct, undefined);
  assert.notEqual(admitted[0].amount, toRaw(100));
  const repeated = await play(seven, 'answer', { runId: partial.run.id, questionToken: partial.questionToken, selectedIndex: 0 });
  assert.equal(repeated.statusCode, 200);
  assert.equal((await jobs()).length, 1);
  await fixture.command('FLUSHDB');
  const next = await player();
  await saveAddress(next);
  result = await play(next, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const perfect = await answerRound(next, result.body, () => true);
  assert.equal((await jobs())[0].amount, toRaw(100));
  result = await play(next, 'continue', { runId: perfect.run.id });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  await answerRound(next, result.body, () => false);
  assert.equal((await jobs()).length, 1);
  await fixture.command('FLUSHDB');
  const second = await player();
  await saveAddress(second);
  result = await play(second, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const first = await answerRound(second, result.body, () => true);
  result = await play(second, 'continue', { runId: first.run.id });
  await answerRound(second, result.body, index => index === 0);
  admitted = await jobs();
  assert.deepEqual(admitted.map(job => job.amount).sort(), [toRaw(20), toRaw(100)].sort());
  assert.equal(await daySpend(), (BigInt(toRaw(100)) + BigInt(toRaw(20))).toString());
});

test('one correct answer in round 10 pays 1800 and the perfect maximum is not substitutable', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'gauntlet', category: 'kaspa' });
  for (let round = 1; round <= 9; round += 1) {
    const finished = await answerRound(cookie, result.body, () => true);
    assert.equal(finished.roundResult.correct, 10);
    if (round < 9) {
      result = await play(cookie, 'continue', { runId: finished.run.id });
      assert.equal(result.statusCode, 200, JSON.stringify(result.body));
    } else result = { body: finished };
  }
  const continued = await play(cookie, 'continue', { runId: result.body.run.id });
  assert.equal(continued.statusCode, 200, JSON.stringify(continued.body));
  const last = await answerRound(cookie, continued.body, index => index === 0);
  assert.equal(last.roundResult.correct, 1);
  const amounts = (await jobs()).map(job => job.amount);
  assert.equal(amounts.filter(amount => amount === toRaw(1800)).length, 1);
  assert.equal(amounts.includes(toRaw(18000)), false);
  const lastJob = (await jobs()).find(job => job.proof.round === 10);
  assert.equal(lastJob.proof.correctCount, 1);
  assert.equal(lastJob.amount, toRaw(1800));
});

test('player and receiving-address caps block a payout without blocking the saved result', async () => {
  enable();
  const under = (BigInt(toRaw(PLAYER_DAILY_CAP_WHOLE)) - 50n * 100_000_000n).toString();
  for (const key of [payoutPlayerDayKey(payoutDay(), ''), payoutAddressDayKey(payoutDay(), recipient)]) {
    await fixture.command('FLUSHDB');
    const cookie = await player();
    await saveAddress(cookie);
    const spendKey = key || payoutPlayerDayKey(payoutDay(), playerId(cookie));
    if (key.endsWith(':')) await fixture.command('SET', payoutPlayerDayKey(payoutDay(), playerId(cookie)), under);
    else await fixture.command('SET', key, under);
    let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
    result = await answerRound(cookie, result.body);
    assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200);
    assert.deepEqual(await jobs(), []);
    assert.equal(await daySpend(), null);
  }
});

test('the outstanding-job ceiling shrinks when a job leaves the active index', async () => {
  enable();
  await fixture.command('EVAL', `
local n = tonumber(ARGV[1])
for i = 1, n do
  redis.call('ZADD', KEYS[1], 1, string.format('%064x', i))
end
return redis.call('ZCARD', KEYS[1])`, 1, payoutIndexKey, String(PAYOUT_INDEX_CEILING));
  const blocked = await player();
  await saveAddress(blocked);
  let result = await play(blocked, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(blocked, result.body);
  assert.equal((await play(blocked, 'finish', { runId: result.run.id })).statusCode, 200);
  const quote = quoteGeekReward({ mode: 'daily', status: 'finished', completedRound: 1, round: 1, questionCount: 5, correct: 5, roundAnswers: Array(5).fill({ correct: true }) });
  assert.equal(await fixture.command('GET', payoutEarnKey(earningId(playerId(blocked), result.run, quote))), 'not-paid');
  await fixture.command('DEL', payoutIndexKey);
  const next = await player();
  await saveAddress(next);
  result = await play(next, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(next, result.body);
  assert.equal((await play(next, 'finish', { runId: result.run.id })).statusCode, 200);
  assert.equal((await jobs()).length, 1);
});

test('preview and a missing worker token do not admit a job or fail the saved answer', async () => {
  process.env.MAINNET_PAYOUT_ENABLED = 'true';
  process.env.MAINNET_PAYOUT_WORKER_TOKEN = token;
  process.env.MAINNET_PAYOUT_JOB_HMAC = 'ab'.repeat(32);
  process.env.VERCEL_ENV = 'preview';
  const preview = await player();
  await saveAddress(preview);
  let result = await play(preview, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(preview, result.body);
  assert.equal((await play(preview, 'finish', { runId: result.run.id })).statusCode, 200);
  assert.deepEqual(await jobs(), []);
  process.env.VERCEL_ENV = 'production';
  delete process.env.MAINNET_PAYOUT_WORKER_TOKEN;
  const missing = await player();
  await saveAddress(missing);
  result = await play(missing, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(missing, result.body);
  assert.equal((await play(missing, 'finish', { runId: result.run.id })).statusCode, 200);
  assert.deepEqual(await jobs(), []);
});

test('a journal that never confirms is removed from the active queue without a second payment', async () => {
  enable();
  const first = await player();
  await saveAddress(first);
  let result = await play(first, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(first, result.body);
  assert.equal((await play(first, 'finish', { runId: result.run.id })).statusCode, 200);
  const older = (await jobs())[0];
  const journal = { commit: { id: 'b'.repeat(64), transaction: 'c'.repeat(80) }, reveal: { id: 'd'.repeat(64), transaction: 'e'.repeat(80) } };
  older.state = 'prepared';
  older.journal = journal;
  older.transactionHash = journal.reveal.id;
  older.preparedAt = Date.now() - STUCK_AFTER_MS - 5000;
  delete older.submittedAt;
  await fixture.command('SET', payoutJobKey(older.id), JSON.stringify(older));
  await fixture.command('ZADD', payoutIndexKey, '1', older.id);
  const info = console.info;
  const events = [];
  console.info = (...args) => { events.push(args.map(String).join(' ')); };
  const stillPrepared = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(stillPrepared.body.job.id, older.id);
  assert.equal(stillPrepared.body.job.state, 'prepared');
  await call(sessionHandler, 'POST', { action: 'release', lease: stillPrepared.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  older.submittedAt = Date.now() - STUCK_AFTER_MS - 1000;
  older.state = 'awaiting-indexer';
  await fixture.command('SET', payoutJobKey(older.id), JSON.stringify(older));
  const second = await player();
  await saveAddress(second);
  result = await play(second, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(second, result.body);
  assert.equal((await play(second, 'finish', { runId: result.run.id })).statusCode, 200);
  const claimed = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.body.job.state, 'queued');
  assert.notEqual(claimed.body.job.id, older.id);
  const stuck = JSON.parse(await fixture.command('GET', payoutJobKey(older.id)));
  assert.equal(stuck.state, 'stuck');
  assert.deepEqual(stuck.journal, journal);
  assert.equal(await fixture.command('GET', payoutEarnKey(older.id)), older.id);
  assert.equal((await fixture.command('ZRANGE', payoutIndexKey, 0, -1)).includes(older.id), false);
  const rejected = await call(sessionHandler, 'POST', { action: 'prepare', lease: claimed.body.lease, id: older.id, version: stuck.version, journal }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(rejected.statusCode, 409);
  assert.deepEqual(JSON.parse(await fixture.command('GET', payoutJobKey(older.id))).journal, journal);
  assert.equal((await fixture.command('ZRANGE', payoutStuckKey, 0, -1)).includes(older.id), true);
  assert.match(events.join('\n'), /"code":"PAYOUT_UNCONFIRMED"/);
  console.info = info;
  indexerPayload = (url) => {
    if (String(url).includes(`/op/${journal.reveal.id}`)) return { message: 'successful', result: [{ p: 'KRC-20', op: 'transfer', hashRev: journal.reveal.id, tick: 'GEEK', from: MAINNET_PAYOUT_SENDER, to: recipient, amt: stuck.amount, mtsAdd: String(Date.now()), txAccept: '1', opAccept: '1', opScore: '1', checkpoint: 'ab'.repeat(32) }] };
    return { message: 'successful', result: [{ tick: 'GEEK', state: 'deployed', hashRev: GEEK_DEPLOYMENT_HASH, dec: '8', p: 'KRC-20', op: 'deploy', txAccept: '1', opAccept: '1' }] };
  };
  const confirmed = await call(sessionHandler, 'POST', { action: 'check', lease: claimed.body.lease, id: older.id, version: stuck.version }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(confirmed.statusCode, 200, JSON.stringify(confirmed.body));
  assert.equal(confirmed.body.job.state, 'indexed-confirmed');
  assert.deepEqual(confirmed.body.job.journal, journal);
  assert.equal((await fixture.command('ZRANGE', payoutStuckKey, 0, -1)).includes(older.id), false);
  await call(sessionHandler, 'POST', { action: 'release', lease: claimed.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
});

test('ranked starts share one 20-per-hour budget for an IP across User-Agent changes', async () => {
  const start = (cookie, ip, agent) => call(rankedHandler, 'POST', { action: 'start', mode: 'gauntlet', category: 'kaspa' }, cookie, {}, { 'x-forwarded-for': ip, 'user-agent': agent });
  const cookie = await player();
  const statuses = [];
  for (let i = 0; i < 21; i += 1) statuses.push((await start(cookie, '198.51.100.20', `agent-${i}`)).statusCode);
  assert.equal(statuses.filter(status => status === 201).length, 20);
  assert.equal(statuses[20], 429);
  const other = await player();
  assert.equal((await start(other, '198.51.100.21', 'agent-0')).statusCode, 201);
});

test('a production HMAC binds amount, address, and earning id, and a preview secret is not payable', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(cookie, result.body);
  assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200);
  const real = (await jobs())[0];
  assert.equal(jobMacMatches(real, hmacSecret), true);
  assert.equal(jobMacMatches(real, 'ab'.repeat(32)), false);
  assert.equal(jobMacMatches({ ...real, mac: undefined }, hmacSecret), false);
  const forged = { ...real, id: 'f'.repeat(64), amount: toRaw(18000), mac: real.mac };
  await fixture.command('SET', payoutJobKey(forged.id), JSON.stringify(forged));
  await fixture.command('ZADD', payoutIndexKey, '1', forged.id);
  const claimed = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(claimed.statusCode, 200);
  assert.equal(claimed.body.job.id, real.id);
  assert.equal((await fixture.command('ZRANGE', payoutIndexKey, 0, -1)).includes(forged.id), false);
  assert.equal((await fixture.command('ZRANGE', payoutQuarantineKey, 0, -1)).includes(forged.id), true);
  assert.equal(await fixture.command('GET', payoutJobKey(forged.id)), JSON.stringify(forged));
  await call(sessionHandler, 'POST', { action: 'release', lease: claimed.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  const broken = { ...real, proof: { ...real.proof, runId: 'ab'.repeat(20) } };
  await fixture.command('SET', payoutJobKey(real.id), JSON.stringify(broken));
  const events = [];
  const info = console.info;
  console.info = (...args) => { events.push(args.map(String).join(' ')); };
  const held = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  console.info = info;
  assert.equal(held.body.job, null);
  assert.match(events.join('\n'), /"code":"PAYOUT_MAC_INVALID"/);
  assert.equal(await fixture.command('GET', payoutEarnKey(real.id)), real.id);
  assert.equal(await fixture.command('GET', payoutJobKey(real.id)), JSON.stringify(broken));
  await call(sessionHandler, 'POST', { action: 'release', lease: held.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  let prepared = 0;
  await assert.rejects(() => processPayment({
    request: async () => ({ lease: 'a'.repeat(24), job: forged, config: {} }),
    signer: { verify() { prepared += 1; }, prepare() { prepared += 1; }, submit() { prepared += 1; } }
  }), /JOB_MAC_INVALID/);
  assert.equal(prepared, 0);
  delete process.env.MAINNET_PAYOUT_JOB_HMAC;
  const unsigned = await player();
  await saveAddress(unsigned);
  result = await play(unsigned, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(unsigned, result.body);
  assert.equal((await play(unsigned, 'finish', { runId: result.run.id })).statusCode, 200);
  assert.equal((await jobs()).some(job => job.playerId === playerId(unsigned)), false);
});

test('cap changes do not alter the job fingerprint, and asset identity changes do', () => {
  enable();
  const config = mainnetPayoutConfig();
  assert.equal(payoutIdentityFingerprint({ ...config, dailyCapRaw: '1', playerCapRaw: '2', addressCapRaw: '3' }), config.fingerprint);
  assert.notEqual(payoutIdentityFingerprint({ ...config, ticker: 'GEEKT' }), config.fingerprint);
  assert.notEqual(payoutIdentityFingerprint({ ...config, sender: recipient }), config.fingerprint);
  assert.notEqual(payoutIdentityFingerprint({ ...config, decimals: '7' }), config.fingerprint);
  assert.notEqual(payoutIdentityFingerprint({ ...config, network: 'testnet-10' }), config.fingerprint);
  assert.notEqual(payoutIdentityFingerprint({ ...config, deploymentHash: 'b'.repeat(64) }), config.fingerprint);
});

test('the job mac changes when any proof field changes', () => {
  const base = { id: 'a'.repeat(64), amount: toRaw(1800), recipient, sender: MAINNET_PAYOUT_SENDER, playerId: 'b'.repeat(32), network: 'mainnet', protocol: 'KRC-20', ticker: 'GEEK', decimals: '8', deploymentHash: 'c'.repeat(64), configFingerprint: 'd'.repeat(64), proof: { kind: 'gauntlet', round: 10, correctCount: 1, runId: 'e'.repeat(40) } };
  const original = jobMac(base, hmacSecret);
  for (const [field, value] of [['kind', 'daily'], ['round', 9], ['correctCount', 10], ['runId', 'f'.repeat(40)]]) {
    assert.notEqual(jobMac({ ...base, proof: { ...base.proof, [field]: value } }, hmacSecret), original, field);
  }
  assert.notEqual(jobMac({ ...base, amount: toRaw(18000) }, hmacSecret), original);
  assert.notEqual(jobMac({ ...base, recipient: 'kaspa:other' }, hmacSecret), original);
  assert.notEqual(jobMac({ ...base, sender: 'kaspa:other' }, hmacSecret), original);
  assert.notEqual(jobMac({ ...base, playerId: 'c'.repeat(32) }, hmacSecret), original);
  assert.notEqual(jobMac({ ...base, id: '1'.repeat(64) }, hmacSecret), original);
  assert.notEqual(jobMac({ ...base, ticker: 'GEEKT' }, hmacSecret), original);
});

test('a queued copy of an already signed job is quarantined and cannot be signed again', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
  result = await answerRound(cookie, result.body);
  assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200);
  const queued = structuredClone((await jobs())[0]);
  const claim = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  const journal = { commit: { id: 'b'.repeat(64), transaction: 'c'.repeat(80) }, reveal: { id: 'd'.repeat(64), transaction: 'e'.repeat(80) } };
  indexerPayload = () => ({ message: 'successful', result: [{ tick: 'GEEK', state: 'deployed', hashRev: GEEK_DEPLOYMENT_HASH, dec: '8', p: 'KRC-20', op: 'deploy', txAccept: '1', opAccept: '1' }] });
  const prepared = await call(sessionHandler, 'POST', { action: 'prepare', lease: claim.body.lease, id: queued.id, version: queued.version, journal }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.equal(prepared.statusCode, 200, JSON.stringify(prepared.body));
  await call(sessionHandler, 'POST', { action: 'release', lease: claim.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  await fixture.command('SET', payoutJobKey(queued.id), JSON.stringify(queued));
  await fixture.command('ZADD', payoutIndexKey, '1', queued.id);
  const events = [];
  const info = console.info;
  console.info = (...args) => { events.push(args.map(String).join(' ')); };
  const again = await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  console.info = info;
  assert.equal(again.statusCode, 200);
  assert.equal(again.body.job, null);
  assert.match(events.join('\n'), /"code":"PAYOUT_ALREADY_SIGNED"/);
  assert.equal((await fixture.command('ZRANGE', payoutQuarantineKey, 0, -1)).includes(queued.id), true);
  assert.equal(await fixture.command('GET', payoutEarnKey(queued.id)), queued.id);
  assert.equal(await fixture.command('HGET', payoutSignedKey, queued.id), journal.reveal.id);
  const otherJournal = { commit: { id: '1'.repeat(64), transaction: 'c'.repeat(80) }, reveal: { id: '2'.repeat(64), transaction: 'e'.repeat(80) } };
  const rejected = await call(sessionHandler, 'POST', { action: 'prepare', lease: again.body.lease, id: queued.id, version: queued.version, journal: otherJournal }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  assert.notEqual(rejected.statusCode, 200);
  assert.equal(JSON.parse(await fixture.command('GET', payoutJobKey(queued.id))).journal, undefined);
  let signed = 0;
  await assert.rejects(() => processPayment({
    request: async () => ({ lease: 'a'.repeat(24), job: queued, config: {}, signedReveal: journal.reveal.id }),
    signer: { prepare() { signed += 1; }, verify() { signed += 1; }, submit() { signed += 1; } }
  }), /JOB_ALREADY_SIGNED/);
  assert.equal(signed, 0);
  await call(sessionHandler, 'POST', { action: 'release', lease: again.body.lease }, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
});


test('journal preparation is recoverable across rejected writes and lost acknowledgments', async () => {
  for (const failure of ['before-write', 'lost-response', 'expired-lease', 'changed-job', 'conflicting-marker', 'invalid-marker-type']) {
    await fixture.command('FLUSHDB'); enable();
    const cookie = await player(); await saveAddress(cookie);
    let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
    result = await answerRound(cookie, result.body);
    assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200);
    const queued = (await jobs())[0];
    const worker = body => call(sessionHandler, 'POST', body, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
    const claim = await worker({ action: 'claim' }); assert.equal(claim.statusCode, 200);
    const journal = { commit: { id: 'b'.repeat(64), transaction: 'c'.repeat(80) }, reveal: { id: 'd'.repeat(64), transaction: 'e'.repeat(80) } };
    indexerPayload = () => ({ message: 'successful', result: [{ tick: 'GEEK', state: 'deployed', hashRev: GEEK_DEPLOYMENT_HASH, dec: '8', p: 'KRC-20', op: 'deploy', txAccept: '1', opAccept: '1' }] });
    const prepareCommand = values => values[0] === 'EVAL' && values[1].startsWith('-- geek-mainnet-payout-prepare-v1');
    beforeRedisCommand = async values => {
      if (!prepareCommand(values)) return;
      if (failure === 'before-write') throw new Error('Synthetic request not delivered');
      if (failure === 'expired-lease') await fixture.command('DEL', 'geek:mainnet-payout:sender-lease:v1');
      if (failure === 'changed-job') await fixture.command('SET', payoutJobKey(queued.id), JSON.stringify({ ...queued, version: 'f'.repeat(24) }));
      if (failure === 'conflicting-marker') await fixture.command('HSET', payoutSignedKey, queued.id, 'f'.repeat(64));
      if (failure === 'invalid-marker-type') await fixture.command('SET', payoutSignedKey, 'synthetic-wrong-type');
    };
    afterRedisCommand = values => {
      if (failure === 'lost-response' && prepareCommand(values)) throw new Error('Synthetic response lost after commit');
    };
    let prepared;
    try { prepared = await worker({ action: 'prepare', lease: claim.body.lease, id: queued.id, version: queued.version, journal }); }
    finally { beforeRedisCommand = null; afterRedisCommand = null; }
    assert.ok(prepared.statusCode >= 400, failure);
    const saved = JSON.parse(await fixture.command('GET', payoutJobKey(queued.id)));
    if (failure === 'lost-response') {
      assert.equal(saved.state, 'prepared'); assert.deepEqual(saved.journal, journal);
      assert.equal(await fixture.command('HGET', payoutSignedKey, queued.id), journal.reveal.id);
    } else {
      assert.equal(saved.state, 'queued'); assert.equal(saved.journal, undefined);
      if (failure === 'invalid-marker-type') assert.equal(await fixture.command('GET', payoutSignedKey), 'synthetic-wrong-type');
      else assert.equal(await fixture.command('HGET', payoutSignedKey, queued.id), failure === 'conflicting-marker' ? 'f'.repeat(64) : null);
    }
    assert.equal(await fixture.command('GET', payoutEarnKey(queued.id)), queued.id);
    await worker({ action: 'release', lease: claim.body.lease });
    if (['conflicting-marker', 'invalid-marker-type'].includes(failure)) continue;
    const retry = await worker({ action: 'claim' }); assert.equal(retry.statusCode, 200);
    assert.equal(retry.body.job.id, queued.id);
    assert.deepEqual(await fixture.command('ZRANGE', payoutQuarantineKey, 0, -1), []);
    if (failure === 'lost-response') {
      assert.deepEqual(retry.body.job.journal, journal);
      const replacement = { ...journal, reveal: { ...journal.reveal, id: 'a'.repeat(64) } };
      const rejected = await worker({ action: 'prepare', lease: retry.body.lease, id: queued.id, version: retry.body.job.version, journal: replacement });
      assert.equal(rejected.statusCode, 409);
      assert.deepEqual(JSON.parse(await fixture.command('GET', payoutJobKey(queued.id))).journal, journal);
    } else {
      const retried = await worker({ action: 'prepare', lease: retry.body.lease, id: queued.id, version: retry.body.job.version, journal });
      assert.equal(retried.statusCode, 200, failure);
      assert.deepEqual(retried.body.job.journal, journal);
    }
    await worker({ action: 'release', lease: retry.body.lease });
  }
});

test('a stuck mark commits the job and stuck list together or not at all', async () => {
  const info = console.info;
  const events = [];
  console.info = (...args) => { events.push(args.map(String).join(' ')); };
  const worker = body => call(sessionHandler, 'POST', body, '', { service: 'mainnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
  try {
    for (const failure of ['committed', 'rejected', 'wrong-type']) {
      await fixture.command('FLUSHDB');
      enable();
      events.length = 0;
      const cookie = await player();
      await saveAddress(cookie);
      let result = await play(cookie, 'start', { mode: 'daily', category: 'kaspa' });
      result = await answerRound(cookie, result.body);
      assert.equal((await play(cookie, 'finish', { runId: result.run.id })).statusCode, 200, failure);
      const queued = (await jobs())[0];
      const journal = { commit: { id: 'b'.repeat(64), transaction: 'c'.repeat(80) }, reveal: { id: 'd'.repeat(64), transaction: 'e'.repeat(80) } };
      const awaiting = {
        ...queued, state: 'awaiting-indexer', journal, transactionHash: journal.reveal.id,
        preparedAt: Date.now() - STUCK_AFTER_MS - 5000, submittedAt: Date.now() - STUCK_AFTER_MS - 1000
      };
      await fixture.command('SET', payoutJobKey(awaiting.id), JSON.stringify(awaiting));
      if (failure === 'wrong-type') await fixture.command('SET', payoutStuckKey, 'synthetic-wrong-type');
      const prior = await fixture.command('GET', payoutJobKey(awaiting.id));
      const seen = [];
      beforeRedisCommand = async values => {
        if (!Array.isArray(values) || Array.isArray(values[0])) return;
        seen.push(values);
        if (failure === 'rejected' && values[0] === 'EVAL' && String(values[1]).startsWith('-- geek-mainnet-payout-update-v1')) throw new Error('Synthetic stuck update not delivered');
      };
      let claimed;
      try { claimed = await worker({ action: 'claim' }); }
      finally { beforeRedisCommand = null; }
      const saved = await fixture.command('GET', payoutJobKey(awaiting.id));
      const update = seen.filter(values => values[0] === 'EVAL' && String(values[1]).startsWith('-- geek-mainnet-payout-update-v1'));
      assert.equal(update.length, 1, failure);
      const script = String(update[0][1]);
      const typeAt = script.indexOf("redis.call('TYPE', KEYS[4])");
      const setAt = script.indexOf("redis.call('SET', KEYS[1], ARGV[2])");
      const zaddAt = script.indexOf("redis.call('ZADD', KEYS[4], ARGV[6], ARGV[5])");
      assert.ok(typeAt > 0 && typeAt < setAt && setAt < zaddAt, failure);
      assert.equal(update[0][6], payoutStuckKey);
      assert.deepEqual(seen.filter(values => values[0] === 'ZADD' && values[1] === payoutStuckKey), []);
      if (failure === 'committed') {
        assert.equal(claimed.statusCode, 200, JSON.stringify(claimed.body));
        const stuck = JSON.parse(saved);
        assert.equal(stuck.state, 'stuck');
        assert.deepEqual(stuck.journal, journal);
        assert.equal((await fixture.command('ZRANGE', payoutStuckKey, 0, -1)).includes(awaiting.id), true);
        assert.equal((await fixture.command('ZRANGE', payoutIndexKey, 0, -1)).includes(awaiting.id), false);
        assert.equal(await fixture.command('GET', payoutEarnKey(awaiting.id)), awaiting.id);
        assert.match(events.join('\n'), /"code":"PAYOUT_UNCONFIRMED"/);
        assert.equal(update[0].at(-1), String(stuck.stuckAt));
      } else {
        assert.equal(claimed.statusCode, 503, `${failure} ${claimed.statusCode} ${JSON.stringify(claimed.body)}`);
        assert.equal(saved, prior, failure);
        assert.equal(JSON.parse(saved).state, 'awaiting-indexer');
        assert.equal((await fixture.command('ZRANGE', payoutIndexKey, 0, -1)).includes(awaiting.id), true);
        assert.doesNotMatch(events.join('\n'), /PAYOUT_UNCONFIRMED/);
        if (failure === 'wrong-type') {
          assert.equal(await fixture.command('TYPE', payoutStuckKey), 'string');
          assert.equal(await fixture.command('GET', payoutStuckKey), 'synthetic-wrong-type');
        } else assert.deepEqual(await fixture.command('ZRANGE', payoutStuckKey, 0, -1), []);
      }
    }
  } finally {
    console.info = info;
    beforeRedisCommand = null;
  }
});
