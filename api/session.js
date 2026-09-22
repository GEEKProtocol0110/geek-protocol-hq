import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { rateLimit } from '../server/redis.js';
import { upsertSession } from '../server/session.js';
import { collectiblesHandler, profileHandler } from '../server/player-api.js';

export default async function handler(req, res) {
  if (req.query?.service === 'profile') return profileHandler(req, res);
  if (req.query?.service === 'collectibles') return collectiblesHandler(req, res);
  setApiHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');
  try {
    const body = parseBody(req);
    const session = await upsertSession(req, res, body.displayName);
    await rateLimit('session', session.id, 40, 60);
    await rateLimit('session-ip', clientFingerprint(req), 60, 60 * 10);
    return sendJson(res, 200, { ok: true, player: { name: session.name, createdAt: session.createdAt } });
  } catch (error) {
    return handleApiError(res, error);
  }
}
