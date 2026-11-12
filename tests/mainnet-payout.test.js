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
  earningId, mainnetPayoutFlags, payoutDay, payoutDayKey, payoutEarnKey, payoutIndexKey, payoutJobKey
} from '../server/mainnet-payout.js';
import { createCronHandler } from '../workers/mainnet/cron.mjs';
import { workerRequest } from '../workers/mainnet/request.mjs';
import {
  DAILY_CAP_WHOLE, DAILY_WHOLE, GAUNTLET_PERFECT_WHOLE, GEEK_DEPLOYMENT_HASH, GEEK_TICKER, MAINNET_PAYOUT_SENDER,
  PERFECT_GAUNTLET_WHOLE, quoteGeekReward, toRaw
} from '../workers/mainnet/schedule.mjs';

const token = 'e'.repeat(64);
const recipient = (() => {
  const key = new kaspa.PrivateKey('3'.padStart(64, '0'));
  try { return key.toAddress('mainnet').toString(); } finally { key.free(); }
})();
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  const target = String(url);
  if (target.includes('kasplex.org')) throw new Error('mainnet payout test must not contact an indexer');
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
  Object.assign(process.env, {
    UPSTASH_REDIS_REST_URL: 'https://redis.mainnet-payout.test', UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
    AUDIT_LOG_SECRET: 'synthetic-mainnet-payout-audit-32-characters'
  });
});

const call = async (handler, method, body = {}, cookie = '', query = {}, extra = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'content-type': 'application/json', ...extra } }, res);
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
const enable = () => { process.env.MAINNET_PAYOUT_ENABLED = 'true'; process.env.MAINNET_PAYOUT_WORKER_TOKEN = token; };
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
  assert.equal(toRaw(GAUNTLET_PERFECT_WHOLE[9]), '1800000000000');
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
  for (const [index, whole] of GAUNTLET_PERFECT_WHOLE.entries()) {
    const round = index + 1;
    const quote = quoteGeekReward({ mode: 'gauntlet', status: 'between-rounds', completedRound: round, round, questionCount: 10, correct: 1, roundAnswers: Array(10).fill({ correct: false }) });
    assert.equal(quote.whole, whole);
    assert.equal(quote.raw, toRaw(whole));
  }
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

test('a finished Gauntlet round pays the ladder once, not the per-answer amount', async () => {
  enable();
  const cookie = await player();
  await saveAddress(cookie);
  let result = await play(cookie, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const partial = await answerRound(cookie, result.body, index => index === 0);
  assert.equal(partial.roundResult.correct, 1);
  let admitted = await jobs();
  assert.equal(admitted.length, 1);
  assert.equal(admitted[0].amount, toRaw(100));
  assert.notEqual(admitted[0].amount, toRaw(10));
  const repeated = await play(cookie, 'answer', { runId: partial.run.id, questionToken: partial.questionToken, selectedIndex: 0 });
  assert.equal(repeated.statusCode, 200);
  assert.equal((await jobs()).length, 1);
  await fixture.command('FLUSHDB');
  const next = await player();
  await saveAddress(next);
  result = await play(next, 'start', { mode: 'gauntlet', category: 'kaspa' });
  const perfect = await answerRound(next, result.body, () => true);
  result = await play(next, 'continue', { runId: perfect.run.id });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  await answerRound(next, result.body, () => false);
  admitted = await jobs();
  assert.equal(admitted.length, 2);
  assert.deepEqual(admitted.map(job => job.amount).sort(), [toRaw(100), toRaw(200)].sort());
  assert.equal(await daySpend(), (BigInt(toRaw(100)) + BigInt(toRaw(200))).toString());
  assert.equal(admitted.every(job => job.sender === MAINNET_PAYOUT_SENDER && job.recipient === recipient), true);
});
