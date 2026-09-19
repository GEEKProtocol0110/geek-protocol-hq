import { moderateContribution, moderationQueue, requireCceModerator } from '../server/cce.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { rateLimit } from '../server/redis.js';

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    requireCceModerator(req);
    await rateLimit('cce-moderation', clientFingerprint(req), 180, 60 * 10);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, queue: await moderationQueue() });
    if (req.method !== 'POST') return methodNotAllowed(res);
    const submission = await moderateContribution(parseBody(req));
    return sendJson(res, 200, { ok: true, submission, queue: await moderationQueue() });
  } catch (error) {
    return handleApiError(res, error);
  }
}
