import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture,json} from './helpers/client-fixture.js';
const scripts=['sign-in.js','passkeys.js'].map(p=>readFileSync(new URL('../public/sign-in/assets/'+p,import.meta.url),'utf8'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const mount=async state=>{
  const calls=[],listeners=new Map();
  const ui=clientFixture(async(path,options={})=>{calls.push(path);return json(path==='/api/session'?{ok:true}:state);});
  ui.window.isSecureContext=true;ui.window.PublicKeyCredential=undefined;
  ui.document.addEventListener=(type,fn)=>{const list=listeners.get(type)||[];listeners.set(type,[...list,fn]);};
  ui.document.dispatchEvent=event=>{for(const fn of listeners.get(event.type)||[])fn(event);};
  for(const name of ['address','signature'])ui.node(`[data-${name}-form]`).append(ui.make('button'));
  const panel=ui.node('[data-passkeys]');
  for(const name of ['note','list','label','wallet-help','player','device','device-help','login-area','account','player-row','new-title'])panel.append(ui.node(`[data-passkey-${name}]`));
  for(const name of ['save','login','verify','logout','wallet-authorize'])panel.append(ui.node(`[data-passkey-${name}]`,'button'));
  ui.node('[data-sign-in-hq]').hidden=true;
  for(const script of scripts)ui.run(script);
  await tick();return {...ui,calls,emit:(type,detail)=>ui.document.dispatchEvent(new CustomEvent(type,{detail}))};
};

test('guest initialization has one account-status source and leaves the guest and returning choices available',async()=>{
  const ui=await mount({playerName:'Guest Geek',signedIn:false,walletLinked:false,credentials:[]});
  assert.deepEqual(ui.calls,['/api/session','/api/passkeys']);
  assert.equal(ui.node('[data-sign-in-status]').textContent,'Not signed in.');
  assert.equal(ui.node('[data-sign-in-hq]').hidden,true);assert.equal(ui.node('[data-sign-in-guest]').hidden,false);
  assert.equal(ui.node('[data-passkey-account]').hidden,true);
});

test('a saved session continues directly to HQ, including a receiving browser without WebAuthn',async()=>{
  const ui=await mount({playerName:'Saved Geek',signedIn:true,walletLinked:false,credentials:[]});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false);assert.equal(ui.node('[data-sign-in-guest]').hidden,true);
  assert.equal(ui.node('[data-sign-in-title]').textContent,'Welcome back.');
  assert.equal(ui.node('[data-passkey-player]').textContent,'Saved Geek');assert.equal(ui.node('[data-passkey-login-area]').hidden,true);
  assert.match(ui.node('[data-passkey-note]').textContent,/You’re signed in/);assert.equal(ui.node('[data-passkey-logout]').disabled,false);
  assert.equal(ui.node('[data-passkey-verify]').disabled,true);
  ui.emit('geek:account-status',{signedIn:false,walletLinked:false});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false,'late guest status cannot replace successful sign-in');
});

test('an existing verified wallet uses the same continuation state without asking for a new passkey',async()=>{
  const ui=await mount({playerName:'Wallet Geek',signedIn:false,walletLinked:true,credentials:[]});
  assert.equal(ui.node('[data-sign-in-hq]').hidden,false);assert.equal(ui.node('[data-sign-in-guest]').hidden,true);
  assert.equal(ui.node('[data-passkey-login-area]').hidden,true);assert.equal(ui.node('[data-passkey-account]').hidden,false);
  assert.equal(ui.node('[data-passkey-player]').textContent,'Wallet Geek');assert.equal(ui.calls.length,2);
});
