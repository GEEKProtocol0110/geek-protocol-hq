import { categories, clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { rateLimit } from './redis.js';
import { requireSession, playerIdFor } from './session.js';
import { createRoyale, transitionRoyale, royaleView } from './royale.js';

const errors = {
  ROYALE_NOT_FOUND: [404, 'This Royale invitation has expired or was not found.'],
  ROYALE_NOT_PLAYER: [403, 'Join this Royale before viewing it. Your seat may have been removed.'],
  ROYALE_HOST_REQUIRED: [403, 'Only the host can start, remove seats or end this event. Hosts must end a room before leaving.'],
  ROYALE_FULL: [409, 'This Royale has reached the host’s chosen player limit.'],
  ROYALE_CLOSED: [409, 'The roster is locked after the host starts the event.'],
  ROYALE_NOT_READY: [409, 'At least two players must be online and everyone must ready up. Remove offline seats or wait.'],
  ROYALE_CHANGED: [409, 'That action belongs to a different event. Reload the room.'],
  ROYALE_QUESTION_CLOSED: [409, 'That question has closed. Refresh to see the next stage.'],
  ROYALE_ELIMINATED: [409, 'You are out of this event. Stay to watch the remaining Geeks.'],
  ROYALE_ANSWER_LOCKED: [409, 'Your first answer is locked. It cannot be changed.'],
  ROYALE_SNAPSHOT_INVALID: [503, 'This event’s question snapshot is unavailable. The action was not accepted.'],
  ROYALE_CONTENT_UNAVAILABLE: [503, 'This category does not have enough distinct questions for Royale.']
};
export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  if (req.method === 'POST') {
    const origin = String(req.headers?.origin || '');
    const host = String(req.headers?.['x-forwarded-host'] || req.headers?.host || '').toLowerCase();
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (origin && origin !== `https://${host}`)) {
      return sendJson(res, 403, { ok: false, error: 'Open Royale on this site before changing a room.' });
    }
    const type = String(req.headers?.['content-type'] || '');
    if (type && !/^application\/json(?:\s*;|$)/i.test(type)) {
      return sendJson(res, 400, { ok: false, error: 'Send a JSON Royale action.' });
    }
  }
  try {
    const session = await requireSession(req), playerId = playerIdFor(session);
    await rateLimit('royale', playerId, 60, 60);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const action = req.method === 'GET' ? 'view' : body.action;
    if (!['create', 'join', 'view', 'ready', 'start', 'answer', 'kick', 'cancel', 'leave'].includes(action)) throw new Error('INVALID_REQUEST');
    if (action === 'ready' && typeof body.ready !== 'boolean') throw new Error('INVALID_REQUEST');
    if (action === 'answer' && (!Number.isInteger(body.questionNumber) || body.questionNumber < 1 || body.questionNumber > 100 || !Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 3)) throw new Error('INVALID_REQUEST');
    if (action === 'kick' && (!Number.isInteger(body.slot) || body.slot < 1)) throw new Error('INVALID_REQUEST');
    let room;
    if (action === 'create') {
      if (!categories.has(body.category)) throw new Error('INVALID_REQUEST');
      const capacity = body.capacity ?? 100;
      if (!Number.isInteger(capacity) || capacity < 2 || capacity > 100) throw new Error('INVALID_REQUEST');
      await rateLimit('royale-create', playerId, 5, 3600);
      await rateLimit('royale-create-ip', clientFingerprint(req), 15, 3600);
      room = await createRoyale(session, body.category, capacity);
    } else {
      if (action === 'join') await rateLimit('royale-join-ip', clientFingerprint(req), 180, 60);
      room = await transitionRoyale(session, req.method === 'GET' ? req.query?.code : body.code, action, body);
    }
    return sendJson(res, action === 'create' ? 201 : 200, { ok: true, royale: await royaleView(room, session) });
  } catch (error) {
    const mapped = errors[error.message];
    if (mapped) return sendJson(res, mapped[0], { ok: false, code: error.message, error: mapped[1] });
    return handleApiError(res, error);
  }
}
