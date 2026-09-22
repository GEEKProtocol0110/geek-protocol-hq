import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { GEEK_DEPLOYMENT, geekMintInscription, parseGeekMintStatus } from '../server/mint.js';

const source = await readFile(new URL('../public/mint/assets/mint.js', import.meta.url), 'utf8');
const live = () => ({
  ok: true,
  ...parseGeekMintStatus({ message: 'successful', result: [{
    tick: 'GEEK', max: GEEK_DEPLOYMENT.maxRaw, lim: GEEK_DEPLOYMENT.limitRaw,
    pre: '0', dec: '8', mod: 'mint', to: GEEK_DEPLOYMENT.deployer,
    hashRev: GEEK_DEPLOYMENT.deploymentHash, minted: '174500000000000000', state: 'deployed'
  }] }),
  transaction: { type: 3, custodial: false, inscription: geekMintInscription() }
});

const settle = () => new Promise((resolve) => setImmediate(resolve));

const mount = async () => {
  const elements = new Map();
  const listeners = new Map();
  const intervals = [];
  const walletCalls = [];
  const requests = [];
  const ui = {
    response: () => Response.json(live()),
    sign: async () => ({ commitId: 'a'.repeat(64), revealId: 'b'.repeat(64) })
  };
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, {
      textContent: '', disabled: false, checked: false, hidden: false, style: {}, dataset: {},
      parentElement: { setAttribute() {} },
      addEventListener: (event, handler) => listeners.set(`${id}:${event}`, handler)
    });
    return elements.get(id);
  };
  const document = {
    hidden: false, getElementById: element,
    addEventListener: (event, handler) => listeners.set(`document:${event}`, handler)
  };
  const window = {
    GeekWallet: { snapshot: () => ({ installed: true, connected: true, network: 'kaspa_mainnet', address: 'kaspa:test' }) },
    kasware: {
      getNetwork: async () => 'kaspa_mainnet', getAccounts: async () => ['kaspa:test'],
      signKRC20Transaction: async (...args) => { walletCalls.push(args); return ui.sign(); }
    },
    setTimeout() {},
    setInterval: (handler, delay) => { assert.equal(delay, 30_000); intervals.push(handler); }
  };
  vm.runInNewContext(source, { document, window, AbortSignal, Intl, Date, fetch: async (url, options) => {
    requests.push({ url, options });
    return ui.response();
  } });
  await settle();
  return Object.assign(ui, {
    element, document, walletCalls, requests,
    click: (id) => listeners.get(`${id}:click`)(),
    acknowledge: () => listeners.get('mint-acknowledge:change')({ currentTarget: { checked: true } }),
    tick: async () => { await intervals[0](); await settle(); }
  });
};

test('outage clears live numbers and automatic recovery never asks the wallet to mint', async () => {
  const ui = await mount();
  ui.acknowledge();
  assert.equal(ui.element('mint-submit').disabled, false);
  ui.response = () => Response.json({ error: 'Indexer unavailable' }, { status: 503 });
  await ui.tick();
  assert.equal(ui.element('mint-live-state').textContent, 'MINT PAUSED');
  assert.equal(ui.element('mint-supply').textContent, '—');
  ui.acknowledge();
  assert.equal(ui.element('mint-submit').disabled, true);
  ui.response = () => Response.json(live());
  await ui.tick();
  assert.equal(ui.element('mint-live-state').textContent, 'LIVE FAIR MINT');
  assert.equal(ui.walletCalls.length, 0);
  await ui.click('mint-submit');
  assert.deepEqual(ui.walletCalls, [[geekMintInscription(), 3, undefined, 0]]);
  assert.ok(ui.requests.every(({ url, options }) => url === '/api/mint/?fresh=1' && options.cache === 'no-store'));
});

test('fresh preflight failure blocks a click even after the page displayed open status', async () => {
  const ui = await mount();
  ui.acknowledge();
  ui.response = () => Response.json({ error: 'Indexer unavailable' }, { status: 503 });
  await ui.click('mint-submit');
  assert.equal(ui.walletCalls.length, 0);
  assert.equal(ui.element('mint-submit').disabled, true);
  assert.equal(ui.element('mint-live-state').textContent, 'MINT PAUSED');
});

test('automatic status refresh preserves an uncertain wallet outcome', async () => {
  const ui = await mount();
  ui.acknowledge();
  ui.sign = async () => { throw new Error('Unknown transaction result. Check wallet activity.'); };
  await ui.click('mint-submit');
  const message = ui.element('mint-message').textContent;
  await ui.tick();
  assert.equal(ui.element('mint-message').textContent, message);
  assert.equal(ui.element('mint-submit').disabled, true);
  assert.equal(ui.walletCalls.length, 1);
});

test('hidden pages and pending wallet approvals do not start background checks', async () => {
  const ui = await mount();
  ui.document.hidden = true;
  await ui.tick();
  assert.equal(ui.requests.length, 1);
  ui.document.hidden = false;
  let finish;
  ui.sign = () => new Promise((resolve) => { finish = resolve; });
  ui.acknowledge();
  const minting = ui.click('mint-submit');
  await settle();
  assert.equal(ui.requests.length, 2);
  await ui.tick();
  await ui.click('mint-submit');
  assert.equal(ui.requests.length, 2);
  assert.equal(ui.walletCalls.length, 1);
  finish({ commitId: 'a'.repeat(64), revealId: 'b'.repeat(64) });
  await minting;
});

test('stale status cannot authorize a wallet request', async () => {
  const ui = await mount();
  ui.acknowledge();
  ui.response = () => Response.json({ ...live(), checkedAt: Date.now() - 120_000 });
  await ui.click('mint-submit');
  assert.equal(ui.walletCalls.length, 0);
  assert.equal(ui.element('mint-submit').disabled, true);
});
