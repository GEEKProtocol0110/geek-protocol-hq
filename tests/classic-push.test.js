import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createECDH,createHash,randomBytes} from 'node:crypto';
import {generateVAPIDKeys} from 'web-push';
import {redisFixture} from './helpers/redis-fixture.js';
import {createOnline,updateOnline,onlineKey} from '../server/classic-online.js';
import {pushOutboxKey} from '../server/classic-online-keys.js';
import {validateSubscription,savePushSubscription,hasPushSubscription,removePushSubscription,deliverRoomPush,drainTurnPush,pushSettings,pushOriginAllowed,cronAllowed} from '../server/classic-push.js';
const fixture=await redisFixture(),prior=globalThis.fetch;
process.env.VERCEL_ENV='production';process.env.GEEK_WEB_PUSH_ENABLED='1';
const vapid=generateVAPIDKeys();process.env.GEEK_PUSH_PUBLIC_KEY=vapid.publicKey;process.env.GEEK_PUSH_PRIVATE_KEY=vapid.privateKey;
process.env.KV_REST_API_URL='https://redis.push.test';process.env.KV_REST_API_TOKEN='fake-push-redis';
globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/redis\.push\.test/);const command=JSON.parse(options.body);const result=String(url).endsWith('/pipeline')?(await fixture.commands(command)).map(result=>({result})):{result:await fixture.command(...command)};return Response.json(result);};
after(async()=>{globalThis.fetch=prior;await fixture.close();});
const hash=s=>createHash('sha256').update(s).digest('hex');
function subscription(suffix='one'){const key=createECDH('prime256v1');key.generateKeys();return {endpoint:`https://fcm.googleapis.com/fcm/send/fake-test-${suffix}`,keys:{p256dh:key.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};}
async function game(){await fixture.command('FLUSHDB');const r=await createOnline({id:'host',name:'Host Player'},{game:'chess',visibility:'private'});let next=await updateOnline(r.code,'guest','request',{name:'Guest Player'});next=await updateOnline(r.code,'host','accept',{requestId:next.requests[0].id});return updateOnline(r.code,'host','move',{revision:next.revision,from:'e2',to:'e4'});}
test('subscriptions reject SSRF, invalid curve keys and credentials; configuration exposes only public key',()=>{
 const good=subscription();assert.deepEqual(validateSubscription(good),good);
 for(const endpoint of ['http://fcm.googleapis.com/x','https://127.0.0.1/x','https://fcm.googleapis.com.evil.invalid/x','https://fcm.googleapis.com:8443/x','https://user:pass@fcm.googleapis.com/x','https://fcm.googleapis.com/x#secret'])assert.throws(()=>validateSubscription({...good,endpoint}),/PUSH_INVALID/);
 assert.throws(()=>validateSubscription({...good,keys:{...good.keys,p256dh:Buffer.alloc(65).toString('base64url')}}),/PUSH_INVALID/);
 assert.equal(JSON.stringify(pushSettings()).includes(vapid.privateKey),false);assert.equal(pushSettings().publicKey,vapid.publicKey);
});
test('subscription changes require canonical origin and cron requires a separate bearer secret',()=>{
 assert.equal(pushOriginAllowed({headers:{origin:'https://www.geekprotocol.xyz','sec-fetch-site':'same-origin'}}),true);
 for(const origin of ['','https://evil.invalid','https://www.geekprotocol.xyz.evil.invalid'])assert.equal(pushOriginAllowed({headers:{origin}}),false);
 process.env.CRON_SECRET='fake-'.repeat(9);assert.equal(cronAllowed({headers:{authorization:`Bearer ${process.env.CRON_SECRET}`}}),true);assert.equal(cronAllowed({headers:{authorization:'Bearer wrong'}}),false);
 delete process.env.CRON_SECRET;
});
test('concurrent subscriptions obey device caps and cannot be rebound to another player',async()=>{
 await fixture.command('FLUSHDB');const list=Array.from({length:4},(_,i)=>subscription('limit'+i));const result=await Promise.allSettled(list.map(s=>savePushSubscription('guest',s)));
 assert.equal(result.filter(x=>x.status==='fulfilled').length,3);assert.equal(result.filter(x=>x.status==='rejected'&&x.reason.message==='PUSH_LIMIT').length,1);
 const saved=list[result.findIndex(x=>x.status==='fulfilled')];assert.equal(await hasPushSubscription('guest',hash(saved.endpoint)),true);
 await assert.rejects(savePushSubscription('other',saved),/PUSH_OWNED/);await removePushSubscription('other',hash(saved.endpoint));assert.equal(await hasPushSubscription('guest',hash(saved.endpoint)),true);
 await removePushSubscription('guest',hash(saved.endpoint));assert.equal(await hasPushSubscription('guest',hash(saved.endpoint)),false);
});
test('a committed move durably queues an encrypted recipient notification without giving the room a TTL',async()=>{
 const r=await game(),sub=subscription();await savePushSubscription('guest',sub);assert.equal(await fixture.command('TTL',onlineKey(r.code)),-1);assert.ok(await fixture.command('ZSCORE',pushOutboxKey(),r.code));
 let calls=0;const send=async(url,options)=>{calls++;assert.equal(url,sub.endpoint);assert.equal(options.redirect,'error');assert.equal(options.method,'POST');assert.match(options.headers.Authorization||options.headers.authorization,/vapid/i);assert.equal(Buffer.from(options.body).includes(Buffer.from(r.code)),false);return {status:201};};
 assert.equal(await deliverRoomPush(r.code,{fetcher:send}),true);assert.equal(calls,1);assert.equal(await fixture.command('ZSCORE',pushOutboxKey(),r.code),null);
 await deliverRoomPush(r.code,{fetcher:send});assert.equal(calls,1);
});
test('partial push failures retain the outbox and retry only unsent devices; expired endpoints are removed',async()=>{
 const r=await game(),a=subscription('a'),b=subscription('b');await savePushSubscription('guest',a);await savePushSubscription('guest',b);const seen=[];
 await deliverRoomPush(r.code,{fetcher:async url=>{seen.push(url);return {status:url===a.endpoint?201:503};}});assert.ok(Number(await fixture.command('ZSCORE',pushOutboxKey(),r.code))>Date.now());assert.equal((await drainTurnPush()).processed,0);
 await deliverRoomPush(r.code,{fetcher:async url=>{seen.push(url);return {status:410};}});assert.equal(seen.filter(x=>x===a.endpoint).length,1);assert.equal(seen.filter(x=>x===b.endpoint).length,2);assert.equal(await hasPushSubscription('guest',hash(b.endpoint)),false);assert.equal(await fixture.command('ZSCORE',pushOutboxKey(),r.code),null);
});
test('a newer turn supersedes an old pending alert and finishing atomically removes pending work',async()=>{
 const r=await game();assert.equal(r.pendingPush.playerId,'guest');let next=await updateOnline(r.code,'guest','move',{revision:r.revision,from:'e7',to:'e5'});assert.equal(next.pendingPush.playerId,'host');assert.equal(next.pendingPush.ply,2);
 next=await updateOnline(r.code,'host','resign',{});assert.equal(next.pendingPush,null);assert.equal(await fixture.command('ZSCORE',pushOutboxKey(),r.code),null);
});

test('the real API refuses unauthenticated subscription changes, cross-origin enrollment and unauthenticated cron',async()=>{
 const {default:handler}=await import('../server/classic-online-api.js'),{default:sessionHandler}=await import('../api/session.js');await fixture.command('FLUSHDB');
 const res=()=>({statusCode:0,body:null,headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(v){this.body=v;return this;},end(){}});
 const body={action:'push-subscribe',subscription:subscription('api')};let r=res();await handler({method:'POST',body,headers:{origin:'https://www.geekprotocol.xyz'}},r);assert.equal(r.statusCode,401);
 const s=res();await sessionHandler({method:'POST',body:{displayName:'Push Player'},headers:{'x-forwarded-for':'127.0.0.1','user-agent':'fake-push-api'}},s);assert.equal(s.statusCode,200);const cookie=s.headers['Set-Cookie'].split(';')[0];
 r=res();await handler({method:'POST',body,headers:{cookie,origin:'https://evil.invalid'}},r);assert.equal(r.statusCode,403);
 r=res();await handler({method:'POST',body,headers:{cookie,origin:'https://www.geekprotocol.xyz','sec-fetch-site':'same-origin'}},r);assert.equal(r.statusCode,200);
 r=res();await handler({method:'GET',query:{pushSettings:'1'},headers:{cookie}},r);assert.equal(r.statusCode,200);assert.deepEqual(Object.keys(r.body).sort(),['enabled','ok','publicKey']);
 r=res();await handler({method:'GET',query:{pushCron:'1'},headers:{}},r);assert.equal(r.statusCode,401);
});
