import { createHash, randomBytes } from 'node:crypto';
import kaspa from '@dfns/kaspa-wasm';
import { auditWriteCommands, createAuditRecord, hashAuditIdentifier, recordAuditEvent } from './audit.js';
import {
  identityAuthorizationKey,
  identityChallengeKey,
  identityPlayerKey,
  identityWalletKey
} from './identity-keys.js';
import { isValidKaspaMainnetAddress, maskKaspaAddress, normalizeKaspaAddress } from './kaspa-address.js';
import { parseStoredJson, redis } from './redis.js';
import { sessionTtl } from './http.js';

const CHALLENGE_TTL_SECONDS = 5 * 60;
const AUTHORIZATION_TTL_SECONDS = 5 * 60;
const SIGNATURE_SCHEME = 'kaspa-schnorr-personal-message-v1';
const PROOF_VERSION = 1;
const IDENTITY_BIND_SCRIPT = `
-- geek-identity-bind-v1
local wallet = redis.call('GET', KEYS[1])
local player = redis.call('GET', KEYS[2])
if wallet and wallet ~= ARGV[1] then return 'WALLET_BOUND' end
if ARGV[2] == '' then
  if player then return 'PLAYER_CONFLICT' end
elseif player ~= ARGV[2] then
  return 'PLAYER_CONFLICT'
end
if redis.call('EXISTS', KEYS[4]) == 1 then return 'AUDIT_CONFLICT' end
redis.call('SET', KEYS[1], ARGV[1])
redis.call('SET', KEYS[2], ARGV[3])
redis.call('SET', KEYS[3], ARGV[4], 'EX', ARGV[5])
redis.call('SET', KEYS[4], ARGV[6])
redis.call('ZADD', KEYS[5], ARGV[7], ARGV[8])
return 'OK'
`;

const digest = (value) => createHash('sha256').update(String(value || '')).digest('hex');
const sessionKey = (sessionId) => `geek:session:${sessionId}`;
const stablePlayerId = (session) => String(session?.playerId || session?.id || '');

const normalizePublicKey = (value) => {
  const publicKey = String(value || '').trim().toLowerCase();
  if (!/^(02|03)[a-f0-9]{64}$/.test(publicKey)) throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
  return publicKey;
};

const addressForPublicKey = (publicKey) => {
  try {
    return new kaspa.PublicKey(publicKey).toAddress(kaspa.NetworkType.Mainnet).toString().toLowerCase();
  } catch {
    throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
  }
};

const normalizeSchnorrSignature = (value) => {
  const signature = String(value || '').trim();
  if (/^[a-f0-9]{128}$/i.test(signature)) return signature.toLowerCase();
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(signature) || signature.length > 180) throw new Error('IDENTITY_SIGNATURE_INVALID');
  const decoded = Buffer.from(signature, 'base64');
  if (decoded.length !== 64 || decoded.toString('base64').replace(/=+$/, '') !== signature.replace(/=+$/, '')) {
    throw new Error('IDENTITY_SIGNATURE_INVALID');
  }
  return decoded.toString('hex');
};

const verifySignature = ({ message, signature, publicKey }) => {
  try {
    return kaspa.verifyMessage({
      message: String(message),
      signature: normalizeSchnorrSignature(signature),
      publicKey: normalizePublicKey(publicKey)
    });
  } catch {
    return false;
  }
};

const validateWalletProofInputs = (addressValue, publicKeyValue) => {
  if (!isValidKaspaMainnetAddress(addressValue)) throw new Error('INVALID_KASPA_ADDRESS');
  const address = normalizeKaspaAddress(addressValue);
  const publicKey = normalizePublicKey(publicKeyValue);
  if (addressForPublicKey(publicKey) !== address) throw new Error('IDENTITY_KEY_MISMATCH');
  return { address, publicKey };
};

const canonicalOrigin = (req) => {
  const configured = String(process.env.IDENTITY_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  const host = String(req?.headers?.['x-forwarded-host'] || req?.headers?.host || '').split(',')[0].trim().toLowerCase();
  if (host === 'geekprotocol.xyz' || host === 'www.geekprotocol.xyz') return 'https://geekprotocol.xyz';
  if (/^[a-z0-9-]+\.vercel\.app$/.test(host)) return `https://${host}`;
  return 'https://geekprotocol.xyz';
};

const challengeMessage = ({ origin, intent, address, payoutAddress, nonce, issuedAt, expiresAt }) => {
  const actions = {
    link: 'LINK PLAYER IDENTITY',
    recover: 'RECOVER PLAYER IDENTITY',
    'payout-set': 'AUTHORIZE PAYOUT DESTINATION',
    'payout-remove': 'AUTHORIZE PAYOUT REMOVAL'
  };
  return [
    'GEEK Protocol Identity Proof',
    `Version: ${PROOF_VERSION}`,
    `Origin: ${origin}`,
    `Action: ${actions[intent]}`,
    `Identity wallet: ${address}`,
    ...(intent === 'payout-set' ? [`Requested payout: ${payoutAddress}`] : []),
    `Challenge: ${nonce}`,
    `Issued: ${new Date(issuedAt).toISOString()}`,
    `Expires: ${new Date(expiresAt).toISOString()}`,
    'This proves wallet control only. It does not authorize a transaction, transfer, purchase, mint, or withdrawal.'
  ].join('\n');
};

const safeIdentity = (identity) => identity ? ({
  linked: true,
  status: 'wallet-verified-alpha',
  address: identity.address,
  maskedAddress: maskKaspaAddress(identity.address),
  network: 'kaspa-mainnet',
  scheme: identity.scheme,
  linkedAt: Number(identity.linkedAt || 0),
  verifiedAt: Number(identity.verifiedAt || 0),
  lastRecoveredAt: Number(identity.lastRecoveredAt || 0),
  recoveryCount: Number(identity.recoveryCount || 0),
  recoveryAvailable: true,
  settlementEnabled: false
}) : ({
  linked: false,
  status: 'session-only',
  address: '',
  maskedAddress: '',
  network: 'kaspa-mainnet',
  scheme: SIGNATURE_SCHEME,
  linkedAt: 0,
  verifiedAt: 0,
  lastRecoveredAt: 0,
  recoveryCount: 0,
  recoveryAvailable: false,
  settlementEnabled: false
});

export const loadIdentity = async (playerId) => parseStoredJson(await redis('GET', identityPlayerKey(playerId)));

export const identityView = (identity) => safeIdentity(identity);

export const identityStatus = async (session) => safeIdentity(await loadIdentity(stablePlayerId(session)));

const recordRejectedProof = async (session, reason, challenge = {}) => {
  try {
    await recordAuditEvent({
      type: 'identity.proof.rejected',
      severity: 'warning',
      actorType: 'alpha-session',
      actorId: session?.id,
      objectType: 'player-identity',
      objectId: challenge.targetPlayerId || stablePlayerId(session),
      outcome: 'failure',
      reason,
      interactionId: session?.id,
      details: {
        intent: challenge.intent || 'unknown',
        addressHash: challenge.address ? hashAuditIdentifier(challenge.address) : '',
        scheme: SIGNATURE_SCHEME
      }
    });
  } catch {
    // Authentication failures remain predictable if audit storage is temporarily unavailable.
  }
};

export const createIdentityChallenge = async ({ req, session, address: rawAddress, publicKey: rawPublicKey, intent = 'identity', operation = 'set', payoutAddress: rawPayoutAddress = '' }) => {
  const { address, publicKey } = validateWalletProofInputs(rawAddress, rawPublicKey);
  const playerId = stablePlayerId(session);
  const addressHash = hashAuditIdentifier(address);
  const boundPlayerId = String(await redis('GET', identityWalletKey(addressHash)) || '');
  let selectedIntent;
  let targetPlayerId;
  let payoutAddress = '';

  if (intent === 'payout') {
    const identity = await loadIdentity(playerId);
    if (!identity || identity.address !== address || identity.publicKey !== publicKey) throw new Error('IDENTITY_REAUTH_REQUIRED');
    selectedIntent = operation === 'remove' ? 'payout-remove' : 'payout-set';
    targetPlayerId = playerId;
    if (selectedIntent === 'payout-set') {
      if (!isValidKaspaMainnetAddress(rawPayoutAddress)) throw new Error('INVALID_KASPA_ADDRESS');
      payoutAddress = normalizeKaspaAddress(rawPayoutAddress);
    }
  } else {
    const currentIdentity = await loadIdentity(playerId);
    if (!boundPlayerId && currentIdentity && currentIdentity.address !== address) throw new Error('IDENTITY_ROTATION_UNAVAILABLE');
    selectedIntent = boundPlayerId && boundPlayerId !== playerId ? 'recover' : 'link';
    targetPlayerId = boundPlayerId || playerId;
  }

  const now = Date.now();
  const expiresAt = now + CHALLENGE_TTL_SECONDS * 1000;
  const challengeId = randomBytes(20).toString('hex');
  const nonce = randomBytes(32).toString('hex');
  const origin = canonicalOrigin(req);
  const message = challengeMessage({ origin, intent: selectedIntent, address, payoutAddress, nonce, issuedAt: now, expiresAt });
  const challenge = {
    version: PROOF_VERSION,
    challengeId,
    sessionId: session.id,
    requesterPlayerId: playerId,
    targetPlayerId,
    intent: selectedIntent,
    address,
    publicKey,
    payoutAddress,
    payoutAddressHash: selectedIntent === 'payout-set' ? hashAuditIdentifier(payoutAddress) : '',
    scheme: SIGNATURE_SCHEME,
    origin,
    message,
    issuedAt: now,
    expiresAt
  };
  const stored = await redis('SET', identityChallengeKey(challengeId), JSON.stringify(challenge), 'EX', CHALLENGE_TTL_SECONDS, 'NX');
  if (stored !== 'OK') throw new Error('IDENTITY_CHALLENGE_FAILED');
  return {
    challengeId,
    intent: selectedIntent,
    message,
    expiresAt,
    scheme: SIGNATURE_SCHEME,
    transactionRequested: false,
    settlementEnabled: false
  };
};

const consumeChallenge = async (session, challengeId) => {
  if (!/^[a-f0-9]{40}$/.test(String(challengeId || ''))) throw new Error('IDENTITY_CHALLENGE_INVALID');
  const challenge = parseStoredJson(await redis('GETDEL', identityChallengeKey(challengeId)));
  if (!challenge || challenge.challengeId !== challengeId) throw new Error('IDENTITY_CHALLENGE_INVALID');
  if (challenge.sessionId !== session.id || Number(challenge.expiresAt || 0) < Date.now()) throw new Error('IDENTITY_CHALLENGE_INVALID');
  return challenge;
};

const createPayoutAuthorization = async (session, challenge) => {
  const identity = await loadIdentity(stablePlayerId(session));
  if (!identity || identity.address !== challenge.address || identity.publicKey !== challenge.publicKey) throw new Error('IDENTITY_REAUTH_REQUIRED');
  const token = randomBytes(32).toString('hex');
  const tokenHash = digest(token);
  const now = Date.now();
  const expiresAt = now + AUTHORIZATION_TTL_SECONDS * 1000;
  const authorization = {
    sessionId: session.id,
    playerId: stablePlayerId(session),
    identityVersion: Number(identity.sessionVersion || 0),
    operation: challenge.intent === 'payout-remove' ? 'remove' : 'set',
    payoutAddressHash: challenge.payoutAddressHash || '',
    issuedAt: now,
    expiresAt
  };
  const stored = await redis('SET', identityAuthorizationKey(tokenHash), JSON.stringify(authorization), 'EX', AUTHORIZATION_TTL_SECONDS, 'NX');
  if (stored !== 'OK') throw new Error('IDENTITY_AUTHORIZATION_FAILED');
  const audit = await recordAuditEvent({
    type: 'payout.authorization.issued',
    severity: 'warning',
    actorType: 'wallet-verified-player',
    actorId: stablePlayerId(session),
    objectType: 'payout-profile',
    objectId: stablePlayerId(session),
    outcome: 'success',
    reason: authorization.operation === 'remove' ? 'wallet-authorized-removal' : 'wallet-authorized-change',
    interactionId: session.id,
    details: {
      operation: authorization.operation,
      addressHash: challenge.payoutAddressHash || '',
      authorizationTtlSeconds: AUTHORIZATION_TTL_SECONDS,
      settlementEnabled: false
    }
  });
  return {
    identity: safeIdentity(identity),
    authorization: {
      token,
      operation: authorization.operation,
      expiresAt,
      oneTime: true
    },
    auditReceipt: { eventId: audit.eventId, sequence: audit.sequence, integrity: audit.integrity.algorithm }
  };
};

export const verifyIdentityChallenge = async ({ session, challengeId, signature }) => {
  const challenge = await consumeChallenge(session, challengeId);
  if (!verifySignature({ message: challenge.message, signature, publicKey: challenge.publicKey })) {
    await recordRejectedProof(session, 'signature-invalid', challenge);
    throw new Error('IDENTITY_SIGNATURE_INVALID');
  }
  if (challenge.intent.startsWith('payout-')) return createPayoutAuthorization(session, challenge);

  const currentPlayerId = stablePlayerId(session);
  const targetPlayerId = String(challenge.targetPlayerId || '');
  const walletKey = identityWalletKey(hashAuditIdentifier(challenge.address));
  const playerKey = identityPlayerKey(targetPlayerId);
  const existingBinding = String(await redis('GET', walletKey) || '');
  if (!targetPlayerId || (existingBinding && existingBinding !== targetPlayerId)) {
    await recordRejectedProof(session, 'wallet-already-bound', challenge);
    throw new Error('IDENTITY_WALLET_BOUND');
  }

  const previousRaw = await redis('GET', playerKey);
  const previous = parseStoredJson(previousRaw);
  if (previousRaw && !previous) throw new Error('IDENTITY_STATE_INVALID');
  if (previous && (previous.address !== challenge.address || previous.publicKey !== challenge.publicKey)) {
    await recordRejectedProof(session, 'identity-record-mismatch', challenge);
    throw new Error('IDENTITY_WALLET_BOUND');
  }

  const recovered = challenge.intent === 'recover' && targetPlayerId !== currentPlayerId;
  const now = Date.now();
  const identity = {
    version: PROOF_VERSION,
    id: targetPlayerId,
    address: challenge.address,
    publicKey: challenge.publicKey,
    network: 'kaspa-mainnet',
    scheme: SIGNATURE_SCHEME,
    linkedAt: Number(previous?.linkedAt || now),
    verifiedAt: now,
    lastRecoveredAt: recovered ? now : Number(previous?.lastRecoveredAt || 0),
    recoveryCount: Number(previous?.recoveryCount || 0) + (recovered ? 1 : 0),
    sessionVersion: Math.max(1, Number(previous?.sessionVersion || 1) + (recovered ? 1 : 0)),
    settlementEnabled: false
  };
  const updatedSession = {
    ...session,
    playerId: targetPlayerId,
    identityVersion: identity.sessionVersion,
    lastSeen: now
  };
  const audit = await createAuditRecord({
    type: recovered ? 'identity.session.recovered' : (previous ? 'identity.wallet.reverified' : 'identity.wallet.linked'),
    severity: 'warning',
    actorType: 'wallet-verified-player',
    actorId: targetPlayerId,
    objectType: 'player-identity',
    objectId: targetPlayerId,
    outcome: 'success',
    reason: recovered ? 'fresh-wallet-proof' : 'wallet-control-proved',
    interactionId: session.id,
    details: {
      addressHash: hashAuditIdentifier(challenge.address),
      scheme: SIGNATURE_SCHEME,
      recovered,
      previousSessionsInvalidated: recovered,
      settlementEnabled: false
    }
  });
  const [eventWrite, indexWrite] = auditWriteCommands(audit);
  const transition = await redis(
    'EVAL',
    IDENTITY_BIND_SCRIPT,
    5,
    walletKey,
    playerKey,
    sessionKey(session.id),
    eventWrite[1],
    indexWrite[1],
    targetPlayerId,
    previousRaw || '',
    JSON.stringify(identity),
    JSON.stringify(updatedSession),
    sessionTtl,
    JSON.stringify(audit),
    audit.sequence,
    audit.eventId
  );
  if (transition !== 'OK') {
    const reason = transition === 'WALLET_BOUND' ? 'wallet-already-bound' : 'identity-state-race';
    await recordRejectedProof(session, reason, challenge);
    if (transition === 'WALLET_BOUND') throw new Error('IDENTITY_WALLET_BOUND');
    throw new Error('IDENTITY_STATE_CONFLICT');
  }
  return {
    identity: safeIdentity(identity),
    recovered,
    previousSessionsInvalidated: recovered,
    auditReceipt: { eventId: audit.eventId, sequence: audit.sequence, integrity: audit.integrity.algorithm }
  };
};

export const requirePayoutAuthorization = async ({ session, token, operation, payoutAddress = '' }) => {
  if (!/^[a-f0-9]{64}$/.test(String(token || ''))) throw new Error('PAYOUT_REAUTH_REQUIRED');
  const authorization = parseStoredJson(await redis('GETDEL', identityAuthorizationKey(digest(token))));
  const identity = await loadIdentity(stablePlayerId(session));
  const expectedAddressHash = operation === 'set' ? hashAuditIdentifier(normalizeKaspaAddress(payoutAddress)) : '';
  const valid = authorization
    && identity
    && authorization.sessionId === session.id
    && authorization.playerId === stablePlayerId(session)
    && Number(authorization.identityVersion) === Number(identity.sessionVersion)
    && authorization.operation === operation
    && authorization.payoutAddressHash === expectedAddressHash
    && Number(authorization.expiresAt || 0) >= Date.now();
  if (!valid) throw new Error('PAYOUT_REAUTH_REQUIRED');
  return identity;
};

export const verifyKaspaProof = ({ message, signature, publicKey }) => verifySignature({ message, signature, publicKey });
export const publicKeyAddress = (publicKey) => addressForPublicKey(normalizePublicKey(publicKey));
