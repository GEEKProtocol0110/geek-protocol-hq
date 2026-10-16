import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/sign-in/assets/sign-in.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const mount = async ({ exec = false, clipboard } = {}) => {
  let now = 100000;
  const message = 'GEEK Protocol Identity Proof\nOrigin: https://www.geekprotocol.xyz\nChallenge: exact café + / =\nNo transaction.\n';
  const challenge = { challengeId: 'synthetic-proof', message, expiresAt: now + 300000 };
  const requests = [], selections = [], events = [];
  const ui = clientFixture(async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null; requests.push({ path, body });
    if (!body) return json({ identity: { linked: false } });
    if (path === '/api/session') return json({});
    if (body.action === 'challenge') return json({ challenge });
    if (body.action === 'verify') return json({ identity: { linked: true }, recovered: true });
    throw new Error('Unexpected request');
  }, { navigator: { clipboard }, Date: class extends Date { static now() { return now; } } });
  for (const selector of ['[data-address-form]', '[data-signature-form]']) ui.node(selector).append(ui.make('button'));
  const input = ui.node('[data-login-message]'); input.select = () => selections.push(input.value);
  input.setSelectionRange = (start, end) => { input.selectionStart = start; input.selectionEnd = end; };
  if (exec !== 'absent') ui.document.execCommand = command => {
    assert.equal(command, 'copy'); assert.equal(ui.document.activeElement, input);
    assert.deepEqual([input.selectionStart, input.selectionEnd], [0, message.length]);
    return typeof exec === 'function' ? exec(input.value) : exec;
  };
  ui.document.dispatchEvent = event => events.push(event);
  ui.run(source); await tick();
  ui.node('[data-login-address]').value = 'kaspa:synthetic-test-address';
  await ui.node('[data-address-form]').emit('submit');
  return { ...ui, message, challenge, requests, selections, events, setNow(value) { now = value; } };
};

test('a tap copies the exact message through selection before awaiting a Clipboard API', async () => {
  const copied = []; const ui = await mount({ exec: text => { copied.push(text); return true; }, clipboard: { writeText() { throw new Error('Must not call'); } } });
  ui.node('[data-login-message]').value = 'cropped message';
  await ui.node('[data-copy-message]').emit('click');
  assert.deepEqual(copied, [ui.message]); assert.match(ui.node('[data-manual-status]').textContent, /Message copied/);
  assert.equal(ui.requests.filter(r => r.body?.action === 'verify').length, 0);
});
test('Clipboard API copies all line breaks when selection copy is unavailable', async () => {
  const copied = []; const ui = await mount({ exec: 'absent', clipboard: { writeText: async text => copied.push(text) } });
  await ui.node('[data-copy-message]').emit('click'); assert.deepEqual(copied, [ui.message]);
  assert.match(ui.node('[data-manual-status]').textContent, /Message copied/);
});
test('clipboard denial leaves a whole-message selection and usable manual guidance', async () => {
  const ui = await mount({ exec: () => { throw new Error('blocked'); }, clipboard: { writeText: async () => { throw new Error('denied'); } } });
  await ui.node('[data-copy-message]').emit('click');
  assert.match(ui.node('[data-manual-status]').textContent, /Touch and hold.*Copy/);
  assert.doesNotMatch(ui.node('[data-manual-status]').textContent, /Message copied/);
  assert.equal(ui.node('[data-copy-message]').disabled, false); assert.equal(ui.node('[data-proof-step]').hidden, false);
  assert.deepEqual(ui.selections, [ui.message, ui.message]);
});
test('the explicit select action works without clipboard APIs and makes no server write', async () => {
  const ui = await mount(); const count = ui.requests.length;
  await ui.node('[data-select-message]').emit('click');
  assert.deepEqual(ui.selections, [ui.message]); assert.equal(ui.requests.length, count);
  await ui.node('[data-copy-message]').emit('click'); assert.match(ui.node('[data-manual-status]').textContent, /Message selected/);
});
test('a hanging clipboard prompt has a bounded wait and returns to manual selection', async () => {
  const wait = deferred(), ui = await mount({ clipboard: { writeText: () => wait.promise } });
  const copying = ui.node('[data-copy-message]').emit('click'); await tick();
  assert.equal(ui.node('[data-copy-message]').disabled, true); ui.expire(2000); await copying;
  assert.equal(ui.node('[data-copy-message]').disabled, false); assert.match(ui.node('[data-manual-status]').textContent, /Message selected/);
  wait.resolve(); await tick(); assert.match(ui.node('[data-manual-status]').textContent, /Message selected/);
});
test('a late clipboard result cannot replace the message after an address edit', async () => {
  const wait = deferred(), ui = await mount({ clipboard: { writeText: () => wait.promise } });
  const copying = ui.node('[data-copy-message]').emit('click'); await tick();
  await ui.node('[data-login-address]').emit('input'); wait.resolve(); await copying;
  assert.equal(ui.node('[data-login-message]').value, ''); assert.equal(ui.node('[data-proof-step]').hidden, true);
  assert.match(ui.node('[data-manual-status]').textContent, /Create a new message/);
});
test('expired messages cannot be copied or selected for a fresh login', async () => {
  const copied = [], ui = await mount({ exec: text => { copied.push(text); return true; } });
  ui.setNow(ui.challenge.expiresAt); await ui.node('[data-copy-message]').emit('click');
  assert.equal(copied.length, 0); assert.equal(ui.node('[data-login-message]').value, '');
  assert.match(ui.node('[data-manual-status]').textContent, /expired/);
});
test('copying does not sign in; a separately pasted signature verifies once and clears the message', async () => {
  const ui = await mount({ exec: true }); await ui.node('[data-copy-message]').emit('click');
  assert.equal(ui.events.length, 0);
  ui.node('[data-login-signature]').value = 'ab'.repeat(64); await ui.node('[data-signature-form]').emit('submit');
  const verified = ui.requests.filter(r => r.body?.action === 'verify'); assert.equal(verified.length, 1);
  assert.equal(verified[0].body.challengeId, ui.challenge.challengeId); assert.equal(verified[0].body.signature, 'ab'.repeat(64));
  assert.equal(ui.node('[data-login-message]').value, ''); assert.equal(ui.node('[data-proof-step]').hidden, true);
  assert.equal(ui.events[0].type, 'geek:signed-in'); assert.equal(ui.events[0].detail.recovered, true);
});
