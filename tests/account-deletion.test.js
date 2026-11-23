import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import passkeysHandler from '../api/passkeys.js';
import identityHandler from '../api/identity.js';
import { identityPlayerKey, identityWalletKey } from '../server/identity-keys.js';
import { hashAuditIdentifier } from '../server/audit.js';
import { passkeyAccountKey } from '../server/passkey-grants.js';
import { profileKeyFor } from '../server/profile.js';
import { rewardAddressKey } from '../server/reward-addresses.js';
import { questKey } from '../server/quest.js';
import { deletedPlayerKey, ownedPlayerKeys, standingKeys, TOMBSTONE_TTL } from '../server/account-deletion.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let beforeCommand = null;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.account-deletion.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-account-deletion-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-account-deletion-audit-32-chars';
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.account-deletion.test'));
  const command = JSON.parse(options.body);
  await beforeCommand?.(command);
  const payload = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...command, ['EXEC']])).at(-1).map(result => ({ result }))
    : String(url).endsWith('/pipeline') ? (await fixture.commands(command)).map(result => ({ result })) : { result: await fixture.command(...command) };
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { beforeCommand = null; await fixture.command('FLUSHDB'); });

const origin = 'https://www.geekprotocol.xyz', rp = 'geekprotocol.xyz';
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, end() {} });
const call = async (handler, cookie, body, method = 'POST') => {
  const res = response();
  await handler({ method, body, headers: { cookie, host: 'www.geekprotocol.xyz', origin, 'user-agent': 'synthetic-deletion-tests' } }, res);
  return res;
};
const cookieFrom = r => r.headers['Set-Cookie'].split(';')[0];
const newSession = async () => cookieFrom(await call(sessionHandler, '', { displayName: 'Deletion Tester' }));
const sessionRecord = async cookie => JSON.parse(await fixture.command('GET', `geek:session:${cookie.split('=')[1]}`));
const hash = value => createHash('sha256').update(value).digest();
const authenticator = () => {
  const { publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }), id = randomBytes(32), cid = id.toString('base64url');
  const cose = isoCBOR.encode(new Map([[1, 2], [3, -7], [-1, 1], [-2, new Uint8Array(Buffer.from(jwk.x, 'base64url'))], [-3, new Uint8Array(Buffer.from(jwk.y, 'base64url'))]]));
  return { id: cid, register(options) {
    const client = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin }));
    const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
    const data = Buffer.concat([hash(rp), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, cose]);
    const attestation = isoCBOR.encode(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', new Uint8Array(data)]]));
    return { id: cid, rawId: cid, type: 'public-key', response: { clientDataJSON: client.toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] }, clientExtensionResults: {} };
  } };
};
const enroll = async cookie => {
  const key = authenticator();
  const begin = await call(passkeysHandler, cookie, { action: 'begin-register' }); assert.equal(begin.statusCode, 200, JSON.stringify(begin.body));
  const finish = await call(passkeysHandler, cookie, { action: 'finish-register', challengeId: begin.body.challengeId, response: key.register(begin.body.options), label: 'Test key' });
  assert.equal(finish.statusCode, 200, JSON.stringify(finish.body));
  return { cookie: cookieFrom(finish), grant: finish.body.grant.token, key };
};
const credentialIndex = id => `geek:passkey:credential:v1:${createHash('sha256').update(id).digest('hex')}`;
const seedPlayerData = async playerId => {
  for (const key of [profileKeyFor(playerId), rewardAddressKey(playerId), questKey(playerId), `geek:vault:${playerId}`]) await fixture.command('SET', key, '{"synthetic":true}');
  const [board, meta] = standingKeys()[0];
  await fixture.command('ZADD', board, 900, playerId);
  await fixture.command('HSET', meta, playerId, '{"name":"Deletion Tester"}');
  await fixture.command('ZADD', board, 500, 'f'.repeat(32));
  return { board, meta };
};
const status = cookie => call(passkeysHandler, cookie, undefined, 'GET');

test('a guest deletes their own account with typed confirmation and loses every session', async () => {
  const cookie = await newSession(), playerId = (await sessionRecord(cookie)).playerId;
  const { board, meta } = await seedPlayerData(playerId);
  const otherDevice = `geek_session=${'c'.repeat(32)}`;
  await fixture.command('SET', `geek:session:${'c'.repeat(32)}`, JSON.stringify({ ...(await sessionRecord(cookie)), id: 'c'.repeat(32) }), 'EX', 600);
  assert.equal((await status(otherDevice)).statusCode, 200);

  const unconfirmed = await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'delete' });
  assert.equal(unconfirmed.statusCode, 400); assert.equal(unconfirmed.body.code, 'ACCOUNT_DELETE_CONFIRM_REQUIRED');
  assert.equal(await fixture.command('EXISTS', profileKeyFor(playerId)), 1);

  const deleted = await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE' });
  assert.equal(deleted.statusCode, 200, JSON.stringify(deleted.body)); assert.equal(deleted.body.deleted, true);
  assert.match(deleted.headers['Set-Cookie'], /^geek_session=; Max-Age=0/);
  for (const key of [...ownedPlayerKeys(playerId, cookie.split('=')[1]), `geek:session:${cookie.split('=')[1]}`]) assert.equal(await fixture.command('EXISTS', key), 0, key);
  assert.equal(await fixture.command('ZSCORE', board, playerId), null);
  assert.equal(await fixture.command('HEXISTS', meta, playerId), 0);
  assert.equal(await fixture.command('ZSCORE', board, 'f'.repeat(32)), '500', 'other players keep their standing');
  const ttl = Number(await fixture.command('TTL', deletedPlayerKey(playerId)));
  assert.ok(ttl > 0 && ttl <= TOMBSTONE_TTL);
  assert.equal((await status(otherDevice)).statusCode, 401, 'a session on another device is revoked');
  const events = await fixture.command('KEYS', 'geek:audit:event:*');
  const types = await Promise.all(events.map(async key => JSON.parse(await fixture.command('GET', key)).type));
  assert.ok(types.includes('identity.account.deleted'));
  const record = JSON.parse(await fixture.command('GET', events[types.indexOf('identity.account.deleted')]));
  assert.ok(!JSON.stringify(record).includes(playerId), 'the audit event stores only hashed identifiers');
});

test('a passkey account needs a fresh grant and releases its credential binding', async () => {
  const guest = await newSession(), account = await enroll(guest);
  const playerId = (await sessionRecord(account.cookie)).playerId;
  await seedPlayerData(playerId);

  const denied = await call(passkeysHandler, account.cookie, { action: 'delete-account', confirm: 'DELETE' });
  assert.equal(denied.statusCode, 400); assert.equal(denied.body.code, 'PASSKEY_REAUTH_REQUIRED');
  assert.equal(await fixture.command('EXISTS', passkeyAccountKey(playerId)), 1, 'nothing is deleted without proof');
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(playerId)), 0);

  const deleted = await call(passkeysHandler, account.cookie, { action: 'delete-account', confirm: 'DELETE', token: account.grant });
  assert.equal(deleted.statusCode, 200, JSON.stringify(deleted.body));
  assert.equal(await fixture.command('EXISTS', passkeyAccountKey(playerId)), 0);
  assert.equal(await fixture.command('EXISTS', credentialIndex(account.key.id)), 0, 'the passkey can no longer sign in to the deleted player');
  assert.equal(await fixture.command('EXISTS', profileKeyFor(playerId)), 0);
  assert.equal((await status(account.cookie)).statusCode, 401);
  assert.equal((await call(passkeysHandler, account.cookie, { action: 'delete-account', confirm: 'DELETE', token: account.grant })).statusCode, 401);
});

test('a concurrent account change aborts deletion without removing anything', async () => {
  const guest = await newSession(), account = await enroll(guest);
  const playerId = (await sessionRecord(account.cookie)).playerId;
  await seedPlayerData(playerId);
  beforeCommand = async command => {
    if (command[0] === 'EVAL' && String(command[1]).includes('geek-account-delete-v1')) {
      beforeCommand = null;
      const raw = JSON.parse(await fixture.command('GET', passkeyAccountKey(playerId)));
      raw.epoch += 1;
      await fixture.command('SET', passkeyAccountKey(playerId), JSON.stringify(raw));
    }
  };
  const result = await call(passkeysHandler, account.cookie, { action: 'delete-account', confirm: 'DELETE', token: account.grant });
  assert.equal(result.statusCode, 409); assert.equal(result.body.code, 'ACCOUNT_DELETE_CHANGED');
  assert.equal(await fixture.command('EXISTS', profileKeyFor(playerId)), 1);
  assert.equal(await fixture.command('EXISTS', credentialIndex(account.key.id)), 1);
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(playerId)), 0);
});

// Wallet-linked deletion (Security Bot MEDIUM on #314). Real identity API: signed Kaspa
// personal-message proofs against server challenges, using synthetic test keys only.
const identityCall = async (cookie, body, method = 'POST') => {
  const res = response();
  await identityHandler({ method, body, query: {}, headers: { cookie, host: 'www.geekprotocol.xyz', origin, 'x-forwarded-proto': 'https', 'user-agent': 'synthetic-deletion-tests' } }, res);
  return res;
};
const testWallet = n => {
  const privateKey = String(n).padStart(64, '0'), key = new kaspa.PrivateKey(privateKey);
  try { return { privateKey, publicKey: key.toPublicKey().toString(), address: key.toAddress('mainnet').toString() }; } finally { key.free(); }
};
const challenge = async (cookie, w, fields = {}) => {
  const issued = await identityCall(cookie, { action: 'challenge', address: w.address, ...fields });
  assert.equal(issued.statusCode, 201, JSON.stringify(issued.body));
  return issued.body.challenge;
};
const sign = (w, issued) => kaspa.signMessage({ message: issued.message, privateKey: w.privateKey });
const prove = async (cookie, w, fields = {}) => { const issued = await challenge(cookie, w, fields); return identityCall(cookie, { action: 'verify', challengeId: issued.challengeId, signature: sign(w, issued) }); };
// A fresh wallet proof with intent "passkey" issues the one-time grant that protected changes, including deletion, consume.
const walletGrant = async (cookie, w) => {
  const proved = await prove(cookie, w, { intent: 'passkey' });
  assert.equal(proved.statusCode, 200, JSON.stringify(proved.body));
  return proved.body.passkeyAuthorization.token;
};
const walletBindingKey = w => identityWalletKey(hashAuditIdentifier(w.address));
const linkedWallet = async n => {
  const cookie = await newSession(), w = testWallet(n);
  const linked = await prove(cookie, w);
  assert.equal(linked.statusCode, 200, JSON.stringify(linked.body)); assert.equal(linked.body.identity.address, w.address);
  const playerId = (await sessionRecord(cookie)).playerId;
  assert.equal(await fixture.command('GET', walletBindingKey(w)), playerId, 'the wallet is bound to this player before deletion');
  return { cookie, w, playerId };
};

test('deleting a wallet-linked account needs a fresh wallet grant and releases the wallet binding', async () => {
  const { cookie, w, playerId } = await linkedWallet(21);
  await seedPlayerData(playerId);

  for (const token of [undefined, 'a'.repeat(64)]) {
    const denied = await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE', token });
    assert.equal(denied.statusCode, 400); assert.equal(denied.body.code, 'PASSKEY_REAUTH_REQUIRED');
  }
  assert.equal(await fixture.command('GET', walletBindingKey(w)), playerId, 'nothing is released without proof');
  assert.equal(await fixture.command('EXISTS', identityPlayerKey(playerId)), 1);
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(playerId)), 0);

  const deleted = await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE', token: await walletGrant(cookie, w) });
  assert.equal(deleted.statusCode, 200, JSON.stringify(deleted.body)); assert.equal(deleted.body.deleted, true);
  assert.equal(await fixture.command('EXISTS', walletBindingKey(w)), 0, 'the wallet binding is released');
  assert.equal(await fixture.command('EXISTS', identityPlayerKey(playerId)), 0, 'the identity record is removed');
  assert.equal(await fixture.command('EXISTS', profileKeyFor(playerId)), 0);
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(playerId)), 1);
  assert.equal((await identityCall(cookie, undefined, 'GET')).statusCode, 401, 'the deleted session is revoked');
  const events = await fixture.command('KEYS', 'geek:audit:event:*');
  const records = await Promise.all(events.map(async key => JSON.parse(await fixture.command('GET', key))));
  const record = records.find(r => r.type === 'identity.account.deleted');
  assert.equal(record?.details?.walletLinked, true);
  assert.ok(!JSON.stringify(record).includes(w.address) && !JSON.stringify(record).includes(playerId), 'the audit event stores only hashed identifiers');
});

test('after deletion the same wallet links only to a new player and only with a fresh signed proof', async () => {
  const { cookie, w, playerId } = await linkedWallet(22);
  assert.equal((await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE', token: await walletGrant(cookie, w) })).statusCode, 200);

  const fresh = await newSession(), freshPlayer = (await sessionRecord(fresh)).playerId;
  assert.notEqual(freshPlayer, playerId);
  assert.equal((await identityCall(fresh, undefined, 'GET')).body.identity.linked, false, 'a new session is not linked automatically');
  // The wallet no longer resolves to the deleted player: the challenge links to the new player instead of recovering the old one.
  const issued = await challenge(fresh, w);
  const forged = await identityCall(fresh, { action: 'verify', challengeId: issued.challengeId, signature: sign(testWallet(23), issued) });
  assert.equal(forged.statusCode, 401, 'a signature from another key does not link the wallet');
  assert.equal((await identityCall(fresh, undefined, 'GET')).body.identity.linked, false);
  assert.equal(await fixture.command('EXISTS', walletBindingKey(w)), 0);

  const relinked = await prove(fresh, w);
  assert.equal(relinked.statusCode, 200, JSON.stringify(relinked.body));
  assert.notEqual(relinked.body.recovered, true, 'the deleted player is not recovered');
  assert.equal((await sessionRecord(fresh)).playerId, freshPlayer);
  assert.equal(await fixture.command('GET', walletBindingKey(w)), freshPlayer, 'the wallet is now bound to the new player');
  assert.equal(await fixture.command('EXISTS', identityPlayerKey(playerId)), 0, 'the deleted identity is not recreated');
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(playerId)), 1);
});

test('a wallet grant or challenge issued before deletion is refused afterwards', async () => {
  const { cookie, w, playerId } = await linkedWallet(24);
  const used = await walletGrant(cookie, w), stale = await walletGrant(cookie, w);
  const staleChallenge = await challenge(cookie, w, { intent: 'passkey' });
  assert.equal((await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE', token: used })).statusCode, 200);

  // On the deleted session, the stale grant and the stale challenge are both refused.
  assert.equal((await call(passkeysHandler, cookie, { action: 'delete-account', confirm: 'DELETE', token: stale })).statusCode, 401);
  assert.equal((await identityCall(cookie, { action: 'verify', challengeId: staleChallenge.challengeId, signature: sign(w, staleChallenge) })).statusCode, 401);

  // A new player that relinks the same wallet cannot spend the pre-deletion grant either.
  const fresh = await newSession();
  assert.equal((await prove(fresh, w)).statusCode, 200);
  const freshPlayer = (await sessionRecord(fresh)).playerId;
  await seedPlayerData(freshPlayer);
  const refused = await call(passkeysHandler, fresh, { action: 'delete-account', confirm: 'DELETE', token: stale });
  assert.equal(refused.statusCode, 400); assert.equal(refused.body.code, 'PASSKEY_REAUTH_REQUIRED');
  const replay = await identityCall(fresh, { action: 'verify', challengeId: staleChallenge.challengeId, signature: sign(w, staleChallenge) });
  assert.notEqual(replay.statusCode, 200, 'a pre-deletion challenge cannot be completed by another session');
  assert.equal(await fixture.command('GET', walletBindingKey(w)), freshPlayer, 'the new binding is untouched');
  assert.equal(await fixture.command('EXISTS', profileKeyFor(freshPlayer)), 1, 'nothing of the new player is deleted');
  assert.equal(await fixture.command('EXISTS', deletedPlayerKey(freshPlayer)), 0);
  assert.equal(await fixture.command('EXISTS', identityPlayerKey(playerId)), 0);
  // A fresh grant for the new player works, proving the refusal was about staleness.
  assert.equal((await call(passkeysHandler, fresh, { action: 'delete-account', confirm: 'DELETE', token: await walletGrant(fresh, w) })).statusCode, 200);
  assert.equal(await fixture.command('EXISTS', walletBindingKey(w)), 0);
});
