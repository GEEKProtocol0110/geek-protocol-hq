import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import operations from '../server/operations.js';
import rewards from '../api/rewards.js';
import { loadQuestionBank } from '../server/questions.js';
import { autoIndex, autoJobKey, enrollmentKey, automaticConfig } from '../server/testnet-automatic.js';
const wallet = n => { const k = new kaspa.PrivateKey(n.toString(16).padStart(64, '0')); try { return k.toAddress('testnet').toString(); } finally { k.free(); } };
const sender = wallet(7), recipient = wallet(3), deploy = 'a'.repeat(64), token = 'e'.repeat(64);
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let observed = null, loseReply = false, beforeCommit;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://tn10api.kasplex.org/v1/krc20/')) {
    const row = String(url).endsWith('token/GEEKT') ? { tick: 'GEEKT', hashRev: deploy, state: 'deployed', dec: '8' }
      : String(url).endsWith(`op/${deploy}`) ? { p: 'KRC-20', op: 'deploy', tick: 'GEEKT', hashRev: deploy, dec: '8', txAccept: '1', opAccept: '1' } : observed;
    return Response.json({ message: 'successful', result: row ? [row] : [] });
  }
  assert.ok(String(url).startsWith('https://redis.automatic.test'), 'No production data or network sends');
  const values = JSON.parse(options.body), commit = values[0] === 'EVAL' && values[1].includes('geek-ranked-commit-v1');
  if (commit && beforeCommit) { const hook = beforeCommit; beforeCommit = null; await hook(values); }
  const result = String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result }))
    : String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }))
      : { result: await fixture.command(...values) };
  if (commit && loseReply) { loseReply = false; throw new Error('Synthetic lost reply'); }
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => {
  await fixture.command('FLUSHDB'); observed = null; loseReply = false; beforeCommit = null;
  Object.assign(process.env, { UPSTASH_REDIS_REST_URL: 'https://redis.automatic.test', UPSTASH_REDIS_REST_TOKEN: 'synthetic-token',
    AUDIT_LOG_SECRET: 'synthetic-automatic-audit-key-32-characters', CCE_ADMIN_TOKEN: 'synthetic-automatic-cce-key-32-characters',
    PAYOUT_REVIEW_ADMIN_TOKEN: 'synthetic-automatic-payout-key-32-characters', TESTNET_REWARDS_ENABLED: 'true',
    TESTNET_REWARDS_NETWORK: 'testnet-10', TESTNET_REWARDS_TICKER: 'GEEKT', TESTNET_REWARDS_DEPLOYMENT_HASH: deploy,
    TESTNET_REWARDS_DECIMALS: '8', TESTNET_REWARDS_SENDER: wallet(6), TESTNET_REWARDS_AMOUNT_RAW: '100000000',
    TESTNET_AUTO_ENABLED: 'true', TESTNET_AUTO_SENDER: sender, TESTNET_AUTO_WORKER_TOKEN: token, TESTNET_AUTO_DAILY_LIMIT: '2' });
  delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_TOTP_SECRET;
});
const call = async (handler, method, body = {}, cookie = '', query = {}, extra = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'content-type': 'application/json', ...extra } }, res); return res;
};
const worker = body => call(sessionHandler, 'POST', body, '', { service: 'testnet-worker' }, { origin: '', authorization: `Bearer ${token}` });
const ops = (body, cookie, method = 'POST') => call(operations, method, body, cookie, { action: 'testnet-auto' });
const login = async () => (await call(operations, 'POST', { key: process.env.CCE_ADMIN_TOKEN }, '', { action: 'login' })).headers['Set-Cookie'].split(';')[0];
const player = async () => (await call(sessionHandler, 'POST', { displayName: 'Automatic fixture' })).headers['Set-Cookie'].split(';')[0];
const play = (cookie, action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
const enroll = async (p, address = recipient) => {
  const cookie = `${p}; ${await login()}`;
  const result = await ops({ action: 'enroll', recipient: address, enabled: true }, cookie);
  assert.equal(result.statusCode, 200, JSON.stringify(result.body)); return cookie;
};
const complete = async (p, mode = 'daily') => {
  let result = await play(p, 'start', { mode, category: 'kaspa' }), payload = result.body;
  assert.equal(result.statusCode, 201);
  const id = payload.run.id;
  for (let i = 0; i < payload.run.questionCount; i++) {
    const question = loadQuestionBank('kaspa').questions.find(q => q.prompt === payload.question.prompt);
    assert.equal((await play(p, 'answer', { runId: id, questionToken: payload.question.token, selectedIndex: payload.question.options.indexOf(question.options[question.correctIndex]) })).statusCode, 200);
    if (i < payload.run.questionCount - 1) payload = (await play(p, 'next', { runId: id })).body;
  }
  return id;
};
const jobs = async () => { const ids = await fixture.command('ZRANGE', autoIndex, 0, -1); return Promise.all(ids.map(async id => JSON.parse(await fixture.command('GET', autoJobKey(id))))); };
const journal = { commit: { id: 'b'.repeat(64), transaction: JSON.stringify({ synthetic: 'commit'.repeat(20) }) }, reveal: { id: 'c'.repeat(64), transaction: JSON.stringify({ synthetic: 'reveal'.repeat(20) }) } };
const step = (action, claim, job, extra = {}) => worker({ action, lease: claim.lease, id: job.id, version: job.version, ...extra });

test('only owner payout access enrolls the current player; stale enrollment and public writes fail', async () => {
  const p = await player();
  assert.equal((await ops({ action: 'enroll', recipient, enabled: true }, p)).statusCode, 401);
  const cookie = await enroll(p);
  assert.equal((await ops({ action: 'enroll', recipient, enabled: false }, cookie)).statusCode, 409);
  assert.equal((await call(operations, 'POST', { action: 'enroll', recipient, enabled: false }, cookie, { action: 'testnet-auto' }, { origin: 'https://evil.invalid' })).statusCode, 403);
  assert.equal((await call(rewards, 'POST', { recipient }, p, { service: 'testnet' })).statusCode, 405);
});
test('eligible Daily finish atomically queues once, survives expiry and excludes the manual desk', async () => {
  const p = await player(), cookie = await enroll(p), runId = await complete(p);
  assert.equal((await jobs()).length, 0);
  const concurrent = await Promise.all([play(p, 'finish', { runId }), play(p, 'finish', { runId })]);
  assert.ok(concurrent.some(r => r.statusCode === 200));
  const [job] = await jobs(); assert.equal((await jobs()).length, 1); assert.equal(job.amount, '100000000');
  assert.equal(job.recipient, recipient); assert.equal(job.sender, sender);
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 1);
  assert.equal((await call(operations, 'POST', { action: 'queue', runId, recipient }, cookie, { action: 'testnet' })).statusCode, 503);
  await fixture.command('DEL', `geek:run:${runId}`);
  assert.equal(await fixture.command('TTL', autoJobKey(job.id)), -1);
  assert.equal(await fixture.command('GET', `geek:testnet-reward:run:${runId}`), job.id);
});
test('lost finish reply keeps one durable reward and one completed run', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p);
  loseReply = true; assert.equal((await play(p, 'finish', { runId })).statusCode, 503);
  const [job] = await jobs(); assert.ok(job);
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200);
  assert.equal((await jobs()).length, 1);
  assert.equal(JSON.parse(await fixture.command('GET', `geek:profile:${p.split('=')[1]}`)).totalRuns, 1);
});
test('unenrolled, disabled, incomplete and non-Daily results do not enqueue', async () => {
  const p = await player(); let runId = await complete(p); await play(p, 'finish', { runId });
  const p2 = await player(); await enroll(p2); process.env.TESTNET_AUTO_ENABLED = 'false';
  runId = await complete(p2); assert.equal((await play(p2, 'finish', { runId })).statusCode, 200);
  process.env.TESTNET_AUTO_ENABLED = 'true';
  const p3 = await player(); await enroll(p3); runId = (await play(p3, 'start', { mode: 'daily' })).body.run.id;
  await play(p3, 'finish', { runId }); assert.equal((await jobs()).length, 0);
  const p4 = await player(); await enroll(p4); runId = await complete(p4, 'gauntlet');
  await play(p4, 'finish', { runId }); assert.equal((await jobs()).length, 0);
});
test('one recipient per UTC day and daily/capacity bounds retain learning without extra payments', async () => {
  for (const address of [recipient, recipient, wallet(4), wallet(5)]) {
    const p = await player(); await enroll(p, address); const runId = await complete(p);
    assert.equal((await play(p, 'finish', { runId })).statusCode, 200);
  }
  assert.equal((await jobs()).length, 2);
});
test('changed enrollment skips stale admission and corrupt queue storage stops before finishing', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p), key = enrollmentKey(p.split('=')[1]);
  beforeCommit = async () => { const e = JSON.parse(await fixture.command('GET', key)); e.enabled = false; await fixture.command('SET', key, JSON.stringify(e)); };
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
  const p2 = await player(); await enroll(p2); const id2 = await complete(p2);
  await fixture.command('SET', autoIndex, 'broken');
  assert.equal((await play(p2, 'finish', { runId: id2 })).statusCode, 503);
  assert.equal(JSON.parse(await fixture.command('GET', `geek:run:${id2}`)).status, 'between-rounds');
});
test('the dedicated testnet sender and bounded worker token/config fail closed', () => {
  for (const [field, value] of Object.entries({ TESTNET_AUTO_SENDER: wallet(6), TESTNET_AUTO_WORKER_TOKEN: 'short', TESTNET_AUTO_DAILY_LIMIT: '101', TESTNET_REWARDS_NETWORK: 'mainnet' })) {
    const old = process.env[field]; process.env[field] = value; assert.throws(automaticConfig, /TESTNET/); process.env[field] = old;
  }
});
test('a prior manual run lock and full retained capacity cannot admit another automatic payment', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p);
  await fixture.command('SET', `geek:testnet-reward:run:${runId}`, 'prior-manual-receipt');
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
  const p2 = await player(); await enroll(p2, wallet(4)); const second = await complete(p2);
  for (let i = 0; i < 100; i++) await fixture.command('ZADD', autoIndex, i, i.toString(16).padStart(64, '0'));
  assert.equal((await play(p2, 'finish', { runId: second })).statusCode, 200);
  assert.equal(await fixture.command('ZCARD', autoIndex), 100);
  assert.equal(await fixture.command('GET', `geek:testnet-reward:run:${second}`), null);
});
test('worker authentication rejects browser/owner sessions and unauthorized calls without jobs', async () => {
  assert.equal((await call(sessionHandler, 'POST', { action: 'claim' }, '', { service: 'testnet-worker' })).statusCode, 401);
  assert.equal((await call(sessionHandler, 'POST', { action: 'claim' }, await login(), { service: 'testnet-worker' }, { authorization: `Bearer ${token}` })).statusCode, 401);
  assert.equal((await worker({ action: 'claim' })).statusCode, 200);
  assert.equal((await worker({ action: 'claim' })).body.busy, true);
});
test('immutable preparation, stale leases, worker restart and exact indexer acceptance preserve one payment', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p); await play(p, 'finish', { runId });
  let claim = (await worker({ action: 'claim' })).body, job = claim.job;
  const prepared = await step('prepare', claim, job, { journal }); assert.equal(prepared.statusCode, 200); job = prepared.body.job;
  assert.equal((await step('prepare', claim, job, { journal })).statusCode, 409);
  await worker({ action: 'release', lease: claim.lease });
  const old = claim; claim = (await worker({ action: 'claim' })).body;
  assert.deepEqual(claim.job.journal, journal);
  assert.equal((await step('submitted', old, job)).statusCode, 409);
  job = (await step('submitted', claim, job)).body.job;
  job = (await step('check', claim, job)).body.job; assert.equal(job.state, 'awaiting-indexer');
  observed = { p: 'KRC-20', op: 'transfer', tick: job.ticker, hashRev: job.transactionHash, from: sender, to: recipient, amt: job.amount,
    txAccept: '1', opAccept: '1', opError: '', mtsAdd: String(job.createdAt + 1), opScore: '100', checkpoint: 'd'.repeat(64) };
  const accepted = await step('check', claim, job); assert.equal(accepted.statusCode, 200); job = accepted.body.job;
  assert.equal(job.state, 'indexed-confirmed'); assert.deepEqual(job.journal, journal);
  const own = await call(rewards, 'GET', {}, p, { service: 'testnet' }); assert.equal(own.body.records[0].state, 'indexed-confirmed');
  assert.ok(!JSON.stringify(own.body).includes('journal'));
  const other = await call(rewards, 'GET', {}, await player(), { service: 'testnet' }); assert.deepEqual(other.body.records, []);
  await worker({ action: 'release', lease: claim.lease }); assert.equal((await worker({ action: 'claim' })).body.job, null);
});
