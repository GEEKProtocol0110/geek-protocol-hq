import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import operations from '../server/operations.js';
import { loadQuestionBank } from '../server/questions.js';
import { testnetConfig, testnetRewardKey, testnetRewardIndex } from '../server/testnet-rewards.js';
const wallet = n => { const k = new kaspa.PrivateKey(n.toString(16).padStart(64, '0')), a = k.toAddress('testnet'); try { return a.toString(); } finally { a.free(); k.free(); } };
const sender = wallet(6), recipient = wallet(3), deploymentHash = 'a'.repeat(64), tx = 'b'.repeat(64);
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.testnet-pilot.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-testnet-token';
process.env.AUDIT_LOG_SECRET = 'synthetic-testnet-audit-key-32-characters';
process.env.CCE_ADMIN_TOKEN = 'synthetic-testnet-cce-key-32-characters';
process.env.PAYOUT_REVIEW_ADMIN_TOKEN = 'synthetic-testnet-payout-key-32-characters';
delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_TOTP_SECRET;
let observation = null, assetState = 'deployed', upstreamCalls = [], beforeQueue = null;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://tn10api.kasplex.org/v1/krc20/')) {
    upstreamCalls.push(String(url));
    const row = String(url).endsWith('token/GEEK') ? { tick: 'GEEK', hashRev: deploymentHash, state: assetState, dec: '8' } : String(url).endsWith(`op/${deploymentHash}`) ? { p: 'KRC-20', op: 'deploy', tick: 'GEEK', hashRev: deploymentHash, dec: '8', txAccept: '1', opAccept: '1' } : observation;
    return Response.json({ message: 'successful', result: row ? [row] : [] });
  }
  assert.ok(String(url).startsWith('https://redis.testnet-pilot.test'), 'No Mainnet endpoint, signer or production data in these fixtures');
  const values = JSON.parse(options.body);
  if (values[0] === 'EVAL' && values[1].includes('geek-testnet-queue-v1') && beforeQueue) { const hook = beforeQueue; beforeQueue = null; await hook(values); }
  const result = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result })) : String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => {
  await fixture.command('FLUSHDB'); observation = null; assetState = 'deployed'; upstreamCalls = []; beforeQueue = null;
  Object.assign(process.env, { TESTNET_REWARDS_ENABLED: 'true', TESTNET_REWARDS_NETWORK: 'testnet-10', TESTNET_REWARDS_TICKER: 'GEEK', TESTNET_REWARDS_DEPLOYMENT_HASH: deploymentHash, TESTNET_REWARDS_DECIMALS: '8', TESTNET_REWARDS_SENDER: sender, TESTNET_REWARDS_AMOUNT_RAW: '100000000' });
});
const call = async (handler, method, body = {}, cookie = '', query = {}, headers = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'content-type': 'application/json', ...headers } }, res); return res;
};
const ops = (method, body = {}, cookie = '', headers = {}) => call(operations, method, body, cookie, { action: 'testnet' }, headers);
const login = async () => (await call(operations, 'POST', { key: process.env.CCE_ADMIN_TOKEN }, '', { action: 'login' })).headers['Set-Cookie'].split(';')[0];
const play = (cookie, action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
const finished = async () => {
  const player = (await call(sessionHandler, 'POST', { displayName: 'Pilot Fixture' })).headers['Set-Cookie'].split(';')[0];
  let payload = (await play(player, 'start', { mode: 'daily', category: 'kaspa' })).body;
  const runId = payload.run.id;
  for (let n = 0; n < 5; n++) {
    const q = loadQuestionBank('kaspa').questions.find(q => q.prompt === payload.question.prompt);
    const answer = await play(player, 'answer', { runId, questionToken: payload.question.token, selectedIndex: payload.question.options.indexOf(q.options[q.correctIndex]) }); assert.equal(answer.statusCode, 200);
    if (n < 4) payload = (await play(player, 'next', { runId })).body;
  }
  assert.equal((await play(player, 'finish', { runId })).statusCode, 200);
  return { player, runId, cookie: `${player}; ${await login()}` };
};
const queue = g => ops('POST', { action: 'queue', runId: g.runId, recipient }, g.cookie);
const attach = (record, cookie, hash = tx) => ops('POST', { action: 'attach', id: record.id, version: record.version, transactionHash: hash }, cookie);
const check = (record, cookie) => ops('POST', { action: 'check', id: record.id, version: record.version }, cookie);
const matching = record => ({ p: 'KRC-20', op: 'transfer', tick: record.ticker, hashRev: record.transactionHash, from: sender, to: recipient, amt: record.amount, txAccept: '1', opAccept: '1', opError: '', mtsAdd: String(record.createdAt + 1), opScore: '12345', checkpoint: 'c'.repeat(64) });

test('pilot configuration is disabled by default and rejects Mainnet, wrong addresses and inexact amounts', () => {
  process.env.TESTNET_REWARDS_ENABLED = 'false'; assert.equal(testnetConfig(), null); process.env.TESTNET_REWARDS_ENABLED = 'true';
  for (const [field, values] of Object.entries({ TESTNET_REWARDS_NETWORK: ['mainnet', 'testnet-12'], TESTNET_REWARDS_SENDER: [sender.replace('kaspatest:', 'kaspa:'), recipient.slice(0,-1)+'q'], TESTNET_REWARDS_AMOUNT_RAW: ['1.5', '1e8', '0', '001', '9007199254740991000000'], TESTNET_REWARDS_DEPLOYMENT_HASH: ['bad'], TESTNET_REWARDS_TICKER: ['../GEEK'] })) {
    const old = process.env[field]; for (const value of values) { process.env[field] = value; assert.throws(testnetConfig, /TESTNET_CONFIG_INVALID/); } process.env[field] = old;
  }
  assert.equal(testnetConfig().amount, '100000000');
});
test('anonymous and cross-site callers cannot access pilot receipts, assets or queue writes', async () => {
  assert.equal((await ops('GET')).statusCode, 401);
  assert.equal((await call(operations, 'GET', {}, '', { path: 'testnet' })).statusCode, 303);
  assert.equal((await call(operations, 'GET', {}, '', { path: 'assets/testnet.js' })).statusCode, 401);
  const cookie = await login();
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { 'x-payout-review-admin': 'bad' }]) assert.equal((await ops('GET', {}, cookie, headers)).statusCode, 403);
  assert.equal((await ops('POST', {}, cookie, { origin: '' })).statusCode, 403);
  process.env.TESTNET_REWARDS_ENABLED = 'false';
  assert.equal((await ops('GET', {}, cookie)).body.enabled, false);
  assert.equal((await ops('POST', { action: 'queue', runId: 'a'.repeat(40), recipient }, cookie)).statusCode, 503);
  assert.equal(upstreamCalls.length, 0);
});
test('a real server-graded Daily run queues once and an exact accepted transfer produces an indexed receipt', async () => {
  const g = await finished(); const concurrent = await Promise.all([queue(g), queue(g)]);
  assert.ok(concurrent.every(r => r.statusCode === 200)); assert.equal(concurrent[0].body.record.id, concurrent[1].body.record.id);
  let result = concurrent[0], record = result.body.record;
  assert.equal(record.proof.correct, 5); assert.ok(record.proof.score > 0);
  assert.equal(result.body.automaticSigning, false); assert.equal(result.body.mainnetSettlementEnabled, false);
  assert.equal((await queue(g)).body.record.id, record.id); assert.equal(await fixture.command('ZCARD', testnetRewardIndex), 1);
  result = await attach(record, g.cookie); assert.equal(result.statusCode, 200); record = result.body.record;
  assert.equal(record.state, 'awaiting-indexer');
  result = await check(record, g.cookie); assert.equal(result.statusCode, 200); record = result.body.record; assert.equal(record.state, 'awaiting-indexer');
  observation = matching(record); result = await check(record, g.cookie); assert.equal(result.statusCode, 200); record = result.body.record; assert.equal(record.state, 'indexed-confirmed');
  assert.equal(record.transactionHash, tx); assert.equal(await fixture.command('TTL', testnetRewardKey(record.id)), -1);
  observation = null; result = await check(record, g.cookie); assert.equal(result.body.record.state, 'awaiting-indexer'); assert.equal(result.body.record.transactionHash, tx);
  assert.equal((await attach(result.body.record, g.cookie)).statusCode, 409);
});
test('forged score, foreign or stale run, undeployed asset and concurrent run change fail without receipts', async () => {
  const g = await finished();
  assert.equal((await ops('POST', { action: 'queue', runId: g.runId, recipient, score: 999999 }, g.cookie)).statusCode, 400);
  assert.equal((await ops('POST', { action: 'queue', runId: g.runId, recipient }, await login())).statusCode, 401);
  assetState = 'unused'; assert.equal((await queue(g)).statusCode, 503); assert.equal(await fixture.command('ZCARD', testnetRewardIndex), 0); assetState = 'deployed';
  beforeQueue = values => fixture.command('DEL', values[3]); assert.equal((await queue(g)).statusCode, 409); assert.equal(await fixture.command('ZCARD', testnetRewardIndex), 0);
});
test('wrong transfers, stale versions, reused transaction hashes and damaged receipt records are rejected', async () => {
  const g = await finished(); const first = (await queue(g)).body.record;
  let record = (await attach(first, g.cookie)).body.record;
  assert.equal((await check(first, g.cookie)).statusCode, 409);
  for (const [field, wrong] of Object.entries({ to: sender, from: recipient, amt: '1', tick: 'OTHER', hashRev: 'c'.repeat(64), mtsAdd: String(record.createdAt-1) })) {
    observation = { ...matching(record), [field]: wrong }; assert.equal((await check(record, g.cookie)).statusCode, 409);
  }
  observation = { ...matching(record), opAccept: '-1' }; record = (await check(record, g.cookie)).body.record; assert.equal(record.state, 'awaiting-indexer');
  const other = await finished(), second = (await queue(other)).body.record;
  assert.equal((await attach(second, other.cookie)).statusCode, 409);
  await fixture.command('SET', testnetRewardKey(record.id), '{broken');
  assert.equal((await ops('GET', {}, g.cookie)).statusCode, 503);
  assert.equal((await check(record, g.cookie)).statusCode, 503);
  assert.equal(await fixture.command('GET', testnetRewardKey(record.id)), '{broken');
});
