import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import operations from '../server/operations.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import { defaultStressScenario } from '../server/economy-stress.js';
import { appendPlannedTransaction, readLedger, ledgerKey, ledgerCasScript } from '../server/economy-ledger.js';
import { loadQuestionBank } from '../server/questions.js';
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.economy-stress.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-economy-stress-token';
process.env.CCE_ADMIN_TOKEN = 'synthetic-economy-stress-owner-key-32-characters'; process.env.AUDIT_LOG_SECRET = 'synthetic-economy-stress-audit-key-32-characters';
delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_TOTP_SECRET;
let lost = false;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.economy-stress.test'), 'No production or wallet request in stress fixtures');
  const values = JSON.parse(options.body);
  const result = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result })) : String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
  if (lost && values[0] === 'EVAL' && values[1] === ledgerCasScript && result.result === 1) { lost = false; throw new Error('Synthetic lost journal commit reply'); }
  return Response.json(result);
};
beforeEach(async () => { await fixture.command('FLUSHDB'); lost = false; });
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const call = async (handler, method, body = {}, cookie = '', query = {}, headers = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await handler({ method, body, query, headers: { cookie, origin: 'https://www.geekprotocol.xyz', host: 'www.geekprotocol.xyz', 'content-type': 'application/json', 'user-agent': 'synthetic-economy-stress', ...headers } }, res); return res;
};
const ops = (method, body = {}, cookie = '', headers = {}) => call(operations, method, body, cookie, { action: 'stress' }, headers);
const login = async () => { const res = await call(operations, 'POST', { key: process.env.CCE_ADMIN_TOKEN }, '', { action: 'login' }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
test('the stress lab is private and arbitrary fees, scores or configuration cannot change player state', async () => {
  assert.equal((await ops('GET')).statusCode, 401);
  assert.equal((await call(operations, 'GET', {}, '', { path: 'stress' })).statusCode, 303);
  assert.equal((await call(operations, 'GET', {}, '', { path: 'assets/stress.js' })).statusCode, 401);
  const cookie = await login();
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { authorization: 'bad' }]) assert.equal((await ops('GET', {}, cookie, headers)).statusCode, 403);
  assert.equal((await ops('POST', defaultStressScenario(), cookie, { origin: '' })).statusCode, 403);
  const key = 'geek:profile:' + 'a'.repeat(32); await fixture.command('SET', key, '{"balance":73,"xp":12}');
  const keysBefore = (await fixture.command('KEYS', '*')).filter(k => !k.startsWith('geek:rate:')).sort();
  const read = await ops('GET', {}, cookie); assert.equal(read.statusCode, 200); assert.match(read.headers['Cache-Control'], /private.*no-store/);
  const result = await ops('POST', defaultStressScenario(), cookie); assert.equal(result.statusCode, 200); assert.equal(result.body.result.reserve.coveredClaims, '1000'); assert.equal(result.body.result.creditConversionEnabled, false); assert.equal(result.body.result.runway.fullBudgetDays, '10000');
  assert.equal((await ops('POST', { ...defaultStressScenario(), balance: 999999 }, cookie)).statusCode, 400);
  assert.equal(await fixture.command('GET', key), '{"balance":73,"xp":12}');
  assert.deepEqual((await fixture.command('KEYS', '*')).filter(k => !k.startsWith('geek:rate:')).sort(), keysBefore);
});
test('a hundred concurrent same-reference planning receipts commit once; conflicting terms cannot replace them', async () => {
  const player = 'a'.repeat(32), input = { reference: 'reward_stress_0001', kind: 'reward-payout', grossRaw: '9007199254740993', feeRaw: '0' };
  const outcomes = await Promise.all(Array.from({ length: 100 }, () => appendPlannedTransaction(player, input)));
  assert.equal(new Set(outcomes.map(r => r.receipt.hash)).size, 1); assert.equal(outcomes.filter(r => !r.duplicate).length, 1); assert.equal((await readLedger(player)).sequence, 1);
  const before = await fixture.command('GET', ledgerKey(player));
  await assert.rejects(appendPlannedTransaction(player, { ...input, grossRaw: '9007199254740994' }), /REFERENCE_CONFLICT/);
  assert.equal(await fixture.command('GET', ledgerKey(player)), before);
  assert.equal(await fixture.command('EXISTS', 'geek:profile:' + player), 0);
});
test('a lost accepted journal reply returns the same receipt on retry without paying or allocating again', async () => {
  const player = 'b'.repeat(32), input = { reference: 'entry_stress_00001', kind: 'game-entry', grossRaw: '101', feeRaw: '101' };
  lost = true; await assert.rejects(appendPlannedTransaction(player, input), /REDIS_UNAVAILABLE/);
  const retry = await appendPlannedTransaction(player, input); assert.equal(retry.duplicate, true);
  const state = await readLedger(player); assert.equal(state.sequence, 1); assert.equal(state.totals.recyclePendingRaw, '70'); assert.equal(state.totals.burnPendingRaw, '31');
  assert.equal(await fixture.command('EXISTS', 'geek:profile:' + player), 0);
});
test('actual Gauntlet free rounds grant once per round, while genuinely new completed runs grant again', async () => {
  const initialized = await call(sessionHandler, 'POST', { displayName: 'Credit Stress Fixture' }), cookie = initialized.headers['Set-Cookie'].split(';')[0];
  const play = (action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
  for (let n = 0; n < 2; n++) {
    let payload = (await play('start', { category: 'kaspa', mode: 'gauntlet' })).body;
    for (let qn = 0; qn < 10; qn++) {
      const q = loadQuestionBank('kaspa').questions.find(q => q.prompt === payload.question.prompt);
      const answer = { runId: payload.run.id, questionToken: payload.question.token, selectedIndex: payload.question.options.indexOf(q.options[q.correctIndex]) };
      const replies = await Promise.all([play('answer', answer), play('answer', answer)]); assert.ok(replies.every(r => r.statusCode === 200));
      if (qn < 9) payload = (await play('next', { runId: payload.run.id })).body;
      else { assert.equal(replies[0].body.profile.balance, (n + 1) * 100); assert.equal(replies[0].body.roundResult.reward, 100); }
    }
    const finish = await play('finish', { runId: payload.run.id }); assert.equal(finish.statusCode, 200); assert.equal(finish.body.profile.balance, (n + 1) * 100);
    assert.equal((await play('finish', { runId: payload.run.id })).body.profile.balance, (n + 1) * 100);
  }
  assert.equal(await fixture.command('EXISTS', ledgerKey(cookie.split('=')[1])), 0);
});
