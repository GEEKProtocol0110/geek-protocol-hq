import { isValidKaspaMainnetAddress, normalizeKaspaAddress } from './kaspa-address.js';
import { validateWalletProofInputs } from './identity-wallet.js';
import { hashAuditIdentifier } from './audit.js';

export const CHALLENGE_TTL_SECONDS = 5 * 60;
export const AUTHORIZATION_TTL_SECONDS = 5 * 60;
export const SIGNATURE_SCHEME = 'kaspa-schnorr-personal-message-v1';
export const PROOF_VERSION = 1;

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const integer = (value, minimum = 0) => Number.isSafeInteger(value) && value >= minimum;
const mainnetAddress = value => typeof value === 'string'
  && value === normalizeKaspaAddress(value) && isValidKaspaMainnetAddress(value);
const assert = (valid, code) => { if (!valid) throw new Error(code); };

// Only Redis nil means absent. Empty strings, JSON null, arrays and malformed JSON
// are invalid records, never an invitation to initialize a replacement identity.
const decode = (raw, code, validate) => {
  if (raw === null) return null;
  let value;
  try {
    if (typeof raw !== 'string') throw new Error(code);
    value = JSON.parse(raw);
    validate(value);
  } catch { throw new Error(code); }
  return value;
};

const walletMatches = record => {
  if (!mainnetAddress(record.address) || typeof record.publicKey !== 'string'
      || !/^(?:[a-f0-9]{64}|(?:02|03)[a-f0-9]{64})$/.test(record.publicKey)) return false;
  try { validateWalletProofInputs(record.address, record.publicKey); return true; }
  catch { return false; }
};

export const validateIdentityRecord = (record, playerId) => {
  const code = 'IDENTITY_STATE_INVALID';
  assert(object(record) && record.version === PROOF_VERSION
    && hex(record.id, 32) && record.id === playerId
    && record.network === 'kaspa-mainnet' && record.scheme === SIGNATURE_SCHEME
    && record.settlementEnabled === false && walletMatches(record)
    && integer(record.linkedAt, 1) && integer(record.verifiedAt, record.linkedAt)
    && integer(record.lastRecoveredAt) && record.lastRecoveredAt <= record.verifiedAt
    && integer(record.recoveryCount) && integer(record.sessionVersion, 1)
    && record.sessionVersion === record.recoveryCount + 1
    && (record.recoveryCount === 0 ? record.lastRecoveredAt === 0 : record.lastRecoveredAt >= record.linkedAt), code);
  return record;
};

export const decodeIdentityRecord = (raw, playerId) => decode(raw, 'IDENTITY_STATE_INVALID',
  record => validateIdentityRecord(record, playerId));

export const validateSessionRecord = (record, sessionId) => {
  const code = 'SESSION_STATE_INVALID';
  assert(object(record) && hex(record.id, 32) && record.id === sessionId
    && typeof record.name === 'string' && record.name.length > 0 && record.name.length <= 24
    && (record.playerId === undefined || hex(record.playerId, 32))
    && (record.identityVersion === undefined || integer(record.identityVersion)), code);
  // Pre-identity guest records may omit playerId/version/timestamps. Validate every
  // field that is present instead of inferring a link from a truthy string.
  assert(!record.identityVersion || hex(record.playerId, 32), code);
  for (const field of ['createdAt', 'lastSeen']) {
    assert(record[field] === undefined || integer(record[field], 1), code);
  }
  assert(record.createdAt === undefined || record.lastSeen === undefined
    || record.lastSeen >= record.createdAt, code);
  return record;
};

export const decodeSessionRecord = (raw, sessionId) => decode(raw, 'SESSION_STATE_INVALID',
  record => validateSessionRecord(record, sessionId));

export const readWalletBinding = raw => {
  if (raw === null) return '';
  assert(hex(raw, 32), 'IDENTITY_STATE_INVALID');
  return raw;
};

export const challengeMessage = ({ origin, intent, address, payoutAddress, nonce, issuedAt, expiresAt }) => {
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

const validLifetime = (record, seconds) => integer(record.issuedAt, 1)
  && integer(record.expiresAt, record.issuedAt + 1)
  && record.expiresAt - record.issuedAt === seconds * 1000;

export const validateChallengeRecord = (record, challengeId) => {
  const code = 'IDENTITY_CHALLENGE_INVALID';
  assert(object(record) && record.version === PROOF_VERSION
    && hex(record.challengeId, 40) && record.challengeId === challengeId
    && hex(record.sessionId, 32) && hex(record.requesterPlayerId, 32) && hex(record.targetPlayerId, 32)
    && ['link', 'recover', 'payout-set', 'payout-remove'].includes(record.intent)
    && record.scheme === SIGNATURE_SCHEME && walletMatches(record)
    && typeof record.origin === 'string' && /^https:\/\/[a-z0-9.-]+$/.test(record.origin)
    && typeof record.message === 'string' && record.message.length <= 2000
    && validLifetime(record, CHALLENGE_TTL_SECONDS), code);
  assert(record.intent === 'recover' ? record.targetPlayerId !== record.requesterPlayerId
    : record.targetPlayerId === record.requesterPlayerId, code);
  assert(record.intent === 'payout-set'
    ? mainnetAddress(record.payoutAddress) && record.payoutAddressHash === hashAuditIdentifier(record.payoutAddress)
    : record.payoutAddress === '' && record.payoutAddressHash === '', code);
  // Existing v1 records store the nonce inside the signed text. Reconstruct that
  // exact text to ensure the action, wallet, destination and times agree with it.
  const nonce = record.message.match(/^Challenge: ([a-f0-9]{64})$/m)?.[1];
  assert(Boolean(nonce) && record.message === challengeMessage({ ...record, nonce }), code);
  return record;
};

export const decodeChallengeRecord = (raw, challengeId) => decode(raw, 'IDENTITY_CHALLENGE_INVALID',
  record => validateChallengeRecord(record, challengeId));

export const validateAuthorizationRecord = record => {
  assert(object(record) && hex(record.sessionId, 32) && hex(record.playerId, 32)
    && integer(record.identityVersion, 1) && ['set', 'remove'].includes(record.operation)
    && (record.operation === 'set' ? hex(record.payoutAddressHash, 64) : record.payoutAddressHash === '')
    && validLifetime(record, AUTHORIZATION_TTL_SECONDS), 'PAYOUT_REAUTH_REQUIRED');
  return record;
};

export const decodeAuthorizationRecord = raw => decode(raw, 'PAYOUT_REAUTH_REQUIRED', validateAuthorizationRecord);
