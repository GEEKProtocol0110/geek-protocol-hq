import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import lobbiesHandler from '../api/lobbies.js';
import rewardsHandler from '../api/rewards.js';
import payoutReviewHandler from '../api/payout-review.js';
import identityHandler from '../api/identity.js';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { royaleKey, royaleQuestionsKey } from '../server/royale.js';
import { emptyLedger, ledgerKey, planTransaction } from '../server/economy-ledger.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.release-boundary.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-release-boundary-token';
process.env.AUDIT_LOG_SECRET = 'synthetic-release-boundary-audit-32-characters';
process.env.PAYOUT_REVIEW_ADMIN_TOKEN = 'synthetic-release-boundary-reviewer';
process.env.OPS_ACCESS_TOKEN = '';
delete process.env.OPS_TOTP_SECRET;
let indexerReads = 0;
globalThis.fetch = async (url, options) => {
  if (String(url) === 'https://api.kasplex.org/v1/krc20/token/GEEK') {
    assert.ok(!options?.method || options.method === 'GET');
    indexerReads++;
    const d = GEEK_DEPLOYMENT;
    return new Response(JSON.stringify({ message: 'successful', result: [{ tick: d.ticker, max: d.maxRaw, lim: d.limitRaw, pre: d.premintRaw, dec: String(d.decimals), mod: d.mode, to: d.deployer, hashRev: d.deploymentHash, minted: '174500000000000000', burned: '0', state: 'deployed' }] }));
  }
  assert.ok(String(url).startsWith('https://redis.release-boundary.test'), 'No unmocked external request is allowed');
  assert.equal(options.headers.Authorization, 'Bearer synthetic-release-boundary-token');
  const values = JSON.parse(options.body); let payload;
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else payload = { result: await fixture.command(...values) };
  return new Response(JSON.stringify(payload));
};
// The production mint loader captures fetch at module initialization. Install
// the network fixture before importing it so this suite never queries an indexer.
const { GEEK_DEPLOYMENT } = await import('../server/mint.js');
const { default: mintHandler } = await import('../api/mint.js');
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { await fixture.command('FLUSHDB'); indexerReads = 0; });

const call = async (handler, method, body, cookie = '', query = {}, headers = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(data) { this.body = data; return this; }, end() {} };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'x-forwarded-proto': 'https', 'content-type': 'application/json', 'user-agent': cookie || 'release-boundary-fixture', ...headers } }, res);
  return res;
};
const session = async name => {
  const res = await call(sessionHandler, 'POST', { displayName: name });
  assert.equal(res.statusCode, 200);
  return res.headers['Set-Cookie'].split(';')[0];
};
const playerId = cookie => cookie.split('=')[1];
const stored = async key => JSON.parse(await fixture.command('GET', key));
const hidden = body => {
  const privateFields = new Set(['correctIndex', 'questionId', 'questionIds', 'roundQuestionIds', 'usedQuestionIds', 'answerKey', 'questionHash', 'funFact', 'explanation']);
  const visit = value => {
    if (!value || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) { assert.ok(!privateFields.has(key), `Unexpected private field: ${key}`); visit(child); }
  };
  visit(body);
};
const noFuturePack = (body, pack, currentIndex) => {
  const json = JSON.stringify(body);
  for (const question of pack) assert.equal(json.includes(JSON.stringify(question.id)), false, 'Private bank IDs must not be returned');
  for (const question of pack.slice(currentIndex + 1)) assert.equal(json.includes(JSON.stringify(question.prompt)), false, 'Future prompts must not be returned');
};

for (const mode of ['gauntlet', 'daily', 'speed']) {
  test(`${mode}: all categories disclose only the committed answer and protect future questions across retries and players`, async () => {
    const outsider = await session('Other player');
    for (const category of Object.keys(categoryFiles)) {
      const cookie = await session('Boundary player');
      const started = await call(rankedHandler, 'POST', { action: 'start', category, mode }, cookie);
      assert.equal(started.statusCode, 201);
      const runId = started.body.run.id, runKey = `geek:run:${runId}`, run = await stored(runKey);
      const pack = run.roundQuestionIds.map(id => loadQuestionBank(category).byId.get(id));
      hidden(started.body); noFuturePack(started.body, pack, 0);
      assert.deepEqual(new Set(started.body.question.options), new Set(pack[0].options));
      const answer = { action: 'answer', runId, questionToken: started.body.question.token, selectedIndex: -1 };
      for (const [auth, token, status] of [[outsider, answer.questionToken, 404], [cookie, 'forged-token', 409]]) {
        const rejected = await call(rankedHandler, 'POST', { ...answer, questionToken: token }, auth);
        assert.equal(rejected.statusCode, status); hidden(rejected.body); noFuturePack(rejected.body, pack, 0);
      }
      const receipt = await call(rankedHandler, 'POST', answer, cookie);
      assert.equal(receipt.statusCode, 200);
      assert.equal(receipt.body.result.answer, pack[0].options[pack[0].correctIndex]);
      assert.equal(started.body.question.options[receipt.body.result.correctIndex], receipt.body.result.answer);
      assert.equal((await stored(runKey)).current, null);
      const { result, ...rest } = receipt.body; hidden(rest); noFuturePack(receipt.body, pack, 0);
      const retry = await call(rankedHandler, 'POST', { ...answer, selectedIndex: 0, correctIndex: 0 }, cookie);
      assert.deepEqual(retry.body, receipt.body);
      const other = await call(rankedHandler, 'POST', answer, outsider);
      assert.equal(other.statusCode, 404); hidden(other.body);
      const next = await call(rankedHandler, 'POST', { action: 'next', runId }, cookie);
      assert.equal(next.statusCode, 200); hidden(next.body); noFuturePack(next.body, pack, 1);
      assert.equal(next.body.question.prompt, pack[1].prompt);
    }
  });
}

test('Royale hides grades after every player answers and on refresh, then discloses only the expired question', async () => {
  const host = await session('Boundary host'), guest = await session('Boundary guest'), outsider = await session('Boundary outsider');
  const royale = (cookie, action, fields) => call(lobbiesHandler, action === 'view' ? 'GET' : 'POST', action === 'view' ? undefined : { action, ...fields }, cookie, { service: 'royale', ...(action === 'view' ? { code: fields.code } : {}) });
  const created = await royale(host, 'create', { category: 'kaspa', capacity: 2 }); assert.equal(created.statusCode, 201);
  const fields = { code: created.body.royale.code, eventId: created.body.royale.id };
  assert.equal((await royale(guest, 'join', fields)).statusCode, 200);
  for (const cookie of [host, guest]) assert.equal((await royale(cookie, 'ready', { ...fields, ready: true })).statusCode, 200);
  assert.equal((await royale(host, 'start', fields)).statusCode, 200);
  const pack = await stored(royaleQuestionsKey(fields.code));
  const advance = async age => {
    const room = await stored(royaleKey(fields.code)), time = await fixture.command('TIME');
    room.startsAt = Number(time[0]) * 1000 + Math.floor(Number(time[1]) / 1000) - age;
    await fixture.command('SET', royaleKey(fields.code), JSON.stringify(room), 'EX', 86400);
  };
  await advance(1000);
  for (const cookie of [host, guest]) {
    const answer = await royale(cookie, 'answer', { ...fields, questionNumber: 1, selectedIndex: pack[0].correctIndex });
    assert.equal(answer.statusCode, 200); hidden(answer.body); noFuturePack(answer.body, pack, 0);
    assert.equal(answer.body.royale.review, null); assert.equal(Object.hasOwn(answer.body.royale.yourAnswer, 'correct'), false);
  }
  const refresh = await royale(host, 'view', fields);
  hidden(refresh.body); noFuturePack(refresh.body, pack, 0); assert.equal(refresh.body.royale.state, 'question');
  assert.equal(JSON.stringify(refresh.body).includes(playerId(guest)), false);
  assert.equal((await royale(outsider, 'view', fields)).statusCode, 403);
  await advance(15001);
  const review = await royale(host, 'view', fields);
  assert.equal(review.body.royale.state, 'review'); assert.equal(review.body.royale.review.correctIndex, pack[0].correctIndex);
  assert.equal(review.body.royale.yourAnswer.correct, true); noFuturePack(review.body, pack, 0);
});

test('configured reserve, supplied enable flags and approved payout review cannot enable settlement or mutate monetary state', async () => {
  process.env.GEEK_SETTLEMENT_ENABLED = 'true';
  process.env.GEEK_REWARD_RESERVE_ADDRESS = GEEK_DEPLOYMENT.deployer;
  const cookie = await session('Settlement boundary'), id = playerId(cookie);
  const flags = { settlementEnabled: true, withdrawalsEnabled: true, purchasesEnabled: true, payoutsEnabled: true, burnsEnabled: true, confirmed: true };
  const saved = await call(rewardsHandler, 'POST', { address: GEEK_DEPLOYMENT.deployer, acknowledged: true, ...flags }, cookie);
  assert.equal(saved.statusCode, 200);
  const approved = await call(payoutReviewHandler, 'POST', { id: saved.body.payout.review.reference, action: 'approve', note: 'Synthetic review acceptance', ...flags }, cookie, {}, { 'x-payout-review-admin': process.env.PAYOUT_REVIEW_ADMIN_TOKEN });
  assert.equal(approved.statusCode, 200); assert.equal(approved.body.review.status, 'approved'); assert.equal(approved.body.settlementEnabled, false);
  const rewards = await call(rewardsHandler, 'GET', undefined, cookie);
  assert.equal(rewards.body.payout.review.status, 'approved'); assert.equal(rewards.body.payout.review.settlementEnabled, false);
  assert.equal(rewards.body.payout.withdrawalsEnabled, false); assert.equal(rewards.body.payout.settlementEligible, false);
  const identity = await call(identityHandler, 'GET', undefined, cookie); assert.equal(identity.statusCode, 200); assert.equal(identity.body.identity.settlementEnabled, false);
  const economy = await call(sessionHandler, 'GET', undefined, cookie, { service: 'economy' });
  assert.equal(economy.statusCode, 200); assert.equal(economy.body.economy.reserve.configuration, 'address-configured');
  for (const field of ['purchasesEnabled', 'payoutsEnabled', 'burnsEnabled']) assert.equal(economy.body.economy[field], false);
  for (const field of ['transfersEnabled', 'purchasesEnabled', 'payoutsEnabled', 'burnsEnabled']) assert.equal(economy.body.economy.policy[field], false);
  assert.equal(economy.body.economy.reserve.signingEnabled, false); assert.equal(economy.body.economy.reserve.fundingVerified, false);
  const ledger = planTransaction(emptyLedger(), { reference: 'boundary_receipt_0001', kind: 'reward-payout', grossRaw: '100000000', feeRaw: '0' }, 1000).state;
  await fixture.command('SET', ledgerKey(id), JSON.stringify(ledger));
  const keys = [`geek:profile:${id}`, ledgerKey(id), `geek:payout-review:${saved.body.payout.review.reference}`, `geek:session:${id}`];
  const before = await Promise.all(keys.map(key => fixture.command('GET', key)));
  for (const action of ['transfer', 'withdraw', 'redeem', 'settle', 'purchase', 'payout', 'burn', 'ledger-write']) {
    const rejected = await call(sessionHandler, 'POST', { action, address: GEEK_DEPLOYMENT.deployer, amount: '999999', playerId: id, ...flags }, cookie, { service: 'economy' });
    assert.equal(rejected.statusCode, 409); assert.equal(rejected.body.code, 'ECONOMY_TRANSFERS_DISABLED');
    for (const field of ['purchasesEnabled', 'payoutsEnabled', 'burnsEnabled']) assert.equal(rejected.body[field], false);
  }
  assert.deepEqual(await Promise.all(keys.map(key => fixture.command('GET', key))), before);
  assert.equal(indexerReads, 0);
});

test('mint API exposes only a user-approved mint inscription and refuses server-side transaction requests', async () => {
  const status = await call(mintHandler, 'GET', undefined, '', { fresh: '1' });
  assert.equal(status.statusCode, 200); assert.equal(indexerReads, 1);
  assert.equal(status.body.transaction.userApprovalRequired, true); assert.equal(status.body.transaction.custodial, false);
  assert.deepEqual(JSON.parse(status.body.transaction.inscription), { p: 'KRC-20', op: 'mint', tick: 'GEEK' });
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    const rejected = await call(mintHandler, method, { action: 'transfer', address: GEEK_DEPLOYMENT.deployer, amount: '999999', settlementEnabled: true });
    assert.equal(rejected.statusCode, 405);
  }
  assert.equal(indexerReads, 1); assert.deepEqual(await fixture.command('KEYS', '*'), []);
});
