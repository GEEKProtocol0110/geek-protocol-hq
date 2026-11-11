import {reversiLegal} from '../public/games/strategy/engine.js';
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

run('all four open-board strategy games complete through authoritative lobby requests and turns',async()=>{
 for(const game of ['tic-tac-toe','connect-four','dots','reversi']){
  const p=await pair(game,'private');await call(p.b,'request',p);const requests=(await call(p.a,'view',p)).body.room.requests;
  let r=await call(p.a,'accept',{...p,requestId:requests[0].id});assert.equal(r.statusCode,200);let turn=0;
  const sequence=game==='tic-tac-toe'?[0,3,1,4,2]:game==='connect-four'?[0,1,0,1,0,1,0]:game==='dots'?Array.from({length:60},(_,i)=>i):null;
  while(r.body.room.state==='playing'&&turn<65){const pos=r.body.room.position,cell=sequence?sequence[turn]:reversiLegal(pos.board,pos.turn)[0];r=await call(pos.turn===0?p.a:p.b,'move',{...p,cell,revision:r.body.room.revision});assert.equal(r.statusCode,200,game);turn++;}
  assert.equal(r.body.room.state,'finished',game);assert.ok(r.body.room.result);
 }
});
run('Battle Geek opponent fleets stay absent from every API view; stale deployment and repeated scans fail',async()=>{
 const p=await pair('battle-geek','private');await call(p.b,'request',p);let r=await call(p.a,'view',p);r=await call(p.a,'accept',{...p,requestId:r.body.room.requests[0].id});
 const fleets=[[[0,1,2,3,4],[10,11,12,13],[20,21,22],[30,31,32],[40,41]],[[50,51,52,53,54],[60,61,62,63],[70,71,72],[80,81,82],[90,91]]];const revision=r.body.room.revision;
 r=await call(p.a,'move',{...p,revision,kind:'deploy',fleet:fleets[0]});assert.equal(r.statusCode,200);
 assert.equal((await call(p.b,'move',{...p,revision,kind:'deploy',fleet:fleets[1]})).statusCode,409);
 const guest=await call(p.b,'view',p);assert.deepEqual(guest.body.room.position.ownFleet,[]);assert.equal(guest.body.room.position.fleets,undefined);assert.ok(guest.body.room.position.target.every(x=>x==='unknown'));
 r=await call(p.b,'move',{...p,revision:guest.body.room.revision,kind:'deploy',fleet:fleets[1]});assert.equal(r.statusCode,200);
 let miss=99;for(const cell of fleets[1].flat()){
  r=await call(p.a,'move',{...p,revision:r.body.room.revision,kind:'scan',cell});assert.equal(r.statusCode,200);
  assert.equal(r.body.room.position.fleets,undefined);assert.deepEqual(r.body.room.position.ownFleet,fleets[0]);
  if(r.body.room.state==='playing'){r=await call(p.b,'move',{...p,revision:r.body.room.revision,kind:'scan',cell:miss--});assert.equal(r.statusCode,200);}
 }
 assert.equal(r.body.room.state,'finished');assert.equal(r.body.room.position.sunk.length,5);assert.ok(r.body.room.history.slice(0,2).every(s=>s==='Fleet deployed'));
 assert.equal((await call(p.c,'view',p)).body.room.position,null);
});
run('ten-room limit is atomic and My Games stays private, expires at 30 days and frees finished seats',async()=>{
 await fixture.command('FLUSHDB');const a=await session('Many Games'),b=await session('Other Player');
 const results=await Promise.all(Array.from({length:11},()=>call(a,'create',{game:'chess',visibility:'private',pace:'slow'})));
 assert.equal(results.filter(r=>r.statusCode===201).length,10);assert.equal(results.filter(r=>r.body.code==='ONLINE_LIMIT').length,1);
 const list=await call(a,'list');assert.equal(list.body.myGames.length,10);assert.equal(list.body.rooms.length,0);assert.equal(list.body.myGames.every(r=>r.pace==='slow'&&!r.position),true);
 assert.equal((await call(b,'list')).body.myGames.length,0);
 const room=results.find(r=>r.statusCode===201).body.room;assert.ok(room.expiresAt-Date.now()>29*86400*1000);
 assert.equal((await call(a,'cancel',{code:room.code})).statusCode,200);assert.equal((await call(a,'list')).body.myGames.length,9);assert.equal((await call(a,'create',{game:'chess',visibility:'private',pace:'slow'})).statusCode,201);
});
run('My Games follows chess turn changes without exposing opponent or third-party boards',async()=>{
 const p=await pair('chess','private');await call(p.b,'request',p);let r=await call(p.a,'view',p);await call(p.a,'accept',{...p,requestId:r.body.room.requests[0].id});
 assert.equal((await call(p.a,'list')).body.myGames[0].yourTurn,true);assert.equal((await call(p.b,'list')).body.myGames[0].yourTurn,false);
 r=await call(p.a,'move',{...p,revision:2,from:'e2',to:'e4'});assert.equal(r.statusCode,200);assert.equal((await call(p.b,'list')).body.myGames[0].yourTurn,true);assert.equal((await call(p.c,'list')).body.myGames.length,0);
});
run('accepted correspondence chess has no Redis expiry or index expiry and survives long pauses',async()=>{
 const p=await pair('chess','private');await call(p.b,'request',p);let r=await call(p.a,'view',p);r=await call(p.a,'accept',{...p,requestId:r.body.room.requests[0].id});assert.equal(r.body.room.expiresAt,null);assert.equal(await fixture.command('TTL',onlineKey(p.code)),-1);
 const {transitionOnline}=await import('../server/classic-online.js');const raw=JSON.parse(await fixture.command('GET',onlineKey(p.code)));const future=Date.now()+366*86400000;const next=transitionOnline(raw,raw.host.id,'move',{revision:raw.revision,from:'e2',to:'e4'},future);assert.equal(next.expiresAt,null);assert.equal(next.state,'playing');
 assert.equal((await call(p.a,'list')).body.myGames[0].expiresAt,null);r=await call(p.a,'resign',p);assert.equal(r.statusCode,200);assert.ok(r.body.room.expiresAt>Date.now());assert.ok(await fixture.command('TTL',onlineKey(p.code))>0);
});
