import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/assets/receiving-address.js', import.meta.url), 'utf8');
const tick = () => new Promise(setImmediate);
const buffer = s => Uint8Array.from(Buffer.from(s)).buffer;
const mount = async ({ canEdit = true, supported = true, prompt, handle } = {}) => {
  const calls = [], prompts = [];
  const state = { ok: true, canEdit, signedIn: canEdit, addresses: { mainnet: '', 'testnet-10': '', version: '' } };
  const ui = clientFixture(async (path, options = {}) => {
    assert.equal(path, '/api/rewards?service=addresses');
    const body = options.body ? JSON.parse(options.body) : null; calls.push(body);
    const custom = await handle?.(body, options); if (custom) return custom;
    if (!body) return json(state);
    if (body.action === 'begin') return json({ challengeId: 'bound-proof', options: { challenge: Buffer.from('exact nonce').toString('base64url'), allowCredentials: [{ id: Buffer.from('account-key').toString('base64url') }], userVerification: 'required' } });
    assert.equal(body.action, 'finish');
    return json({ ...state, addresses: { mainnet: 'kaspa:saved-fixture', 'testnet-10': '', version: 'next-version' } });
  }, { btoa, atob, DOMException });
  ui.window.isSecureContext = true; ui.window.PublicKeyCredential = supported ? class {} : undefined;
  ui.window.GeekWallet = { authorizePayout() { assert.fail('Saving a receiving address must not contact a wallet'); } };
  ui.context.navigator.credentials = { get: async options => { prompts.push(options); if (prompt) return prompt(options); return { id: 'account-key', rawId: buffer('account-key'), type: 'public-key', getClientExtensionResults: () => ({}), response: { clientDataJSON: buffer('client'), authenticatorData: buffer('auth'), signature: buffer('sig'), userHandle: null } }; } };
  const root = ui.node('[data-receiving-address]'), form = ui.node('[data-receiving-form]', 'form'); root.append(form);
  form.reportValidity = () => true;
  for (const [name, tag] of [['network','select'],['input','input'],['save','button'],['remove','button'],['retry','button'],['status','p'],['access','a'],['confirm','input'],['badge','span'],['hint','p']]) root.append(ui.node(`[data-receiving-${name}]`, tag));
  ui.node('[data-receiving-network]').value = 'mainnet';
  ui.run(source); await tick();
  return { ...ui, root, form, calls, prompts };
};

test('saving a receiving address uses account confirmation and never opens a wallet', async () => {
  const ui = await mount(); assert.equal(ui.prompts.length, 0);
  let savedEvents = 0; ui.window.addEventListener('geek:receiving-address-saved', () => savedEvents++);
  ui.node('[data-receiving-input]').value = 'kaspa:new-fixture'; ui.node('[data-receiving-confirm]').checked = true;
  await ui.form.emit('submit');
  assert.equal(ui.calls[1].address, 'kaspa:new-fixture'); assert.equal(ui.calls[1].network, 'mainnet');
  assert.equal(ui.prompts.length, 1); assert.equal(Buffer.from(ui.prompts[0].publicKey.challenge).toString(), 'exact nonce');
  assert.equal(ui.calls[2].challengeId, 'bound-proof'); assert.equal(ui.calls[2].response.response.signature, Buffer.from('sig').toString('base64url'));
  assert.equal(ui.node('[data-receiving-input]').value, 'kaspa:saved-fixture');
  assert.equal(ui.node('[data-receiving-badge]').textContent, 'Saved');
  assert.equal(ui.node('[data-receiving-save]').disabled, true);
  assert.match(ui.node('[data-receiving-status]').textContent, /Mainnet receiving address saved.*disabled/);
  assert.equal(savedEvents, 1);
});

test('canceling account confirmation cannot save an address or claim success', async () => {
  const ui = await mount({ prompt: () => { throw new DOMException('canceled', 'NotAllowedError'); } });
  ui.window.addEventListener('geek:receiving-address-saved', () => assert.fail('Canceled confirmation cannot emit a saved-address event'));
  ui.node('[data-receiving-input]').value = 'kaspa:new-fixture';
  ui.node('[data-receiving-confirm]').checked = true;
  await ui.form.emit('submit');
  assert.equal(ui.calls.some(c => c?.action === 'finish'), false);
  assert.match(ui.node('[data-receiving-status]').textContent, /canceled.*not changed/);
  assert.equal(ui.node('[data-receiving-save]').disabled, false);
});

test('guest and unsupported-browser states offer account access without granting save authority', async () => {
  for (const setup of [{ canEdit: false }, { supported: false }]) {
    const ui = await mount(setup); assert.equal(ui.node('[data-receiving-save]').disabled, true);
    assert.equal(ui.node('[data-receiving-access]').hidden, false);
    if (setup.canEdit === false) assert.equal(ui.form.hidden, true);
    await ui.form.emit('submit'); assert.equal(ui.calls.length, 1); assert.equal(ui.prompts.length, 0);
  }
  const signedOut = await mount({ handle: () => json({error:'Sign in first.'},401) });
  assert.equal(signedOut.node('[data-receiving-badge]').textContent,'Sign in to add');
  assert.equal(signedOut.form.hidden,true);assert.equal(signedOut.node('[data-receiving-access]').hidden,false);
});

test('repeated save taps during a prompt cannot duplicate the mutation', async () => {
  const wait = deferred(), ui = await mount({ prompt: () => wait.promise });
  ui.node('[data-receiving-input]').value = 'kaspa:new-fixture';
  ui.node('[data-receiving-confirm]').checked = true;
  const first = ui.form.emit('submit'); await tick(); await ui.form.emit('submit');
  assert.equal(ui.calls.filter(c => c?.action === 'begin').length, 1);
  wait.reject(new DOMException('cancel', 'AbortError')); await first;
});

test('switching networks retains separate unfinished drafts and asks for confirmation again', async () => {
  const ui = await mount(), address = ui.node('[data-receiving-input]'), network = ui.node('[data-receiving-network]');
  address.value = 'kaspa:unfinished'; await address.emit('input');
  ui.node('[data-receiving-confirm]').checked = true;
  network.value = 'testnet-10'; await network.emit('change');
  assert.equal(address.value, ''); assert.equal(address.placeholder, 'kaspatest:…');
  address.value = 'kaspatest:unfinished'; await address.emit('input');
  network.value = 'mainnet'; await network.emit('change');
  assert.equal(address.value, 'kaspa:unfinished'); assert.equal(ui.node('[data-receiving-confirm]').checked, false);
  assert.equal(ui.node('[data-receiving-badge]').textContent, 'Unsaved changes');
  assert.equal(ui.node('[data-receiving-save]').disabled, true);
  network.value = 'testnet-10'; await network.emit('change'); assert.equal(address.value, 'kaspatest:unfinished');
  assert.equal(ui.calls.length, 1); assert.equal(ui.prompts.length, 0);
});

test('reloading changed server settings retains the draft without labeling it saved', async () => {
  let reads = 0;
  const ui = await mount({ handle: body => !body ? (++reads === 1 ? undefined : json({ ok:true,canEdit:true,signedIn:true,addresses:{mainnet:'kaspa:new-server-setting','testnet-10':'',version:'new-version'} }))
    : body.action === 'begin' ? json({ error:'Settings changed. Reload saved addresses.' },409) : undefined });
  const address=ui.node('[data-receiving-input]'); address.value='kaspa:my-draft'; await address.emit('input');
  ui.node('[data-receiving-confirm]').checked=true; await ui.form.emit('submit');
  assert.equal(ui.node('[data-receiving-retry]').hidden,false);
  await ui.node('[data-receiving-retry]').emit('click');
  assert.equal(address.value,'kaspa:my-draft'); assert.equal(ui.node('[data-receiving-badge]').textContent,'Unsaved changes');
  assert.equal(ui.node('[data-receiving-confirm]').checked,false); assert.equal(ui.node('[data-receiving-retry]').hidden,true);
  assert.equal(ui.prompts.length,0);
});

test('network selection keeps receiving addresses distinct and a lost reply tells the player to check saved state', async () => {
  const ui = await mount({ handle: body => body?.action === 'finish' ? json({ error: 'Reload addresses to check whether your change was saved.' }, 503) : undefined });
  ui.node('[data-receiving-network]').value = 'testnet-10'; await ui.node('[data-receiving-network]').emit('change');
  ui.node('[data-receiving-input]').value = 'kaspatest:fixture'; ui.node('[data-receiving-confirm]').checked = true;
  await ui.form.emit('submit');
  assert.equal(ui.calls[1].network, 'testnet-10'); assert.equal(ui.calls[1].address, 'kaspatest:fixture');
  assert.match(ui.node('[data-receiving-status]').textContent, /check whether your change was saved/);
  assert.doesNotMatch(ui.node('[data-receiving-status]').textContent, /^Testnet-10 receiving address saved/);
});
