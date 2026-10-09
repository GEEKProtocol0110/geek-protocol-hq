import { clientFingerprint, handleApiError, methodNotAllowed, sendJson } from './http.js';
import { rateLimit } from './redis.js';
import { operationsSession, operationsTrustedOrigin } from './operations-access.js';
import { moderationAttention } from './cce.js';
import { pendingContributionAttention } from './community-contributions.js';

export const operationsAttentionHandler = async (req, res) => {
  try {
    if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
    const session = await operationsSession(req);
    if (!session) return sendJson(res, 401, { ok: false, error: 'Sign in to check waiting reviews.' });
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req))) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
    await rateLimit('ops-attention', clientFingerprint(req), 60, 600);
    const canReview = session.permissions.includes('cce');
    const [hall, questions] = await Promise.allSettled([
      pendingContributionAttention(),
      canReview ? moderationAttention() : Promise.resolve(null)
    ]);
    return sendJson(res, 200, {
      ok: true,
      checkedAt: Date.now(),
      hall: hall.status === 'fulfilled' ? { status: 'ready', ...hall.value } : { status: 'unavailable' },
      questions: !canReview ? { status: 'access-unavailable' } : questions.status === 'fulfilled' ? { status: 'ready', ...questions.value } : { status: 'unavailable' }
    });
  } catch (error) { return handleApiError(res, error); }
};
