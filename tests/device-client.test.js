import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, aborted, json } from './helpers/client-fixture.js';
const source=readFileSync(new URL('../public/sign-in/assets/device-access.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const mount=handle=>{
  const calls=[],events=[],listeners=new Map();
  const ui=clientFixture(async(path,options)=>{
    const body=JSON.parse(options.body);calls.push(body);
    return handle ? handle(body,options) : json({});
  });
  ui.document.addEventListener=(type,fn)=>{const l=listeners.get(type)||[];listeners.set(type,[...l,fn]);};
  ui.document.dispatchEvent=e=>{events.push(e);for(const fn of listeners.get(e.type)||[])fn(e);};
  const emit=(type,detail={})=>ui.document.dispatchEvent(new CustomEvent(type,{detail}));
  const panel=ui.node('[data-device-access]');
  for(const name of ['note','label','guest-ack','request','received','code-display','request-check','expiry','player','code-input','review-panel','confirm','review-text','list-items'])panel.append(ui.node(`[data-device-${name}]`));
  for(const name of ['start','cancel','check','finish','review','approve','list'])panel.append(ui.node(`[data-device-${name}]`,'button'));
  ui.run(source);
  return {...ui,calls,events,emit,el:name=>ui.node(`[data-device-${name}]`)};
};

test('device UI waits for session initialization, works without WebAuthn and switches only after explicit approved-player confirmation',async()=>{
  const ui=mount(body=>json(body.action==='device-start'?{code:'abc-code',check:'a1b2c3d4',expiresAt:Date.now()+300000}:body.action==='device-status'?{approved:true,playerName:'Saved Geek',approvalId:'reviewed-player'}:{signedIn:true,playerName:'Saved Geek'}));
  assert.equal(ui.el('start').disabled,true);assert.equal(ui.calls.length,0);
  ui.emit('geek:device-ready');ui.el('guest-ack').checked=true;ui.el('label').value='Tablet';
  await ui.el('start').emit('click');assert.equal(ui.calls[0].acknowledge,true);assert.equal(ui.el('code-display').value,'abc-code');
  await ui.el('check').emit('click');assert.match(ui.el('player').textContent,/Saved Geek/);assert.equal(ui.calls.length,2);
  await ui.el('finish').emit('click');assert.equal(ui.calls[2].approvalId,'reviewed-player');assert.equal(ui.calls[2].confirm,true);
  assert.ok(ui.events.some(e=>e.type==='geek:device-signed-in'));assert.equal(ui.el('code-display').value,'');
});

test('phone approval requires review, matching-screen confirmation and a fresh grant; changes clear the reviewed request',async()=>{
  const ui=mount(body=>json(body.action==='device-review'?{check:'abcd1234',playerId:'reviewed-id',label:'<untrusted label>',playerName:'Owner',expiresAt:Date.now()+300000}:{approved:true}));
  ui.emit('geek:device-ready');await ui.el('approve').emit('click');assert.equal(ui.calls.length,0);
  ui.el('code-input').value='approval-code';await ui.el('review').emit('click');
  assert.match(ui.el('review-text').textContent,/<untrusted label>/);assert.equal(ui.el('review-text').innerHTML,'');
  ui.el('confirm').checked=true;await ui.el('approve').emit('click');assert.equal(ui.calls.length,1);
  ui.emit('geek:device-grant',{token:'fresh-proof'});await ui.el('approve').emit('click');
  assert.equal(ui.calls[1].token,'fresh-proof');assert.equal(ui.calls[1].playerId,'reviewed-id');assert.equal(ui.calls[1].check,'abcd1234');
  assert.ok(ui.events.some(e=>e.type==='geek:device-grant-used'));
  ui.el('code-input').value='other-code';await ui.el('code-input').emit('input');assert.equal(ui.el('review-panel').hidden,true);
  await ui.el('approve').emit('click');assert.equal(ui.calls.length,2);
});

test('stalled requests are bounded, double taps do not duplicate writes and uncertain writes are not retried',async()=>{
  const pending=deferred();
  const ui=mount(async(body,options)=>{await aborted(options.signal);return pending.promise;});
  ui.emit('geek:device-ready');const first=ui.el('start').emit('click');await tick();await ui.el('start').emit('click');assert.equal(ui.calls.length,1);
  ui.expire(15000);await first;assert.equal(ui.calls.length,1);assert.match(ui.el('note').textContent,/timed out.*Check/);assert.equal(ui.el('start').disabled,false);
});

test('pending approvals never auto-switch and cancellation clears displayed code after server acknowledgement',async()=>{
  const ui=mount(body=>json(body.action==='device-start'?{code:'one-code',check:'abcd1234',expiresAt:Date.now()+300000}:body.action==='device-status'?{approved:false}:{cancelled:true}));
  ui.emit('geek:device-ready');await ui.el('start').emit('click');await ui.el('check').emit('click');
  assert.equal(ui.el('received').hidden,true);assert.equal(ui.calls.some(c=>c.action==='device-finish'),false);
  await ui.el('cancel').emit('click');assert.equal(ui.el('request').hidden,true);assert.equal(ui.el('code-display').value,'');
});

test('device removal needs its own fresh proof and only exposes public device IDs',async()=>{
  const ui=mount(body=>json(body.action==='device-list'?{devices:[{id:'public-id',label:'Tablet',createdAt:Date.now()}]}:{revoked:true}));
  ui.emit('geek:device-ready');await ui.el('list').emit('click');const remove=ui.el('list-items').children[0].children[1];
  await remove.emit('click');assert.equal(ui.calls.length,1);
  ui.emit('geek:device-grant',{token:'remove-proof'});await remove.emit('click');
  assert.equal(ui.calls[1].action,'device-revoke');assert.equal(ui.calls[1].deviceId,'public-id');assert.equal(ui.calls[1].token,'remove-proof');
});


test('failed initialization shows the service error and never enables approval controls',async()=>{
  const ui=mount();ui.emit('geek:device-unavailable',{message:'Origin not accepted.'});
  assert.match(ui.el('note').textContent,/unavailable.*Origin not accepted/);assert.equal(ui.el('start').disabled,true);assert.equal(ui.calls.length,0);
});
