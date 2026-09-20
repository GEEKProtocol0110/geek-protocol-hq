import { randomBytes } from 'node:crypto';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { hashAuditIdentifier, recordAuditEvent } from '../server/audit.js';
import { identityView, loadIdentity, requirePayoutAuthorization } from '../server/identity.js';
import { isValidKaspaMainnetAddress, maskKaspaAddress, normalizeKaspaAddress } from '../server/kaspa-address.js';
import { createPayoutReview, loadPayoutReview, payoutReviewWriteCommands } from '../server/payout-review.js';
import { loadProfile, saveProfileWithAudit } from '../server/profile.js';
import { rateLimit } from '../server/redis.js';
import { playerIdFor, requireSession } from '../server/session.js';

const PAYOUT_CHANGE_COOLDOWN_MS = 72 * 60 * 60 * 1000;
const PAYOUT_RISK_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const RECOVERY_RISK_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const RAPID_CHANGE_THRESHOLD = 3;

const payoutView = (profile, identity, review = null) => {
  const ownershipVerified = Boolean(identity?.address && identity.address === profile.payoutAddress);
  const reviewStatus = review?.status || profile.payoutReviewStatus || 'not-required';
  return ({
    address: profile.payoutAddress || '',
    maskedAddress: maskKaspaAddress(profile.payoutAddress),
    configuredAt: Number(profile.payoutAddressSetAt || 0),
    version: Number(profile.payoutAddressVersion || 0),
    changeCooldownUntil: Number(profile.payoutAddressEligibleAt || 0),
    network: 'kaspa-mainnet',
    status: profile.payoutAddress ? (ownershipVerified ? 'registered-alpha-wallet-verified' : 'registered-alpha-unverified') : 'not-configured',
    ownershipVerified,
    settlementEligible: false,
    withdrawalsEnabled: false,
    protection: identity ? 'wallet-signature-and-72-hour-change-cooldown' : '72-hour-change-cooldown-before-future-settlement',
    review: {
      required: reviewStatus === 'pending' || reviewStatus === 'required',
      status: reviewStatus,
      reasons: Array.isArray(review?.reasons) ? review.reasons : (Array.isArray(profile.payoutRiskReasons) ? profile.payoutRiskReasons : []),
      reference: review?.id || profile.payoutReviewId || '',
      settlementEnabled: false
    },
    notification: profile.payoutNotice || null
  });
};

const recentMutations = (profile, now) => (Array.isArray(profile.payoutMutationHistory) ? profile.payoutMutationHistory : [])
  .map(Number)
  .filter((timestamp) => Number.isFinite(timestamp) && timestamp >= now - PAYOUT_RISK_WINDOW_MS && timestamp <= now)
  .slice(-12);

const payoutRiskReasons = ({ identity, ownershipVerified, previousAddress, address, mutations, now }) => {
  const reasons = [];
  if (!identity) reasons.push('identity-not-linked');
  if (!ownershipVerified) reasons.push('destination-ownership-unverified');
  if (previousAddress && previousAddress !== address) reasons.push('destination-changed');
  if (Number(identity?.lastRecoveredAt || 0) >= now - RECOVERY_RISK_WINDOW_MS) reasons.push('recent-identity-recovery');
  if (mutations.length >= RAPID_CHANGE_THRESHOLD) reasons.push('multiple-recent-changes');
  return reasons;
};

const noticeFor = ({ type, now, version, previousAddress = '', address = '', reviewRequired = false, reasons = [] }) => ({
  id: `pnot_${randomBytes(10).toString('hex')}`,
  type,
  severity: reviewRequired ? 'warning' : 'info',
  createdAt: now,
  payoutVersion: version,
  previousAddressMasked: maskKaspaAddress(previousAddress),
  addressMasked: maskKaspaAddress(address),
  reviewRequired,
  reasons,
  message: type === 'removed'
    ? 'Your payout destination was removed. No on-chain transfer was made.'
    : reviewRequired
      ? 'Your payout destination changed and is held for private risk review. On-chain settlement remains disabled.'
      : 'Your payout destination was saved. On-chain settlement remains disabled.'
});

const auditReceipt = (record) => ({
  eventId: record.eventId,
  sequence: record.sequence,
  integrity: record.integrity.algorithm
});

const recordRejectedChange = async (sessionId, reason, address = '') => {
  try {
    await recordAuditEvent({
      type: 'payout.destination.rejected',
      severity: 'warning',
      actorType: 'alpha-session',
      actorId: sessionId,
      objectType: 'payout-profile',
      objectId: sessionId,
      outcome: 'failure',
      reason,
      interactionId: sessionId,
      details: { addressHash: address ? hashAuditIdentifier(address) : '', network: 'kaspa-mainnet' }
    });
  } catch {
    // Validation errors must remain safe and predictable even if audit storage is unavailable.
  }
};

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    const playerId = playerIdFor(session);
    await rateLimit('rewards', playerId, 30, 60 * 10);
    const [profile, identity] = await Promise.all([loadProfile(playerId), loadIdentity(playerId)]);
    const currentReview = await loadPayoutReview(profile.payoutReviewId);

    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity, currentReview), identity: identityView(identity) });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.acknowledged !== true) {
        await recordRejectedChange(session.id, 'acknowledgment-required', body.address);
        throw new Error('PAYOUT_ACK_REQUIRED');
      }
      if (!isValidKaspaMainnetAddress(body.address)) {
        await recordRejectedChange(session.id, 'invalid-mainnet-address', body.address);
        throw new Error('INVALID_KASPA_ADDRESS');
      }
      const address = normalizeKaspaAddress(body.address);
      if (identity) await requirePayoutAuthorization({ session, token: body.authorizationToken, operation: 'set', payoutAddress: address });
      const previousAddress = profile.payoutAddress || '';
      const now = Date.now();
      const addressChanged = previousAddress !== address;
      profile.payoutAddress = address;
      profile.payoutAddressSetAt = now;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (addressChanged ? 1 : 0);
      profile.payoutAddressEligibleAt = now + PAYOUT_CHANGE_COOLDOWN_MS;
      const ownershipVerified = Boolean(identity?.address && identity.address === address);
      let review = currentReview;
      let reviewCommands = [];
      if (addressChanged) {
        const mutations = [...recentMutations(profile, now), now];
        const reasons = payoutRiskReasons({ identity, ownershipVerified, previousAddress, address, mutations, now });
        review = reasons.length ? createPayoutReview({
          playerId,
          address,
          addressMasked: maskKaspaAddress(address),
          payoutVersion: profile.payoutAddressVersion,
          reasons,
          now
        }) : null;
        reviewCommands = payoutReviewWriteCommands(review, currentReview);
        profile.payoutMutationHistory = mutations;
        profile.payoutReviewId = review?.id || '';
        profile.payoutReviewStatus = review ? 'required' : 'not-required';
        profile.payoutRiskReasons = reasons;
        profile.payoutNotice = noticeFor({
          type: previousAddress ? 'changed' : 'created',
          now,
          version: profile.payoutAddressVersion,
          previousAddress,
          address,
          reviewRequired: Boolean(review),
          reasons
        });
      } else {
        profile.payoutNotice = noticeFor({
          type: 'reaffirmed',
          now,
          version: profile.payoutAddressVersion,
          previousAddress,
          address,
          reviewRequired: currentReview?.status === 'pending',
          reasons: currentReview?.reasons || profile.payoutRiskReasons || []
        });
      }
      const { audit } = await saveProfileWithAudit(playerId, profile, {
        type: previousAddress ? (previousAddress === address ? 'payout.destination.reaffirmed' : 'payout.destination.changed') : 'payout.destination.created',
        severity: 'warning',
        objectType: 'payout-profile',
        objectId: playerId,
        outcome: 'success',
        reason: previousAddress === address ? 'address-reconfirmed' : 'user-requested-change',
        details: {
          addressHash: hashAuditIdentifier(address),
          previousAddressHash: previousAddress ? hashAuditIdentifier(previousAddress) : '',
          version: profile.payoutAddressVersion,
          cooldownHours: 72,
          ownershipVerified,
          walletReauthenticated: Boolean(identity),
          settlementEnabled: false
        }
      }, reviewCommands);
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity, review), identity: identityView(identity), auditReceipt: auditReceipt(audit) });
    }

    if (req.method === 'DELETE') {
      if (identity) await requirePayoutAuthorization({ session, token: parseBody(req).authorizationToken, operation: 'remove' });
      const previousAddress = profile.payoutAddress || '';
      delete profile.payoutAddress;
      delete profile.payoutAddressSetAt;
      delete profile.payoutAddressEligibleAt;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (previousAddress ? 1 : 0);
      const now = Date.now();
      if (previousAddress) profile.payoutMutationHistory = [...recentMutations(profile, now), now];
      profile.payoutReviewId = '';
      profile.payoutReviewStatus = 'not-required';
      profile.payoutRiskReasons = [];
      profile.payoutNotice = noticeFor({ type: 'removed', now, version: profile.payoutAddressVersion, previousAddress });
      const { audit } = await saveProfileWithAudit(playerId, profile, {
        type: 'payout.destination.removed',
        severity: 'warning',
        objectType: 'payout-profile',
        objectId: playerId,
        outcome: 'success',
        reason: previousAddress ? 'user-requested-removal' : 'already-empty',
        details: {
          previousAddressHash: previousAddress ? hashAuditIdentifier(previousAddress) : '',
          version: profile.payoutAddressVersion,
          walletReauthenticated: Boolean(identity),
          settlementEnabled: false
        }
      }, payoutReviewWriteCommands(null, currentReview));
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity), identity: identityView(identity), auditReceipt: auditReceipt(audit) });
    }

    return methodNotAllowed(res, 'GET, POST, DELETE, OPTIONS');
  } catch (error) {
    return handleApiError(res, error);
  }
}
