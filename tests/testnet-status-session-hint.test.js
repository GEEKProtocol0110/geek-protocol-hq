import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, json } from './helpers/client-fixture.js';

// Fake data only. The hint is a UX shortcut; the server still authorizes every status read.
const source = readFileSync(new URL('../public/play/assets/testnet-status.js', import.meta.url), 'utf8');
const siteSource = readFileSync(new URL('../public/assets/site.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
const storage = (initial = {}) => { const map = new Map(Object.entries(initial)); return { map, getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: k => map.delete(k) }; };
const ok = () => json({ ok: true, enabled: true, enrollment: { enabled: true }, records: [{ state: 'queued' }] });

async function setup(localStorage, reply = ok) {
  const requests = [], listeners = new Map();
  const ui = clientFixture(async url => { requests.push(url); return reply(); }, { localStorage });
  const panel = ui.node('[data-testnet-status]'); panel.hidden = true;
  ui.document.addEventListener = (name, handler) => listeners.set(name, handler);
  ui.run(source); await settle();
  return { ui, requests, panel, emit: async name => { await listeners.get(name)?.(); await settle(); } };
}

test('signed-out visitor: no status request, so no 401 console noise', async () => {
  const { requests, panel, ui } = await setup(storage());
  assert.deepEqual(requests, []); assert.equal(panel.hidden, true);
  assert.equal([...ui.timers.values()].some(t => t.delay === 15000), false, 'no polling while signed out');
});

test('signed-in hint: the private status check still happens and keeps polling', async () => {
  const store = storage({ 'geek-session-hint': 'signed-in' });
  const { requests, panel, ui } = await setup(store);
  assert.deepEqual(requests, ['/api/rewards/?service=testnet']);
  assert.match(panel.textContent, /queued/);
  assert.ok([...ui.timers.values()].some(t => t.delay === 15000));
});

test('stale signed-in hint: a 401 clears the hint so the next visit stays quiet', async () => {
  const store = storage({ 'geek-session-hint': 'signed-in' });
  const { requests, panel } = await setup(store, () => json({ ok: false }, 401));
  assert.equal(requests.length, 1); assert.equal(panel.hidden, true);
  assert.equal(store.map.has('geek-session-hint'), false);
  const again = await setup(store);
  assert.deepEqual(again.requests, []);
});

test('unknown state: unrecognised hint skips the automatic read; sign-in or a saved run reads and records the hint', async () => {
  const store = storage({ 'geek-session-hint': 'maybe' });
  const ui = await setup(store);
  assert.deepEqual(ui.requests, []);
  await ui.emit('geek:signed-in');
  assert.deepEqual(ui.requests, ['/api/rewards/?service=testnet']);
  assert.equal(store.map.get('geek-session-hint'), 'signed-in');
  await ui.emit('geek:signed-out');
  assert.equal(store.map.has('geek-session-hint'), false);
});

test('storage unavailable: falls back to the previous behaviour and still asks the server', async () => {
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  const { requests } = await setup(blocked);
  assert.deepEqual(requests, ['/api/rewards/?service=testnet']);
});

test('site.js records the hint on any page sign-in and clears it on sign-out', () => {
  const store = storage(), listeners = new Map();
  const ui = clientFixture(async () => json({}), { localStorage: store });
  ui.document.addEventListener = (name, handler) => listeners.set(name, handler);
  ui.context.window.scrollY = 0; ui.context.window.matchMedia = () => ({ matches: true, addEventListener() {} });
  try { ui.run(siteSource); } catch { /* Unrelated DOM features are not modelled here. */ }
  assert.ok(listeners.has('geek:signed-in'), 'sign-in listener registered');
  listeners.get('geek:signed-in')(); assert.equal(store.map.get('geek-session-hint'), 'signed-in');
  listeners.get('geek:signed-out')(); assert.equal(store.map.has('geek-session-hint'), false);
});
