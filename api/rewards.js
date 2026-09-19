import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { hashAuditIdentifier, recordAuditEvent } from '../server/audit.js';
import { isValidKaspaMainnetAddress, maskKaspaAddress, normalizeKaspaAddress } from '../server/kaspa-address.js';
import { loadProfile, saveProfileWithAudit } from '../server/profile.js';
import { rateLimit } from '../server/redis.js';
import { requireSession } from '../server/session.js';

const PAYOUT_CHANGE_COOLDOWN_MS = 72 * 60 * 60 * 1000;

const payoutView = (profile) => ({
  address: profile.payoutAddress || '',
  maskedAddress: maskKaspaAddress(profile.payoutAddress),
  configuredAt: Number(profile.payoutAddressSetAt || 0),
  version: Number(profile.payoutAddressVersion || 0),
  changeCooldownUntil: Number(profile.payoutAddressEligibleAt || 0),
  network: 'kaspa-mainnet',
  status: profile.payoutAddress ? 'registered-alpha-unverified' : 'not-configured',
  ownershipVerified: false,
  settlementEligible: false,
  withdrawalsEnabled: false,
  protection: '72-hour-change-cooldown-before-future-settlement'
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
    await rateLimit('rewards', session.id, 30, 60 * 10);
    const profile = await loadProfile(session.id);

    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile) });
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
      const previousAddress = profile.payoutAddress || '';
      const now = Date.now();
      profile.payoutAddress = address;
      profile.payoutAddressSetAt = now;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (previousAddress === address ? 0 : 1);
      profile.payoutAddressEligibleAt = now + PAYOUT_CHANGE_COOLDOWN_MS;
      const { audit } = await saveProfileWithAudit(session.id, profile, {
        type: previousAddress ? (previousAddress === address ? 'payout.destination.reaffirmed' : 'payout.destination.changed') : 'payout.destination.created',
        severity: 'warning',
        objectType: 'payout-profile',
        objectId: session.id,
        outcome: 'success',
        reason: previousAddress === address ? 'address-reconfirmed' : 'user-requested-change',
        details: {
          addressHash: hashAuditIdentifier(address),
          previousAddressHash: previousAddress ? hashAuditIdentifier(previousAddress) : '',
          version: profile.payoutAddressVersion,
          cooldownHours: 72,
          ownershipVerified: false,
          settlementEnabled: false
        }
      });
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile), auditReceipt: auditReceipt(audit) });
    }

    if (req.method === 'DELETE') {
      const previousAddress = profile.payoutAddress || '';
      delete profile.payoutAddress;
      delete profile.payoutAddressSetAt;
      delete profile.payoutAddressEligibleAt;
      profile.payoutAddressVersion = Number(profile.payoutAddressVersion || 0) + (previousAddress ? 1 : 0);
      const { audit } = await saveProfileWithAudit(session.id, profile, {
        type: 'payout.destination.removed',
        severity: 'warning',
        objectType: 'payout-profile',
        objectId: session.id,
        outcome: 'success',
        reason: previousAddress ? 'user-requested-removal' : 'already-empty',
        details: {
          previousAddressHash: previousAddress ? hashAuditIdentifier(previousAddress) : '',
          version: profile.payoutAddressVersion,
          settlementEnabled: false
        }
      });
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile), auditReceipt: auditReceipt(audit) });
    }

    return methodNotAllowed(res, 'GET, POST, DELETE, OPTIONS');
  } catch (error) {
    return handleApiError(res, error);
  }
}
