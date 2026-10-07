import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sessionHandler from '../api/session.js';
import { redisFixture } from './helpers/redis-fixture.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) { if (process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error; }
const run = fixture ? test : (name, fn) => test(name, { skip: 'Real Redis required in CI.' }, fn);
const savedFetch = globalThis.fetch;
const moderator = 'synthetic-private-moderator-key-123456';
const audit = 'synthetic-audit-viewer-key-123456';
const owner = 'synthetic-dedicated-owner-key-123456';
const origin = 'https://www.geekprotocol.xyz';
if (fixture) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.ops-access.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/redis\.ops-access\.test/);
    const values = JSON.parse(options.body); let payload;
    if (String(url).endsWith('/multi-exec')) { const replies = await fixture.commands([['MULTI'], ...values, ['EXEC']]); payload = replies.at(-1).map(result => ({ result })); }
    else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
    else payload = { result: await fixture.command(...values) };
    return new Response(JSON.stringify(payload));
  };
  beforeEach(async () => {
    await fixture.command('FLUSHDB');
    process.env.CCE_ADMIN_TOKEN = moderator; process.env.AUDIT_ADMIN_TOKEN = audit;
    process.env.AUDIT_LOG_SECRET = 'synthetic-ops-audit-hmac-key-with-32-characters';
    delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_ALLOWED_ORIGINS;
  });
}
after(async () => { globalThis.fetch = savedFetch; if (fixture) await fixture.close(); });
const call = async ({ method = 'GET', path = '', action, cookie = '', key, headers = {}, body } = {}) => {
  const res = { statusCode: 0, headers: {}, body: null, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; return this; } };
  await sessionHandler({ method, query: { service: 'operations', path, ...(action ? { action } : {}) }, headers: { origin, 'content-type': 'application/json', 'user-agent': 'ops-access-test', 'x-forwarded-for': '127.0.0.1', cookie, ...headers }, body: body ?? (key !== undefined ? { key } : {}) }, res);
  return res;
};
const login = async (key = moderator, cookie = '') => { const res = await call({ method: 'POST', action: 'login', key, cookie }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const sessionId = cookie => cookie.split('=')[1];
run('dashboard shell and every private asset require a server session', async () => {
  for (const path of ['', 'index', 'index.html', '/']) {
    const res = await call({ path }); assert.equal(res.statusCode, 303); assert.equal(res.headers.Location, '/ops-login/'); assert.equal(res.body, undefined);
  }
  for (const path of ['assets/ops.js','assets/ops-core.js','assets/ops.css']) { const res = await call({path}); assert.equal(res.statusCode, 401); assert.equal(JSON.stringify(res.body).includes('roleClient'), false); }
  assert.equal((await call({action:'status'})).statusCode,401);
  for(const cookie of ['geek_session='+'a'.repeat(32), '__Host-geek_ops=forged', '__Host-geek_ops='+ 'a'.repeat(64)]) assert.equal((await call({cookie,path:'assets/ops.js'})).statusCode,401);
});
run('sole operator login grants a short-lived Secure HttpOnly session, not a stored password', async () => {
  const res = await call({method:'POST',action:'login',key:moderator});assert.equal(res.statusCode,200);
  const cookie = res.headers['Set-Cookie'];assert.match(cookie,/^__Host-geek_ops=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800$/);
  const id=sessionId(cookie.split(';')[0]),record=JSON.parse(await fixture.command('GET','geek:ops:session:'+id));assert.equal(record.version,1);assert.equal(JSON.stringify(record).includes(moderator),false);
  const page=await call({cookie:cookie.split(';')[0]});assert.equal(page.statusCode,200);assert.match(String(page.body),/A clear view of Geek/);assert.match(page.headers['Cache-Control'],/private, no-store/);assert.equal(page.headers.Vary,'Cookie');
  for(const path of ['assets/ops.js','assets/ops-core.js','assets/ops.css'])assert.equal((await call({cookie:cookie.split(';')[0],path})).statusCode,200);
  assert.equal((await call({cookie:cookie.split(';')[0],method:'HEAD'})).body,undefined);
});
run('dedicated owner key takes precedence and audit or moderator roles cannot substitute for it', async () => {
  process.env.OPS_ACCESS_TOKEN=owner;
  for(const key of [moderator,audit,'wrong'])assert.equal((await call({method:'POST',action:'login',key})).statusCode,403);
  const cookie=await login(owner);assert.equal((await call({cookie,action:'status'})).body.authenticated,true);
  process.env.OPS_ACCESS_TOKEN='';assert.equal((await call({method:'POST',action:'login',key:moderator})).statusCode,503);
});
run('cross-origin, missing-origin, forged-host and form posts cannot create or revoke access', async () => {
  const cookie=await login();
  for(const headers of [{origin:'https://evil.example'},{origin:''},{origin:'https://evil.example',host:'evil.example'},{'content-type':'application/x-www-form-urlencoded'}]) {
    assert.equal((await call({method:'POST',action:'login',key:moderator,headers})).statusCode,403);
    assert.equal((await call({method:'POST',action:'logout',cookie,headers})).statusCode,403);
  }
  assert.equal((await call({cookie,action:'status'})).statusCode,200);
  assert.equal((await call({action:'logout',cookie})).statusCode,405);
});
run('expired sessions and rotated credentials fail closed without renewing the deadline', async () => {
  const cookie=await login(),key='geek:ops:session:'+sessionId(cookie),record=JSON.parse(await fixture.command('GET',key));
  await call({cookie});assert.deepEqual(JSON.parse(await fixture.command('GET',key)),record);
  process.env.CCE_ADMIN_TOKEN='rotated-moderator-key-with-24-characters';assert.equal((await call({cookie,path:'assets/ops.js'})).statusCode,401);
  process.env.CCE_ADMIN_TOKEN=moderator;record.expiresAt=Date.now()-1;await fixture.command('SET',key,JSON.stringify(record));assert.equal((await call({cookie})).statusCode,303);
});
run('logout revokes copied cookies and fresh logins rotate the previous session', async () => {
  const first=await login(),second=await login(moderator,first);assert.notEqual(first,second);assert.equal((await call({cookie:first,path:'assets/ops.js'})).statusCode,401);
  const out=await call({method:'POST',action:'logout',cookie:second});assert.equal(out.statusCode,200);assert.match(out.headers['Set-Cookie'],/Max-Age=0/);assert.equal(await fixture.command('GET','geek:ops:session:'+sessionId(second)),null);
  assert.equal((await call({cookie:second,path:'assets/ops.js'})).statusCode,401);
});
run('path traversal, duplicate cookies and unsupported methods cannot bypass the file allowlist', async () => {
  const cookie=await login();
  for(const path of ['../operations.js','assets/../../audit.js','assets/%2e%2e/operations.js','assets/ops.js.map','/assets/ops.js/extra', ['assets/ops.js','index.html']])assert.equal((await call({path,cookie})).statusCode,404);
  assert.equal((await call({cookie:cookie+'; '+cookie,path:'assets/ops.js'})).statusCode,401);
  assert.equal((await call({method:'POST',path:'assets/ops.js',cookie})).statusCode,405);
});
run('login attempts are rate limited and configuration or database failures do not expose private files', async () => {
  for(let i=0;i<10;i++)assert.equal((await call({method:'POST',action:'login',key:'wrong'})).statusCode,403);
  assert.equal((await call({method:'POST',action:'login',key:moderator})).statusCode,429);
  await fixture.command('FLUSHDB');process.env.AUDIT_LOG_SECRET='short';assert.equal((await call({method:'POST',action:'login',key:moderator})).statusCode,503);
  const saved=globalThis.fetch;globalThis.fetch=async()=>{throw Error('Synthetic database outage');};
  try{const res=await call({cookie:'__Host-geek_ops='+'a'.repeat(64)});assert.notEqual(res.statusCode,200);assert.equal(String(res.body).includes('A clear view of Geek'),false);}finally{globalThis.fetch=saved;}
});
test('deployment routes the complete private namespace to the server and retires public review files',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(cfg.rewrites.some(item=>item.source==='/ops/'&&item.destination.includes('service=operations')));
  assert.ok(cfg.rewrites.some(item=>item.source==='/ops/:path*'&&item.destination.includes('service=operations')));
  assert.ok(cfg.redirects.some(item=>item.source==='/moderate/:path*'&&item.destination==='/ops/'));
  assert.equal(cfg.functions['api/session.js'].includeFiles,'server/ops-ui/**');
  assert.equal(existsSync(new URL('../public/ops',import.meta.url)),false);assert.equal(existsSync(new URL('../public/moderate',import.meta.url)),false);
  const loginSource=readFileSync(new URL('../public/ops-login/assets/login.js',import.meta.url),'utf8');assert.doesNotMatch(loginSource,/Storage\.(?:setItem|getItem)|console\./);assert.match(loginSource,/removeItem\('geek-cce-admin'\)/);
});
