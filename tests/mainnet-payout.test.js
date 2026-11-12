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
  PAYOUT_INDEX_CEILING, STUCK_AFTER_MS, earningId, mainnetPayoutFlags, payoutAddressDayKey, payoutDay, payoutDayKey,
  payoutEarnKey, payoutIndexKey, payoutJobKey, payoutPlayerDayKey
} from '../server/mainnet-payout.js';
import { createCronHandler } from '../workers/mainnet/cron.mjs';
import { workerRequest } from '../workers/mainnet/request.mjs';
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
let indexerPayload = null;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target.includes('kasplex.org')) {
    if (!indexerPayload) throw new Error('mainnet payout test must not contact an indexer');
    return Response.json(indexerPayload(target));
  }
  assert.ok(target.startsWith(process.env.UPSTASH_REDIS_REST_URL), 'No production data or network sends');
  const values = JSON.parse(options.body);
  const result = target.endsWith('/pipeline') ? (await fixture.commands(values)).map(item => ({ result: item }))
    : target.endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(item => ({ result: item }))
      : { result: await fixture.command(...values) };
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => {
  await fixture.command('FLUSHDB');
  delete process.env.MAINNET_PAYOUT_ENABLED;
  delete process.env.MAINNET_SIGNER_ENABLED;
  delete process.env.MAINNET_PAYOUT_WORKER_TOKEN;
  delete process.env.VERCEL_ENV;
  indexerPayload = null;
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
const enable = () => { process.env.MAINNET_PAYOUT_ENABLED = 'true'; process.env.MAINNET_PAYOUT_WORKER_TOKEN = token; process.env.VERCEL_ENV = 'production'; };
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
  older.preparedAt = Date.now() - STUCK_AFTER_MS - 1000;
  await fixture.command('SET', payoutJobKey(older.id), JSON.stringify(older));
  await fixture.command('ZADD', payoutIndexKey, '1', older.id);
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
