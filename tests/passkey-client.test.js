import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, aborted, deferred, json } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/sign-in/assets/passkeys.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
const buffer = text => Uint8Array.from(Buffer.from(text)).buffer;
const b64 = text => Buffer.from(text).toString('base64url');
const credential = register => ({ id:b64('credential'), rawId:buffer('credential'), type:'public-key',
  authenticatorAttachment:'platform', getClientExtensionResults:() => ({}),
  response: { clientDataJSON:buffer('client'), ...(register
    ? { attestationObject:buffer('attestation'), getTransports:() => ['internal'] }
    : { authenticatorData:buffer('auth-data'), signature:buffer('signature'), userHandle:buffer('player') }) } });

const mount = async ({ support=true, handle, prompt, walletLinked=false, platform } = {}) => {
  const calls=[], prompts=[], events=[];
  const ui=clientFixture(async (path, options={}) => {
    const body=options.body ? JSON.parse(options.body) : null;
    calls.push({path,body});
    const custom=await handle?.(path,body,options,calls); if(custom) return custom;
    if(path==='/api/session') return json({ok:true});
    if(!body) return json({playerName:'Saved Explorer',signedIn:false,walletLinked,credentials:[]});
    if(body.action.startsWith('begin-')) return json({challengeId:'test-challenge', options:{challenge:b64('challenge'),
      ...(body.action==='begin-register' ? {user:{id:b64('player'),name:'Geek'}} : {})}});
    if(body.action.startsWith('finish-')) return json({signedIn:true,grant:{token:'single-use-test-grant'}});
    throw new Error('Unexpected request '+body.action);
  }, {btoa,atob,DOMException});
  ui.window.isSecureContext=true;ui.window.PublicKeyCredential=support ? class {} : undefined;
  if (support && platform) ui.window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable=platform;
  ui.context.navigator.credentials={};
  for(const method of ['create','get']) ui.context.navigator.credentials[method]=async options => {
    prompts.push({method,options});return prompt ? prompt(method,options) : credential(method==='create');
  };
  const listeners=new Map();
  ui.document.addEventListener=(type,fn)=>{const l=listeners.get(type)||[];listeners.set(type,[...l,fn]);};
  ui.document.dispatchEvent=event => { events.push(event); for(const fn of listeners.get(event.type)||[])fn(event); };
  const panel=ui.node('[data-passkeys]');
  for(const selector of ['note','list','label','wallet-help','player','device','device-help']) panel.append(ui.node(`[data-passkey-${selector}]`));
  for(const selector of ['save','login','logout','wallet-authorize']) panel.append(ui.node(`[data-passkey-${selector}]`,'button'));
  ui.run(source);await tick();
  return {...ui,calls,prompts,events};
};

test('first-visit passkey enrollment requires a tap, serializes exact bytes and opens saved-player access',async () => {
  const ui=await mount();assert.equal(ui.prompts.length,0);
  assert.equal(ui.node('[data-passkey-player]').textContent,'Saved Explorer');
  assert.equal(ui.node('[data-passkey-save]').disabled,false);
  ui.node('[data-passkey-label]').value='My phone';
  await ui.node('[data-passkey-save]').emit('click');
  assert.equal(ui.prompts[0].method,'create');
  assert.equal(Buffer.from(ui.prompts[0].options.publicKey.challenge).toString(),'challenge');
  assert.equal(Buffer.from(ui.prompts[0].options.publicKey.user.id).toString(),'player');
  const finish=ui.calls.find(c=>c.body?.action==='finish-register').body;
  assert.equal(finish.response.response.attestationObject,b64('attestation'));
  assert.equal(finish.label,'My phone');assert.ok(ui.events.some(e=>e.type==='geek:passkey-signed-in'));
});

test('no platform provider explains device limits without blocking an external passkey or security key',async () => {
  const ui=await mount({platform:async()=>false});
  assert.match(ui.node('[data-passkey-device]').textContent,/no built-in passkey provider/);
  assert.equal(ui.node('[data-passkey-device-help]').open,true);
  assert.equal(ui.node('[data-passkey-login]').disabled,false);
  assert.equal(ui.prompts.length,0);
  await ui.node('[data-passkey-login]').emit('click');
  assert.equal(ui.calls.some(c=>c.body?.action==='finish-login'),true);
});

test('a stalled or rejected device-support probe cannot block signing in or report a supported device',async () => {
  for (const stall of [false,true]) {
    const pending=deferred();
    const ui=await mount({platform:()=>stall ? pending.promise : Promise.reject(new Error('Capability unavailable'))});
    assert.equal(ui.node('[data-passkey-login]').disabled,false);
    if(stall) { ui.expire(2000); await tick(); }
    assert.doesNotMatch(ui.node('[data-passkey-device]').textContent,/provider is available/);
    await ui.node('[data-passkey-login]').emit('click');
    assert.equal(ui.calls.some(c=>c.body?.action==='finish-login'),true);
  }
});

test('unsupported authenticator failures explain the available paths without submitting a credential',async () => {
  const ui=await mount({prompt:async()=>{throw new DOMException('No authenticator','NotSupportedError');}});
  await ui.node('[data-passkey-save]').emit('click');
  assert.equal(ui.calls.some(c=>c.body?.action==='finish-register'),false);
  assert.match(ui.node('[data-passkey-note]').textContent,/without clearing your progress/);
  assert.equal(ui.node('[data-passkey-device-help]').open,true);
  assert.equal(ui.node('[data-passkey-save]').disabled,false);
});

test('returning login sends the assertion and exposes access even if the credential list refresh fails',async () => {
  const ui=await mount({handle:(path,body,options,calls)=> !body && calls.some(c=>c.body?.action==='finish-login') ? json({error:'Unavailable'},503) : null});
  await ui.node('[data-passkey-login]').emit('click');
  const finish=ui.calls.find(c=>c.body?.action==='finish-login').body;
  assert.equal(finish.response.response.userHandle,b64('player'));
  assert.equal(finish.response.response.signature,b64('signature'));
  assert.ok(ui.events.some(e=>e.type==='geek:passkey-signed-in'));
  assert.match(ui.node('[data-passkey-note]').textContent,/player is signed in.*could not refresh/);
});

test('unsupported browsers keep enrollment disabled and explain the browser and guest options',async () => {
  const ui=await mount({support:false});assert.equal(ui.calls.length,2);
  assert.ok(ui.events.some(e=>e.type==='geek:device-ready'));assert.equal(ui.prompts.length,0);
  assert.equal(ui.node('[data-passkey-save]').disabled,true);
  assert.match(ui.node('[data-passkey-note]').textContent,/up-to-date browser.*guest/);
});

test('cancelled or timed-out authenticator prompts never submit a proof and allow another tap',async () => {
  for(const timeout of [false,true]) {
    const ui=await mount({prompt:async(method,options)=>{
      if(timeout) {await aborted(options.signal);}
      throw new DOMException('Cancelled','NotAllowedError');
    }});
    const action=ui.node('[data-passkey-login]').emit('click');await tick();
    if(timeout) ui.expire(120000);
    await action;
    assert.equal(ui.calls.some(c=>c.body?.action==='finish-login'),false);
    assert.equal(ui.node('[data-passkey-login]').disabled,false);
  }
});

test('a stalled API request stops after its deadline without retrying or opening the authenticator',async () => {
  const ui=await mount({handle:async(path,body,options)=>{
    if(body?.action==='begin-register') {await aborted(options.signal);throw new Error('Aborted');}
  }});
  const action=ui.node('[data-passkey-save]').emit('click');await tick();ui.expire();await action;
  assert.match(ui.node('[data-passkey-note]').textContent,/Reload to check your saved player/);
  assert.equal(ui.calls.filter(c=>c.body?.action==='begin-register').length,1);
  assert.equal(ui.prompts.length,0);assert.equal(ui.node('[data-passkey-save]').disabled,false);
});

test('double taps cannot open overlapping prompts and linked players see the fresh-proof requirement',async () => {
  const pending=deferred(),ui=await mount({walletLinked:true,prompt:()=>pending.promise});
  assert.equal(ui.node('[data-passkey-wallet-help]').hidden,false);
  assert.match(ui.node('[data-passkey-note]').textContent,/fresh wallet proof/);
  const first=ui.node('[data-passkey-login]').emit('click');await tick();
  await ui.node('[data-passkey-login]').emit('click');assert.equal(ui.prompts.length,1);
  pending.resolve(credential(false));await first;
});


test('an unsupported-passkey browser refreshes the approved player and can sign out without a local authenticator',async()=>{
  let approved=false;
  const ui=await mount({support:false,handle:(path,body)=>{
    if(path==='/api/passkeys'&&!body) return json({playerName:approved?'Approved Geek':'Guest Geek',signedIn:approved,walletLinked:false,credentials:[]});
    if(body?.action==='logout')return json({signedOut:true});
  }});
  approved=true;ui.document.dispatchEvent(new CustomEvent('geek:device-signed-in'));await tick();
  assert.equal(ui.node('[data-passkey-player]').textContent,'Approved Geek');
  assert.equal(ui.node('[data-passkey-logout]').hidden,false);assert.equal(ui.node('[data-passkey-logout]').disabled,false);
  assert.equal(ui.node('[data-passkey-save]').disabled,true);assert.equal(ui.node('[data-passkey-login]').disabled,true);
  ui.context.location.reload=()=>{};await ui.node('[data-passkey-logout]').emit('click');
  assert.equal(ui.calls.at(-1).body.action,'logout');assert.equal(ui.prompts.length,0);
});
