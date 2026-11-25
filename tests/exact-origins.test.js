import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import identityHandler from '../api/identity.js';
import royaleHandler from '../server/royale-api.js';
import { passkeyContext } from '../server/passkeys.js';
import { identityChallengeKey } from '../server/identity-keys.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
const production = 'https://www.geekprotocol.xyz';
const preview = 'https://review-geek.example';
const privateKey = '6'.padStart(64, '0');
const key = new kaspa.PrivateKey(privateKey);
const address = key.toAddress('mainnet').toString();
key.free();
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.exact-origin.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-origin-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-origin-audit-key-with-32-characters';
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.exact-origin.test'));
  const commands = JSON.parse(options.body);
  const result = String(url).endsWith('/multi-exec')
    ? (await fixture.commands([['MULTI'], ...commands, ['EXEC']])).at(-1).map(result => ({ result }))
    : String(url).endsWith('/pipeline') ? (await fixture.commands(commands)).map(result => ({ result }))
      : { result: await fixture.command(...commands) };
  return Response.json(result);
};
beforeEach(async () => {
  await fixture.command('FLUSHDB');
  for (const name of ['IDENTITY_ALLOWED_ORIGINS', 'IDENTITY_ORIGIN', 'PASSKEY_ORIGIN', 'VERCEL_URL', 'VERCEL_BRANCH_URL']) delete process.env[name];
});
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const call = async (handler, { cookie = '', headers = {}, body = {}, method = 'POST', query = {} } = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; return this; } };
  await handler({ method, body, query, headers: { host: 'www.geekprotocol.xyz', origin: production, 'x-forwarded-proto': 'https', 'content-type': 'application/json', cookie, 'user-agent': 'origin-regression', ...headers } }, res);
  return res;
};
const session = async () => (await call(sessionHandler, { body: { displayName: 'Origin Geek' } })).headers['Set-Cookie'].split(';')[0];
const challenge = (cookie, headers = {}) => call(identityHandler, { cookie, headers, body: { action: 'challenge', address } });
const createRoom = (cookie, headers = {}) => call(royaleHandler, { cookie, headers, body: { action: 'create', category: 'kaspa' } });
const previewHeaders = { host: new URL(preview).host, origin: preview };

test('wallet challenges reject a substituted forwarded host even with matching attacker Origin', async () => {
  const cookie = await session();
  const result = await challenge(cookie, { 'x-forwarded-host': 'attacker.vercel.app', origin: 'https://attacker.vercel.app' });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'IDENTITY_ORIGIN_INVALID');
  assert.equal((await fixture.command('KEYS', '*challenge*')).length, 0);
});

test('arbitrary Vercel tenants and automatic deployment names are not wallet signing origins', async () => {
  const cookie = await session();
  process.env.VERCEL_URL = 'attacker.vercel.app';
  process.env.VERCEL_BRANCH_URL = 'attacker.vercel.app';
  const result = await challenge(cookie, { host: 'attacker.vercel.app', origin: 'https://attacker.vercel.app' });
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.code, 'IDENTITY_ORIGIN_INVALID');
});

test('wallet requests reject non-HTTPS and multi-value or array headers', async () => {
  const cookie = await session();
  for (const headers of [
    { 'x-forwarded-host': 'www.geekprotocol.xyz,attacker.example' },
    { 'x-forwarded-host': ['www.geekprotocol.xyz', 'attacker.example'] },
    { 'x-forwarded-proto': 'https,http' },
    { 'x-forwarded-proto': ['https'] },
    { 'x-forwarded-proto': 'http' },
    { host: 'www.geekprotocol.xyz,attacker.example' },
    { host: ['www.geekprotocol.xyz'] },
    { origin: production + ',https://attacker.example' },
    { origin: [production] },
    { origin: 'http://www.geekprotocol.xyz' },
    { origin: production + '/' },
    { origin: undefined, 'sec-fetch-site': ['cross-site'] },
    { origin: undefined, 'sec-fetch-site': 'same-origin,cross-site' }
  ]) {
    const result = await challenge(cookie, headers);
    assert.ok([400, 409].includes(result.statusCode), JSON.stringify(headers));
  }
});

test('wallet preview origins require an explicit exact entry and a matching original Host', async () => {
  const cookie = await session();
  assert.equal((await challenge(cookie, previewHeaders)).statusCode, 400);
  process.env.IDENTITY_ALLOWED_ORIGINS = preview;
  const result = await challenge(cookie, { ...previewHeaders, 'x-forwarded-host': new URL(preview).host });
  assert.equal(result.statusCode, 201);
  const saved = JSON.parse(await fixture.command('GET', identityChallengeKey(result.body.challenge.challengeId)));
  assert.equal(saved.origin, preview);
  assert.match(result.body.challenge.message, new RegExp('Origin: ' + preview));
  assert.equal((await challenge(cookie, { 'x-forwarded-host': new URL(preview).host, origin: preview })).statusCode, 400);
  process.env.IDENTITY_ALLOWED_ORIGINS = 'https://owned-geek-review.vercel.app';
  assert.equal((await challenge(cookie, { host: 'owned-geek-review.vercel.app', origin: process.env.IDENTITY_ALLOWED_ORIGINS })).statusCode, 201);
  process.env.IDENTITY_ALLOWED_ORIGINS = 'https://*.vercel.app';
  assert.equal((await challenge(cookie, previewHeaders)).statusCode, 400);
});

test('legacy exact origin configuration remains accepted, while unsafe configured URLs fail closed', async () => {
  const cookie = await session();
  process.env.IDENTITY_ORIGIN = preview;
  assert.equal((await challenge(cookie, previewHeaders)).statusCode, 201);
  delete process.env.IDENTITY_ORIGIN;
  for (const value of ['http://review-geek.example', preview + '/path', preview + '?query=1', 'https://user:pass@review-geek.example', preview + '#fragment']) {
    process.env.IDENTITY_ALLOWED_ORIGINS = value;
    assert.equal((await challenge(cookie, previewHeaders)).statusCode, 400, value);
  }
});

test('wallet proofs cannot move between two allowed origins and valid same-origin proof still works', async () => {
  const cookie = await session();
  process.env.IDENTITY_ALLOWED_ORIGINS = preview;
  const issued = await challenge(cookie);
  assert.equal(issued.statusCode, 201);
  const body = { action: 'verify', challengeId: issued.body.challenge.challengeId, signature: kaspa.signMessage({ message: issued.body.challenge.message, privateKey }) };
  const rejected = await call(identityHandler, { cookie, headers: previewHeaders, body });
  assert.equal(rejected.statusCode, 409);
  assert.equal(rejected.body.code, 'IDENTITY_ORIGIN_MISMATCH');
  assert.notEqual((await call(identityHandler, { cookie, body })).statusCode, 200);
  const fresh = await challenge(cookie);
  const accepted = await call(identityHandler, { cookie, body: { action: 'verify', challengeId: fresh.body.challenge.challengeId, signature: kaspa.signMessage({ message: fresh.body.challenge.message, privateKey }) } });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.body.identity.address, address);
});

test('Royale writes require an exact allowed Origin and cannot substitute forwarded headers', async () => {
  const cookie = await session();
  for (const headers of [
    { origin: undefined }, { origin: 'null' },
    { host: 'attacker.vercel.app', origin: 'https://attacker.vercel.app' },
    { 'x-forwarded-host': 'attacker.vercel.app', origin: 'https://attacker.vercel.app' },
    { 'x-forwarded-host': 'www.geekprotocol.xyz,attacker.example' },
    { 'x-forwarded-proto': 'https,http' },
    { 'x-forwarded-proto': 'http' },
    { origin: production, 'sec-fetch-site': 'cross-site' }
  ]) assert.equal((await createRoom(cookie, headers)).statusCode, 403, JSON.stringify(headers));
  assert.equal((await createRoom(cookie)).statusCode, 201);
  process.env.IDENTITY_ALLOWED_ORIGINS = preview;
  assert.equal((await createRoom(cookie, previewHeaders)).statusCode, 201);
  assert.equal((await call(royaleHandler, { method: 'GET', headers: { origin: undefined }, query: { discover: '1' } })).statusCode, 200);
});

test('wallet preview allowlisting does not broaden passkey relying-party configuration', () => {
  process.env.IDENTITY_ALLOWED_ORIGINS = preview;
  assert.deepEqual(passkeyContext({ method: 'POST', headers: { host: 'www.geekprotocol.xyz', origin: production } }), { origin: production, rpID: 'geekprotocol.xyz' });
  assert.throws(() => passkeyContext({ method: 'POST', headers: previewHeaders }), /PASSKEY_ORIGIN_INVALID/);
  process.env.PASSKEY_ORIGIN = preview;
  assert.deepEqual(passkeyContext({ method: 'POST', headers: previewHeaders }), { origin: preview, rpID: new URL(preview).host });
});
