import test, { beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, stat, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redisFixture } from './helpers/redis-fixture.js';
import handler from '../api/session.js';
import moderation from '../api/moderation.js';
import audit from '../api/audit.js';
import payout from '../api/payout-review.js';
import { decodeTotpSecret, hotpCode } from '../server/operations-mfa.js';
import { operationsConfig } from '../server/operations-access.js';
import { createEnrollment, writeEnrollment } from '../scripts/setup-ops-mfa.mjs';

const secret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', key = 'synthetic-owner-key-for-authenticator-tests', origin = 'https://www.geekprotocol.xyz';
const fixture = await redisFixture(), oldFetch = globalThis.fetch;
let seconds = 1_700_000_000, failClaim = false;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.mfa.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic';
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/redis\.mfa\.test/); const commands = JSON.parse(options.body); let payload;
  if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(commands)).map(result => ({ result }));
  else if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...commands, ['EXEC']])).at(-1).map(result => ({ result }));
  else {
    if (failClaim && commands[0] === 'EVAL') throw new Error('Synthetic unavailable MFA store');
    payload = { result: commands[0] === 'TIME' ? [String(seconds), '0'] : await fixture.command(...commands) };
  }
  return new Response(JSON.stringify(payload));
};
beforeEach(async () => {
  await fixture.command('FLUSHDB'); seconds = 1_700_000_000; failClaim = false;
  process.env.OPS_ACCESS_TOKEN = key; delete process.env.OPS_TOTP_SECRET;
  process.env.AUDIT_LOG_SECRET = 'synthetic-mfa-audit-key-with-32-characters';
  for (const name of ['CCE_ADMIN_TOKEN', 'AUDIT_ADMIN_TOKEN', 'PAYOUT_REVIEW_ADMIN_TOKEN']) process.env[name] = 'synthetic-' + name + '-with-32-characters';
});
after(async () => { globalThis.fetch = oldFetch; await fixture.close(); });
const code = (offset = 0) => hotpCode(decodeTotpSecret(secret), Math.floor(seconds / 30) + offset);
const call = async ({ action = 'login', method = 'POST', cookie = '', body = { key, code: code() }, headers = {}, api = handler } = {}) => {
  const res = { statusCode: 0, headers: {}, body: null, setHeader(k,v) { this.headers[k] = v; }, status(n) { this.statusCode=n; return this; }, json(v) { this.body=v; return this; }, end(v) { this.body=v; return this; } };
  await api({ method, query: { service: 'operations', action }, headers: { origin, 'content-type':'application/json', cookie, 'x-forwarded-for':'192.0.2.22', ...headers }, body },res); return res;
};
const cookieFor = res => res.headers['Set-Cookie']?.split(';')[0] || '';

test('HOTP and TOTP match independent RFC vectors including timestamps beyond 2038', () => {
  const bytes = decodeTotpSecret(secret);
  assert.equal(bytes.toString(), '12345678901234567890');
  const hotp = ['755224','287082','359152','969429','338314','254676','287922','162583','399871','520489'];
  hotp.forEach((expected,i) => assert.equal(hotpCode(bytes,i), expected));
  for (const [time,expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']]) assert.equal(hotpCode(bytes,Math.floor(time/30),8),expected);
  for (const value of ['', 'short', secret+'!', 'A'.repeat(105), 'A'.repeat(33), 'A'.repeat(32)+'B']) assert.throws(()=>decodeTotpSecret(value));
});

test('enrollment creates private files without overwriting an existing secret', async () => {
  const enrollment=createEnrollment(); assert.equal(decodeTotpSecret(enrollment.secret).length,20); assert.match(enrollment.uri,/^otpauth:\/\/totp\//);
  const dir=await mkdtemp(join(tmpdir(),'geek-enroll-')); const filename=join(dir,'setup.json');
  try { await writeEnrollment(filename); const first=await readFile(filename,'utf8'); assert.equal((await stat(filename)).mode & 0o777,0o600); await assert.rejects(writeEnrollment(filename),{code:'EEXIST'}); assert.equal(await readFile(filename,'utf8'),first); await assert.rejects(writeEnrollment('relative.json')); }
  finally { await rm(dir,{recursive:true,force:true}); }
});

test('MFA login requires both factors; responses, sessions and audit omit secret and code', async () => {
  process.env.OPS_TOTP_SECRET=secret;
  for (const body of [{key},{key,code:'000000'},{key,code:'12345678'},{key:'wrong',code:code()}]) { const rejected=await call({body}); assert.equal(rejected.statusCode,403); assert.equal(cookieFor(rejected),''); }
  const accepted=await call(); assert.equal(accepted.statusCode,200); const cookie=cookieFor(accepted);
  const status=await call({method:'GET',action:'status',cookie}); assert.equal(status.body.mfaEnabled,true);
  const record=await fixture.command('GET','geek:ops:session:'+cookie.split('=')[1]);
  const ids=await fixture.command('ZREVRANGE','geek:audit:index',0,-1); const events=await Promise.all(ids.map(id=>fixture.command('GET','geek:audit:event:'+id)));
  for(const value of [JSON.stringify(status.body),record,...events]) for(const sensitive of [secret,key,code()]) assert.equal(value.includes(sensitive),false);
});

test('one code cannot be raced, replayed or replaced with an older accepted clock step', async () => {
  process.env.OPS_TOTP_SECRET=secret;
  const results=await Promise.all([call(),call({headers:{'x-forwarded-for':'192.0.2.23'}})]); assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,403]);
  assert.equal((await call()).statusCode,403); assert.equal((await call({body:{key,code:code(-1)}})).statusCode,403);
  assert.equal((await call({body:{key,code:code(2)}})).statusCode,403);
  assert.equal((await call({body:{key,code:code(1)}})).statusCode,200); seconds+=30; assert.equal((await call()).statusCode,403);
});

test('enabling or rotating MFA revokes old sessions and malformed configuration fails closed', async () => {
  const previous=cookieFor(await call()); process.env.OPS_TOTP_SECRET=secret;
  assert.equal((await call({action:'status',method:'GET',cookie:previous})).statusCode,401);
  const current=cookieFor(await call()); process.env.OPS_TOTP_SECRET=createEnrollment().secret;
  assert.equal((await call({action:'status',method:'GET',cookie:current})).statusCode,401);
  for(const value of ['', 'bad']) { process.env.OPS_TOTP_SECRET=value; assert.equal((await call()).statusCode,503); }
});

test('MFA closes direct moderation, audit and payout keys while retaining scoped owner-cookie access', async () => {
  process.env.OPS_TOTP_SECRET=secret; const cookie=cookieFor(await call());
  for(const [api,header,name] of [[moderation,'x-cce-admin','CCE_ADMIN_TOKEN'],[audit,'x-audit-admin','AUDIT_ADMIN_TOKEN'],[payout,'x-payout-review-admin','PAYOUT_REVIEW_ADMIN_TOKEN']]) {
    assert.equal((await call({api,method:'GET',headers:{[header]:process.env[name]}})).statusCode,403);
    assert.equal((await call({api,method:'GET',cookie})).statusCode,200);
    assert.equal((await call({api,method:'GET',cookie,headers:{[header]:process.env[name]}})).statusCode,403);
    assert.equal((await call({api,method:'GET',cookie,headers:{'sec-fetch-site':'cross-site'}})).statusCode,403);
  }
});

test('origin, rate limits, replay corruption and unavailable MFA storage cannot bypass the second factor', async () => {
  process.env.OPS_TOTP_SECRET=secret;
  assert.equal((await call({headers:{origin:'https://evil.example'}})).statusCode,403);
  const replayKey='geek:ops:totp:'+operationsConfig().totpFingerprint; await fixture.command('SET',replayKey,'corrupt'); assert.equal((await call()).statusCode,403);
  await fixture.command('DEL',replayKey); failClaim=true; assert.equal(cookieFor(await call()),''); failClaim=false;
  await fixture.command('FLUSHDB');
  for(let i=0;i<8;i++)assert.equal((await call({body:{key,code:'000000'},headers:{'user-agent':'different-agent-'+i,'x-forwarded-for':'192.0.2.'+(60+i)}})).statusCode,403);
  assert.equal((await call({headers:{'user-agent':'new-agent','x-forwarded-for':'192.0.2.99'}})).statusCode,429);
});
