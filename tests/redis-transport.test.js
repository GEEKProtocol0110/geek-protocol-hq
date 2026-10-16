import test from 'node:test';
import assert from 'node:assert/strict';
import { redis } from '../server/redis.js';
import { handleApiError } from '../server/http.js';

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.transport.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-only-token';
const stalled = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Connection lost')), { once: true }));
for (const phase of ['headers', 'body']) test(`database ${phase} stalls stop at the deadline without retrying a possibly saved write`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0, signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++; signal = options.signal;
    assert.equal(JSON.parse(options.body)[0], 'SET');
    if (phase === 'headers') return stalled(signal);
    return { ok: true, json: () => stalled(signal) };
  });
  const result = redis('SET', 'synthetic:key', 'value');
  await Promise.resolve(); await Promise.resolve();
  const rejection = assert.rejects(result, /^Error: REDIS_TIMEOUT$/);
  t.mock.timers.tick(7999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await rejection;
  assert.equal(signal.aborted, true); assert.equal(requests, 1);
});

test('completed database requests clear their deadline and unavailable services expose no provider details', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { signal = options.signal; return new Response('{"result":"OK"}'); });
  assert.equal(await redis('SET', 'synthetic:key', 'value'), 'OK');
  t.mock.timers.tick(8000); assert.equal(signal.aborted, false);
  globalThis.fetch = async () => new Response('{"error":"private-provider-detail"}', {status:503});
  let failure; try { await redis('GET','synthetic:key'); } catch (error) { failure=error; }
  const res = { status(code) { this.statusCode=code; return this; }, setHeader() {}, json(body) { this.body=body; } };
  handleApiError(res,failure);
  assert.equal(res.statusCode,503); assert.equal(res.body.code,'SERVICE_UNAVAILABLE');
  assert.match(res.body.error,/check your saved state/);
  assert.doesNotMatch(JSON.stringify(res.body),/private-provider-detail|synthetic-only-token/);
});
