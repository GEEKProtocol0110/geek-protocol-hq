import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {redisFixture} from './helpers/redis-fixture.js';
import handler from '../api/lobbies.js';
import sessionHandler from '../api/session.js';
import {onlineKey} from '../server/classic-online.js';
let fixture;
try{fixture=await redisFixture();}catch(e){if(process.env.CI||e.code!=='ENOENT')throw e;}
const run=fixture?test:(name,fn)=>test(name,{skip:'Real Redis is required; CI installs it.'},fn);
const originalFetch=globalThis.fetch;
if(fixture){process.env.UPSTASH_REDIS_REST_URL='https://redis.classic.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture-token';globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/redis\.classic\.test/);const command=JSON.parse(options.body);let result;if(String(url).endsWith('/pipeline'))result=(await fixture.commands(command)).map(result=>({result}));else result={result:await fixture.command(...command)};return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});};}
after(async()=>{globalThis.fetch=originalFetch;if(fixture)await fixture.close();});
const res=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},end(){}});
const req=(method,body,cookie='',query={})=>({method,body,headers:{cookie,'x-forwarded-for':'127.0.0.1','user-agent':'classic-test'},query});
async function session(name){const r=res();await sessionHandler(req('POST',{displayName:name}),r);assert.equal(r.statusCode,200);return r.headers['Set-Cookie'].split(';')[0];}
async function call(cookie,action,data={}){const r=res();await handler(req(action==='view'||action==='list'?'GET':'POST',action==='view'||action==='list'?undefined:{action,...data},cookie,{service:'classic',...(action==='view'?{code:data.code}:{})}),r);return r;}
async function pair(game='chess',visibility='public'){await fixture.command('FLUSHDB');const a=await session('Host Geek'),b=await session('Guest Geek'),c=await session('Other Geek');const created=await call(a,'create',{game,visibility});assert.equal(created.statusCode,201);return {a,b,c,code:created.body.room.code};}
run('lobby API creates, lists, requests, accepts, syncs turns and reconnects without leaking identities',async()=>{
 const p=await pair();let r=await call(p.a,'list');assert.equal(r.body.rooms.length,1);
 assert.equal((await call(p.b,'request',{code:p.code,name:'Forged'})).statusCode,200);r=await call(p.a,'view',p);assert.equal(r.body.room.requests[0].name,'Guest Geek');
 r=await call(p.a,'accept',{code:p.code,requestId:r.body.room.requests[0].id});assert.equal(r.body.room.state,'playing');
 const raw=await fixture.command('GET',onlineKey(p.code));const stored=JSON.parse(raw);const view=JSON.stringify(r.body.room);assert.equal(view.includes(stored.host.id),false);assert.equal(view.includes(stored.guest.id),false);
 assert.equal((await call(p.c,'view',p)).body.room.position,null);assert.equal((await call(p.c,'move',{...p,revision:r.body.room.revision,from:'e2',to:'e4'})).statusCode,403);
 r=await call(p.a,'move',{...p,revision:r.body.room.revision,from:'e2',to:'e4'});assert.equal(r.statusCode,200);const next=await call(p.b,'view',p);assert.equal(next.body.room.history[0],'e4');assert.equal(next.body.room.role,'guest');
 r=await call(p.b,'move',{...p,revision:next.body.room.revision,from:'e7',to:'e5'});assert.equal(r.statusCode,200);assert.equal((await call(p.a,'view',p)).body.room.ply,2);
 assert.equal((await call('','list')).statusCode,401);
});
run('private invitations stay out of listings and competing accepts reserve exactly two seats',async()=>{
 const p=await pair('checkers','private');assert.equal((await call(p.a,'list')).body.rooms.length,0);
 await call(p.b,'request',p);await call(p.c,'request',p);const requests=(await call(p.a,'view',p)).body.room.requests;
 const results=await Promise.all(requests.map(r=>call(p.a,'accept',{code:p.code,requestId:r.id})));assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
 const stored=JSON.parse(await fixture.command('GET',onlineKey(p.code)));assert.ok(stored.guest);assert.equal(stored.requests.length,0);
 const revision=stored.revision;const moves=await Promise.all([call(p.a,'move',{...p,revision,from:40,to:33}),call(p.a,'move',{...p,revision,from:40,to:33})]);assert.deepEqual(moves.map(r=>r.statusCode).sort(),[200,409]);assert.equal((await call(p.a,'view',p)).body.room.ply,1);
});
run('room expiration, environment isolation, request cancellation and draw consent',async()=>{
 const p=await pair();await call(p.b,'request',p);assert.equal((await call(p.b,'cancel-request',p)).body.room.requested,false);await call(p.b,'request',p);
 let r=await call(p.a,'view',p);await call(p.a,'accept',{...p,requestId:r.body.room.requests[0].id});await call(p.a,'offer-draw',p);assert.equal((await call(p.a,'accept-draw',p)).statusCode,409);assert.equal((await call(p.b,'accept-draw',p)).body.room.result,'Draw by agreement');
 const before=onlineKey(p.code),prev=process.env.VERCEL_ENV;process.env.VERCEL_ENV='preview';assert.notEqual(before,onlineKey(p.code));assert.equal((await call(p.a,'view',p)).statusCode,404);if(prev===undefined)delete process.env.VERCEL_ENV;else process.env.VERCEL_ENV=prev;
 const stored=JSON.parse(await fixture.command('GET',onlineKey(p.code)));stored.expiresAt=Date.now()-1;await fixture.command('SET',onlineKey(p.code),JSON.stringify(stored));assert.equal((await call(p.a,'view',p)).statusCode,404);
});
