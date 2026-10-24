import { randomBytes } from 'node:crypto';
import kaspa from '@dfns/kaspa-wasm';
import { generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { redis, rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';
import { decodePasskeyAccount } from './passkey-records.js';
import { passkeyAccountKey } from './passkey-grants.js';
import { passkeyContext } from './passkeys.js';
import { identityPlayerKey } from './identity-keys.js';
import { decodeIdentityRecord, decodeSessionRecord } from './identity-records.js';
import { isValidKaspaMainnetAddress, isValidKaspaTestnetAddress, normalizeKaspaAddress } from './kaspa-address.js';
import { auditWriteCommands, createAuditRecord, hashAuditIdentifier } from './audit.js';
import { parseProfile, profileKeyFor } from './profile.js';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';

export const rewardAddressKey = id => `geek:reward-addresses:v1:${id}`;
const challengeKey = id => `geek:reward-address-proof:v1:${id}`;
const hex = (s, n) => typeof s === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(s);
const networks = ['mainnet', 'testnet-10'];
export const validReceivingAddress = (address, network) => {
  if (typeof address !== 'string' || !(network === 'mainnet' ? isValidKaspaMainnetAddress(address) : network === 'testnet-10' && isValidKaspaTestnetAddress(address))) return false;
  let parsed;
  try { parsed = new kaspa.Address(normalizeKaspaAddress(address)); return true; }
  catch { return false; }
  finally { parsed?.free(); }
};
export const decodeRewardAddresses = (raw, playerId) => {
  if (raw === null) return null;
  let r; try { r = JSON.parse(raw); } catch { /* reject below */ }
  if (!r || r.schema !== 1 || r.playerId !== playerId || !hex(playerId, 32) || !hex(r.version, 24)
    || !Number.isSafeInteger(r.updatedAt) || r.updatedAt <= 0 || r.authorizedBy !== 'passkey'
    || !Number.isSafeInteger(r.mainnetEligibleAt) || r.mainnetEligibleAt < 0
    || (r.mainnet === '' ? r.mainnetEligibleAt !== 0 : r.mainnetEligibleAt === 0)
    || networks.some(n => r[n] !== '' && !validReceivingAddress(r[n], n))) throw new Error('REWARD_ADDRESS_STATE_INVALID');
  return r;
};
const accountState = async session => {
  const id = playerIdFor(session);
  const [accountRaw, identityRaw, sessionRaw] = await Promise.all([
    redis('GET', passkeyAccountKey(id)), redis('GET', identityPlayerKey(id)), redis('GET', `geek:session:${session.id}`)
  ]);
  const account = decodePasskeyAccount(accountRaw, id), identity = decodeIdentityRecord(identityRaw, id), live = decodeSessionRecord(sessionRaw, session.id);
  if (!live || playerIdFor(live) !== id || live.passkeyEpoch !== session.passkeyEpoch || live.identityVersion !== session.identityVersion) throw new Error('SESSION_REQUIRED');
  const canEdit = Boolean((session.passkeyEpoch || session.identityVersion) && account?.credentials.length
    && account.walletVersion === (identity?.sessionVersion || 0) && (!session.passkeyEpoch || account.epoch === session.passkeyEpoch));
  return { accountRaw, identityRaw, sessionRaw, account, canEdit, signedIn: Boolean(session.passkeyEpoch || session.identityVersion) };
};
const savedState = async id => {
  const raw = await redis('GET', rewardAddressKey(id)), record = decodeRewardAddresses(raw, id);
  if (record) return { raw, record, legacyRaw: '' };
  // Preserve the earlier Mainnet setting until this account explicitly confirms
  // a change. It is receiving information, never an authentication identity.
  const legacyRaw = await redis('GET', profileKeyFor(id));
  const legacy = parseProfile(legacyRaw).payoutAddress || '';
  if (legacy && !validReceivingAddress(legacy, 'mainnet')) throw new Error('REWARD_ADDRESS_STATE_INVALID');
  return { raw, legacyRaw, record: { mainnet: legacy, 'testnet-10': '', version: '' } };
};
const view = (state, account) => ({ addresses: { mainnet: state.record.mainnet, 'testnet-10': state.record['testnet-10'], version: state.record.version },
  canEdit: account.canEdit, signedIn: account.signedIn, mainnetSettlementEnabled: false });

const SAVE = `-- geek-reward-address-save-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 'CHANGED' end
if redis.call('GET', KEYS[2]) ~= ARGV[2] then return 'CHANGED' end
if redis.call('GET', KEYS[3]) ~= ARGV[3] then return 'CHANGED' end
if (redis.call('GET', KEYS[4]) or '') ~= ARGV[4] then return 'CHANGED' end
if ARGV[1] == '' and (redis.call('GET', KEYS[5]) or '') ~= ARGV[5] then return 'CHANGED' end
local kind = redis.call('TYPE', KEYS[7]).ok
if kind ~= 'none' and kind ~= 'zset' then return 'INVALID' end
if redis.call('EXISTS', KEYS[6]) == 1 then return 'INVALID' end
redis.call('SET', KEYS[1], ARGV[6])
redis.call('SET', KEYS[3], ARGV[7])
redis.call('SET', KEYS[6], ARGV[8])
redis.call('ZADD', KEYS[7], ARGV[9], ARGV[10])
return 'OK'`;

export async function receivingAddressesHandler(req, res) {
  setApiHeaders(res, 'GET, POST'); res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
  try {
    const context = passkeyContext(req), session = await requireSession(req), id = playerIdFor(session);
    await rateLimit('reward-address', session.id, 30, 600);
    const [state, access] = await Promise.all([savedState(id), accountState(session)]);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, ...view(state, access) });
    if (!access.canEdit) throw new Error('REWARD_ADDRESS_PASSKEY_REQUIRED');
    const body = parseBody(req);
    if (body.action === 'begin') {
      if (!networks.includes(body.network) || !['set', 'remove'].includes(body.operation) || body.confirmed !== true
        || (body.operation === 'set' && !validReceivingAddress(body.address, body.network))) throw new Error('REWARD_ADDRESS_INVALID');
      if (body.version !== state.record.version) throw new Error('REWARD_ADDRESS_CHANGED');
      const address = body.operation === 'set' ? normalizeKaspaAddress(body.address) : '';
      const options = await generateAuthenticationOptions({ rpID: context.rpID, userVerification: 'required',
        allowCredentials: access.account.credentials.map(c => ({ id: c.id, transports: c.transports })) });
      const challengeId = randomBytes(20).toString('hex');
      const proof = { schema: 1, sessionId: session.id, playerId: id, ...context, challenge: options.challenge,
        accountRaw: access.accountRaw, identityRaw: access.identityRaw, previousRaw: state.raw,
        legacyMainnet: state.record.mainnet, network: body.network, operation: body.operation, address, expiresAt: Date.now() + 300000 };
      if (await redis('SET', challengeKey(challengeId), JSON.stringify(proof), 'EX', 300, 'NX') !== 'OK') throw new Error('REWARD_ADDRESS_STATE_INVALID');
      return sendJson(res, 200, { ok: true, challengeId, options });
    }
    if (body.action !== 'finish' || !hex(body.challengeId, 40)) throw new Error('REWARD_ADDRESS_PROOF_INVALID');
    let proof; try { proof = JSON.parse(await redis('GETDEL', challengeKey(body.challengeId))); } catch { /* reject */ }
    if (!proof || proof.schema !== 1 || proof.sessionId !== session.id || proof.playerId !== id || proof.origin !== context.origin || proof.rpID !== context.rpID
      || !Number.isSafeInteger(proof.expiresAt) || proof.expiresAt <= Date.now() || proof.accountRaw !== access.accountRaw || proof.identityRaw !== access.identityRaw
      || proof.previousRaw !== state.raw || (!state.raw && proof.legacyMainnet !== state.record.mainnet)
      || !networks.includes(proof.network) || !['set', 'remove'].includes(proof.operation)
      || (proof.operation === 'set' ? !validReceivingAddress(proof.address, proof.network) : proof.address !== '')) throw new Error('REWARD_ADDRESS_PROOF_INVALID');
    const credential = access.account.credentials.find(c => c.id === body.response?.id);
    const handle = body.response?.response?.userHandle;
    if (!credential || (handle != null && handle !== Buffer.from(id, 'hex').toString('base64url'))) throw new Error('REWARD_ADDRESS_PROOF_INVALID');
    const result = await verifyAuthenticationResponse({ response: body.response, expectedChallenge: proof.challenge,
      expectedOrigin: context.origin, expectedRPID: context.rpID, requireUserVerification: true,
      credential: { ...credential, publicKey: new Uint8Array(Buffer.from(credential.publicKey, 'base64url')) } });
    if (!result.verified) throw new Error('REWARD_ADDRESS_PROOF_INVALID');
    credential.counter = result.authenticationInfo.newCounter;
    const now = Date.now();
    const record = { schema: 1, playerId: id, mainnet: state.record.mainnet, 'testnet-10': state.record['testnet-10'],
      [proof.network]: proof.address, version: randomBytes(12).toString('hex'), updatedAt: now, authorizedBy: 'passkey',
      mainnetEligibleAt: proof.network === 'mainnet' ? (proof.address ? now + 72 * 60 * 60 * 1000 : 0)
        : state.record.mainnetEligibleAt ?? (state.record.mainnet ? now + 72 * 60 * 60 * 1000 : 0) };
    decodeRewardAddresses(JSON.stringify(record), id);
    const audit = await createAuditRecord({ type: `rewards.address.${proof.operation}`, actorType: 'passkey-player', actorId: id,
      objectType: 'receiving-address', objectId: id, interactionId: session.id, reason: 'fresh-account-confirmation',
      details: { network: proof.network, addressHash: proof.address ? hashAuditIdentifier(proof.address) : '', ownershipVerified: false, mainnetSettlementEnabled: false } });
    const [event, index] = auditWriteCommands(audit);
    const saved = await redis('EVAL', SAVE, 7, rewardAddressKey(id), `geek:session:${session.id}`, passkeyAccountKey(id), identityPlayerKey(id), profileKeyFor(id), event[1], index[1],
      state.raw || '', access.sessionRaw, access.accountRaw, access.identityRaw || '', state.legacyRaw || '', JSON.stringify(record), JSON.stringify(access.account), JSON.stringify(audit), audit.sequence, audit.eventId);
    if (saved !== 'OK') throw new Error(saved === 'INVALID' ? 'REWARD_ADDRESS_STATE_INVALID' : 'REWARD_ADDRESS_CHANGED');
    return sendJson(res, 200, { ok: true, ...view({ record }, access) });
  } catch (error) {
    const code = error.message || '';
    if (code === 'REWARD_ADDRESS_PASSKEY_REQUIRED') return sendJson(res, 403, { ok: false, code, error: 'Save or sign in with a Geek passkey before changing receiving addresses.' });
    if (code === 'REWARD_ADDRESS_CHANGED') return sendJson(res, 409, { ok: false, code, error: 'Your saved account or address changed. Reload before trying again.' });
    if (code === 'REWARD_ADDRESS_INVALID') return sendJson(res, 400, { ok: false, code, error: 'Check the address and its selected network, then confirm it before saving.' });
    if (['REWARD_ADDRESS_STATE_INVALID', 'PASSKEY_STATE_INVALID', 'PROFILE_STATE_INVALID'].includes(code)) return sendJson(res, 503, { ok: false, code, error: 'Saved addresses are temporarily unavailable. Your settings have not been replaced.' });
    if (code === 'REWARD_ADDRESS_PROOF_INVALID' || (!code.startsWith('REDIS_') && !['RATE_LIMITED', 'SESSION_REQUIRED', 'SESSION_CHANGED', 'SESSION_STATE_INVALID', 'IDENTITY_STATE_INVALID'].includes(code))) return sendJson(res, 400, { ok: false, code: 'REWARD_ADDRESS_PROOF_INVALID', error: 'Account confirmation was not completed. Retry with a passkey for this Geek account.' });
    return handleApiError(res, error);
  }
}
