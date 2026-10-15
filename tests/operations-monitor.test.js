import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import { expectedProbe } from './helpers/monitor-fixture.js';
import operations from '../server/operations.js';
import { monitorHistoryKey, monitorLockKey } from '../server/operations-monitor.js';
import { monitorChecks, MONITOR_ORIGIN } from '../server/production-monitor.js';
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.monitor.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-monitor-token';
process.env.AUDIT_LOG_SECRET = 'synthetic-monitor-audit-key-32-characters'; process.env.CCE_ADMIN_TOKEN = 'synthetic-monitor-owner-key-32-characters';
delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_TOTP_SECRET;
let probes = 0, failing = false;
globalThis.fetch = async (url, options) => {
  if (String(url).startsWith(MONITOR_ORIGIN)) {
    probes++; assert.equal(options.credentials, 'omit'); assert.equal(options.headers.Cookie, undefined); assert.equal(options.headers.Authorization, undefined);
    const spec = monitorChecks.find(s => MONITOR_ORIGIN + s.path === url); assert.ok(spec);
    return failing && spec.id === 'health' ? new Response('', { status: 503 }) : expectedProbe(spec);
  }
  assert.ok(String(url).startsWith('https://redis.monitor.test'));
  const values = JSON.parse(options.body), result = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result })) : String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
  return Response.json(result);
};
beforeEach(async () => { await fixture.command('FLUSHDB'); probes = 0; failing = false; });
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const call = async ({ method = 'GET', action = 'monitor', cookie = '', body = {}, path = '', headers = {} } = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; }, end(v) { this.body = v; } };
  await operations({ method, query: { action, path }, body, headers: { cookie, origin: MONITOR_ORIGIN, host: 'www.geekprotocol.xyz', 'content-type': 'application/json', ...headers } }, res); return res;
};
const login = async () => { const res = await call({ method: 'POST', action: 'login', body: { key: process.env.CCE_ADMIN_TOKEN } }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const run = cookie => call({ method: 'POST', cookie, body: { action: 'run' } });
test('monitor pages, APIs and assets remain private; GET only reads history and never performs probes', async () => {
  assert.equal((await call()).statusCode, 401); assert.equal((await call({ action: '', path: 'monitor' })).statusCode, 303); assert.equal((await call({ action: '', path: 'assets/monitor.js' })).statusCode, 401);
  const cookie = await login(), read = await call({ cookie }); assert.equal(read.statusCode, 200); assert.deepEqual(read.body.history, []); assert.match(read.headers['Cache-Control'], /private.*no-store/); assert.equal(probes, 0);
  assert.equal((await call({ cookie, action: '', path: 'monitor' })).statusCode, 200);
  for (const headers of [{ origin: 'https://evil.invalid' }, { 'sec-fetch-site': 'cross-site' }, { authorization: 'bad' }]) assert.equal((await call({ cookie, headers })).statusCode, 403);
  assert.equal((await call({ method: 'POST', cookie, body: { action: 'run' }, headers: { origin: '' } })).statusCode, 403);
  assert.equal((await call({ method: 'POST', cookie, body: { action: 'run', url: 'https://evil.invalid/' } })).statusCode, 400);
  assert.equal(probes, 0);
});
test('a global lock prevents duplicate probes and failures are saved as failures with a bounded history', async () => {
  const cookie = await login(), results = await Promise.all([run(cookie), run(cookie)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); assert.equal(probes, 20);
  assert.equal((await call({ cookie })).body.history[0].passed, true);
  const saved = await fixture.command('LINDEX', monitorHistoryKey, 0);
  for (let n = 0; n < 24; n++) await fixture.command('RPUSH', monitorHistoryKey, saved);
  assert.ok(await fixture.command('TTL', monitorLockKey) > 0);
  await fixture.command('DEL', monitorLockKey); failing = true;
  assert.equal((await run(cookie)).body.report.passed, false);
  const read = await call({ cookie }); assert.equal(read.body.history.length, 25); assert.equal(read.body.history[0].checks.find(c => c.id === 'health').status, 503);
  assert.ok(await fixture.command('TTL', monitorHistoryKey) > 0);
});
test('damaged evidence is unavailable without overwriting historical records', async () => {
  const cookie = await login(); await fixture.command('LPUSH', monitorHistoryKey, '{damaged');
  assert.equal((await call({ cookie })).statusCode, 503); assert.equal(await fixture.command('LINDEX', monitorHistoryKey, 0), '{damaged');
});
