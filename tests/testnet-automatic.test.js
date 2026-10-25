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
import { processPayment } from '../workers/testnet/process.mjs';
import { identityPlayerKey } from '../server/identity-keys.js';
import { rewardAddressKey } from '../server/reward-addresses.js';
import { retiredJobKey, freshTestId } from '../server/testnet-fresh-test.js';
import { createHash } from 'node:crypto';
import { Wasm, legacyJournal } from '../workers/testnet/fixtures/legacy-journal.mjs';
import { prepareFeeRepair } from '../workers/testnet/signer.mjs';
import { validateFeeRepair } from '../server/testnet-fee-repair.js';
const wallet = n => { const k = new kaspa.PrivateKey(n.toString(16).padStart(64, '0')); try { return k.toAddress('testnet').toString(); } finally { k.free(); } };
const sender = wallet(7), recipient = wallet(3), deploy = 'a'.repeat(64), token = 'e'.repeat(64);
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let observed = null, loseReply = false, beforeCommit, missingOperationStatus = 200, loseFreshReply = false, beforeFreshCommit, loseRepairReply = false;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith('https://tn10api.kasplex.org/v1/krc20/')) {
    const row = String(url).endsWith('token/GEEKT') ? { tick: 'GEEKT', hashRev: deploy, state: 'deployed', dec: '8' }
      : String(url).endsWith(`op/${deploy}`) ? { p: 'KRC-20', op: 'deploy', tick: 'GEEKT', hashRev: deploy, dec: '8', txAccept: '1', opAccept: '1' } : observed;
    if (!row && missingOperationStatus !== 200) return Response.json({ message: 'op not found', result: null }, { status: missingOperationStatus });
    return Response.json({ message: 'successful', result: row ? [row] : [] });
  }
  assert.ok(String(url).startsWith('https://redis.automatic.test'), 'No production data or network sends');
  const values = JSON.parse(options.body), commit = values[0] === 'EVAL' && values[1].includes('geek-ranked-commit-v1');
  const fresh = values[0] === 'EVAL' && values[1].includes('geek-testnet-one-fresh-test-v1');
  if (fresh && beforeFreshCommit) { const hook = beforeFreshCommit; beforeFreshCommit = null; await hook(values); }
  if (commit && beforeCommit) { const hook = beforeCommit; beforeCommit = null; await hook(values); }
  const result = String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result }))
    : String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }))
      : { result: await fixture.command(...values) };
  if (commit && loseReply) { loseReply = false; throw new Error('Synthetic lost reply'); }
  if (fresh && loseFreshReply) { loseFreshReply = false; throw new Error('Synthetic lost fresh-test response'); }
  if (loseRepairReply && values[0] === 'EVAL' && values[1].includes('geek-testnet-auto-update-v1') && JSON.parse(values[7]).feeRepair) {
    loseRepairReply = false; throw new Error('Synthetic lost fee-repair response');
  }
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => {
  delete process.env.TESTNET_AUTO_APPROVED_WALLETS;
  delete process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL;
  await fixture.command('FLUSHDB'); observed = null; loseReply = false; beforeCommit = null; missingOperationStatus = 200; loseFreshReply = false; beforeFreshCommit = null; loseRepairReply = false;
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

async function feeFixture() {
  const original = await freshFixture(), claim = (await worker({ action: 'claim' })).body;
  const key = new Wasm.PrivateKey('7'.padStart(64, '0')), address = key.toPublicKey().toAddress('testnet');
  const entry = { address: sender, amount: 2000000000n, outpoint: { transactionId: '4'.repeat(64), index: 2 },
    scriptPublicKey: Wasm.payToAddressScript(address), blockDaaScore: 0n, isCoinbase: false };
  try {
    const legacy = await legacyJournal(key, claim.job, entry);
    const saved = await step('prepare', claim, claim.job, { journal: legacy });
    assert.equal(saved.statusCode, 200);
    const job = saved.body.job, corrected = await prepareFeeRepair(key, job, [entry]);
    return { original, claim, job, corrected };
  } finally { key.free(); address.free(); }
}

test('same-input fee repair retains both journals, earning locks and budgets and confirms the corrected exact hash', async () => {
  const { original, claim, job, corrected } = await feeFixture(), retained = JSON.stringify(job.journal);
  const budget = await fixture.command('GET', `geek:testnet-auto:day:${new Date().toISOString().slice(0, 10)}`);
  const result = await step('repair-fee', claim, job, { journal: corrected });
  assert.equal(result.statusCode, 200, JSON.stringify(result.body));
  let current = result.body.job;
  assert.equal(JSON.stringify(current.journal), retained); assert.deepEqual(current.feeRepair.journal, corrected);
  assert.equal(current.transactionHash, corrected.reveal.id); assert.equal(current.state, 'prepared');
  assert.equal(await fixture.command('GET', autoJobKey(original.job.id)), original.raw);
  assert.equal(await fixture.command('GET', original.runKey), original.job.id);
  assert.equal(await fixture.command('GET', `geek:testnet-auto:day:${new Date().toISOString().slice(0, 10)}`), budget);
  assert.equal((await jobs()).length, 2);
  assert.equal((await step('repair-fee', claim, current, { journal: corrected })).statusCode, 409);
  observed = { p: 'KRC-20', op: 'transfer', tick: 'GEEKT', hashRev: corrected.reveal.id, from: sender, to: recipient,
    amt: '100000000', txAccept: '1', opAccept: '1', mtsAdd: String(Date.now()), opScore: '1', checkpoint: 'a'.repeat(64) };
  current = (await step('check', claim, current)).body.job;
  assert.equal(current.state, 'indexed-confirmed'); assert.equal(JSON.stringify(current.journal), retained);
  const view = (await call(rewards, 'GET', {}, original.cookie, { service: 'testnet' })).body;
  assert.equal(view.records[0].transactionHash, corrected.reveal.id);
  assert.doesNotMatch(JSON.stringify(view), /signatureScript|originalJournalHash|signed-commit|feeRepair/);
});

test('lost fee-repair acknowledgement and stale leases cannot create another correction or discard receipts', async () => {
  const { claim, job, corrected } = await feeFixture(); loseRepairReply = true;
  const lost = await step('repair-fee', claim, job, { journal: corrected }); assert.notEqual(lost.statusCode, 200);
  await worker({ action: 'release', lease: claim.lease });
  const next = (await worker({ action: 'claim' })).body;
  assert.equal(next.job.id, job.id); assert.deepEqual(next.job.journal, job.journal); assert.deepEqual(next.job.feeRepair.journal, corrected);
  assert.equal((await step('repair-fee', next, next.job, { journal: corrected })).statusCode, 409);
  assert.equal((await step('submitted', claim, job)).statusCode, 409);
  assert.equal((await jobs()).length, 2);
});

test('fee-repair validation rejects different coins, destinations, scripts, extra inputs and fees outside the cap', async () => {
  const { claim, job, corrected } = await feeFixture();
  const mutate = (phase, change) => { const value = structuredClone(corrected), tx = JSON.parse(value[phase].transaction); change(tx); value[phase].transaction = JSON.stringify(tx); return value; };
  const bad = [
    mutate('commit', tx => { tx.inputs[0].transactionId = '5'.repeat(64); }),
    mutate('commit', tx => { tx.inputs.push(structuredClone(tx.inputs[0])); }),
    mutate('commit', tx => { tx.outputs[0].value = '129000000'; }),
    mutate('commit', tx => { tx.outputs[1].scriptPublicKey = '000020' + 'a'.repeat(64); }),
    mutate('commit', tx => { tx.outputs[1].value = '1'; }),
    mutate('reveal', tx => { tx.inputs[0].transactionId = '6'.repeat(64); }),
    mutate('reveal', tx => { tx.inputs[0].signatureScript += '00'; }),
    mutate('reveal', tx => { tx.outputs[0].scriptPublicKey = '000020' + 'b'.repeat(64); })
  ];
  for (const journal of bad) {
    assert.throws(() => validateFeeRepair(job, journal), /FEE_REPAIR_INVALID/);
    assert.equal((await step('repair-fee', claim, job, { journal })).statusCode, 503);
  }
  assert.throws(() => validateFeeRepair({ ...job, freshTestOf: undefined }, corrected), /FEE_REPAIR_INVALID/);
  assert.equal((await jobs()).find(x => x.id === job.id).feeRepair, undefined);
});

test('an accepted original fresh hash and corrupted saved repair lineage fail closed', async () => {
  const { claim, job, corrected } = await feeFixture();
  observed = { p: 'KRC-20', op: 'transfer', tick: 'GEEKT', hashRev: job.transactionHash, from: sender, to: recipient,
    amt: '100000000', txAccept: '1', opAccept: '1', mtsAdd: String(Date.now()), opScore: '1', checkpoint: 'a'.repeat(64) };
  assert.equal((await step('repair-fee', claim, job, { journal: corrected })).statusCode, 409);
  assert.equal((await jobs()).find(x => x.id === job.id).feeRepair, undefined);
  observed = null;
  const repaired = (await step('repair-fee', claim, job, { journal: corrected })).body.job;
  repaired.feeRepair.originalJournalHash = '0'.repeat(64);
  await fixture.command('SET', autoJobKey(job.id), JSON.stringify(repaired)); await releaseClaim(claim);
  assert.equal((await worker({ action: 'claim' })).statusCode, 503);
});
const step = (action, claim, job, extra = {}) => worker({ action, lease: claim.lease, id: job.id, version: job.version, ...extra });
const verifiedWallet = async (p, ecdsa = false) => {
  const id = p.split('=')[1], key = new kaspa.PrivateKey('3'.padStart(64, '0'));
  const pub = key.toPublicKey();
  const now = Date.now();
  const record = { version: 1, id, address: (ecdsa ? key.toAddressECDSA('mainnet') : key.toAddress('mainnet')).toString(), publicKey: pub.toString(),
    network: 'kaspa-mainnet', scheme: 'kaspa-schnorr-personal-message-v1', linkedAt: now, verifiedAt: now,
    lastRecoveredAt: 0, recoveryCount: 0, sessionVersion: 1, settlementEnabled: false };
  pub.free(); key.free();
  await fixture.command('SET', identityPlayerKey(id), JSON.stringify(record));
  const sessionKey = `geek:session:${id}`, session = JSON.parse(await fixture.command('GET', sessionKey));
  await fixture.command('SET', sessionKey, JSON.stringify({ ...session, playerId: id, identityVersion: 1 }));
  return { id, record };
};

const savedReceiving = async (p, address = recipient) => {
  const id = p.split('=')[1], record = { schema: 1, playerId: id, version: 'a'.repeat(24), mainnet: '', 'testnet-10': address,
    updatedAt: Date.now(), mainnetEligibleAt: 0, authorizedBy: 'passkey' };
  await fixture.command('SET', rewardAddressKey(id), JSON.stringify(record)); return record;
};

test('an account-confirmed receiving address admits an approved test reward without a wallet identity', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  const p = await player(); await savedReceiving(p);
  const view = await call(rewards, 'GET', {}, p, { service: 'testnet' });
  assert.equal(view.body.enrollment.source, 'saved-account-address');
  assert.equal(await fixture.command('GET', identityPlayerKey(p.split('=')[1])), null);
  const runId = await complete(p); assert.equal((await play(p, 'finish', { runId })).statusCode, 200);
  const [job] = await jobs(); assert.equal(job.recipient, recipient);
  await savedReceiving(p, wallet(4));
  assert.equal((await call(rewards, 'GET', {}, p, { service: 'testnet' })).body.records[0].recipient, recipient, 'a saved payment keeps its original recipient');
});

test('saved-address changes during finish skip stale admission while retaining the learning result', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  const p = await player(); await savedReceiving(p); const runId = await complete(p);
  beforeCommit = () => savedReceiving(p, wallet(4));
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
});

test('an existing pilot approval accepts its same saved recipient and a concurrent owner pause still blocks admission', async () => {
  const p = await player(); await enroll(p); await savedReceiving(p);
  const runId = await complete(p);
  beforeCommit = async () => {
    const key = enrollmentKey(p.split('=')[1]), e = JSON.parse(await fixture.command('GET', key));
    await fixture.command('SET', key, JSON.stringify({ ...e, enabled: false }));
  };
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
  const p2 = await player(); await enroll(p2); await savedReceiving(p2);
  const run2 = await complete(p2); await play(p2, 'finish', { runId: run2 });
  assert.equal((await jobs())[0].recipient, recipient);
});

test('a newly saved or removed account destination prevents stale manual enrollment admission', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p);
  beforeCommit = () => savedReceiving(p, '');
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
  const p2 = await player(); await enroll(p2); await savedReceiving(p2, wallet(4));
  const run2 = await complete(p2); await play(p2, 'finish', { runId: run2 }); assert.equal((await jobs()).length, 0);
});

test('unapproved or removed saved destinations never fall back to an old verified wallet', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  for (const address of [wallet(4), '']) {
    const p = await player(); await verifiedWallet(p); await savedReceiving(p, address);
    const runId = await complete(p); await play(p, 'finish', { runId });
  }
  assert.equal((await jobs()).length, 0);
  const p = await player(); await savedReceiving(p); const cookie = await enroll(p);
  const e = JSON.parse(await fixture.command('GET', enrollmentKey(p.split('=')[1])));
  await ops({ action: 'enroll', recipient, enabled: false, version: e.version }, cookie);
  const runId = await complete(p); await play(p, 'finish', { runId }); assert.equal((await jobs()).length, 0);
});

test('an approved verified wallet receives automatic admission without an owner enrollment action', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  const p = await player(); await verifiedWallet(p);
  const view = await call(rewards, 'GET', {}, p, { service: 'testnet' });
  assert.equal(view.body.enrollment.source, 'verified-wallet'); assert.equal(view.body.enrollment.recipient, recipient);
  assert.equal(await fixture.command('GET', enrollmentKey(p.split('=')[1])), null);
  const id = await complete(p); assert.equal((await play(p, 'finish', { runId: id })).statusCode, 200);
  const [job] = await jobs(); assert.equal(job.recipient, recipient); assert.equal((await jobs()).length, 1);
  assert.equal((await play(p, 'finish', { runId: id })).statusCode, 200); assert.equal((await jobs()).length, 1);
  delete process.env.TESTNET_AUTO_APPROVED_WALLETS;
  const retained = await call(rewards, 'GET', {}, p, { service: 'testnet' });
  assert.equal(retained.body.enrollment, null); assert.equal(retained.body.records[0].id, job.id);
});

test('guest addresses, unapproved wallets and explicitly disabled enrollments do not gain reward eligibility', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  const guest = await player(); let id = await complete(guest); await play(guest, 'finish', { runId: id });
  assert.equal((await jobs()).length, 0);
  const p = await player(); await verifiedWallet(p); process.env.TESTNET_AUTO_APPROVED_WALLETS = wallet(4);
  id = await complete(p); await play(p, 'finish', { runId: id }); assert.equal((await jobs()).length, 0);
  const p2 = await player(), cookie = await enroll(p2); await verifiedWallet(p2);
  const raw = JSON.parse(await fixture.command('GET', enrollmentKey(p2.split('=')[1])));
  assert.equal((await ops({ action: 'enroll', recipient, enabled: false, version: raw.version }, cookie)).statusCode, 200);
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  id = await complete(p2); await play(p2, 'finish', { runId: id }); assert.equal((await jobs()).length, 0);
});

test('wallet proof changes during the atomic finish skip stale automatic admission', async () => {
  process.env.TESTNET_AUTO_APPROVED_WALLETS = recipient;
  const p = await player(), { id, record } = await verifiedWallet(p), runId = await complete(p);
  beforeCommit = () => fixture.command('SET', identityPlayerKey(id), JSON.stringify({ ...record, verifiedAt: record.verifiedAt + 1 }));
  assert.equal((await play(p, 'finish', { runId })).statusCode, 200); assert.equal((await jobs()).length, 0);
});

test('derived rewards preserve an ECDSA wallet address type on TN10', async () => {
  const p = await player(); await verifiedWallet(p, true);
  const key = new kaspa.PrivateKey('3'.padStart(64, '0'));
  const expected = key.toAddressECDSA('testnet').toString(); key.free();
  process.env.TESTNET_AUTO_APPROVED_WALLETS = expected;
  const view = await call(rewards, 'GET', {}, p, { service: 'testnet' });
  assert.equal(view.statusCode, 200); assert.equal(view.body.enrollment.recipient, expected);
});

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

test('a real 403 missing-operation response permits same-journal recovery and later exact confirmation', async () => {
  const p = await player(); await enroll(p); const runId = await complete(p); await play(p, 'finish', { runId });
  const claim = (await worker({ action: 'claim' })).body;
  const prepared = await step('prepare', claim, claim.job, { journal }); assert.equal(prepared.statusCode, 200);
  await worker({ action: 'release', lease: claim.lease });
  missingOperationStatus = 403;
  const sent = [];
  const request = async body => {
    const response = await worker(body);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body;
  };
  const signer = {
    verify: async () => {},
    prepare: async () => assert.fail('A persisted job must never construct another payment'),
    submit: async saved => sent.push(structuredClone(saved))
  };
  assert.equal(await processPayment({ request, signer }), 'awaiting-indexer');
  assert.deepEqual(sent, [journal.commit, journal.reveal]);
  let [job] = await jobs(); assert.deepEqual(job.journal, journal);
  assert.equal(job.observation.reason, 'not-indexed');
  assert.equal(job.transactionHash, journal.reveal.id);
  observed = { p: 'KRC-20', op: 'transfer', tick: job.ticker, hashRev: job.transactionHash, from: sender, to: recipient, amt: job.amount,
    txAccept: '1', opAccept: '1', opError: '', mtsAdd: String(job.createdAt + 1), opScore: '100', checkpoint: 'd'.repeat(64) };
  assert.equal(await processPayment({ request, signer }), 'indexed-confirmed');
  assert.equal(sent.length, 2, 'Confirmation must not rebroadcast the accepted payment');
  [job] = await jobs(); assert.deepEqual(job.journal, journal);
  assert.equal((await jobs()).length, 1);
});

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const leaseKeyForTest = 'geek:testnet-auto:sender-lease:v1';
async function freshFixture(patch = {}) {
  const cookie = await player(), playerId = cookie.split('=')[1], runId = '8'.repeat(40), id = digest(['testnet-pilot-v1', runId]);
  const createdAt = Date.now() - 2 * 86400000, date = new Date(createdAt).toISOString().slice(0, 10), config = automaticConfig();
  const job = { schema: 1, id, version: '9'.repeat(24), state: 'awaiting-indexer', playerId, network: 'testnet-10', ticker: 'GEEKT',
    sender, recipient, deploymentHash: deploy, configFingerprint: config.fingerprint, amount: '100000000', decimals: '8',
    proof: { runId, mode: 'daily', category: 'kaspa', correct: 1, answered: 5, score: 200 }, createdAt,
    journal: structuredClone(journal), transactionHash: journal.reveal.id, ...patch };
  const raw = JSON.stringify(job), runKey = `geek:testnet-reward:run:${runId}`,
    recipientKey = `geek:testnet-auto:recipient-day:${digest([date, recipient])}`, dayKey = `geek:testnet-auto:day:${date}`;
  await fixture.command('SET', autoJobKey(id), raw); await fixture.command('ZADD', autoIndex, createdAt, id);
  await fixture.command('SET', runKey, id); await fixture.command('SET', recipientKey, id); await fixture.command('SET', dayKey, '1');
  const consent = { originalRevealHash: job.transactionHash, recipient, riskAccepted: true, approvedAt: Date.now() };
  process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL = JSON.stringify(consent);
  return { cookie, job, raw, consent, runKey, recipientKey, dayKey };
}
const releaseClaim = claim => worker({ action: 'release', lease: claim.lease });

test('approved fresh test atomically retains the old signed receipt, consumes budget and never resumes old service retries', async () => {
  const old = await freshFixture(), claim = (await worker({ action: 'claim' })).body, child = claim.job;
  assert.equal(child.id, freshTestId(old.job.id)); assert.equal(child.freshTestOf, old.job.id);
  assert.equal(child.state, 'queued'); assert.equal(child.journal, undefined); assert.equal(child.transactionHash, undefined);
  assert.equal(child.recipient, old.job.recipient); assert.equal(child.amount, '100000000'); assert.deepEqual(child.proof, old.job.proof);
  assert.equal(await fixture.command('GET', autoJobKey(old.job.id)), old.raw);
  assert.equal(await fixture.command('GET', old.runKey), old.job.id);
  assert.equal(await fixture.command('GET', old.recipientKey), old.job.id); assert.equal(await fixture.command('GET', old.dayKey), '1');
  const today = new Date().toISOString().slice(0, 10);
  assert.equal(await fixture.command('GET', `geek:testnet-auto:day:${today}`), '1');
  assert.equal(await fixture.command('GET', `geek:testnet-auto:recipient-day:${digest([today, recipient])}`), child.id);
  const marker = JSON.parse(await fixture.command('GET', retiredJobKey(old.job.id))); assert.equal(marker.riskAccepted, true);
  const view = await call(rewards, 'GET', {}, old.cookie, { service: 'testnet' });
  assert.equal(view.body.records[0].freshTest, true); assert.equal(view.body.records[1].serviceRetriesStopped, true);
  assert.ok(!JSON.stringify(view.body).includes('journal')); assert.ok(!JSON.stringify(view.body).includes('authorizationHash'));
  assert.equal((await step('submitted', claim, old.job)).statusCode, 409);
  assert.equal((await step('check', claim, old.job)).statusCode, 409);
  await releaseClaim(claim); delete process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL;
  const resumed = (await worker({ action: 'claim' })).body;
  assert.equal(resumed.job.id, child.id); assert.equal((await jobs()).length, 2);
  assert.equal(await fixture.command('GET', autoJobKey(old.job.id)), old.raw);
});

test('lost approval acknowledgement and concurrent claims cannot create a second fresh payment', async () => {
  const old = await freshFixture(); loseFreshReply = true;
  assert.notEqual((await worker({ action: 'claim' })).statusCode, 200);
  const firstLease = await fixture.command('GET', leaseKeyForTest); await releaseClaim({ lease: firstLease });
  const results = await Promise.all([worker({ action: 'claim' }), worker({ action: 'claim' })]);
  assert.equal(results.filter(r => r.body.busy === true).length, 1);
  const claimed = results.find(r => r.body.job).body;
  assert.equal(claimed.job.id, freshTestId(old.job.id)); assert.equal((await jobs()).length, 2);
  assert.equal(await fixture.command('GET', `geek:testnet-auto:day:${new Date().toISOString().slice(0, 10)}`), '1');
  await releaseClaim(claimed);
  const next = (await worker({ action: 'claim' })).body; assert.equal(next.job.id, claimed.job.id);
});

test('fresh-test authorization rejects different recipients, reveals, expired consent, amounts and chained retries', async () => {
  for (const patch of [{ recipient: wallet(4) }, { originalRevealHash: 'f'.repeat(64) }, { riskAccepted: false }, { approvedAt: Date.now() - 2 * 86400000 }]) {
    await fixture.command('FLUSHDB'); const old = await freshFixture();
    process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL = JSON.stringify({ ...old.consent, ...patch });
    assert.equal((await worker({ action: 'claim' })).statusCode, 503);
    assert.equal((await jobs()).length, 1); assert.equal(await fixture.command('GET', retiredJobKey(old.job.id)), null);
  }
  for (const patch of [{ amount: '200000000' }, { freshTestOf: 'a'.repeat(64) }]) {
    await fixture.command('FLUSHDB'); const old = await freshFixture(patch);
    assert.equal((await worker({ action: 'claim' })).statusCode, 503); assert.equal((await jobs()).length, 1);
    assert.equal(await fixture.command('GET', autoJobKey(old.job.id)), old.raw);
  }
});

test('fresh-test budget and recipient-day limits preserve the original attempt without partial retirement', async () => {
  for (const cap of ['daily', 'recipient']) {
    await fixture.command('FLUSHDB'); const old = await freshFixture(), date = new Date().toISOString().slice(0, 10);
    if (cap === 'daily') await fixture.command('SET', `geek:testnet-auto:day:${date}`, '2');
    else await fixture.command('SET', `geek:testnet-auto:recipient-day:${digest([date, recipient])}`, 'another-job');
    assert.equal((await worker({ action: 'claim' })).statusCode, 503);
    assert.equal(await fixture.command('GET', retiredJobKey(old.job.id)), null); assert.equal((await jobs()).length, 1);
    assert.equal(await fixture.command('GET', autoJobKey(old.job.id)), old.raw);
  }
});

test('fresh approval compares the live lease and original snapshot before any retirement or creation', async () => {
  for (const race of ['lease', 'job']) {
    await fixture.command('FLUSHDB'); const old = await freshFixture();
    beforeFreshCommit = async () => {
      if (race === 'lease') await fixture.command('SET', leaseKeyForTest, 'b'.repeat(24));
      else await fixture.command('SET', autoJobKey(old.job.id), JSON.stringify({ ...old.job, version: 'a'.repeat(24) }));
    };
    assert.equal((await worker({ action: 'claim' })).statusCode, 409);
    assert.equal(await fixture.command('GET', retiredJobKey(old.job.id)), null); assert.equal((await jobs()).length, 1);
  }
});

test('an already-confirmed original never creates a fresh test or retirement', async () => {
  const old = await freshFixture({ state: 'indexed-confirmed', observation: { accepted: true } });
  const response = await worker({ action: 'claim' }); assert.equal(response.statusCode, 200); assert.equal(response.body.job, null);
  assert.equal((await jobs()).length, 1); assert.equal(await fixture.command('GET', retiredJobKey(old.job.id)), null);
});

test('fresh-test confirmation preserves both distinct receipts and does not reactivate the original', async () => {
  const old = await freshFixture(), claim = (await worker({ action: 'claim' })).body;
  const freshJournal = { commit: { id: 'd'.repeat(64), transaction: 'fresh-commit'.repeat(10) }, reveal: { id: 'e'.repeat(64), transaction: 'fresh-reveal'.repeat(10) } };
  let child = (await step('prepare', claim, claim.job, { journal: freshJournal })).body.job;
  child = (await step('submitted', claim, child)).body.job;
  observed = { p: 'KRC-20', op: 'transfer', tick: 'GEEKT', hashRev: freshJournal.reveal.id, from: sender, to: recipient,
    amt: '100000000', txAccept: '1', opAccept: '1', opError: '', mtsAdd: String(child.createdAt + 1), opScore: '100', checkpoint: 'd'.repeat(64) };
  child = (await step('check', claim, child)).body.job; assert.equal(child.state, 'indexed-confirmed');
  await releaseClaim(claim); delete process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL;
  assert.equal((await worker({ action: 'claim' })).body.job, null);
  assert.equal(await fixture.command('GET', autoJobKey(old.job.id)), old.raw);
  const view = (await call(rewards, 'GET', {}, old.cookie, { service: 'testnet' })).body;
  assert.equal(view.records.length, 2); assert.equal(view.records[0].state, 'indexed-confirmed'); assert.equal(view.records[0].freshTest, true);
  assert.equal(view.records[1].serviceRetriesStopped, true); assert.equal(view.records[1].transactionHash, journal.reveal.id);
});

test('queue capacity and corrupt retirement lineage fail closed without dropping a saved receipt', async () => {
  const old = await freshFixture();
  for (let n = 0; n < 99; n++) {
    const id = n.toString(16).padStart(64, '0'), revealId = (n + 1000).toString(16).padStart(64, '0');
    const job = { ...old.job, id, recipient: wallet(4), journal: { ...journal, reveal: { ...journal.reveal, id: revealId } }, transactionHash: revealId };
    await fixture.command('SET', autoJobKey(id), JSON.stringify(job)); await fixture.command('ZADD', autoIndex, old.job.createdAt + n + 1, id);
  }
  assert.equal((await worker({ action: 'claim' })).statusCode, 503);
  assert.equal(await fixture.command('GET', retiredJobKey(old.job.id)), null); assert.equal((await jobs()).length, 100);
  await fixture.command('FLUSHDB'); const second = await freshFixture(), claim = (await worker({ action: 'claim' })).body;
  await releaseClaim(claim); delete process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL;
  const child = { ...claim.job, recipient: wallet(4) }; await fixture.command('SET', autoJobKey(child.id), JSON.stringify(child));
  assert.equal((await worker({ action: 'claim' })).statusCode, 503);
  assert.equal(await fixture.command('GET', autoJobKey(second.job.id)), second.raw);
});
