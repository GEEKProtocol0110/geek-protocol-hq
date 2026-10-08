import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped request function without replacing it with a test copy.
const source = readFileSync(new URL('../public/study/assets/study.js', import.meta.url), 'utf8');
const start = source.indexOf('  const request = '), end = source.indexOf('  const clearError = ', start);
const client = fetch => {
  let timeout, cleared = 0;
  const context = vm.createContext({ fetch, AbortController, setTimeout(fn, delay) { assert.equal(delay, 15_000); timeout = fn; return 1; }, clearTimeout() { cleared++; } });
  vm.runInContext(`${source.slice(start, end)}globalThis.call = request;`, context);
  return { call: context.call, expire: () => timeout(), cleared: () => cleared };
};
const aborted = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Connection stalled')), { once: true }));

test('Study unlocks a stalled request without automatically repeating an answer', async () => {
  const requests = [];
  const c = client((url, options) => { requests.push({ url, options }); return aborted(options.signal); });
  const answer = { action: 'answer', runId: 'saved-run', questionToken: 'saved-question', selectedIndex: 2 };
  const pending = c.call('/api/ranked/?service=study', answer);
  c.expire();
  await assert.rejects(pending, /taking too long.*saved practice/);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(requests[0].options.body), answer);
  assert.equal(c.cleared(), 1);
});

test('Study also bounds waiting for a response body after headers arrive', async () => {
  let reading;
  const bodyStarted = new Promise(resolve => { reading = resolve; });
  const c = client(async (url, options) => ({ ok: true, status: 200, json() { reading(); return aborted(options.signal); } }));
  const pending = c.call('/api/ranked/?service=study');
  await bodyStarted; c.expire();
  await assert.rejects(pending, /taking too long/);
  assert.equal(c.cleared(), 1);
});

test('Study preserves conflicts for resume and clears timers on completed responses', async () => {
  const c = client(async () => ({ ok: false, status: 409, json: async () => ({ error: 'That saved question already changed.' }) }));
  await assert.rejects(c.call('/api/ranked/?service=study', { action: 'next' }), e => e.status === 409 && /already changed/.test(e.message));
  assert.equal(c.cleared(), 1);
  const success = client(async () => ({ ok: true, status: 200, json: async () => ({ ok: true, run: { id: 'same-run' } }) }));
  assert.equal((await success.call('/api/ranked/?service=study')).run.id, 'same-run');
  assert.equal(success.cleared(), 1);
});
