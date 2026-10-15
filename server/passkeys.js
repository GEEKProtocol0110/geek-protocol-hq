import { createAuditRecord, auditWriteCommands } from './audit.js';
import { decodePasskeyAccount } from './passkey-records.js';
import { createHash, randomBytes } from 'node:crypto';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { redis } from './redis.js';
import { identityPlayerKey } from './identity-keys.js';
import { decodeIdentityRecord } from './identity-records.js';
import { passkeyAccountKey, consumePasskeyGrant, issuePasskeyGrant } from './passkey-grants.js';
import { createSessionId, sessionTtl, setSessionCookie, cleanName } from './http.js';

const hex = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x);
const b64 = x => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x) && x.length <= 4096 && Buffer.from(x, 'base64url').toString('base64url') === x;
const credentialKey = id => `geek:passkey:credential:v1:${createHash('sha256').update(id).digest('hex')}`;
const challengeKey = id => `geek:passkey:challenge:v1:${id}`;
const sessionKey = id => `geek:session:${id}`;
const pid = session => session.playerId || session.id;
export const passkeyContext = req => {
  const host = String(req.headers?.host || '').toLowerCase();
  const production = ['geekprotocol.xyz', 'www.geekprotocol.xyz'];
  let origin = `https://${host}`, rpID = 'geekprotocol.xyz';
  if (!production.includes(host)) {
    const configured = String(process.env.PASSKEY_ORIGIN || '');
    let u; try { u = new URL(configured); } catch { throw new Error('PASSKEY_ORIGIN_INVALID'); }
    if (u.host !== host || u.origin !== configured || (u.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && u.hostname === 'localhost' && u.protocol === 'http:'))) throw new Error('PASSKEY_ORIGIN_INVALID');
    origin = u.origin; rpID = u.hostname;
  }
  if (req.method !== 'GET' && req.headers?.origin !== origin) throw new Error('PASSKEY_ORIGIN_INVALID');
  return { origin, rpID };
};
const walletState = async id => {
  const raw = await redis('GET', identityPlayerKey(id));
  const wallet = decodeIdentityRecord(raw, id);
  return { raw, version: wallet?.sessionVersion || 0 };
};
const getAccount = async id => { const raw = await redis('GET', passkeyAccountKey(id)); return { raw, account: decodePasskeyAccount(raw, id) }; };
const issueChallenge = async (session, context, action, options, previous = '', walletVersion = -1) => {
  const id = randomBytes(20).toString('hex'), now = Date.now();
  const c = { version: 1, sessionId: session.id, playerId: pid(session), action, ...context, challenge: options.challenge, previous, walletVersion, issuedAt: now, expiresAt: now + 300000 };
  if (await redis('SET', challengeKey(id), JSON.stringify(c), 'EX', 300, 'NX') !== 'OK') throw new Error('PASSKEY_UNAVAILABLE');
  return { challengeId: id, options };
};
const consumeChallenge = async (session, context, action, id) => {
  if (!/^[a-f0-9]{40}$/.test(id || '')) throw new Error('PASSKEY_PROOF_INVALID');
  const raw = await redis('GETDEL', challengeKey(id));
  let c; try { c = JSON.parse(raw); } catch { /* reject */ }
  if (!c || c.version !== 1 || c.sessionId !== session.id || c.playerId !== pid(session) || c.action !== action
    || c.origin !== context.origin || c.rpID !== context.rpID || !b64(c.challenge) || typeof c.previous !== 'string'
    || !Number.isSafeInteger(c.issuedAt) || c.issuedAt > Date.now() || c.expiresAt !== c.issuedAt + 300000 || c.expiresAt <= Date.now()) throw new Error('PASSKEY_PROOF_INVALID');
  return c;
};
const CAS = `-- geek-passkey-cas-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 'CHANGED' end
if (redis.call('GET', KEYS[4]) or '') ~= ARGV[4] then return 'CHANGED' end
if redis.call('GET', KEYS[5]) ~= ARGV[8] then return 'CHANGED' end
if redis.call('EXISTS', KEYS[6]) == 1 then return 'CHANGED' end
local owner = redis.call('GET', KEYS[2])
if ARGV[5] == 'register' and owner then return 'CHANGED' end
if ARGV[5] == 'login' and owner ~= ARGV[6] then return 'CHANGED' end
redis.call('SET', KEYS[1], ARGV[2])
if ARGV[5] == 'register' then redis.call('SET', KEYS[2], ARGV[6]) end
redis.call('SET', KEYS[3], ARGV[3], 'EX', ARGV[7])
redis.call('DEL', KEYS[5])
redis.call('SET', KEYS[6], ARGV[9])
redis.call('ZADD', KEYS[7], ARGV[10], ARGV[11])
return 'OK'`;
const saveAndRotate = async (res, session, previous, account, credentialId, wallet, mode) => {
  const sessionRaw = await redis('GET', sessionKey(session.id));
  let live; try { live = JSON.parse(sessionRaw); } catch { /* reject */ }
  if (!live || (live.playerId || live.id) !== pid(session)) throw new Error('PASSKEY_STATE_CHANGED');
  const id = createSessionId(), now = Date.now();
  const fresh = { id, playerId: account.playerId, identityVersion: wallet.version, passkeyEpoch: account.epoch,
    name: cleanName(await redis('GET', `geek:player-name:${account.playerId}`), session.name), createdAt: now, lastSeen: now };
  decodePasskeyAccount(JSON.stringify(account), account.playerId);
  const audit = await createAuditRecord({ type: `identity.passkey.${mode}`, actorType: 'passkey-player', actorId: account.playerId, objectType: 'player-access', objectId: account.playerId, reason: 'fresh-user-verification', interactionId: session.id, details: { walletLinked: wallet.version > 0, credentialCount: account.credentials.length } });
  const [event, index] = auditWriteCommands(audit);
  const result = await redis('EVAL', CAS, 7, passkeyAccountKey(account.playerId), credentialKey(credentialId), sessionKey(id), identityPlayerKey(account.playerId), sessionKey(session.id), event[1], index[1],
    previous || '', JSON.stringify(account), JSON.stringify(fresh), wallet.raw || '', mode, account.playerId, sessionTtl, sessionRaw, JSON.stringify(audit), audit.sequence, audit.eventId);
  if (result !== 'OK') throw new Error('PASSKEY_STATE_CHANGED');
  setSessionCookie(res, id);
  return { signedIn: true, grant: await issuePasskeyGrant(fresh, wallet.version) };
};
export const passkeyStatus = async session => {
  const { account } = await getAccount(pid(session));
  const wallet = await walletState(pid(session));
  return { signedIn: Boolean(session.passkeyEpoch), walletLinked: wallet.version > 0,
    credentials: account?.walletVersion === wallet.version ? account.credentials.map(c => ({ id: c.id, label: c.label, createdAt: c.createdAt })) : [],
    recovery: 'Use another saved or synced passkey, or your linked wallet. Geek cannot restore a lost passkey without a remaining recovery method.' };
};
export const passkeyAction = async (req, res, session, body) => {
  const context = passkeyContext(req), id = pid(session);
  if (body.action === 'begin-register') {
    const { raw, account } = await getAccount(id), wallet = await walletState(id);
    if (wallet.version || account) await consumePasskeyGrant(session, body.token, wallet.version);
    const current = account?.walletVersion === wallet.version ? account.credentials : [];
    if (current.length >= 10) throw new Error('PASSKEY_LIMIT');
    const options = await generateRegistrationOptions({ rpName: 'Geek Protocol', rpID: context.rpID,
      userID: Buffer.from(id, 'hex'), userName: `geek-${id.slice(0, 8)}`, userDisplayName: session.name,
      attestationType: 'none', supportedAlgorithmIDs: [-7, -257],
      excludeCredentials: current.map(c => ({ id: c.id, transports: c.transports })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'required' } });
    return issueChallenge(session, context, 'register', options, raw || '', wallet.version);
  }
  if (body.action === 'finish-register') {
    const c = await consumeChallenge(session, context, 'register', body.challengeId), wallet = await walletState(id);
    const { raw, account } = await getAccount(id);
    if (c.walletVersion !== wallet.version) throw new Error('PASSKEY_STATE_CHANGED');
    if ((raw || '') !== c.previous) throw new Error('PASSKEY_STATE_CHANGED');
    const result = await verifyRegistrationResponse({ response: body.response, expectedChallenge: c.challenge,
      expectedOrigin: context.origin, expectedRPID: context.rpID, requireUserVerification: true });
    if (!result.verified || !result.registrationInfo) throw new Error('PASSKEY_PROOF_INVALID');
    const info = result.registrationInfo, credential = info.credential;
    const a = account?.walletVersion === wallet.version ? account : { version: 1, playerId: id, epoch: (account?.epoch || 0) + 1, walletVersion: wallet.version, credentials: [] };
    a.credentials.push({ id: credential.id, publicKey: Buffer.from(credential.publicKey).toString('base64url'), counter: credential.counter,
      label: String(body.label || 'My passkey').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, 40) || 'My passkey', createdAt: Date.now(), transports: credential.transports || [] });
    decodePasskeyAccount(JSON.stringify(a), id);
    return saveAndRotate(res, session, raw, a, credential.id, wallet, 'register');
  }
  if (body.action === 'begin-login') {
    const options = await generateAuthenticationOptions({ rpID: context.rpID, userVerification: 'required' });
    return issueChallenge(session, context, 'login', options);
  }
  if (body.action === 'finish-login') {
    const c = await consumeChallenge(session, context, 'login', body.challengeId), response = body.response;
    if (!b64(response?.id)) throw new Error('PASSKEY_PROOF_INVALID');
    const target = await redis('GET', credentialKey(response.id));
    if (!hex(target)) throw new Error('PASSKEY_PROOF_INVALID');
    const { raw, account } = await getAccount(target), wallet = await walletState(target);
    const credential = account?.credentials.find(c => c.id === response.id);
    if (!credential || account.walletVersion !== wallet.version || response.response?.userHandle !== Buffer.from(target, 'hex').toString('base64url')) throw new Error('PASSKEY_PROOF_INVALID');
    const result = await verifyAuthenticationResponse({ response, expectedChallenge: c.challenge, expectedOrigin: context.origin,
      expectedRPID: context.rpID, requireUserVerification: true, credential: { ...credential, publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')) } });
    if (!result.verified) throw new Error('PASSKEY_PROOF_INVALID');
    credential.counter = result.authenticationInfo.newCounter;
    return saveAndRotate(res, session, raw, account, credential.id, wallet, 'login');
  }
  if (body.action === 'delete') {
    const wallet = await walletState(id); await consumePasskeyGrant(session, body.token, wallet.version);
    const { raw, account } = await getAccount(id);
    if (!account || !account.credentials.some(c => c.id === body.credentialId)) throw new Error('PASSKEY_PROOF_INVALID');
    account.credentials = account.credentials.filter(c => c.id !== body.credentialId); account.epoch++;
    decodePasskeyAccount(JSON.stringify(account), id);
    const audit = await createAuditRecord({ type: 'identity.passkey.removed', severity: 'warning', actorType: 'verified-player', actorId: id, objectType: 'player-access', objectId: id, reason: 'fresh-proof-removal', details: { remainingCredentials: account.credentials.length } });
    const [event, index] = auditWriteCommands(audit);
    const result = await redis('EVAL', `if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end redis.call('SET',KEYS[1],ARGV[2]) redis.call('DEL',KEYS[2]) redis.call('SET',KEYS[3],ARGV[3]) redis.call('ZADD',KEYS[4],ARGV[4],ARGV[5]) return 1`, 4, passkeyAccountKey(id), credentialKey(body.credentialId), event[1], index[1], raw, JSON.stringify(account), JSON.stringify(audit), audit.sequence, audit.eventId);
    if (result !== 1) throw new Error('PASSKEY_STATE_CHANGED');
    return { signedOut: true };
  }
  if (body.action === 'logout') { await redis('DEL', sessionKey(session.id)); res.setHeader('Set-Cookie', 'geek_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax'); return { signedOut: true }; }
  throw new Error('INVALID_REQUEST');
};
