import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import { isoCBOR } from '@simplewebauthn/server/helpers';
import kaspa from '@dfns/kaspa-wasm';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import passkeysHandler from '../api/passkeys.js';
import identityHandler from '../api/identity.js';
import { passkeyAccountKey } from '../server/passkey-grants.js';
import { identityPlayerKey } from '../server/identity-keys.js';
import { resetRestoredSessions } from '../scripts/reset-restored-sessions.mjs';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let beforeCommand = null, activeFixture = fixture;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.passkeys.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-passkey-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-passkey-audit-32-characters';
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.passkeys.test'));
  const command = JSON.parse(options.body);
  await beforeCommand?.(command);
  const payload = String(url).endsWith('/multi-exec') ? (await activeFixture.commands([['MULTI'], ...command, ['EXEC']])).at(-1).map(result => ({ result }))
    : String(url).endsWith('/pipeline') ? (await activeFixture.commands(command)).map(result => ({ result })) : { result: await activeFixture.command(...command) };
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { beforeCommand = null; await fixture.command('FLUSHDB'); });
const origin = 'https://www.geekprotocol.xyz', rp = 'geekprotocol.xyz';
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k,v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, end() {} });
const call = async (handler, cookie, body, method = 'POST', changed = {}) => {
  const res = response(); await handler({ method, body, headers: { cookie, host: 'www.geekprotocol.xyz', origin, 'user-agent': 'synthetic-crypto-tests', ...changed } }, res); return res;
};
const cookieFrom = r => r.headers['Set-Cookie'].split(';')[0];
const session = async () => cookieFrom(await call(sessionHandler, '', { displayName: 'Passkey Tester' }));
const hash = value => createHash('sha256').update(value).digest();
const authenticator = () => {
  const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const jwk = publicKey.export({ format: 'jwk' }), id = randomBytes(32), cid = id.toString('base64url');
  const cose = isoCBOR.encode(new Map([[1,2],[3,-7],[-1,1],[-2,new Uint8Array(Buffer.from(jwk.x,'base64url'))],[-3,new Uint8Array(Buffer.from(jwk.y,'base64url'))]]));
  return { id: cid,
    register(options, changes = {}) {
      const client = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin, ...changes }));
      const length = Buffer.alloc(2); length.writeUInt16BE(id.length);
      const data = Buffer.concat([hash(rp), Buffer.from([0x45]), Buffer.alloc(4), Buffer.alloc(16), length, id, cose]);
      const attestation = isoCBOR.encode(new Map([['fmt','none'],['attStmt',new Map()],['authData',new Uint8Array(data)]]));
      return { id: cid, rawId: cid, type: 'public-key', response: { clientDataJSON: client.toString('base64url'), attestationObject: Buffer.from(attestation).toString('base64url'), transports: ['internal'] }, clientExtensionResults: {} };
    },
    login(options, player, count = 1, uv = true, changes = {}) {
      const client = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin, ...changes }));
      const counter = Buffer.alloc(4); counter.writeUInt32BE(count);
      const data = Buffer.concat([hash(rp), Buffer.from([uv ? 5 : 1]), counter]);
      return { id: cid, rawId: cid, type: 'public-key', response: { clientDataJSON: client.toString('base64url'), authenticatorData: data.toString('base64url'), signature: sign('sha256', Buffer.concat([data,hash(client)]), privateKey).toString('base64url'), userHandle: Buffer.from(player,'hex').toString('base64url') }, clientExtensionResults: {} };
    }
  };
};
const enroll = async (cookie, key = authenticator(), token) => {
  const begin = await call(passkeysHandler, cookie, { action: 'begin-register', token }); assert.equal(begin.statusCode, 200, JSON.stringify(begin.body));
  const finish = await call(passkeysHandler, cookie, { action: 'finish-register', challengeId: begin.body.challengeId, response: key.register(begin.body.options), label: 'Test authenticator' });
  assert.equal(finish.statusCode, 200, JSON.stringify(finish.body));
  return { cookie: cookieFrom(finish), grant: finish.body.grant.token, key };
};

test('real WebAuthn registration and login rotate cookies and recover the same player without a wallet', async () => {
  const original = await session(), player = original.split('=')[1], e = await enroll(original);
  assert.notEqual(e.cookie, original);
  assert.equal((await call(passkeysHandler, original, null, 'GET')).statusCode, 401);
  const fresh = await session(), begin = await call(passkeysHandler, fresh, { action: 'begin-login' });
  const proof = e.key.login(begin.body.options, player);
  const finish = await call(passkeysHandler, fresh, { action: 'finish-login', challengeId: begin.body.challengeId, response: proof });
  assert.equal(finish.statusCode, 200, JSON.stringify(finish.body));
  const recovered = JSON.parse(await fixture.command('GET','geek:session:'+cookieFrom(finish).split('=')[1]));
  assert.equal(recovered.playerId, player); assert.equal(recovered.identityVersion, 0);
  assert.equal((await call(passkeysHandler, cookieFrom(finish), null, 'GET')).body.signedIn, true);
  const replay = await call(passkeysHandler, cookieFrom(finish), { action: 'finish-login', challengeId: begin.body.challengeId, response: proof });
  assert.equal(replay.statusCode, 400);
});

test('origin, UV, signed challenge, user handle and signature failures cannot recover another player', async () => {
  const original = await session(), player = original.split('=')[1], e = await enroll(original);
  for (const change of ['origin','uv','challenge','handle','signature','counter']) {
    const guest = await session(), b = await call(passkeysHandler, guest, { action: 'begin-login' });
    const proof = e.key.login(b.body.options, player, change === 'counter' ? 0 : 1, change !== 'uv', change === 'origin' ? { origin: 'https://attacker.example' } : change === 'challenge' ? { challenge: 'wrong' } : {});
    if (change === 'handle') proof.response.userHandle = Buffer.alloc(16,1).toString('base64url');
    if (change === 'signature') proof.response.signature = Buffer.alloc(70).toString('base64url');
    // Advance the server counter so a non-advancing authenticator assertion fails.
    if (change === 'counter') { const raw = JSON.parse(await fixture.command('GET',passkeyAccountKey(player))); raw.credentials[0].counter = 5; await fixture.command('SET',passkeyAccountKey(player),JSON.stringify(raw)); }
    const result = await call(passkeysHandler, guest, { action: 'finish-login', challengeId: b.body.challengeId, response: proof });
    assert.equal(result.statusCode, 400, change);
    assert.equal(result.headers['Set-Cookie'], undefined);
  }
  assert.equal((await call(passkeysHandler, e.cookie, { action:'begin-login' }, 'POST', { origin:'https://attacker.example' })).statusCode,400);
});

test('management requires fresh proof; removing a credential revokes passkey sessions and retained credentials still work', async () => {
  const guest = await session(), player = guest.split('=')[1], first = await enroll(guest);
  assert.equal((await call(passkeysHandler, first.cookie, { action:'begin-register' })).body.code,'PASSKEY_REAUTH_REQUIRED');
  const second = await enroll(first.cookie, authenticator(), first.grant);
  const removed = await call(passkeysHandler, second.cookie, { action:'delete', token:second.grant, credentialId:first.key.id });
  assert.equal(removed.statusCode,200);
  assert.equal((await call(passkeysHandler, second.cookie, null,'GET')).statusCode,401);
  const fresh = await session(), b = await call(passkeysHandler,fresh,{action:'begin-login'});
  const result = await call(passkeysHandler,fresh,{action:'finish-login',challengeId:b.body.challengeId,response:second.key.login(b.body.options,player)});
  assert.equal(result.statusCode,200,JSON.stringify(result.body));
});

test('wallet-bound enrollment needs explicit signed authorization; recovery invalidates old passkeys', async () => {
  const guest = await session(), player = guest.split('=')[1], key = new kaspa.PrivateKey('6'.padStart(64,'0'));
  const address = key.toAddress('mainnet').toString();
  const issue = async (cookie, intent = 'identity') => { const r = await call(identityHandler,cookie,{ action:'challenge',address,intent }); assert.equal(r.statusCode,201,JSON.stringify(r.body));return r.body.challenge; };
  const submit = (cookie,c) => call(identityHandler,cookie,{action:'verify',challengeId:c.challengeId,signature:kaspa.signMessage({message:c.message,privateKey:'6'.padStart(64,'0')})});
  await submit(guest,await issue(guest));
  assert.equal((await call(passkeysHandler,guest,{action:'begin-register'})).body.code,'PASSKEY_REAUTH_REQUIRED');
  const c = await issue(guest,'passkey'); assert.match(c.message,/AUTHORIZE PASSKEY ACCOUNT ACCESS/);
  const grant = (await submit(guest,c)).body.passkeyAuthorization.token;
  const e = await enroll(guest,authenticator(),grant);
  const another = await session(); await submit(another,await issue(another));
  assert.equal((await call(passkeysHandler,e.cookie,null,'GET')).statusCode,401);
  const b = await call(passkeysHandler,another,{action:'begin-login'});
  assert.equal((await call(passkeysHandler,another,{action:'finish-login',challengeId:b.body.challengeId,response:e.key.login(b.body.options,player)})).statusCode,400);
  assert.equal(JSON.parse(await fixture.command('GET',identityPlayerKey(player))).recoveryCount,1); key.free();
});

test('malformed passkey state fails closed without replacing the saved player', async () => {
  const cookie = await session(), player = cookie.split('=')[1];
  for (const bad of ['', 'null', '{}', '[]', '{']) {
    await fixture.command('SET',passkeyAccountKey(player),bad);
    const r = await call(passkeysHandler,cookie,{action:'begin-register'}); assert.equal(r.statusCode,503);
    assert.equal(await fixture.command('GET',passkeyAccountKey(player)),bad);
  }
});

test('offline restore reset removes passkey challenges and management grants while preserving durable credentials', async () => {
  const account = 'geek:passkey:account:v1:'+'a'.repeat(32);
  await fixture.command('SET',account,'synthetic-durable-record');
  await fixture.command('SET','geek:passkey:challenge:v1:synthetic','one-use-challenge');
  await fixture.command('SET','geek:passkey:grant:v1:synthetic','one-use-grant');
  const dry = await resetRestoredSessions({command:fixture.command});assert.equal(dry.matched,2);assert.equal(dry.removed,0);
  const applied = await resetRestoredSessions({command:fixture.command,apply:true});assert.equal(applied.removed,2);
  assert.equal(await fixture.command('GET',account),'synthetic-durable-record');
});

test('native snapshot recovery rejects restored cookies and proofs, then signs into the same saved player with a fresh passkey proof', async () => {
  const original = await session(), player = original.split('=')[1];
  const oldSession = JSON.parse(await fixture.command('GET', 'geek:session:' + player));
  oldSession.createdAt = 1700000000000;
  await fixture.command('SET', 'geek:session:' + player, JSON.stringify(oldSession));
  const enrolled = await enroll(original);
  const pending = await call(passkeysHandler, enrolled.cookie, { action: 'begin-login' });
  assert.equal(pending.statusCode, 200);
  const staleProof = enrolled.key.login(pending.body.options, player);
  const profile = JSON.stringify({ xp: 1234, balance: 87, journey: [{ id: 'restored-synthetic-progress' }] });
  const samples = {
    ['geek:profile:' + player]: profile,
    ['geek:player-name:' + player]: 'Restored Geek',
    [passkeyAccountKey(player)]: await fixture.command('GET', passkeyAccountKey(player)),
    ['geek:passkey:credential:v1:' + hash(enrolled.key.id).toString('hex')]: player,
    'geek:ops:totp:replay:synthetic': '42'
  };
  for (const [key, value] of Object.entries(samples)) await fixture.command('SET', key, value);
  const restored = await redisFixture({ snapshot: await fixture.snapshot() });
  try {
    await fixture.command('FLUSHDB'); // Force every handler read to use the restored instance.
    activeFixture = restored;
    assert.equal((await call(passkeysHandler, enrolled.cookie, null, 'GET')).statusCode, 200);
    const dry = await resetRestoredSessions({ command: restored.command });
    assert.ok(dry.matched >= 3); assert.equal(dry.removed, 0);
    const cleanup = await resetRestoredSessions({ command: restored.command, apply: true });
    assert.equal(cleanup.removed, dry.matched);
    assert.equal((await call(passkeysHandler, enrolled.cookie, null, 'GET')).statusCode, 401);
    for (const [key, value] of Object.entries(samples)) assert.equal(await restored.command('GET', key), value);
    assert.equal(await restored.command('GET', 'geek:passkey:challenge:v1:' + pending.body.challengeId), null);
    assert.equal(await restored.command('GET', 'geek:passkey:grant:v1:' + hash(enrolled.grant).toString('hex')), null);

    const guest = await session();
    const stale = await call(passkeysHandler, guest, { action: 'finish-login', challengeId: pending.body.challengeId, response: staleProof });
    assert.equal(stale.statusCode, 400); assert.equal(stale.headers['Set-Cookie'], undefined);
    const begin = await call(passkeysHandler, guest, { action: 'begin-login' });
    const finish = await call(passkeysHandler, guest, { action: 'finish-login', challengeId: begin.body.challengeId, response: enrolled.key.login(begin.body.options, player) });
    assert.equal(finish.statusCode, 200, JSON.stringify(finish.body));
    const cookie = cookieFrom(finish);
    const saved = JSON.parse(await restored.command('GET', 'geek:session:' + cookie.split('=')[1]));
    assert.equal(saved.playerId, player); assert.equal(saved.name, 'Restored Geek');
    assert.equal(saved.createdAt, oldSession.createdAt);
    assert.equal(await restored.command('GET', 'geek:profile:' + player), profile);
    assert.equal((await call(passkeysHandler, cookie, null, 'GET')).body.signedIn, true);
    const staleGrant = await call(passkeysHandler, cookie, { action: 'delete', token: enrolled.grant, credentialId: enrolled.key.id });
    assert.equal(staleGrant.statusCode, 400); assert.equal(staleGrant.body.code, 'PASSKEY_REAUTH_REQUIRED');
    assert.equal((await call(passkeysHandler, cookie, null, 'GET')).body.credentials.length, 1);
  } finally { activeFixture = fixture; await restored.close(); }
});

test('linking a wallet after passkey-only signup preserves the player and requires explicit passkey re-enrollment', async () => {
  const guest = await session(), player = guest.split('=')[1], enrolled = await enroll(guest);
  const key = new kaspa.PrivateKey('7'.padStart(64,'0')), addressObject = key.toAddress('mainnet');
  const address = addressObject.toString();addressObject.free();key.free();
  const issued = await call(identityHandler,enrolled.cookie,{action:'challenge',address});
  assert.equal(issued.statusCode,201);
  const linked = await call(identityHandler,enrolled.cookie,{action:'verify',challengeId:issued.body.challenge.challengeId,
    signature:kaspa.signMessage({message:issued.body.challenge.message,privateKey:'7'.padStart(64,'0')})});
  assert.equal(linked.statusCode,200);
  const status = await call(passkeysHandler,enrolled.cookie,null,'GET');
  assert.equal(status.statusCode,200,JSON.stringify(status.body));assert.equal(status.body.walletLinked,true);
  assert.equal(status.body.signedIn,false);assert.equal(status.body.credentials.length,0);
  const saved = JSON.parse(await fixture.command('GET','geek:session:'+enrolled.cookie.split('=')[1]));
  assert.equal(saved.playerId,player);assert.equal(saved.identityVersion,1);assert.equal(saved.passkeyEpoch,undefined);
  assert.equal((await call(passkeysHandler,enrolled.cookie,{action:'begin-register',token:enrolled.grant})).body.code,'PASSKEY_REAUTH_REQUIRED');
});


test('passkey recovery keeps saved progress, chosen name and original membership time', async () => {
  const original = await session(), player = original.split('=')[1];
  const previous = JSON.parse(await fixture.command('GET','geek:session:'+player));
  previous.createdAt = 1700000000000;
  await fixture.command('SET','geek:session:'+player,JSON.stringify(previous));
  const profile = JSON.stringify({ xp:1234, balance:87, journey:[{id:'saved-test-progress'}] });
  await fixture.command('SET','geek:profile:'+player,profile);
  await fixture.command('SET','geek:player-name:'+player,'Saved Geek');
  const enrolled = await enroll(original), fresh = await session();
  const begin = await call(passkeysHandler,fresh,{action:'begin-login'});
  const finish = await call(passkeysHandler,fresh,{action:'finish-login',challengeId:begin.body.challengeId,response:enrolled.key.login(begin.body.options,player)});
  assert.equal(finish.statusCode,200);
  const current = JSON.parse(await fixture.command('GET','geek:session:'+cookieFrom(finish).split('=')[1]));
  assert.equal(current.createdAt,previous.createdAt);assert.equal(current.name,'Saved Geek');
  assert.equal(await fixture.command('GET','geek:profile:'+player),profile);
});

test('a credential cannot be attached to a second player and expired challenges cannot enroll', async () => {
  const guest = await session(), first = await enroll(guest), second = await session();
  const begin = await call(passkeysHandler,second,{action:'begin-register'});
  const collision = await call(passkeysHandler,second,{action:'finish-register',challengeId:begin.body.challengeId,response:first.key.register(begin.body.options)});
  assert.equal(collision.statusCode,400);assert.equal(collision.headers['Set-Cookie'],undefined);
  const other = authenticator(), b = await call(passkeysHandler,second,{action:'begin-register'});
  const ck = 'geek:passkey:challenge:v1:'+b.body.challengeId;
  const c = JSON.parse(await fixture.command('GET',ck));c.issuedAt=Date.now()-300001;c.expiresAt=c.issuedAt+300000;
  await fixture.command('SET',ck,JSON.stringify(c));
  const expired = await call(passkeysHandler,second,{action:'finish-register',challengeId:b.body.challengeId,response:other.register(b.body.options)});
  assert.equal(expired.statusCode,400);assert.equal(await fixture.command('GET',ck),null);
});

test('logout removes the current session and malformed passkey sessions fail closed across APIs', async () => {
  const guest = await session(), player = guest.split('=')[1], e = await enroll(guest);
  await fixture.command('SET',passkeyAccountKey(player),'malformed');
  const invalid = await call(sessionHandler,e.cookie,{});
  assert.equal(invalid.statusCode,503);assert.equal(invalid.body.code,'PASSKEY_STATE_INVALID');
  assert.equal(await fixture.command('GET',passkeyAccountKey(player)),'malformed');
  await fixture.command('FLUSHDB');
  const fresh = await enroll(await session());
  assert.equal((await call(passkeysHandler,fresh.cookie,{action:'logout'})).statusCode,200);
  assert.equal((await call(passkeysHandler,fresh.cookie,null,'GET')).statusCode,401);
});


test('an in-flight session refresh cannot resurrect a cookie removed by sign-out or rotation', async () => {
  const cookie = await session(), key = 'geek:session:'+cookie.split('=')[1];
  let interrupted = false;
  beforeCommand = async command => {
    if (command[0] === 'EVAL' && command[1].includes('geek-session-save-v1')) {
      beforeCommand = null; interrupted = true;
      await fixture.command('DEL',key);
    }
  };
  const refreshed = await call(sessionHandler,cookie,{action:'rename',displayName:'Uncommitted Name'});
  assert.equal(interrupted,true);assert.equal(refreshed.statusCode,401);
  assert.equal(await fixture.command('GET','geek:player-name:'+cookie.split('=')[1]),'Passkey Tester');
  assert.equal(refreshed.headers['Set-Cookie'],undefined);
  assert.equal(await fixture.command('GET',key),null);
});


test('a stale session refresh cannot overwrite a newer wallet protection state', async () => {
  const cookie = await session(), id = cookie.split('=')[1], key = 'geek:session:'+id;
  const privateKey = '8'.padStart(64,'0'), wallet = new kaspa.PrivateKey(privateKey);
  const addressObject = wallet.toAddress('mainnet'), address = addressObject.toString();addressObject.free();wallet.free();
  const issued = await call(identityHandler,cookie,{action:'challenge',address});
  assert.equal(issued.statusCode,201);
  let interrupted = false;
  beforeCommand = async command => {
    if (command[0] === 'EVAL' && command[1].includes('geek-session-save-v1')) {
      beforeCommand = null;interrupted = true;
      const proof = issued.body.challenge;
      const verified = await call(identityHandler,cookie,{action:'verify',challengeId:proof.challengeId,
        signature:kaspa.signMessage({message:proof.message,privateKey})});
      assert.equal(verified.statusCode,200);
    }
  };
  const refreshed = await call(sessionHandler,cookie,{});
  assert.equal(interrupted,true);
  const saved = JSON.parse(await fixture.command('GET',key));
  assert.equal(saved.identityVersion,1,'new wallet proof must survive an older session refresh');
  assert.equal(refreshed.statusCode,409);
  assert.equal(refreshed.headers['Set-Cookie'],undefined);
});
