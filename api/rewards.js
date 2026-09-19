import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { hashAuditIdentifier, recordAuditEvent } from '../server/audit.js';
import { identityView, loadIdentity, requirePayoutAuthorization } from '../server/identity.js';
import { isValidKaspaMainnetAddress, maskKaspaAddress, normalizeKaspaAddress } from '../server/kaspa-address.js';
import { loadProfile, saveProfileWithAudit } from '../server/profile.js';
import { rateLimit } from '../server/redis.js';
import { playerIdFor, requireSession } from '../server/session.js';

const PAYOUT_CHANGE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

const payoutView = (profile, identity) => {
  const ownershipVerified = Boolean(identity?.address && identity.address === profile.payoutAddress);
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
    protection: identity ? 'wallet-signature-and-72-hour-change-cooldown' : '72-hour-change-cooldown-before-future-settlement'
  });
};

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

    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity), identity: identityView(identity) });
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
      profile.payoutAddress = address;
      profile.payoutAddressSetAt = now;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (previousAddress === address ? 0 : 1);
      profile.payoutAddressEligibleAt = now + PAYOUT_CHANGE_COOLDOWN_MS;
      const ownershipVerified = Boolean(identity?.address && identity.address === address);
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
      });
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity), identity: identityView(identity), auditReceipt: auditReceipt(audit) });
    }

    if (req.method === 'DELETE') {
      if (identity) await requirePayoutAuthorization({ session, token: parseBody(req).authorizationToken, operation: 'remove' });
      const previousAddress = profile.payoutAddress || '';
      delete profile.payoutAddress;
      delete profile.payoutAddressSetAt;
      delete profile.payoutAddressEligibleAt;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (previousAddress ? 1 : 0);
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
      });
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile, identity), identity: identityView(identity), auditReceipt: auditReceipt(audit) });
    }

    return methodNotAllowed(res, 'GET, POST, DELETE, OPTIONS');
  } catch (error) {
    return handleApiError(res, error);
  }
}
