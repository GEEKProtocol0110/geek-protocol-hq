import { moderateContribution, moderationQueue, requireCceModerator } from '../server/cce.js';
import { recordAuditEvent } from '../server/audit.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { rateLimit } from '../server/redis.js';

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const actorId = clientFingerprint(req);
  try {
    requireCceModerator(req);
    await rateLimit('cce-moderation', actorId, 180, 60 * 10);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, queue: await moderationQueue() });
    if (req.method !== 'POST') return methodNotAllowed(res);
    const body = parseBody(req);
    const submission = await moderateContribution(body, { actorId, interactionId: body.id || actorId });
    return sendJson(res, 200, { ok: true, submission, queue: await moderationQueue() });
  } catch (error) {
    if (error?.message === 'CCE_FORBIDDEN') {
      try {
        await recordAuditEvent({
          type: 'cce.moderation.authorization-failed',
          severity: 'warning',
          actorType: 'network-client',
          actorId,
          objectType: 'moderation-console',
          objectId: 'cce',
          outcome: 'failure',
          reason: 'invalid-moderator-credential',
          interactionId: actorId
        });
      } catch {
        // Authentication failures must not disclose audit storage availability.
      }
    }
    return handleApiError(res, error);
  }
}
