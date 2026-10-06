import { createDuel, duelView, transitionDuel } from './duel.js';
import { categories, clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  try {
    const session = await requireSession(req);
    const playerId = playerIdFor(session);
    await rateLimit('duel', playerId, 60, 60);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const action = req.method === 'GET' ? 'view' : body.action;
    const code = String(req.method === 'GET' ? req.query?.code || '' : body.code || '').trim().toUpperCase();
    let duel;
    if (action === 'create') {
      await rateLimit('duel-create', playerId, 10, 3600);
      await rateLimit('duel-create-ip', clientFingerprint(req), 20, 3600);
      if (!categories.has(body.category)) throw new Error('INVALID_REQUEST');
      if (body.opponent !== undefined && !['player', 'ace'].includes(body.opponent)) throw new Error('INVALID_REQUEST');
      if (body.difficulty !== undefined && body.opponent !== 'ace') throw new Error('INVALID_REQUEST');
      duel = await createDuel(session, body.category, body.opponent || 'player', body.difficulty ?? 'operator');
    } else {
      if (action === 'rematch') await rateLimit('duel-rematch', playerId, 15, 3600);
      duel = await transitionDuel(session, code, action, body);
    }
    return sendJson(res, action === 'create' ? 201 : 200, { ok: true, duel: duelView(duel, session) });
  } catch (error) { return handleApiError(res, error); }
}
