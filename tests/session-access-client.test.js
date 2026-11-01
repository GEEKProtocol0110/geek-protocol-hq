import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/assets/session-hint.js', import.meta.url), 'utf8') + readFileSync(new URL('../public/assets/session-access.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
async function mount(reply, controls = true) {
  const calls = [], redirects = [], events = [], listeners = new Map();
  const ui = clientFixture(async (path, options = {}) => { calls.push({ path, options }); return reply(options, calls.length); });
  ui.context.location.replace = path => redirects.push(path);
  ui.document.addEventListener = (name, fn) => { listeners.set(name, [...(listeners.get(name) || []), fn]); };
  ui.document.dispatchEvent = event => { events.push(event); for (const fn of listeners.get(event.type) || []) fn(event); };
  const button = controls ? ui.node('[data-sign-out]', 'button') : null;
  if (controls) ui.node('[data-sign-out-status]');
  if (button) button.hidden = true;
  ui.run(source); await settle();
  return { ...ui, button, calls, redirects, events, emit: (name, detail) => ui.document.dispatchEvent(new CustomEvent(name, { detail })) };
}

test('wallet and passkey sessions see sign-out while guests stay unmodified', async () => {
  for (const state of [{ signedIn: true }, { walletLinked: true }, { signedIn: false, walletLinked: false }]) {
    const ui = await mount(() => json({ ok: true, ...state }));
    assert.equal(ui.button.hidden, !Boolean(state.signedIn || state.walletLinked));
    assert.equal(ui.calls.length, 1); assert.equal(ui.calls[0].options.method, undefined);
    assert.equal(ui.calls[0].options.credentials, 'same-origin'); assert.equal(ui.calls[0].options.cache, 'no-store');
  }
  const ui = await mount(() => assert.fail('No account requests on unrelated pages'), false); assert.equal(ui.calls.length, 0);
});

test('one tap ends the session before navigating and repeated taps do not duplicate logout', async () => {
  const wait = deferred();
  const ui = await mount(options => options.method === 'POST' ? wait.promise : json({ ok: true, walletLinked: true }));
  const first = ui.button.emit('click'); await settle(); await ui.button.emit('click');
  assert.equal(ui.button.disabled, true); assert.deepEqual(ui.redirects, []);
  const writes = ui.calls.filter(c => c.options.method === 'POST'); assert.equal(writes.length, 1);
  assert.equal(writes[0].path, '/api/passkeys/'); assert.deepEqual(JSON.parse(writes[0].options.body), { action: 'logout' });
  wait.resolve(json({ ok: true, signedOut: true })); await first;
  assert.deepEqual(ui.redirects, ['/sign-in/?signedOut=1']); assert.equal(ui.button.hidden, true);
  assert.equal(ui.events.at(-1).type, 'geek:signed-out');
});

test('failed logout keeps a usable retry and does not falsely claim the user is signed out', async () => {
  const ui = await mount(options => options.method === 'POST' ? json({ ok: false }, 503) : json({ ok: true, signedIn: true }));
  await ui.button.emit('click');
  assert.deepEqual(ui.redirects, []); assert.equal(ui.button.hidden, false); assert.equal(ui.button.disabled, false);
  assert.match(ui.node('[data-sign-out-status]').textContent, /Could not confirm sign-out/);
});

test('an already-expired session can return to sign-in without an extra confirmation', async () => {
  const ui = await mount(options => options.method === 'POST' ? json({ ok: false }, 401) : json({ ok: true, walletLinked: true }));
  await ui.button.emit('click'); assert.deepEqual(ui.redirects, ['/sign-in/?signedOut=1']);
});

test('a late signed-in status cannot restore controls after logout', async () => {
  const old = deferred();
  const ui = await mount(options => options.method === 'POST' ? json({ ok: true, signedOut: true }) : old.promise);
  ui.emit('geek:account-status', { walletLinked: true }); await ui.button.emit('click');
  old.resolve(json({ ok: true, walletLinked: true })); await settle();
  ui.emit('geek:account-status', { walletLinked: true });
  assert.equal(ui.button.hidden, true); assert.deepEqual(ui.redirects, ['/sign-in/?signedOut=1']);
});
