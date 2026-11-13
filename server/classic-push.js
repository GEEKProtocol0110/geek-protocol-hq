import {createHash,randomUUID,timingSafeEqual,ECDH} from 'node:crypto';
import * as webpush from 'web-push';
import {redis,parseStoredJson} from './redis.js';
import {classicPrefix,pushOutboxKey} from './classic-online-keys.js';
const DAYS=90*86400,MAX_DEVICES=3,MAX_SUBSCRIPTIONS=10000;
const sha=s=>createHash('sha256').update(s).digest('hex');
const subscriptions=id=>`${classicPrefix()}:push:player:${sha(id)}`;
const owners=hash=>`${classicPrefix()}:push:owner:${hash}`;
const registry=()=>`${classicPrefix()}:push:devices`;
const codeOK=c=>/^PLAY-[A-F0-9]{12}$/.test(c);
export const pushReady=()=>process.env.VERCEL_ENV==='production'&&process.env.GEEK_WEB_PUSH_ENABLED==='1'&&/^[A-Za-z0-9_-]{87}$/.test(process.env.GEEK_PUSH_PUBLIC_KEY||'')&&/^[A-Za-z0-9_-]{43}$/.test(process.env.GEEK_PUSH_PRIVATE_KEY||'');
export const pushSettings=()=>({enabled:pushReady(),publicKey:pushReady()?process.env.GEEK_PUSH_PUBLIC_KEY:null});
export function pushOriginAllowed(req){
 const origin=String(req.headers?.origin||'');
 return ['https://www.geekprotocol.xyz','https://geekprotocol.xyz'].includes(origin)&&!['cross-site','none'].includes(req.headers?.['sec-fetch-site']);
}
export function cronAllowed(req){
 const secret=process.env.CRON_SECRET||'',value=String(req.headers?.authorization||'');
 const expected=Buffer.from(`Bearer ${secret}`),actual=Buffer.from(value);return pushReady()&&secret.length>=32&&actual.length===expected.length&&timingSafeEqual(actual,expected);
}
export function validateSubscription(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('PUSH_INVALID');
 let url;try{url=new URL(input.endpoint);}catch{throw Error('PUSH_INVALID');}
 const host=url.hostname;
 const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||/^updates\.push\.services\.mozilla\.com$/.test(host)||host==='web.push.apple.com'||host==='wns2-par02p.notify.windows.com'||/^[a-z0-9-]+\.notify\.windows\.com$/.test(host);
 if(!allowed||url.protocol!=='https:'||url.port||url.username||url.password||url.hash||url.href.length>2048||url.pathname==='/')throw Error('PUSH_INVALID');
 const p=input.keys?.p256dh,a=input.keys?.auth;
 if(typeof p!=='string'||typeof a!=='string'||!/^[A-Za-z0-9_-]{87}$/.test(p)||!/^[A-Za-z0-9_-]{22}$/.test(a))throw Error('PUSH_INVALID');
 try{if(Buffer.from(a,'base64url').length!==16||Buffer.from(p,'base64url').length!==65)throw Error();ECDH.convertKey(Buffer.from(p,'base64url'),'prime256v1');}catch{throw Error('PUSH_INVALID');}
 return {endpoint:url.href,keys:{p256dh:p,auth:a}};
}
const SAVE=`
local ownerPrefix=string.sub(KEYS[2],1,-65)
for _,hash in ipairs(redis.call('HKEYS',KEYS[1])) do if redis.call('EXISTS',ownerPrefix..hash)==0 then redis.call('HDEL',KEYS[1],hash);redis.call('ZREM',KEYS[3],hash) end end
local owner=redis.call('GET',KEYS[2]);if owner and owner~=ARGV[1] then return -1 end
redis.call('ZREMRANGEBYSCORE',KEYS[3],'-inf',ARGV[5])
if redis.call('HEXISTS',KEYS[1],ARGV[2])==0 and redis.call('HLEN',KEYS[1])>=3 then return -2 end
if not redis.call('ZSCORE',KEYS[3],ARGV[2]) and redis.call('ZCARD',KEYS[3])>=10000 then return -2 end
redis.call('HSET',KEYS[1],ARGV[2],ARGV[3]);redis.call('EXPIRE',KEYS[1],ARGV[4])
redis.call('SET',KEYS[2],ARGV[1],'EX',ARGV[4]);redis.call('ZADD',KEYS[3],ARGV[6],ARGV[2]);redis.call('EXPIRE',KEYS[3],ARGV[4]);return 1`;
export async function savePushSubscription(id,input){
 if(!pushReady())throw Error('PUSH_UNAVAILABLE');const sub=validateSubscription(input),hash=sha(sub.endpoint),now=Date.now();
 const r=await redis('EVAL',SAVE,3,subscriptions(id),owners(hash),registry(),sha(id),hash,JSON.stringify(sub),DAYS,now,now+DAYS*1000);
 if(r!==1)throw Error(r===-1?'PUSH_OWNED':'PUSH_LIMIT');return {enabled:true};
}
export async function hasPushSubscription(id,hash){return /^[a-f0-9]{64}$/.test(hash||'')&&Boolean(await redis('HGET',subscriptions(id),hash));}
export async function removePushSubscription(id,hash){
 if(!/^[a-f0-9]{64}$/.test(hash||''))throw Error('PUSH_INVALID');
 await redis('EVAL',`if redis.call('GET',KEYS[2])~=ARGV[1] then return 0 end;redis.call('HDEL',KEYS[1],ARGV[2]);redis.call('DEL',KEYS[2]);redis.call('ZREM',KEYS[3],ARGV[2]);return 1`,3,subscriptions(id),owners(hash),registry(),sha(id),hash);return {enabled:false};
}
const ACK=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('ZREM',KEYS[2],ARGV[2]) end return 0`;
const RETRY=`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('ZADD',KEYS[2],ARGV[3],ARGV[2]) end return 0`;
export async function deliverRoomPush(code,{fetcher=fetch,now=Date.now()}={}){
 if(!pushReady()||!codeOK(code))return false;
 const lock=`${classicPrefix()}:push:lock:${code}`,token=randomUUID();if(await redis('SET',lock,token,'NX','EX',30)!=='OK')return false;
 const roomKey=`${classicPrefix()}:room:${code}`;
 try{
  if(await redis('ZSCORE',pushOutboxKey(),code)===null)return false;
  const raw=await redis('GET',roomKey),r=parseStoredJson(raw),event=r?.pendingPush;
  if(!event||r.state!=='playing'||event.ply!==r.ply||![r.host?.id,r.guest?.id].includes(event.playerId)||now-event.createdAt>48*3600000){await redis('EVAL',ACK,2,roomKey,pushOutboxKey(),raw||'',code);if(!raw)await redis('ZREM',pushOutboxKey(),code);return false;}
  const rows=await redis('HGETALL',subscriptions(event.playerId)),entries=Array.isArray(rows)?Array.from({length:Math.floor(rows.length/2)},(_,i)=>[rows[2*i],rows[2*i+1]]):Object.entries(rows||{});
  let retry=false;
  await Promise.all(entries.slice(0,MAX_DEVICES).map(async([hash,value])=>{
   const receipt=`${classicPrefix()}:push:sent:${code}:${r.ply}:${hash}`;if(await redis('EXISTS',receipt))return;
   try{
    const sub=validateSubscription(parseStoredJson(value));
    const details=webpush.generateRequestDetails(sub,JSON.stringify({code,ply:r.ply}),{TTL:12*3600,urgency:'normal',topic:Buffer.from(code).toString('base64url'),contentEncoding:'aes128gcm',vapidDetails:{subject:'https://www.geekprotocol.xyz/',publicKey:process.env.GEEK_PUSH_PUBLIC_KEY,privateKey:process.env.GEEK_PUSH_PRIVATE_KEY}});
    const response=await fetcher(sub.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'error',signal:AbortSignal.timeout(4000)});
    await response.body?.cancel();
    // Read no provider body: endpoints, keys and payloads must never enter logs.
    if(response.status===404||response.status===410){await removePushSubscription(event.playerId,hash);return;}
    if(response.status>=200&&response.status<300){await redis('SET',receipt,'1','EX',7*86400);return;}
    retry=true;
   }catch{retry=true;}
  }));
  if(retry){await redis('EVAL',RETRY,2,roomKey,pushOutboxKey(),raw,code,now+300000);return false;}
  await redis('EVAL',ACK,2,roomKey,pushOutboxKey(),raw,code);return true;
 }finally{await redis('EVAL',`if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0`,1,lock,token);}
}
export async function drainTurnPush(){
 if(!pushReady())return {processed:0};const codes=await redis('ZRANGEBYSCORE',pushOutboxKey(),'-inf',Date.now(),'LIMIT',0,10);
 const outcomes=await Promise.all((Array.isArray(codes)?codes:[]).map(code=>deliverRoomPush(code).catch(()=>false)));
 return {processed:outcomes.filter(Boolean).length};
}
