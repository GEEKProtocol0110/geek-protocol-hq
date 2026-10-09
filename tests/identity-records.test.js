import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import identityHandler from '../api/identity.js';
import rewardsHandler from '../api/rewards.js';
import { identityAuthorizationKey, identityChallengeKey, identityPlayerKey, identityWalletKey } from '../server/identity-keys.js';
import { hashAuditIdentifier } from '../server/audit.js';
import { challengeMessage } from '../server/identity-records.js';

// Synthetic keys and loopback Redis only; no installed wallets or production data.
const wallet = number => {
  const privateKey = number.toString(16).padStart(64, '0');
  const key = new kaspa.PrivateKey(privateKey), publicKey = key.toPublicKey();
  const address = key.toAddress('mainnet');
  try { return { privateKey, publicKey: publicKey.toString(), address: address.toString() }; }
  finally { address.free(); publicKey.free(); key.free(); }
};
const owner = wallet(6), other = wallet(3);
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let missingReadKey = '';
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.identity-record.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-record-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-record-audit-key-32-characters';
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.identity-record.test'));
  const command = JSON.parse(options.body);
  if (command[0] === 'GET' && command[1] === missingReadKey) return new Response('{}');
  const payload = String(url).endsWith('/multi-exec')
    ? (await fixture.commands([['MULTI'], ...command, ['EXEC']])).at(-1).map(result => ({ result }))
    : String(url).endsWith('/pipeline')
      ? (await fixture.commands(command)).map(result => ({ result }))
      : { result: await fixture.command(...command) };
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { missingReadKey = ''; await fixture.command('FLUSHDB'); });
const response = () => ({ headers: {}, statusCode: 0, body: null,
  setHeader(key, value) { this.headers[key] = value; }, status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; }, end() {} });
const request = (cookie, body, method = 'POST', query = {}) => ({ method, body, query,
  headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz',
    'x-forwarded-proto': 'https', 'user-agent': 'synthetic-record-tests' } });
const call = async (handler, cookie, body, method, query) => {
  const res = response(); await handler(request(cookie, body, method, query), res); return res;
};
const session = async () => {
  const res = await call(sessionHandler, '', { displayName: 'Record Tester' });
  assert.equal(res.statusCode, 200);
  const cookie = res.headers['Set-Cookie'].split(';')[0];
  return { cookie, id: cookie.split('=')[1] };
};
const issue = async (player, fields = {}) => {
  const res = await call(identityHandler, player.cookie, { action: 'challenge', address: owner.address, ...fields });
  assert.equal(res.statusCode, 201, JSON.stringify(res.body)); return res.body.challenge;
};
const submit = (player, challenge) => call(identityHandler, player.cookie, { action: 'verify',
  challengeId: challenge.challengeId, signature: kaspa.signMessage({ message: challenge.message, privateKey: owner.privateKey }) });
const linked = async () => {
  const player = await session(), result = await submit(player, await issue(player));
  assert.equal(result.statusCode, 200); return player;
};
const auth = async player => {
  const result = await submit(player, await issue(player, { intent: 'payout', payoutAddress: owner.address }));
  assert.equal(result.statusCode, 200);
  const token = result.body.authorization.token;
  return { token, key: identityAuthorizationKey(createHash('sha256').update(token).digest('hex')) };
};
const setPayout = (player, token) => call(rewardsHandler, player.cookie,
  { address: owner.address, acknowledged: true, authorizationToken: token });

test('only a missing identity is session-only; malformed durable JSON blocks status and wallet changes without resetting data', async () => {
  for (const raw of ['', '{', 'null', '[]', 'true', '{}']) {
    await fixture.command('FLUSHDB'); const player = await session(), key = identityPlayerKey(player.id);
    const absent = await call(identityHandler, player.cookie, undefined, 'GET');
    assert.equal(absent.statusCode, 200); assert.equal(absent.body.identity.linked, false);
    await fixture.command('SET', key, raw);
    const before = await fixture.command('GET', 'geek:session:' + player.id);
    for (const result of [await call(identityHandler, player.cookie, undefined, 'GET'),
      await call(identityHandler, player.cookie, { action: 'challenge', address: owner.address }),
      await setPayout(player, '')]) {
      assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'IDENTITY_STATE_INVALID');
      assert.match(result.body.error, /has not been reset/); assert.ok(!('identity' in result.body));
    }
    assert.equal(await fixture.command('GET', key), raw);
    assert.equal(await fixture.command('GET', 'geek:session:' + player.id), before);
    assert.equal(await fixture.command('GET', identityWalletKey(hashAuditIdentifier(owner.address))), null);
    assert.equal(await fixture.command('GET', 'geek:profile:' + player.id), null);
  }
});

test('unsupported, mistyped and inconsistent linked identity records stop all linked reads and preserve progress', async () => {
  const mutations = [
    r => { r.version = 2; }, r => { r.id = 'b'.repeat(32); }, r => { r.network = 'kaspa-testnet'; },
    r => { r.scheme = 'unknown'; }, r => { r.settlementEnabled = true; }, r => { r.linkedAt = String(r.linkedAt); },
    r => { r.verifiedAt = r.linkedAt - 1; }, r => { r.lastRecoveredAt = -1; }, r => { r.recoveryCount = '0'; },
    r => { r.sessionVersion = null; }, r => { r.sessionVersion = 0; }, r => { r.sessionVersion = 2; },
    r => { r.publicKey = other.publicKey; }, r => { r.address = other.address; }
  ];
  for (const mutate of mutations) {
    await fixture.command('FLUSHDB'); const player = await linked(), key = identityPlayerKey(player.id);
    const good = await fixture.command('GET', key), record = JSON.parse(good); mutate(record);
    const bad = JSON.stringify(record); await fixture.command('SET', key, bad);
    await fixture.command('SET', 'geek:profile:' + player.id, 'synthetic-preserved-progress');
    const oldSession = await fixture.command('GET', 'geek:session:' + player.id);
    const result = await call(sessionHandler, player.cookie, undefined, 'GET', { service: 'profile' });
    assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'IDENTITY_STATE_INVALID');
    assert.equal((await setPayout(player, '')).statusCode, 503);
    assert.equal(await fixture.command('GET', key), bad);
    assert.equal(await fixture.command('GET', 'geek:profile:' + player.id), 'synthetic-preserved-progress');
    assert.equal(await fixture.command('GET', 'geek:session:' + player.id), oldSession);
    await fixture.command('SET', key, good);
    assert.equal((await call(identityHandler, player.cookie, undefined, 'GET')).body.identity.linked, true);
  }
});

test('malformed sessions cannot be silently replaced or rename another player', async () => {
  const mutations = [() => '{', () => '[]', r => { r.id = 'a'.repeat(32); }, r => { r.playerId = '../other'; },
    r => { r.identityVersion = '0'; }, r => { r.identityVersion = -1; }, r => { r.identityVersion = null; },
    r => { r.name = {}; }, r => { r.createdAt = 'now'; }, r => { r.lastSeen = r.createdAt - 1; }];
  for (const mutate of mutations) {
    await fixture.command('FLUSHDB'); const player = await session(), key = 'geek:session:' + player.id;
    const record = JSON.parse(await fixture.command('GET', key)), special = mutate(record);
    const bad = typeof special === 'string' ? special : JSON.stringify(record);
    await fixture.command('SET', key, bad);
    const name = await fixture.command('GET', 'geek:player-name:' + player.id);
    const result = await call(sessionHandler, player.cookie, { action: 'rename', displayName: 'Changed' });
    assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'SESSION_STATE_INVALID');
    assert.equal(result.headers['Set-Cookie'], undefined); assert.equal(await fixture.command('GET', key), bad);
    assert.equal(await fixture.command('GET', 'geek:player-name:' + player.id), name);
  }
});

test('older guest sessions with omitted optional identity fields refresh in place', async () => {
  const player = await session(), key = 'geek:session:' + player.id;
  await fixture.command('SET', key, JSON.stringify({ id: player.id, name: 'Legacy Guest' }));
  const result = await call(sessionHandler, player.cookie, {});
  assert.equal(result.statusCode, 200); assert.match(result.headers['Set-Cookie'], new RegExp(player.id));
  const record = JSON.parse(await fixture.command('GET', key));
  assert.equal(record.playerId, player.id); assert.equal(record.identityVersion, 0);
});

test('a provider response missing its GET result is not accepted as an absent identity or session', async () => {
  const player = await session();
  missingReadKey = identityPlayerKey(player.id);
  const identity = await call(identityHandler, player.cookie, undefined, 'GET');
  assert.equal(identity.statusCode, 503); assert.equal(identity.body.code, 'IDENTITY_STATE_INVALID');
  missingReadKey = 'geek:session:' + player.id;
  const result = await call(sessionHandler, player.cookie, {});
  assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'SESSION_STATE_INVALID');
  assert.equal(result.headers['Set-Cookie'], undefined);
});

test('malformed wallet mappings and dangling identity references cannot initialize replacement records', async () => {
  for (const mapping of ['', 'null', 'not-a-player', 'b'.repeat(32)]) {
    await fixture.command('FLUSHDB'); const player = await session();
    const key = identityWalletKey(hashAuditIdentifier(owner.address)); await fixture.command('SET', key, mapping);
    const result = await call(identityHandler, player.cookie, { action: 'challenge', address: owner.address });
    assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'IDENTITY_STATE_INVALID');
    assert.equal(await fixture.command('GET', key), mapping);
    assert.deepEqual(await fixture.command('KEYS', '*identity:player:*'), []);
  }
  await fixture.command('FLUSHDB'); const player = await linked();
  await fixture.command('DEL', identityPlayerKey(player.id));
  const result = await call(sessionHandler, player.cookie, {});
  assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'IDENTITY_STATE_INVALID');
  assert.equal(result.headers['Set-Cookie'], undefined);
  await fixture.command('FLUSHDB'); const ownerPlayer = await linked(), guest = await session();
  const wrongMapping = identityWalletKey(hashAuditIdentifier(other.address));
  await fixture.command('SET', wrongMapping, ownerPlayer.id);
  const mismatch = await call(identityHandler, guest.cookie, { action: 'challenge', address: other.address });
  assert.equal(mismatch.statusCode, 503); assert.equal(mismatch.body.code, 'IDENTITY_STATE_INVALID');
  assert.equal(await fixture.command('GET', wrongMapping), ownerPlayer.id);
});

test('corrupt or contradictory one-time challenges are consumed without binding identity or accepting a signature', async () => {
  const mutations = [() => '{', () => 'null', () => '[]', r => { r.version = 2; }, r => { r.expiresAt = 'NaN'; }, r => { r.expiresAt = null; },
    r => { r.expiresAt++; }, r => { r.requesterPlayerId = 'a'.repeat(32); }, r => { r.intent = 'recover'; },
    r => { r.address = other.address; }, r => { r.publicKey = other.publicKey; },
    r => { r.payoutAddress = other.address; }, r => { r.message += '\nchanged'; },
    r => { r.origin += '/'; }, r => { r.scheme = 'other'; }, r => { r.challengeId = 'a'.repeat(40); }];
  for (const mutate of mutations) {
    await fixture.command('FLUSHDB'); const player = await session(), challenge = await issue(player);
    const key = identityChallengeKey(challenge.challengeId), record = JSON.parse(await fixture.command('GET', key));
    const special = mutate(record);
    await fixture.command('SET', key, typeof special === 'string' ? special : JSON.stringify(record));
    const before = await fixture.command('GET', 'geek:session:' + player.id), result = await submit(player, challenge);
    assert.equal(result.statusCode, 409); assert.equal(result.body.code, 'IDENTITY_CHALLENGE_INVALID');
    assert.equal(await fixture.command('GET', key), null);
    assert.equal(await fixture.command('GET', identityPlayerKey(player.id)), null);
    assert.equal(await fixture.command('GET', identityWalletKey(hashAuditIdentifier(owner.address))), null);
    assert.equal(await fixture.command('GET', 'geek:session:' + player.id), before);
    assert.equal((await submit(player, challenge)).body.code, 'IDENTITY_CHALLENGE_INVALID');
  }
});

test('expired and future-dated proofs are rejected even when their signed text and five-minute lifetime agree', async () => {
  for (const offset of [-600_000, 600_000]) {
    await fixture.command('FLUSHDB'); const player = await session(), challenge = await issue(player);
    const key = identityChallengeKey(challenge.challengeId), record = JSON.parse(await fixture.command('GET', key));
    const nonce = record.message.match(/^Challenge: ([a-f0-9]{64})$/m)[1];
    record.issuedAt = Date.now() + offset; record.expiresAt = record.issuedAt + 300_000;
    record.message = challengeMessage({ ...record, nonce }); challenge.message = record.message;
    await fixture.command('SET', key, JSON.stringify(record));
    assert.equal((await submit(player, challenge)).body.code, 'IDENTITY_CHALLENGE_INVALID');
    assert.equal(await fixture.command('GET', key), null);
    assert.equal(await fixture.command('GET', identityPlayerKey(player.id)), null);
  }
});

test('one-time payout authorizations reject invalid field types and lifetimes without mutating the preference', async () => {
  const mutations = [() => '{', () => 'null', () => '[]', r => { r.identityVersion = String(r.identityVersion); }, r => { r.expiresAt = 'NaN'; },
    r => { r.issuedAt = null; }, r => { r.expiresAt++; }, r => { r.operation = 'withdraw'; },
    r => { r.payoutAddressHash = 'wrong'; }, r => { r.playerId = 'b'.repeat(32); },
    r => { r.issuedAt += 600_000; r.expiresAt += 600_000; },
    r => { r.issuedAt -= 600_000; r.expiresAt -= 600_000; }];
  for (const mutate of mutations) {
    await fixture.command('FLUSHDB'); const player = await linked(), authorization = await auth(player);
    const record = JSON.parse(await fixture.command('GET', authorization.key)), special = mutate(record);
    await fixture.command('SET', authorization.key, typeof special === 'string' ? special : JSON.stringify(record));
    const before = await fixture.command('GET', identityPlayerKey(player.id));
    const result = await setPayout(player, authorization.token);
    assert.equal(result.statusCode, 401); assert.equal(result.body.code, 'PAYOUT_REAUTH_REQUIRED');
    assert.equal(await fixture.command('GET', authorization.key), null);
    assert.equal(await fixture.command('GET', identityPlayerKey(player.id)), before);
    assert.equal(await fixture.command('GET', 'geek:profile:' + player.id), null);
    assert.equal((await setPayout(player, authorization.token)).body.code, 'PAYOUT_REAUTH_REQUIRED');
  }
});

test('valid fresh authorization still updates only the preference while settlement remains disabled', async () => {
  const player = await linked(), authorization = await auth(player);
  const result = await setPayout(player, authorization.token);
  assert.equal(result.statusCode, 200); assert.equal(result.body.payout.address, owner.address);
  assert.equal(result.body.payout.withdrawalsEnabled, false); assert.equal(result.body.payout.settlementEligible, false);
  assert.equal(result.body.identity.settlementEnabled, false);
  assert.equal((await setPayout(player, authorization.token)).body.code, 'PAYOUT_REAUTH_REQUIRED');
});

test('a malformed durable record introduced after challenge issuance blocks recovery without replacing it', async () => {
  const original = await linked(), recovered = await session(), challenge = await issue(recovered);
  const key = identityPlayerKey(original.id), raw = '{broken saved identity';
  await fixture.command('SET', key, raw);
  const before = await fixture.command('GET', 'geek:session:' + recovered.id), result = await submit(recovered, challenge);
  assert.equal(result.statusCode, 503); assert.equal(result.body.code, 'IDENTITY_STATE_INVALID');
  assert.equal(await fixture.command('GET', key), raw);
  assert.equal(await fixture.command('GET', 'geek:session:' + recovered.id), before);
  assert.equal(await fixture.command('GET', identityChallengeKey(challenge.challengeId)), null);
});

test('parallel valid wallet claims execute the real binding script and retain one identity with no orphan wallet', async () => {
  const player = await session(), first = await issue(player), second = await issue(player, { address: other.address });
  const results = await Promise.all([submit(player, first), call(identityHandler, player.cookie, {
    action: 'verify', challengeId: second.challengeId,
    signature: kaspa.signMessage({ message: second.message, privateKey: other.privateKey })
  })]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  const stored = JSON.parse(await fixture.command('GET', identityPlayerKey(player.id)));
  for (const w of [owner, other]) {
    assert.equal(await fixture.command('GET', identityWalletKey(hashAuditIdentifier(w.address))),
      stored.address === w.address ? player.id : null);
  }
  const status = await call(identityHandler, player.cookie, undefined, 'GET');
  assert.equal(status.statusCode, 200); assert.equal(status.body.identity.address, stored.address);
  assert.equal(stored.settlementEnabled, false);
});
