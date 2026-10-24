import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/assets/wallet.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
async function mount({ rejectSignature = false, connectedOnly = false, requestAccounts } = {}) {
  const calls = [], events = [], listeners = new Map(), walletEvents = new Map();
  const ui = clientFixture(async (path, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ path, body });
    if (!body) return json({ identity: { linked: false } });
    if (path === '/api/session') return json({ ok: true });
    if (body.action === 'challenge') return json({ challenge: { challengeId: 'nonce', message: 'Exact server sign-in message' } });
    if (body.action === 'verify') return json({ identity: { linked: true, address: 'kaspa:fixture' }, recovered: true });
    assert.fail('Unexpected wallet request');
  });
  ui.document.addEventListener = (name, handler) => { listeners.set(name, [...(listeners.get(name) || []), handler]); };
  ui.document.dispatchEvent = event => { events.push(event); for (const handler of listeners.get(event.type) || []) handler(event); };
  const root = ui.node('[data-wallet-root]'); root.dataset.walletQuickLogin = '';
  if (!connectedOnly) root.setAttribute('data-wallet-quick-login', '');
  const button = ui.node('[data-wallet-connect]', 'button'); root.append(button);
  for (const name of ['state', 'message', 'address', 'network', 'provider', 'verify', 'install']) root.append(ui.node(`[data-wallet-${name}]`));
  ui.window.kasware = {
    requestAccounts: async () => { calls.push('connect'); return requestAccounts ? requestAccounts() : ['kaspa:fixture']; },
    getAccounts: async () => ['kaspa:fixture'], getNetwork: async () => 'kaspa_mainnet', getPublicKey: async () => '02' + 'a'.repeat(64),
    getKRC20Balance: async () => { calls.push('balance'); return []; }, on: (name, handler) => walletEvents.set(name, handler),
    signMessage: async (message, options) => {
      calls.push({ sign: message, options });
      if (rejectSignature) throw new Error('Sign-in was canceled.');
      return 'b'.repeat(128);
    }
  };
  ui.run(source); await settle();
  const click = () => Promise.all((listeners.get('click') || []).map(handler => handler({ target: button })));
  return { ...ui, root, button, calls, events, walletEvents, click };
}

test('one user click connects, signs the exact server challenge and verifies before continuing', async () => {
  const ui = await mount();
  assert.equal(ui.calls.length, 0, 'Page load must never request wallet access or a signature');
  await ui.click();
  assert.equal(ui.calls.filter(x => x === 'connect').length, 1);
  assert.equal(ui.calls.includes('balance'), false, 'A token-balance service must not block authentication');
  const signature = ui.calls.find(x => x.sign);
  assert.equal(signature.sign, 'Exact server sign-in message'); assert.equal(signature.options.type, 'schnorr');
  assert.equal(ui.calls.filter(x => x.body?.action === 'challenge').length, 1);
  assert.equal(ui.calls.filter(x => x.body?.action === 'verify').length, 1);
  const signed = ui.events.filter(x => x.type === 'geek:signed-in');
  assert.equal(signed.length, 1); assert.equal(signed[0].detail.source, 'wallet-connect');
});

test('canceling a signature keeps the player unsigned and restores the button', async () => {
  const ui = await mount({ rejectSignature: true }); await ui.click();
  assert.equal(ui.calls.filter(x => x.body?.action === 'verify').length, 0);
  assert.equal(ui.events.filter(x => x.type === 'geek:signed-in').length, 0);
  assert.equal(ui.button.disabled, false);
});

test('ordinary wallet connections outside sign-in do not request authentication signatures', async () => {
  const ui = await mount({ connectedOnly: true }); delete ui.root.dataset.walletQuickLogin;
  await ui.click(); assert.equal(ui.calls.filter(x => x.sign).length, 0);
  assert.equal(ui.calls.filter(x => x.body?.action === 'verify').length, 0);
});

test('repeated clicks during wallet approval cannot start a second sign-in', async () => {
  const wait = deferred(), ui = await mount({ requestAccounts: () => wait.promise });
  const first = ui.click(); await settle(); await ui.click();
  assert.equal(ui.calls.filter(x => x === 'connect').length, 1);
  wait.resolve(['kaspa:fixture']); await first;
  assert.equal(ui.calls.filter(x => x.body?.action === 'verify').length, 1);
});
