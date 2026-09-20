import { recordAuditEvent } from '../server/audit.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { decidePayoutReview, listPayoutReviews, requirePayoutReviewer } from '../server/payout-review.js';
import { rateLimit } from '../server/redis.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  const actorId = clientFingerprint(req);
  try {
    requirePayoutReviewer(req);
    await rateLimit('payout-review', actorId, 120, 60 * 10);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, settlementEnabled: false, queue: await listPayoutReviews() });
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST, OPTIONS');
    const body = parseBody(req);
    const result = await decidePayoutReview(body, { actorId, interactionId: body.id || actorId });
    return sendJson(res, 200, {
      ok: true,
      settlementEnabled: false,
      review: result.review,
      auditReceipt: { eventId: result.audit.eventId, sequence: result.audit.sequence, integrity: result.audit.integrity.algorithm }
    });
  } catch (error) {
    if (error?.message === 'PAYOUT_REVIEW_FORBIDDEN') {
      try {
        await recordAuditEvent({
          type: 'payout.review.authorization-failed',
          severity: 'warning',
          actorType: 'network-client',
          actorId,
          objectType: 'payout-review-console',
          objectId: 'payout-review',
          outcome: 'failure',
          reason: 'invalid-reviewer-credential',
          interactionId: actorId
        });
      } catch {
        // Authentication failures do not disclose audit storage availability.
      }
    }
    return handleApiError(res, error);
  }
}
