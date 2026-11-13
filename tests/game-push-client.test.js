import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';import {webcrypto} from 'node:crypto';
const source=fs.readFileSync('public/games/online/push.js','utf8');
function setup(){
 const events={},nodes={};let permissionCalls=0,subscribeCalls=0,current=null;const calls=[];
 const node=id=>nodes[id]??=( {disabled:true,textContent:'',addEventListener(name,fn){this[name]=fn;}} );
 const reg={pushManager:{getSubscription:async()=>current,subscribe:async options=>{subscribeCalls++;assert.equal(options.userVisibleOnly,true);current={endpoint:'https://fcm.googleapis.com/fcm/send/fake-browser-test',toJSON(){return {endpoint:this.endpoint,keys:{p256dh:'fake-public',auth:'fake-auth'}};},unsubscribe:async()=>{current=null;return true;}};return current;}}};
 const context={console,Uint8Array,TextEncoder,crypto:webcrypto,atob,AbortSignal,Error,JSON,document:{getElementById:node,addEventListener(name,fn){events[name]=fn;}},window:{isSecureContext:true,Notification:{},PushManager:{}},navigator:{serviceWorker:{getRegistration:async()=>reg,register:async()=>reg,ready:Promise.resolve(reg)}},Notification:{requestPermission:async()=>{permissionCalls++;return 'granted';}},fetch:async(url,options={})=>{const body=options.body&&JSON.parse(options.body);calls.push({url,body});return Response.json(body?{ok:true,enabled:body.action==='push-subscribe'}:{ok:true,enabled:true,publicKey:'B'.repeat(87)});}};
 vm.runInNewContext(source,context);return {events,node,calls,get permissionCalls(){return permissionCalls;},get subscribeCalls(){return subscribeCalls;},get current(){return current;}};
}
test('push client performs no automatic permission/subscription, and explicit device opt-in/out persists settings',async()=>{
 const f=setup();assert.equal(f.calls.length,0);assert.equal(f.permissionCalls,0);assert.equal(f.subscribeCalls,0);
 await f.events['geek:lounge-connected']();assert.equal(f.permissionCalls,0);assert.equal(f.node('push-alerts').disabled,false);
 await f.node('push-alerts').click();assert.equal(f.permissionCalls,1);assert.equal(f.subscribeCalls,1);assert.equal(f.calls.at(-1).body.action,'push-subscribe');assert.match(f.node('push-alert-note').textContent,/lounge is closed/);
 await f.node('push-alerts').click();assert.equal(f.current,null);assert.equal(f.calls.at(-1).body.action,'push-unsubscribe');assert.match(f.node('push-alert-note').textContent,/off/);
});
test('sign-out unsubscribes the browser endpoint and requires a new opt-in',async()=>{
 const f=setup();await f.events['geek:lounge-connected']();await f.node('push-alerts').click();await f.events['geek:signed-out']();assert.equal(f.current,null);assert.equal(f.node('push-alerts').disabled,true);assert.match(f.node('push-alert-note').textContent,/opt in again/);
});
