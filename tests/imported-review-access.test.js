import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import operations from '../server/operations.js';
import { loadQuestionBank } from '../server/questions.js';
import { importedReviewKey } from '../server/imported-review.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.import-review.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-import-review-token';
process.env.AUDIT_LOG_SECRET = 'synthetic-import-review-audit-key-32-characters';
process.env.CCE_ADMIN_TOKEN = 'synthetic-import-review-owner-key-32-characters';
delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_TOTP_SECRET;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.import-review.test'));
  const values = JSON.parse(options.body);
  const result = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result })) :
    String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
  return Response.json(result);
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { await fixture.command('FLUSHDB'); });
const call = async ({ method = 'GET', action = 'imported', path = '', cookie = '', body = {}, query = {}, headers = {} } = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; } };
  await operations({ method, query: { action, path, ...query }, body, headers: { cookie, origin: 'https://www.geekprotocol.xyz', host: 'www.geekprotocol.xyz', 'content-type': 'application/json', ...headers } }, res);
  return res;
};
const login = async () => {
  const r = await call({ method: 'POST', action: 'login', body: { key: process.env.CCE_ADMIN_TOKEN } });
  assert.equal(r.statusCode, 200); return r.headers['Set-Cookie'].split(';')[0];
};
const proposal = rows => ({ category: 'technology', decision: 'retire', note: 'Checked this source and found an editorial issue.', sourceChecked: true,
  items: rows.map(r => ({ id: r.question.id, revision: r.revision, reviewVersion: r.proposal?.version || '' })) });

test('anonymous requests cannot read imported answers or private workspace assets', async () => {
  const r = await call(); assert.equal(r.statusCode, 401); assert.match(r.headers['Cache-Control'], /private/);
  assert.equal(JSON.stringify(r.body).includes('correctIndex'), false);
  assert.equal((await call({ action: '', path: 'imported' })).statusCode, 303);
  assert.equal((await call({ action: '', path: 'assets/imported.js' })).statusCode, 401);
});
test('owner reads a bounded page without mutating source questions', async () => {
  const cookie = await login(), q = JSON.stringify(loadQuestionBank('technology').questions);
  const r = await call({ cookie }); assert.equal(r.statusCode, 200); assert.equal(r.body.rows.length, 10);
  assert.ok(r.body.rows.every(row => Number.isInteger(row.question.correctIndex)));
  assert.equal((await call({ cookie, action: '', path: 'imported' })).statusCode, 200);
  assert.equal((await call({ cookie, action: '', path: 'assets/imported.js' })).statusCode, 200);
  assert.equal(JSON.stringify(loadQuestionBank('technology').questions), q);
});
test('cross-site, wrong-origin, key-header and form requests cannot read or change reviews', async () => {
  const cookie = await login(), rows = (await call({ cookie })).body.rows;
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { 'x-cce-admin': 'wrong' }]) {
    assert.equal((await call({ cookie, headers })).statusCode, 403);
    assert.equal((await call({ cookie, method: 'POST', body: proposal(rows.slice(0, 1)), headers })).statusCode, 403);
  }
  for (const headers of [{ origin: '' }, { 'content-type': 'application/x-www-form-urlencoded' }]) assert.equal((await call({ cookie, method: 'POST', body: proposal(rows.slice(0, 1)), headers })).statusCode, 403);
});
test('bulk review compares every version before any write, so stale selections cannot partially commit', async () => {
  const cookie = await login(), first = (await call({ cookie })).body.rows.slice(0, 2), body = proposal(first);
  assert.equal((await call({ cookie, method: 'POST', body: proposal(first.slice(0, 1)) })).statusCode, 200);
  const saved = await fixture.command('GET', importedReviewKey('technology', first[0].question.id));
  assert.equal((await call({ cookie, method: 'POST', body })).statusCode, 409);
  assert.equal(await fixture.command('GET', importedReviewKey('technology', first[0].question.id)), saved);
  assert.equal(await fixture.command('GET', importedReviewKey('technology', first[1].question.id)), null);
  const refreshed = (await call({ cookie })).body.rows.slice(0, 2);
  const result = await call({ cookie, method: 'POST', body: proposal(refreshed) });
  assert.equal(result.statusCode, 200); assert.equal(result.body.saved, 2); assert.equal(result.body.published, false);
  assert.ok(await fixture.command('TTL', importedReviewKey('technology', first[0].question.id)) > 0);
});
test('invalid bodies and corrupted storage are rejected without replacing records', async () => {
  const cookie = await login(), row = (await call({ cookie })).body.rows[0], key = importedReviewKey('technology', row.question.id);
  for (const body of [proposal([]), { ...proposal([row]), sourceChecked: false }, { ...proposal([row]), items: [proposal([row]).items[0], proposal([row]).items[0]] }]) assert.equal((await call({ cookie, method: 'POST', body })).statusCode, 400);
  await fixture.command('SET', key, '{broken');
  assert.equal((await call({ cookie })).statusCode, 503);
  assert.equal((await call({ cookie, method: 'POST', body: proposal([row]) })).statusCode, 503);
  assert.equal(await fixture.command('GET', key), '{broken');
  const damaged = JSON.stringify({ schema: 99, version: 'a'.repeat(24), category: 'technology', id: row.question.id });
  await fixture.command('SET', key, damaged);
  const stale = proposal([row]); stale.items[0].reviewVersion = 'a'.repeat(24);
  assert.equal((await call({ cookie, method: 'POST', body: stale })).statusCode, 503);
  assert.equal(await fixture.command('GET', key), damaged);
});
