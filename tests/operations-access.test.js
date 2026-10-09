import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import sessionHandler from '../api/session.js';
import moderationHandler from '../api/moderation.js';
import auditHandler from '../api/audit.js';
import payoutHandler from '../api/payout-review.js';
import { createContribution } from '../server/cce.js';
import { createPayoutReview, payoutReviewWriteCommands } from '../server/payout-review.js';
import { defaultProfile, saveProfile } from '../server/profile.js';
import { communityPrefix } from '../server/community-contributions.js';
import { redisFixture } from './helpers/redis-fixture.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) { if (process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error; }
const run = fixture ? test : (name, fn) => test(name, { skip: 'Real Redis required in CI.' }, fn);
const savedFetch = globalThis.fetch;
const moderator = 'synthetic-private-moderator-key-123456';
const audit = 'synthetic-audit-viewer-key-123456';
const payout = 'synthetic-payout-reviewer-key-123456';
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
    process.env.CCE_ADMIN_TOKEN = moderator; process.env.AUDIT_ADMIN_TOKEN = audit; process.env.PAYOUT_REVIEW_ADMIN_TOKEN = payout;
    process.env.AUDIT_LOG_SECRET = 'synthetic-ops-audit-hmac-key-with-32-characters';
    delete process.env.OPS_ACCESS_TOKEN; delete process.env.OPS_ALLOWED_ORIGINS;
  });
}
after(async () => { globalThis.fetch = savedFetch; if (fixture) await fixture.close(); });
const call = async ({ method = 'GET', path = '', action, service = 'operations', cookie = '', key, headers = {}, body, handler = sessionHandler } = {}) => {
  const res = { statusCode: 0, headers: {}, body: null, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; return this; } };
  await handler({ method, query: { service, path, ...(action ? { action } : {}) }, headers: { origin, 'content-type': 'application/json', 'user-agent': 'ops-access-test', 'x-forwarded-for': '127.0.0.1', cookie, ...headers }, body: body ?? (key !== undefined ? { key } : {}) }, res);
  return res;
};
const login = async (key = moderator, cookie = '') => { const res = await call({ method: 'POST', action: 'login', key, cookie }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const sessionId = cookie => cookie.split('=')[1];
run('dashboard shell and every private asset require a server session', async () => {
  for (const path of ['', 'index', 'index.html', '/', 'questions', 'questions/index.html', 'activity', 'payouts']) {
    const res = await call({ path }); assert.equal(res.statusCode, 303); assert.equal(res.headers.Location, '/ops-login/'); assert.equal(res.body, undefined);
  }
  for (const path of ['assets/ops.js','assets/ops-core.js','assets/ops.css']) { const res = await call({path}); assert.equal(res.statusCode, 401); assert.equal(JSON.stringify(res.body).includes('roleClient'), false); }
  assert.equal((await call({action:'status'})).statusCode,401);
  for(const cookie of ['geek_session='+'a'.repeat(32), '__Host-geek_ops=forged', '__Host-geek_ops='+ 'a'.repeat(64)]) assert.equal((await call({cookie,path:'assets/ops.js'})).statusCode,401);
});
run('sole operator login grants a short-lived Secure HttpOnly session, not a stored password', async () => {
  const res = await call({method:'POST',action:'login',key:moderator});assert.equal(res.statusCode,200);
  const cookie = res.headers['Set-Cookie'];assert.match(cookie,/^__Host-geek_ops=[a-f0-9]{64}; Path=\/; HttpOnly; Secure; SameSite=Strict; Max-Age=1800$/);
  const id=sessionId(cookie.split(';')[0]),record=JSON.parse(await fixture.command('GET','geek:ops:session:'+id));assert.equal(record.version,2);assert.equal(record.role,'owner');assert.deepEqual(record.permissions,['cce','audit','payout']);assert.equal(JSON.stringify(record).includes(moderator),false);
  const page=await call({cookie:cookie.split(';')[0]});assert.equal(page.statusCode,200);assert.match(String(page.body),/Choose a workspace/);assert.match(page.headers['Cache-Control'],/private, no-store/);assert.equal(page.headers.Vary,'Cookie');
  for(const path of ['assets/ops.js','assets/ops-core.js','assets/ops.css','questions','activity','payouts'])assert.equal((await call({cookie:cookie.split(';')[0],path})).statusCode,200);
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
  try{const res=await call({cookie:'__Host-geek_ops='+'a'.repeat(64)});assert.notEqual(res.statusCode,200);assert.equal(String(res.body).includes('Choose a workspace'),false);}finally{globalThis.fetch=saved;}
});
test('deployment routes the complete private namespace to the server and retires public review files',()=>{
  const cfg=JSON.parse(readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.ok(cfg.rewrites.some(item=>item.source==='/ops/'&&item.destination.includes('service=operations')));
  for(const page of ['questions','activity','payouts'])for(const suffix of ['', '/'])assert.ok(cfg.rewrites.some(item=>item.source===`/ops/${page}${suffix}`&&item.destination===`/api/session?service=operations&path=${page}`));
  assert.ok(cfg.rewrites.some(item=>item.source==='/ops/:path*'&&item.destination.includes('service=operations')));
  assert.ok(cfg.redirects.some(item=>item.source==='/moderate/'&&item.destination==='/ops/'));
  assert.ok(cfg.redirects.some(item=>item.source==='/moderate/:path*'&&item.destination==='/ops/'));
  assert.equal(cfg.functions['api/session.js'].includeFiles,'server/ops-ui/**');
  assert.equal(existsSync(new URL('../public/ops',import.meta.url)),false);assert.equal(existsSync(new URL('../public/moderate',import.meta.url)),false);
  const loginSource=readFileSync(new URL('../public/ops-login/assets/login.js',import.meta.url),'utf8');assert.doesNotMatch(loginSource,/Storage\.(?:setItem|getItem)|console\./);assert.match(loginSource,/removeItem\('geek-cce-admin'\)/);
});

run('one owner sign-in authorizes all configured role APIs without exposing their keys', async () => {
  const cookie=await login(),handlers=[moderationHandler,auditHandler,payoutHandler];
  for(const handler of handlers){const res=await call({cookie,handler});assert.equal(res.statusCode,200);for(const key of [moderator,audit,payout])assert.equal(JSON.stringify(res.body).includes(key),false);}
  for(const handler of handlers)assert.equal((await call({handler})).statusCode,403);
  const status=await call({cookie,action:'status'});assert.deepEqual(status.body.permissions,['cce','audit','payout']);
  await call({method:'POST',action:'logout',cookie});
  for(const handler of handlers)assert.equal((await call({cookie,handler})).statusCode,403);
});
run('owner permissions enforce scope, expiry, credential rotation and legacy-session reauthentication', async () => {
  const cookie=await login(),key='geek:ops:session:'+sessionId(cookie),record=JSON.parse(await fixture.command('GET',key));
  const checkDenied=async()=>{for(const handler of [moderationHandler,auditHandler,payoutHandler])assert.equal((await call({cookie,handler})).statusCode,403);};
  record.version=1;await fixture.command('SET',key,JSON.stringify(record));await checkDenied();
  record.version=2;record.permissions=['cce'];await fixture.command('SET',key,JSON.stringify(record));
  assert.equal((await call({cookie,handler:moderationHandler})).statusCode,200);assert.equal((await call({cookie,handler:auditHandler})).statusCode,403);
  record.permissions=['cce','audit','payout'];await fixture.command('SET',key,JSON.stringify(record));
  process.env.AUDIT_ADMIN_TOKEN='rotated-audit-viewer-key-123456';await checkDenied();process.env.AUDIT_ADMIN_TOKEN=audit;
  process.env.PAYOUT_REVIEW_ADMIN_TOKEN='rotated-payout-review-key-123456';await checkDenied();process.env.PAYOUT_REVIEW_ADMIN_TOKEN=payout;
  record.expiresAt=Date.now()-1;await fixture.command('SET',key,JSON.stringify(record));await checkDenied();
});
run('cookie-authenticated writes require trusted origins and JSON and explicit wrong keys never fall back to owner access', async () => {
  const cookie=await login();
  for(const handler of [moderationHandler,auditHandler,payoutHandler]){
    assert.equal((await call({cookie,handler,headers:{origin:'https://evil.example'}})).statusCode,403);
    assert.equal((await call({cookie,handler,headers:{'sec-fetch-site':'cross-site'}})).statusCode,403);
    assert.equal((await call({cookie,handler,headers:{authorization:'Bearer wrong'}})).statusCode,403);
    assert.equal((await call({cookie,handler,headers:{'x-cce-admin':'wrong','x-audit-admin':'wrong','x-payout-review-admin':'wrong'}})).statusCode,403);
  }
  for(const handler of [moderationHandler,payoutHandler])for(const headers of [{origin:''},{origin:'https://evil.example'},{'content-type':'application/x-www-form-urlencoded'}])assert.equal((await call({cookie,handler,method:'POST',headers,body:{action:'approve'}})).statusCode,403);
  assert.equal((await call({cookie,handler:auditHandler,method:'POST'})).statusCode,405);
  assert.equal((await call({cookie,handler:auditHandler,headers:{'x-audit-admin':audit}})).statusCode,200);
});
run('owner sessions cannot enable an unconfigured role and dedicated owner access remains separate from role keys', async () => {
  process.env.OPS_ACCESS_TOKEN=owner;delete process.env.PAYOUT_REVIEW_ADMIN_TOKEN;
  const cookie=await login(owner);assert.deepEqual((await call({cookie,action:'status'})).body.permissions,['cce','audit']);
  assert.equal((await call({cookie,handler:payoutHandler})).statusCode,503);
  assert.equal((await call({handler:auditHandler,headers:{'x-cce-admin':moderator}})).statusCode,403);
  assert.equal((await call({handler:payoutHandler,headers:{'x-audit-admin':audit}})).statusCode,503);
  assert.equal((await call({cookie,handler:auditHandler})).statusCode,200);
});
run('owner-cookie moderation and payout decisions use the existing recorded workflows', async () => {
  const contribution=await createContribution({id:'owner-session-contributor'},{category:'kaspa',difficulty:'easy',topic:'Session checks',prompt:'Which option is correct for the owner-session test?',options:['Alpha','Beta','Gamma','Delta'],correctIndex:0,explanation:'Synthetic answer evidence for an isolated test.',source:'https://example.org/session-evidence',displayName:'Synthetic Geek',original:true});
  const address='kaspa:qzj0e55rlxpm0knvra9wvgckpkyq9h8hv8wl0lh2ngjad9a4cedmj24cy07ew';
  const review=createPayoutReview({playerId:'owner-session-player',address,addressMasked:'kaspa:qzj0…07ew',payoutVersion:1,reasons:['recent-destination-change']});
  await saveProfile('owner-session-player',{...defaultProfile(),payoutAddress:address,payoutAddressVersion:1,payoutReviewId:review.id});
  for(const command of payoutReviewWriteCommands(review))await fixture.command(...command);
  const cookie=await login();
  const rejected=await call({cookie,handler:moderationHandler,method:'POST',headers:{origin:''},body:{id:contribution.id,action:'approve',note:'Verified test evidence.'}});assert.equal(rejected.statusCode,403);
  assert.equal(JSON.parse(await fixture.command('GET','geek:cce:submission:'+contribution.id)).status,'submitted');
  const approved=await call({cookie,handler:moderationHandler,method:'POST',body:{id:contribution.id,action:'approve',note:'Verified test evidence.'}});assert.equal(approved.statusCode,200);assert.equal(approved.body.submission.status,'approved');
  const payoutResult=await call({cookie,handler:payoutHandler,method:'POST',body:{id:review.id,action:'approve',note:'Verified synthetic destination evidence.'}});assert.equal(payoutResult.statusCode,200);assert.equal(payoutResult.body.review.status,'approved');assert.equal(payoutResult.body.settlementEnabled,false);assert.match(payoutResult.body.auditReceipt.eventId,/^aud_/);
});

run('attention summary and its script require the current owner session and reject cross-site reads', async () => {
  assert.equal((await call({ action: 'attention' })).statusCode, 401);
  assert.equal((await call({ path: 'assets/attention.js' })).statusCode, 401);
  for (const headers of [{ 'x-cce-admin': moderator }, { authorization: 'Bearer ' + audit }]) assert.equal((await call({ action: 'attention', headers })).statusCode, 401);
  const cookie = await login();
  assert.equal((await call({ cookie, path: 'assets/attention.js' })).statusCode, 200);
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await call({ cookie, action: 'attention', headers })).statusCode, 403);
  for (const method of ['POST', 'HEAD', 'DELETE']) assert.equal((await call({ cookie, method, action: 'attention' })).statusCode, 405);
  const result = await call({ cookie, action: 'attention' });
  assert.equal(result.statusCode, 200); assert.match(result.headers['Cache-Control'], /private, no-store/);
  assert.deepEqual(result.body.hall, { status: 'ready', pending: 0 });
  assert.deepEqual(result.body.questions, { status: 'ready', review: 0, publish: 0, scanned: 0, limit: 100, hasMore: false });
  process.env.CCE_ADMIN_TOKEN += '-rotated'; assert.equal((await call({ cookie, action: 'attention' })).statusCode, 401);
});

run('attention exposes only counts, splits question decisions from publication, and follows Hall retention', async () => {
  const applied = await call({ service: 'community', method: 'POST', body: { requestId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'PRIVATE contributor', profile: 'https://example.org/private-profile', kind: 'testing', details: 'PRIVATE application details and evidence for testing.', evidence: 'https://example.org/private-evidence', recognition: false, consent: false, website: '' } });
  assert.equal(applied.statusCode, 200);
  const prefix = communityPrefix(), id = applied.body.receipt.id;
  await fixture.command('ZADD', prefix + ':pending', Date.now() - 91 * 86400 * 1000, 'app_' + 'f'.repeat(32));
  for (const [index, status] of ['submitted', 'approved', 'changes-requested', 'published', 'rejected'].entries()) {
    const questionId = 'cce_' + index.toString(16).padStart(24, '0');
    await fixture.command('SET', 'geek:cce:submission:' + questionId, JSON.stringify({ id: questionId, status, prompt: 'PRIVATE question', correctIndex: 3, contributorSessionId: 'PRIVATE wallet identity' }));
    await fixture.command('ZADD', 'geek:cce:review', index, questionId);
  }
  const cookie = await login(), result = await call({ cookie, action: 'attention' });
  assert.deepEqual(result.body.hall, { status: 'ready', pending: 1 });
  assert.deepEqual(result.body.questions, { status: 'ready', review: 1, publish: 1, scanned: 5, limit: 100, hasMore: false });
  assert.equal(JSON.stringify(result.body).includes('PRIVATE'), false); assert.equal(JSON.stringify(result.body).includes(id), false);
  assert.equal(await fixture.command('ZCARD', prefix + ':pending'), 1);
  await call({ cookie, action: 'community', method: 'POST', body: { id, action: 'close', expectedRevision: 1, note: 'Reviewed the offer to help.' } });
  assert.equal((await call({ cookie, action: 'attention' })).body.hall.pending, 0);
});

run('attention reports the bounded question window instead of claiming a full queue total', async () => {
  for (let i = 0; i < 101; i++) {
    const id = 'cce_' + i.toString(16).padStart(24, '0');
    await fixture.command('SET', 'geek:cce:submission:' + id, JSON.stringify({ id, status: i === 0 ? 'approved' : 'submitted' }));
    await fixture.command('ZADD', 'geek:cce:review', i, id);
  }
  const result = await call({ cookie: await login(), action: 'attention' });
  assert.deepEqual(result.body.questions, { status: 'ready', review: 100, publish: 0, scanned: 100, limit: 100, hasMore: true });
});

run('attention keeps independent queues available when one has a storage fault or missing permission', async () => {
  const cookie = await login();
  await fixture.command('SET', 'geek:cce:review', 'wrong-type');
  let result = await call({ cookie, action: 'attention' });
  assert.equal(result.statusCode, 200); assert.deepEqual(result.body.questions, { status: 'unavailable' }); assert.equal(result.body.hall.pending, 0);
  await fixture.command('DEL', 'geek:cce:review');
  const id = 'cce_' + 'a'.repeat(24); await fixture.command('SET', 'geek:cce:submission:' + id, '{invalid'); await fixture.command('ZADD', 'geek:cce:review', 1, id);
  result = await call({ cookie, action: 'attention' }); assert.deepEqual(result.body.questions, { status: 'unavailable' });
  await fixture.command('DEL', 'geek:cce:review'); await fixture.command('SET', communityPrefix() + ':pending', 'wrong-type');
  result = await call({ cookie, action: 'attention' }); assert.deepEqual(result.body.hall, { status: 'unavailable' }); assert.equal(result.body.questions.review, 0);
  process.env.OPS_ACCESS_TOKEN = owner; delete process.env.CCE_ADMIN_TOKEN;
  result = await call({ cookie: await login(owner), action: 'attention' }); assert.deepEqual(result.body.questions, { status: 'access-unavailable' });
});

run('attention reads are rate limited and do not extend owner sessions', async () => {
  const cookie = await login(), key = 'geek:ops:session:' + sessionId(cookie), original = await fixture.command('GET', key);
  for (let i = 0; i < 60; i++) assert.equal((await call({ cookie, action: 'attention' })).statusCode, 200);
  assert.equal((await call({ cookie, action: 'attention' })).statusCode, 429);
  assert.equal(await fixture.command('GET', key), original);
  const record = JSON.parse(original); record.expiresAt = Date.now() - 1; await fixture.command('SET', key, JSON.stringify(record));
  assert.equal((await call({ cookie, action: 'attention' })).statusCode, 401);
});
