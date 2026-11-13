import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {redisFixture} from './helpers/redis-fixture.js';
import handler from '../api/lobbies.js';
import sessionHandler from '../api/session.js';
import {clientAddressFingerprint,clientFingerprint,clientIp,clientNetwork,normalizeIp} from '../server/http.js';
const r=(headers={},remoteAddress)=>({headers,socket:remoteAddress?{remoteAddress}:undefined});
const sha=s=>createHash('sha256').update(s).digest('hex').slice(0,24);

test('client IP header precedence: x-vercel-forwarded-for, x-real-ip, first x-forwarded-for, socket',()=>{
 const all={'x-vercel-forwarded-for':'1.1.1.1','x-real-ip':'2.2.2.2','x-forwarded-for':'3.3.3.3, 9.9.9.9'};
 assert.equal(clientIp(r(all,'4.4.4.4')),'1.1.1.1');
 assert.equal(clientIp(r({'x-real-ip':'2.2.2.2','x-forwarded-for':'3.3.3.3'},'4.4.4.4')),'2.2.2.2');
 assert.equal(clientIp(r({'x-forwarded-for':'3.3.3.3, 9.9.9.9'},'4.4.4.4')),'3.3.3.3');
 assert.equal(clientIp(r({},'4.4.4.4')),'4.4.4.4');
 assert.equal(clientIp({headers:{}}),'unknown');
});
test('invalid header values fall through to the next source',()=>{
 assert.equal(clientIp(r({'x-vercel-forwarded-for':'not-an-ip','x-real-ip':'','x-forwarded-for':'999.1.1.1, 3.3.3.3'},'4.4.4.4')),'4.4.4.4');
 assert.equal(clientIp(r({'x-vercel-forwarded-for':'unknown','x-real-ip':'<script>','x-forwarded-for':'5.5.5.5'})),'5.5.5.5');
 assert.equal(clientIp(r({'x-vercel-forwarded-for':'x'.repeat(500)},'::ffff:4.4.4.4')),'4.4.4.4');
 for(const bad of ['','1.2.3','1.2.3.4.5','gg::1','1.2.3.4; DROP','2001:db8::1::2'])assert.equal(normalizeIp(bad),'',bad);
});
test('IPv4-mapped IPv6, ports, brackets, zones and case normalize to one canonical form',()=>{
 for(const v of ['::ffff:1.2.3.4','::FFFF:1.2.3.4','0:0:0:0:0:ffff:102:304','1.2.3.4:5555',' 1.2.3.4 '])assert.equal(normalizeIp(v),'1.2.3.4',v);
 assert.equal(normalizeIp('1::ffff:1.2.3.4'),'1::ffff:1.2.3.4');
 assert.equal(normalizeIp('[2001:DB8::1]:443'),'2001:db8::1');assert.equal(normalizeIp('fe80::1%eth0'),'fe80::1');
 assert.equal(clientAddressFingerprint(r({'x-forwarded-for':'::ffff:1.2.3.4'})),clientAddressFingerprint(r({'x-forwarded-for':'1.2.3.4'})));
});
test('IPv6 shares a fingerprint within one /64 and differs across /64s; IPv4 keys are unchanged',()=>{
 const fp=ip=>clientAddressFingerprint(r({'x-vercel-forwarded-for':ip}));
 assert.equal(clientNetwork(r({'x-real-ip':'2001:DB8:ABCD:12::1'})),'2001:0db8:abcd:0012::/64');
 assert.equal(fp('2001:db8:abcd:12::1'),fp('2001:db8:abcd:12:ffff:eeee:dddd:9'));
 assert.equal(fp('2001:db8:abcd:12::1'),fp('2001:0DB8:ABCD:0012:0:0:0:1'));
 assert.notEqual(fp('2001:db8:abcd:12::1'),fp('2001:db8:abcd:13::1'));
 assert.notEqual(fp('1.2.3.4'),fp('1.2.3.5'));
 assert.equal(fp('1.2.3.4'),sha('addr|1.2.3.4'));
 assert.equal(clientFingerprint(r({'x-forwarded-for':'1.2.3.4','user-agent':'ua'})),sha('1.2.3.4|ua'));
});

let fixture;
try{fixture=await redisFixture();}catch(e){if(process.env.CI||e.code!=='ENOENT')throw e;}
const run=fixture?test:(name,fn)=>test(name,{skip:'Real Redis is required; CI installs it.'},fn);
const originalFetch=globalThis.fetch;
if(fixture){process.env.UPSTASH_REDIS_REST_URL='https://redis.clientip.test';process.env.UPSTASH_REDIS_REST_TOKEN='fixture-token';globalThis.fetch=async(url,options)=>{assert.match(String(url),/^https:\/\/redis\.clientip\.test/);const command=JSON.parse(options.body);let result;if(String(url).endsWith('/pipeline'))result=(await fixture.commands(command)).map(result=>({result}));else result={result:await fixture.command(...command)};return new Response(JSON.stringify(result),{headers:{'Content-Type':'application/json'}});};}
after(async()=>{globalThis.fetch=originalFetch;if(fixture)await fixture.close();});
const res=()=>({headers:{},statusCode:0,body:null,setHeader(k,v){this.headers[k]=v;},status(n){this.statusCode=n;return this;},json(b){this.body=b;return this;},end(){}});
let spoof=0;// A fresh client-set x-forwarded-for on every request must not change the network key.
const req=(method,body,cookie,query,ip,ua='ip-test')=>({method,body,headers:{cookie,'x-vercel-forwarded-for':ip,'x-forwarded-for':`203.0.113.${++spoof%250}`,'user-agent':ua},query});
async function session(name,ip){const x=res();await sessionHandler(req('POST',{displayName:name},'',{},ip),x);assert.equal(x.statusCode,200);return x.headers['Set-Cookie'].split(';')[0];}
async function call(cookie,body,ip,query={}){const x=res();await handler(req(body?'POST':'GET',body,cookie,{service:'classic',...query},ip),x);return x;}
run('host Block of session A bars a new session B from another address in the same IPv6 /64, not other /64s',async()=>{
 await fixture.command('FLUSHDB');const hostIp='198.51.100.7';
 const host=await session('Host Player',hostIp);const code=(await call(host,{action:'create',game:'chess'},hostIp)).body.room.code;
 const a=await session('Requester A','2001:db8:77:1::a');assert.equal((await call(a,{action:'request',code},'2001:db8:77:1::a')).statusCode,200);
 const id=(await call(host,null,hostIp,{code})).body.room.requests[0].id;assert.equal((await call(host,{action:'block',code,requestId:id},hostIp)).statusCode,200);
 const again=await call(a,{action:'request',code},'2001:db8:77:1::a');assert.equal(again.statusCode,403);assert.equal(again.body.code,'ONLINE_BLOCKED');
 const b=await session('Requester B','2001:db8:77:1:9999::b');const rb=await call(b,{action:'request',code},'2001:db8:77:1:9999::b');assert.equal(rb.statusCode,403);assert.equal(rb.body.code,'ONLINE_BLOCKED');
 const c=await session('Requester C','2001:db8:77:2::c');assert.equal((await call(c,{action:'request',code},'2001:db8:77:2::c')).statusCode,200);
 const view=JSON.stringify((await call(host,null,hostIp,{code})).body);assert.equal(/2001|db8|\/64/.test(view),false);
});
run('per-lobby request limit counts the whole IPv6 /64 and ignores a client-set x-forwarded-for',async()=>{
 await fixture.command('FLUSHDB');const host=await session('Host Player','198.51.100.8');const code=(await call(host,{action:'create',game:'checkers'},'198.51.100.8')).body.room.code;
 const statuses=[];for(let i=1;i<=5;i++){const ip=`2001:db8:88:1::${i}`;const s=await session('Player '+i,ip);statuses.push((await call(s,{action:'request',code},ip)).statusCode);}
 assert.deepEqual(statuses,[200,200,200,200,429]);
});
