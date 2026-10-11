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

const mount = async ({ wallet = {}, clipboard, version = '0.8.50.3' } = {}) => {
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
      attributes: {}, setAttribute(name, value) { this.attributes[name] = value; }, removeAttribute(name) { delete this.attributes[name]; },
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
    GeekWallet: { snapshot: () => ({ installed: true, connected: true, network: 'kaspa_mainnet', address: 'kaspa:test', ...wallet }) },
    kasware: {
      getNetwork: async () => 'kaspa_mainnet', getAccounts: async () => ['kaspa:test'],
      getVersion: async () => version,
      signKRC20Transaction: async (...args) => { walletCalls.push(args); return ui.sign(); }
    },
    setTimeout() {},
    setInterval: (handler, delay) => { assert.equal(delay, 30_000); intervals.push(handler); }
  };
  vm.runInNewContext(source, { document, window, navigator: { clipboard }, AbortSignal, Intl, Date, fetch: async (url, options) => {
    requests.push({ url, options });
    return ui.response();
  } });
  await settle();
  return Object.assign(ui, {
    element, document, walletCalls, requests,
    chooseCount: (value) => listeners.get('mint-count:change')({currentTarget:{value:String(value)}}),
    changeProvider: () => { window.kasware = {...window.kasware}; },
    walletChange: (detail) => listeners.get('document:geek:wallet')({ detail }),
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


test('guided steps expose the selected address and require a fresh explicit review', async () => {
  const ui = await mount();
  assert.equal(ui.element('mint-destination').textContent, 'kaspa:test');
  assert.equal(ui.element('mint-step-connect').dataset.state, 'done');
  assert.equal(ui.element('mint-step-review').attributes['aria-current'], 'step');
  ui.acknowledge();
  assert.equal(ui.element('mint-step-approve').attributes['aria-current'], 'step');
  assert.equal(ui.walletCalls.length, 0);
  ui.walletChange({ installed: true, connected: true, network: 'kaspa_mainnet', address: 'kaspa:changed' });
  assert.equal(ui.element('mint-destination').textContent, 'kaspa:changed');
  assert.equal(ui.element('mint-submit').disabled, true);
  assert.equal(ui.element('mint-step-review').attributes['aria-current'], 'step');
});

test('wrong network and missing extension explain the next action without a wallet request', async () => {
  for (const [wallet, next] of [[{network:'kaspa_testnet'}, /Switch Kasware/], [{installed:false,connected:false}, /Kasware installed/]]) {
    const ui=await mount({wallet}); ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.walletCalls.length,0); assert.equal(ui.element('mint-submit').disabled,true);
    assert.match(ui.element('mint-next').textContent,next);
  }
});

test('wallet approval stage locks review controls and result stays a submission receipt', async () => {
  const copied=[];
  const ui=await mount({clipboard:{writeText:async text=>copied.push(text)}});
  ui.acknowledge(); let finish;
  ui.sign=()=>new Promise(resolve=>{finish=resolve;});
  const pending=ui.click('mint-submit'); await settle();
  assert.equal(ui.element('mint-submit').textContent,'Waiting for Kasware approval…');
  assert.equal(ui.element('mint-acknowledge').disabled,true);
  assert.equal(ui.element('mint-refresh').disabled,true);
  assert.equal(ui.element('mint-step-approve').dataset.state,'current');
  finish({commitId:'a'.repeat(64),revealId:'b'.repeat(64)}); await pending;
  assert.equal(ui.element('mint-result').hidden,false);
  assert.equal(ui.element('mint-commit-id').textContent,'a'.repeat(64));
  assert.equal(ui.element('mint-reveal-id').textContent,'b'.repeat(64));
  assert.equal(ui.element('mint-result-address').textContent,'kaspa:test');
  assert.equal(ui.element('mint-commit-link').href,'https://explorer.kaspa.org/txs/'+'a'.repeat(64));
  assert.equal(ui.element('mint-explorer-link').href,'https://explorer.kaspa.org/txs/'+'b'.repeat(64));
  assert.equal(ui.element('mint-submit').disabled,true);
  await ui.click('mint-copy-receipt'); assert.equal(copied.length,1);
  assert.match(copied[0],/Submission is not confirmation/); assert.match(copied[0],/Selected wallet: kaspa:test/);
  ui.walletChange({installed:true,connected:true,network:'kaspa_mainnet',address:'kaspa:changed'});
  assert.equal(ui.element('mint-result-address').textContent,'kaspa:test');
  assert.equal(ui.element('mint-destination').textContent,'kaspa:changed');
});

test('unknown outcomes cannot be cleared by refreshing or toggling review; reset never resubmits', async () => {
  const ui=await mount(); ui.acknowledge();
  ui.sign=async()=>{throw new Error('Unknown wallet outcome');};
  await ui.click('mint-submit'); await ui.tick(); ui.acknowledge();
  assert.equal(ui.element('mint-submit').disabled,true);
  assert.equal(ui.element('mint-retry').hidden,false);
  await ui.click('mint-retry');
  assert.equal(ui.walletCalls.length,1); assert.equal(ui.element('mint-submit').disabled,true);
  assert.equal(ui.element('mint-retry').hidden,true);
  ui.acknowledge(); assert.equal(ui.element('mint-submit').disabled,false);
  assert.equal(ui.walletCalls.length,1);
});

test('account change during fresh preflight blocks wallet handoff', async () => {
  const ui=await mount(); ui.acknowledge(); let finish;
  ui.response=()=>new Promise(resolve=>{finish=resolve;});
  const pending=ui.click('mint-submit'); await settle();
  ui.walletChange({installed:true,connected:true,network:'kaspa_mainnet',address:'kaspa:changed'});
  finish(Response.json(live())); await pending;
  assert.equal(ui.walletCalls.length,0); assert.equal(ui.element('mint-submit').disabled,true);
});

test('invalid transaction IDs are discarded while valid partial IDs remain available', async () => {
  const ui=await mount(); ui.acknowledge();
  ui.sign=async()=>({commitId:'javascript:alert(1)',revealId:'b'.repeat(64)});
  await ui.click('mint-submit');
  assert.equal(ui.element('mint-result').hidden,false);
  assert.equal(ui.element('mint-result').dataset.state,'reference');
  assert.equal(ui.element('mint-commit-link').hidden,true);
  assert.equal(ui.element('mint-commit-link').href,'#');
  assert.equal(ui.element('mint-explorer-link').href,'https://explorer.kaspa.org/txs/'+'b'.repeat(64));
  assert.doesNotMatch(ui.element('mint-commit-id').textContent,/javascript/);
  assert.equal(ui.element('mint-submit').disabled,true);
  assert.equal(ui.element('mint-retry').hidden,true);
});

test('documented JSON-string receipts and object receipts show submission only', async () => {
  for (const serialize of [value=>value, JSON.stringify]) {
    const ui=await mount();
    ui.sign=async()=>serialize({commitId:'A'.repeat(64),revealId:'b'.repeat(64),commitTxStr:'private raw transaction',revealTxStr:'private raw transaction'});
    ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.element('mint-result').dataset.state,'submitted');
    assert.equal(ui.element('mint-retry').hidden,true);
    assert.match(ui.element('mint-result-description').textContent,/Submission does not confirm/);
    assert.doesNotMatch(ui.element('mint-result-description').textContent,/private raw transaction/);
    assert.equal(ui.walletCalls.length,1);
  }
});

test('fulfilled calls without readable receipts are notices, never failures or confirmed mints', async () => {
  for (const response of [undefined,null,{},'', 'not JSON', 'null', JSON.stringify({commitId:'',revealId:''}), {commitId:123,revealId:{}}, {txId:'c'.repeat(64)}]) {
    const copied=[];
    const ui=await mount({clipboard:{writeText:async text=>copied.push(text)}});
    ui.sign=async()=>response; ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.element('mint-message').className,'mint-message is-notice');
    assert.match(ui.element('mint-message').textContent,/does not mean the mint failed/);
    assert.equal(ui.element('mint-result-label').textContent,'RECEIPT INCOMPLETE');
    assert.equal(ui.element('mint-step-approve-status').textContent,'Check wallet activity');
    assert.equal(ui.element('mint-commit-link').hidden,true);
    assert.equal(ui.element('mint-explorer-link').hidden,true);
    await ui.tick(); ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.element('mint-submit').disabled,true);
    assert.equal(ui.walletCalls.length,1);
    await ui.click('mint-copy-receipt');
    assert.match(copied[0],/Partial or missing; outcome unconfirmed by HQ/);
    await ui.click('mint-retry');
    assert.equal(ui.walletCalls.length,1);
    assert.equal(ui.element('mint-retry').hidden,true);
    assert.equal(ui.element('mint-submit').disabled,true);
    ui.acknowledge(); assert.equal(ui.element('mint-submit').disabled,false);
    assert.equal(ui.walletCalls.length,1);
  }
});

test('each valid partial receipt ID can be copied and linked without claiming submission', async () => {
  for (const field of ['commitId','revealId']) {
    const copied=[];
    const ui=await mount({clipboard:{writeText:async text=>copied.push(text)}});
    ui.sign=async()=>JSON.stringify({[field]:'a'.repeat(64)});
    ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.element('mint-result').dataset.state,'reference');
    assert.equal(ui.element(field==='commitId'?'mint-commit-link':'mint-explorer-link').href,'https://explorer.kaspa.org/txs/'+'a'.repeat(64));
    await ui.click('mint-copy-receipt'); assert.match(copied[0],/a{64}/);
    assert.match(copied[0],/outcome unconfirmed/);
    await ui.click('mint-retry');
    assert.equal(ui.element(field==='commitId'?'mint-commit-id':'mint-reveal-id').textContent,'a'.repeat(64));
    assert.equal(ui.walletCalls.length,1);
  }
});

test('standalone transaction IDs and bounded JSON encodings remain generic references', async () => {
  for (const response of ['a'.repeat(64),JSON.stringify('a'.repeat(64)),JSON.stringify(JSON.stringify({commitId:'a'.repeat(64),revealId:'b'.repeat(64)}))]) {
    const ui=await mount(); ui.sign=async()=>response; ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.element('mint-result').hidden,false);
    assert.equal(ui.element('mint-retry').hidden,true);
    assert.doesNotMatch(ui.element('mint-message').textContent,/failed|arrived/);
    if (ui.element('mint-reference-row').hidden===false) {
      assert.equal(ui.element('mint-reference-link').href,'https://explorer.kaspa.org/txs/'+'a'.repeat(64));
      assert.equal(ui.element('mint-result-label').textContent,'TRANSACTION ID RETURNED');
      assert.equal(ui.element('mint-reveal-id').textContent,'Not returned in a readable format');
    }
    assert.equal(ui.walletCalls.length,1);
  }
});

test('diagnostics expose only fixed field types and a bounded wallet version', async () => {
  const copied=[];
  const ui=await mount({clipboard:{writeText:async text=>copied.push(text)}});
  ui.sign=async()=>({txId:'secret transaction data',data:'secret data',seed:'private keys',address:'secret address','secret property':'secret value'});
  ui.acknowledge(); await ui.click('mint-submit'); await ui.click('mint-copy-diagnostic');
  assert.match(copied[0],/Kasware version: 0\.8\.50\.3/);
  assert.match(copied[0],/commitId: undefined, revealId: undefined, txId: string/);
  assert.doesNotMatch(copied[0],/kaspa:test|secret|private|keys|address|seed/);
  assert.equal(ui.walletCalls.length,1);
  const unknown=await mount({version:'malicious wallet payload'}); unknown.acknowledge(); await unknown.click('mint-submit');
  assert.match(unknown.element('mint-receipt-diagnostic').textContent,/Kasware Unavailable/);
  assert.doesNotMatch(unknown.element('mint-receipt-diagnostic').textContent,/malicious/);
  const oversized=await mount({version:'1'.repeat(100)+'.0'}); oversized.acknowledge(); await oversized.click('mint-submit');
  assert.match(oversized.element('mint-receipt-diagnostic').textContent,/Kasware Unavailable/);
});

test('a selected queue has immutable totals and fresh checks before every wallet request', async () => {
  const ui=await mount(); ui.acknowledge(); ui.chooseCount(5);
  assert.equal(ui.element('mint-selected-amount').textContent,'500,000');
  assert.equal(ui.element('mint-protocol-fee').textContent,'5 KAS');
  assert.equal(ui.element('mint-submit').disabled,true);
  assert.equal(ui.walletCalls.length,0);
  ui.acknowledge(); await ui.click('mint-submit');
  assert.equal(ui.walletCalls.length,5);
  assert.equal(ui.requests.length,6);
  for (const args of ui.walletCalls) assert.deepEqual(Array.from(args),[geekMintInscription(),3,undefined,0]);
  assert.match(ui.element('mint-batch-status').textContent,/5 of 5.*Queue finished/);
  assert.match(ui.element('mint-batch-log').textContent,/Request 5:/);
  assert.equal(ui.element('mint-submit').disabled,true);
});

test('invalid counts and insufficient batch capacity cannot open the wallet', async () => {
  for (const value of [0,101,1.5,'1e2','bad','']) {
    const ui=await mount(); ui.chooseCount(value); ui.acknowledge(); await ui.click('mint-submit');
    assert.equal(ui.walletCalls.length,0); assert.equal(ui.element('mint-submit').disabled,true);
  }
  const ui=await mount(); ui.chooseCount(5); ui.acknowledge();
  ui.response=()=>Response.json({...live(),mint:{...live().mint,remainingMints:'4'}});
  await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,0);
  assert.match(ui.element('mint-message').textContent,/Not enough GEEK mints/);
});

test('stop during wallet approval retains the receipt and prevents later wallet requests', async () => {
  const ui=await mount(); ui.chooseCount(5); ui.acknowledge(); let finish;
  ui.sign=()=>new Promise(resolve=>{finish=resolve;});
  const minting=ui.click('mint-submit'); await settle();
  assert.equal(ui.element('mint-count').disabled,true);
  ui.chooseCount(100); assert.equal(ui.element('mint-protocol-fee').textContent,'5 KAS');
  await ui.click('mint-stop');
  finish({commitId:'a'.repeat(64),revealId:'b'.repeat(64)}); await minting;
  assert.equal(ui.walletCalls.length,1);
  assert.equal(ui.element('mint-commit-id').textContent,'a'.repeat(64));
  assert.match(ui.element('mint-batch-status').textContent,/Queue stopped/);
  assert.equal(ui.element('mint-submit').disabled,true);
});

test('unreadable receipts pause and continuation never repeats an already requested mint', async () => {
  const ui=await mount(); ui.chooseCount(5); ui.acknowledge(); ui.sign=async()=>null;
  await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,1);
  await ui.tick(); ui.acknowledge(); await ui.click('mint-submit');
  assert.equal(ui.walletCalls.length,1);
  await ui.click('mint-retry'); assert.equal(ui.walletCalls.length,1);
  assert.equal(ui.element('mint-submit').disabled,true);
  assert.equal(ui.element('mint-selected-amount').textContent,'400,000');
  ui.acknowledge(); assert.match(ui.element('mint-submit').textContent,/Continue queue · 4 mints/);
  ui.sign=async()=>({commitId:'a'.repeat(64),revealId:'b'.repeat(64)});
  await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,5);
  assert.match(ui.element('mint-batch-log').textContent,/Request 1: No readable/);
  assert.match(ui.element('mint-batch-log').textContent,/Request 5: Transaction ID/);
});

test('wallet rejection, supply outage, and account changes halt a queue before further requests', async () => {
  for (const problem of ['reject','outage','account','network']) {
    const ui=await mount(); ui.chooseCount(5); ui.acknowledge();
    ui.sign=async()=>{
      if (problem==='reject') throw new Error('User rejected');
      if (problem==='outage') ui.response=()=>Response.json({error:'Unavailable'},{status:503});
      if (problem==='account'||problem==='network') ui.walletChange({installed:true,connected:true,network:problem==='network'?'kaspa_testnet':'kaspa_mainnet',address:problem==='account'?'kaspa:changed':'kaspa:test'});
      return {commitId:'a'.repeat(64),revealId:'b'.repeat(64)};
    };
    await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,1);
    await ui.tick(); assert.equal(ui.walletCalls.length,1);
    assert.equal(ui.element('mint-submit').disabled,true);
  }
});

test('a hidden page pauses the queue until a new explicit review and click', async () => {
  const ui=await mount(); ui.chooseCount(2); ui.acknowledge();
  ui.sign=async()=>{ui.document.hidden=true;return {commitId:'a'.repeat(64),revealId:'b'.repeat(64)};};
  await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,1);
  ui.document.hidden=false; await ui.tick(); assert.equal(ui.walletCalls.length,1);
  ui.acknowledge(); ui.sign=async()=>({commitId:'a'.repeat(64),revealId:'b'.repeat(64)});
  await ui.click('mint-submit'); assert.equal(ui.walletCalls.length,2);
});

test('stop, a hidden page, or a replaced provider during preflight prevent wallet handoff', async () => {
  for (const action of ['stop','hide','provider']) {
    const ui=await mount(); ui.chooseCount(5); ui.acknowledge(); let finish;
    ui.response=()=>new Promise(resolve=>{finish=resolve;});
    const pending=ui.click('mint-submit'); await settle();
    if (action==='stop') await ui.click('mint-stop');
    if (action==='hide') ui.document.hidden=true;
    if (action==='provider') ui.changeProvider();
    finish(Response.json(live())); await pending;
    assert.equal(ui.walletCalls.length,0);
    assert.equal(ui.element('mint-submit').disabled,true);
    if (action==='stop') assert.doesNotMatch(ui.element('mint-message').textContent,/wallet changed/);
  }
});

test('clipboard refusal gives manual-copy guidance without invoking the wallet again', async () => {
  const ui=await mount({clipboard:{writeText:async()=>{throw new Error('denied');}}});
  ui.acknowledge(); await ui.click('mint-submit'); await ui.click('mint-copy-receipt');
  assert.match(ui.element('mint-copy-message').textContent,/copy them manually/);
  assert.equal(ui.walletCalls.length,1);
});
