import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {redisFixture} from './helpers/redis-fixture.js';
import handler from '../api/lobbies.js';
import sessionHandler from '../api/session.js';
import {indexKey,newOnlineRoom,publicNameAllowed,transitionOnline,onlineView} from '../server/classic-online.js';
import {handleApiError} from '../server/http.js';
let fixture;
try{fixture=await redisFixture();}catch(e){if(process.env.CI||e.code!=='ENOENT')throw e;}
const run=fixture?test:(name,fn)=>test(name,{skip:'Real Redis is required; CI installs it.'},fn);
const originalFetch=globalThis.fetch;
if(fixture){process.env.UPSTASH_REDIS_REST_URL='https://redis.abuse.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture-token';globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/redis\.abuse\.test/);const command=JSON.parse(options.body);let result;if(String(url).endsWith('/pipeline'))result=(await fixture.commands(command)).map(result=>({result}));else result={result:await fixture.command(...command)};return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});};}
after(async()=>{globalThis.fetch=originalFetch;if(fixture)await fixture.close();});
const res=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},end(){}});
const req=(method,body,cookie,query,{ip='10.0.0.1',ua='abuse-test'}={})=>({method,body,headers:{cookie,'x-forwarded-for':ip,'user-agent':ua},query});
async function session(name,net){const r=res();await sessionHandler(req('POST',{displayName:name},'',{},net),r);assert.equal(r.statusCode,200);return r.headers['Set-Cookie'].split(';')[0];}
async function call(cookie,body,net,query={}){const r=res();await handler(req(body?'POST':'GET',body,cookie,{service:'classic',...query},net),r);return r;}

test('public names reject links, domains and staff-like names, including leetspeak and spacing',()=>{
 for(const n of ['geekdrop.xyz claim now','visit geek dot com','geek(dot)xyz','https://x','t.me/scam','www.geek','GEEK Official','G33K','Gee','g.e.e.k','Geek Team','The Real Geek','Geek Protocol','Adm1n','Mod Support','M0derator','0fficial g33k','Geek on KAS'])assert.equal(publicNameAllowed(n),false,n);
 for(const n of ['Guest Geek','Host Geek','Geekster','Alice','R. Smith','Teamwork','Steamboat','Badminton','Player 2'])assert.equal(publicNameAllowed(n),true,n);
});
test('blocked requesters cannot return by session or network, and block data stays private',()=>{
 let r=newOnlineRoom({code:'PLAY-0123456789AB',game:'chess',visibility:'public',player:{id:'host',name:'Host'}});
 r=transitionOnline(r,'pest','request',{name:'Pest',ip:'net-a'});r=transitionOnline(r,'pal','request',{name:'Pal',ip:'net-b'});
 assert.throws(()=>transitionOnline(r,'pest','block',{requestId:r.requests[0].id}),/ONLINE_FORBIDDEN/);
 r=transitionOnline(r,'host','block',{requestId:r.requests[0].id});assert.deepEqual(r.requests.map(p=>p.name),['Pal']);
 assert.throws(()=>transitionOnline(r,'pest','request',{name:'Pest',ip:'net-z'}),/ONLINE_BLOCKED/);
 assert.throws(()=>transitionOnline(r,'pest-2','request',{name:'Fresh',ip:'net-a'}),/ONLINE_BLOCKED/);
 assert.throws(()=>transitionOnline(r,'x','request',{name:'Geek Admin',ip:'net-c'}),/ONLINE_NAME_NOT_ALLOWED/);
 const view=JSON.stringify(onlineView(r,'host'));for(const secret of ['net-a','net-b','pest','blocked'])assert.equal(view.includes(secret),false,secret);
});
run('creation limits ignore User-Agent rotation and a global cap applies',async()=>{
 await fixture.command('FLUSHDB');let made=0;
 for(let u=0;u<6;u++){const net={ua:'rotating-'+u};const c=await session('Player '+u,net);for(let i=0;i<8;i++)if((await call(c,{action:'create',game:'chess'},net)).statusCode===201)made++;}
 assert.equal(made,30);
 await fixture.command('SET','geek:rate:classic-create-global:all','600');const c=await session('Fresh',{ip:'10.9.9.9'});assert.equal((await call(c,{action:'create',game:'chess'},{ip:'10.9.9.9'})).statusCode,429);
});
run('link-like and reserved host names are rejected at create and hidden from listings',async()=>{
 await fixture.command('FLUSHDB');const spam=await session('geekdrop.xyz claim now');const r=await call(spam,{action:'create',game:'chess'});assert.equal(r.statusCode,400);assert.equal(r.body.code,'ONLINE_NAME_NOT_ALLOWED');
 const good=await session('Alice');const created=await call(good,{action:'create',game:'chess'});assert.equal(created.statusCode,201);
 const stored=JSON.parse(await fixture.command('GET',(await import('../server/classic-online.js')).onlineKey(created.body.room.code)));stored.host.name='GEEK Official';
 await fixture.command('SET',(await import('../server/classic-online.js')).onlineKey(created.body.room.code),JSON.stringify(stored));
 const listed=await call(good,null);assert.equal(listed.body.rooms.length,0,JSON.stringify(listed.body));
});
run('closed and started rooms leave the public index',async()=>{
 await fixture.command('FLUSHDB');const a=await session('Alice'),b=await session('Bob',{ip:'10.0.0.2'});
 const one=(await call(a,{action:'create',game:'chess'})).body.room.code,two=(await call(a,{action:'create',game:'checkers'})).body.room.code;
 assert.equal(await fixture.command('ZCARD',indexKey()),2);await call(a,{action:'cancel',code:one});assert.equal(await fixture.command('ZSCORE',indexKey(),one),null);
 await call(b,{action:'request',code:two},{ip:'10.0.0.2'});const id=(await call(a,null,undefined,{code:two})).body.room.requests[0].id;await call(a,{action:'accept',code:two,requestId:id});
 assert.equal(await fixture.command('ZCARD',indexKey()),0);
});
run('one network cannot fill a lobby request queue, and host blocks hold across sessions',async()=>{
 await fixture.command('FLUSHDB');const host=await session('Host Player',{ip:'10.1.1.1'});const code=(await call(host,{action:'create',game:'checkers'},{ip:'10.1.1.1'})).body.room.code;
 const statuses=[];for(let i=0;i<12;i++){const net={ip:'10.6.6.6',ua:'sq'+i};const c=await session('Squatter '+i,net);statuses.push((await call(c,{action:'request',code},net)).statusCode);}
 assert.deepEqual(statuses.filter(s=>s===200).length,4);assert.ok(statuses.slice(4).every(s=>s===429));
 const legit=await session('Legit',{ip:'10.7.7.7'});assert.equal((await call(legit,{action:'request',code},{ip:'10.7.7.7'})).statusCode,200);
 const pest=await session('Pest',{ip:'10.8.8.8'});await call(pest,{action:'request',code},{ip:'10.8.8.8'});
 const pending=(await call(host,null,{ip:'10.1.1.1'},{code})).body.room.requests;const target=pending.find(p=>p.name==='Pest');
 assert.equal((await call(host,{action:'block',code,requestId:target.id},{ip:'10.1.1.1'})).statusCode,200);
 const again=await call(pest,{action:'request',code},{ip:'10.8.8.8'});assert.equal(again.statusCode,403);assert.equal(again.body.code,'ONLINE_BLOCKED');
 const sneaky=await session('Pest Two',{ip:'10.8.8.8',ua:'other'});assert.equal((await call(sneaky,{action:'request',code},{ip:'10.8.8.8',ua:'other'})).body.code,'ONLINE_BLOCKED');
 assert.equal((await call(await session('Gee',{ip:'10.5.5.5'}),{action:'request',code},{ip:'10.5.5.5'})).body.code,'ONLINE_NAME_NOT_ALLOWED');
});
run('non-object bodies are rejected as invalid requests without raw error logs',async t=>{
 await fixture.command('FLUSHDB');const c=await session('Alice');const logs=[];t.mock.method(console,'error',(...a)=>logs.push(a));
 for(const body of ['null','7','"x"','[]']){const r=await call(c,body);assert.equal(r.statusCode,400,body);}
 assert.equal(logs.length,0);
});
test('unexpected API errors log only a bounded classification',t=>{
 const logs=[];t.mock.method(console,'error',(...a)=>logs.push(a));const r=res();
 const e=new TypeError('Cannot read properties of null (secret-detail kaspa:qq123)');handleApiError(r,e);assert.equal(r.statusCode,500);
 assert.equal(logs.length,1);assert.deepEqual(JSON.parse(logs[0][1]),{name:'TypeError',code:'UNCLASSIFIED'});assert.equal(logs.flat().some(x=>x instanceof Error||String(x).includes('secret-detail')),false);
 handleApiError(res(),new Error('SOME_NEW_CODE'));assert.deepEqual(JSON.parse(logs[1][1]),{name:'Error',code:'SOME_NEW_CODE'});
});
test('host lobby view offers a confirmed Block action for each request',async()=>{
 const {readFileSync}=await import('node:fs');const src=readFileSync('public/games/online/online.js','utf8');
 assert.match(src,/btn\('Block',\(\)=>\{if\(confirm\(`Block \$\{r\.name\}[^`]*`\)\)act\('block',\{requestId:r\.id\}\);\}\)/);
});
