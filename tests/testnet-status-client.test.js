import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json, aborted } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/play/assets/testnet-status.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
const status = (patch = {}) => ({ ok: true, enabled: true, enrollment: { enabled: true }, records: [{ state: 'queued' }], ...patch });
async function setup(reply = () => json(status())) {
  const requests = [], listeners = new Map();
  const ui = clientFixture(async (url, options) => { requests.push({ url, options }); return reply(options, requests.length); });
  const panel = ui.node('[data-testnet-status]'); panel.hidden = true;
  ui.document.addEventListener = (name, handler) => listeners.set(name, handler);
  ui.run(source); await settle();
  return { ...ui, requests, panel,
    async documentEvent(name) { await listeners.get(name)?.(); await settle(); },
    async fire(delay = 15000) {
      const [id, timer] = [...ui.timers].find(([, t]) => t.delay === delay) || [];
      assert.ok(timer, `Expected ${delay}ms timer`); ui.timers.delete(id); await timer.fn(); await settle();
    }
  };
}

test('player status uses private canonical reads and distinguishes queued, paused and confirmed payments', async () => {
  let payload = status();
  const ui = await setup(() => json(payload));
  assert.match(ui.panel.textContent, /queued for the automatic reward service/);
  payload = status({ enabled: false }); await ui.fire();
  assert.match(ui.panel.textContent, /saved.*paused/);
  assert.doesNotMatch(ui.panel.textContent, /will be sent|being confirmed/);
  payload = status({ enabled: false, records: [{ state: 'prepared' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /saved.*paused/);
  payload = status({ enabled: false, records: [{ state: 'indexed-confirmed' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /test reward received/);
  for (const { url, options } of ui.requests) {
    assert.equal(url, '/api/rewards/?service=testnet');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.method, undefined); assert.equal(options.body, undefined);
  }
});

test('temporary network and HTTP failures keep retrying and replace stale success text', async () => {
  let outcome = 'network';
  const ui = await setup(() => {
    if (outcome === 'network') throw new Error('offline');
    return outcome === 'http' ? json({ ok: false }, 503) : json(status());
  });
  assert.equal(ui.panel.hidden, true);
  outcome = 'ok'; await ui.fire(); assert.equal(ui.panel.hidden, false);
  outcome = 'http'; await ui.fire(); assert.match(ui.panel.textContent, /status is unavailable/);
  outcome = 'ok'; await ui.fire(); assert.match(ui.panel.textContent, /queued/);
  assert.equal(ui.requests.length, 4);
});

test('lost access or missing enrollment clears the previous player status and stops timed polling', async () => {
  for (const reply of [() => json({ ok: false }, 401), () => json({ ok: false }, 403),
    () => json(status({ enrollment: null, records: [] }))]) {
    let denied = false;
    const ui = await setup(() => denied ? reply() : json(status()));
    denied = true; await ui.fire();
    assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
    assert.equal(ui.timers.size, 0);
  }
});

test('a saved-run event during an older read triggers a fresh read without overlapping requests', async () => {
  const pending = deferred();
  const ui = await setup((options, count) => count === 1 ? pending.promise : json(status()));
  await ui.window.emit('geek:run-saved');
  await ui.window.emit('geek:run-saved');
  assert.equal(ui.requests.length, 1);
  pending.resolve(json(status({ records: [] }))); await settle();
  assert.equal(ui.requests.length, 2); assert.match(ui.panel.textContent, /queued/);
});

test('enrollment and confirmed views continue discovering later rewards', async () => {
  let payload = status({ records: [] });
  const ui = await setup(() => json(payload));
  assert.match(ui.panel.textContent, /sent automatically/);
  payload = status({ records: [{ state: 'indexed-confirmed' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /test reward received/);
  payload = status(); await ui.fire(); assert.match(ui.panel.textContent, /queued/);
});

test('request timeouts recover on the next bounded poll', async () => {
  const ui = await setup((options, count) => count === 1 ? aborted(options.signal) : json(status()));
  await ui.fire(10000); assert.equal(ui.requests[0].options.signal.aborted, true);
  await ui.fire(); assert.match(ui.panel.textContent, /queued/);
});

test('backgrounding cancels private reads and a late reply cannot restore the hidden status', async () => {
  const pending = deferred();
  const ui = await setup((options, count) => count === 1 ? pending.promise : json(status({ records: [] })));
  ui.document.hidden = true; await ui.documentEvent('visibilitychange');
  assert.equal(ui.requests[0].options.signal.aborted, true);
  await ui.window.emit('geek:run-saved'); assert.equal(ui.requests.length, 1);
  pending.resolve(json(status())); await settle();
  assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, ''); assert.equal(ui.timers.size, 0);
  ui.document.hidden = false; await ui.documentEvent('visibilitychange');
  assert.match(ui.panel.textContent, /sent automatically/); assert.equal(ui.requests.length, 2);
});

test('new player and page-cache return discard old responses and old deadlines target only their own request', async () => {
  const old = deferred(), current = deferred();
  const ui = await setup((options, count) => count === 1 ? old.promise : count === 2 ? current.promise : json(status({ enrollment: null, records: [] })));
  const oldDeadline = [...ui.timers.values()].find(t => t.delay === 10000).fn;
  await ui.documentEvent('geek:signed-in'); assert.equal(ui.requests.length, 2);
  oldDeadline(); assert.equal(ui.requests[1].options.signal.aborted, false);
  old.resolve(json(status())); await settle(); assert.equal(ui.panel.hidden, true);
  current.resolve(json(status({ records: [] }))); await settle(); assert.match(ui.panel.textContent, /sent automatically/);
  await ui.window.emit('pagehide'); assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
  await ui.window.emit('pageshow', { persisted: true }); await settle();
  assert.equal(ui.requests.length, 3); assert.equal(ui.panel.hidden, true);
});
