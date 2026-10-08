import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import identityHandler from '../api/identity.js';
import { identityChallengeKey } from '../server/identity-keys.js';
import { verifyKaspaProof } from '../server/identity.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.wallet-proof.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-wallet-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-wallet-audit-key-32-characters';
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/redis\.wallet-proof\.test/);
  const values = JSON.parse(options.body); let payload;
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else payload = { result: await fixture.command(...values) };
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end() {} });
const request = (method, body, cookie = '') => ({ method, body, query: {}, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'x-forwarded-proto': 'https', 'user-agent': 'wallet-independent-test' } });
const session = async () => { const res = response(); await sessionHandler(request('POST', {}), res); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const call = async (cookie, body, method = 'POST') => { const res = response(); await identityHandler(request(method, body, cookie), res); return res; };
const wallet = n => { const privateKey = String(n).padStart(64, '0'), key = new kaspa.PrivateKey(privateKey); return { privateKey, publicKey: key.toPublicKey().toString(), address: key.toAddress('mainnet').toString() }; };
const proof = async (cookie, w, fields = {}) => { const issued = await call(cookie, { action: 'challenge', address: w.address, ...fields }); assert.equal(issued.statusCode, 201); return call(cookie, { action: 'verify', challengeId: issued.body.challenge.challengeId, signature: kaspa.signMessage({ message: issued.body.challenge.message, privateKey: w.privateKey }) }); };

test('x-only keys verify the published KIP-5 vector without relying on the local signer', () => {
  // https://github.com/kaspanet/kips/blob/master/kip-0005.md, vector 0.
  const vector = { message: 'Hello Kaspa!', publicKey: 'F9308A019258C31049344F85F89D5229B531C845836F99B08601F113BCE036F9', signature: '40B9BB2BE0AE02607279EDA64015A8D86E3763279170340B8243F7CE5344D77AFF1191598BAF2FD26149CAC3B4B12C2C433261C00834DB6098CB172AA48EF522' };
  assert.equal(verifyKaspaProof(vector), true);
  assert.equal(verifyKaspaProof({ ...vector, message: vector.message + '.' }), false);
});

test('address-only challenge requires a signature, rejects impersonation and consumes failed proofs', async () => {
  await fixture.command('FLUSHDB'); const cookie = await session(), owner = wallet(3), stranger = wallet(4);
  const issued = await call(cookie, { action: 'challenge', address: owner.address }); assert.equal(issued.statusCode, 201);
  assert.equal((await call(cookie, undefined, 'GET')).body.identity.linked, false);
  const invalid = await call(cookie, { action: 'verify', challengeId: issued.body.challenge.challengeId, signature: kaspa.signMessage({ message: issued.body.challenge.message, privateKey: stranger.privateKey }) });
  assert.equal(invalid.statusCode, 401);
  const replay = await call(cookie, { action: 'verify', challengeId: issued.body.challenge.challengeId, signature: kaspa.signMessage({ message: issued.body.challenge.message, privateKey: owner.privateKey }) });
  assert.equal(replay.body.code, 'IDENTITY_CHALLENGE_INVALID');
  assert.equal((await call(cookie, undefined, 'GET')).body.identity.linked, false);
  assert.equal((await proof(cookie, owner)).body.identity.address, owner.address);
});

test('manual address proof and x-only provider keys recover existing odd compressed-key identities and revoke old sessions', async () => {
  await fixture.command('FLUSHDB'); const owner = wallet(6); assert.equal(owner.publicKey.slice(0, 2), '03');
  const original = await session(), linked = await proof(original, owner, { publicKey: owner.publicKey }); assert.equal(linked.statusCode, 200);
  const other = await session(), recovered = await proof(other, owner); assert.equal(recovered.statusCode, 200); assert.equal(recovered.body.recovered, true);
  assert.equal((await call(original, undefined, 'GET')).statusCode, 401);
  const third = await session(), xOnly = await proof(third, owner, { publicKey: owner.publicKey.slice(2) }); assert.equal(xOnly.statusCode, 200); assert.equal(xOnly.body.recovered, true);
  assert.equal((await call(other, undefined, 'GET')).statusCode, 401);
  const payout = await proof(third, owner, { publicKey: owner.publicKey.slice(2), intent: 'payout', operation: 'set', payoutAddress: owner.address });
  assert.equal(payout.statusCode, 200); assert.equal(payout.body.authorization.oneTime, true);
});

test('single-key ECDSA-format addresses may prove the same key with KIP-5; network and mismatched keys fail closed', async () => {
  await fixture.command('FLUSHDB'); const cookie = await session(), w = wallet(6), key = new kaspa.PrivateKey(w.privateKey);
  w.address = key.toAddressECDSA('mainnet').toString();
  const verified = await proof(cookie, w); assert.equal(verified.statusCode, 200); assert.equal(verified.body.identity.address, w.address);
  const other = await session();
  assert.equal((await call(other, { action: 'challenge', address: w.address, publicKey: wallet(3).publicKey })).body.code, 'IDENTITY_KEY_MISMATCH');
  assert.equal((await call(other, { action: 'challenge', address: key.toAddress('testnet-10').toString() })).body.code, 'INVALID_KASPA_ADDRESS');
  assert.equal((await call(other, { action: 'challenge', address: w.address + 'q' })).body.code, 'INVALID_KASPA_ADDRESS');
});

test('manual proofs remain scoped to the requesting session, exact message and expiry', async () => {
  await fixture.command('FLUSHDB'); const cookie = await session(), stranger = await session(), w = wallet(9);
  const issue = () => call(cookie, { action: 'challenge', address: w.address });
  let issued = await issue(), challenge = issued.body.challenge;
  assert.equal((await call(stranger, { action: 'verify', challengeId: challenge.challengeId, signature: kaspa.signMessage({ message: challenge.message, privateKey: w.privateKey }) })).body.code, 'IDENTITY_CHALLENGE_INVALID');
  issued = await issue(); challenge = issued.body.challenge;
  assert.equal((await call(cookie, { action: 'verify', challengeId: challenge.challengeId, signature: kaspa.signMessage({ message: challenge.message + '\nchanged', privateKey: w.privateKey }) })).statusCode, 401);
  issued = await issue(); challenge = issued.body.challenge;
  const stored = JSON.parse(await fixture.command('GET', identityChallengeKey(challenge.challengeId)));
  stored.expiresAt = Date.now() - 1000;
  await fixture.command('SET', identityChallengeKey(challenge.challengeId), JSON.stringify(stored), 'EX', 60);
  assert.equal((await call(cookie, { action: 'verify', challengeId: challenge.challengeId, signature: kaspa.signMessage({ message: challenge.message, privateKey: w.privateKey }) })).body.code, 'IDENTITY_CHALLENGE_INVALID');
  assert.equal((await call(cookie, undefined, 'GET')).body.identity.linked, false);
});
