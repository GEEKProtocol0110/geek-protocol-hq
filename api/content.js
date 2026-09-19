import { createContribution, contributorDashboard, reviseContribution } from '../server/cce.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { rateLimit } from '../server/redis.js';
import { requireSession } from '../server/session.js';

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    if (req.method === 'GET') {
      await rateLimit('cce-dashboard', session.id, 90, 60);
      return sendJson(res, 200, { ok: true, ...(await contributorDashboard(session.id)) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res);
    await rateLimit('cce-contributor', session.id, 12, 60 * 60);
    await rateLimit('cce-network', clientFingerprint(req), 30, 60 * 60);
    const body = parseBody(req);
    const submission = body.action === 'revise'
      ? await reviseContribution(session, body)
      : body.action === 'submit'
        ? await createContribution(session, body)
        : (() => { throw new Error('INVALID_REQUEST'); })();
    return sendJson(res, body.action === 'submit' ? 201 : 200, { ok: true, submission, ...(await contributorDashboard(session.id)) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
