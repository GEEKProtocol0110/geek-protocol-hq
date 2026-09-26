import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { createMatch, loadMatch, matchView, submitMatchAnswer } from '../server/lobby-game.js';
import { pipeline, rateLimit, redis } from '../server/redis.js';
import { requireSession } from '../server/session.js';

const codePattern = /^GEEK-[A-Z2-9]{6}$/;
const PRESENCE_WINDOW = 45_000;

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    const body = req.method === 'POST' ? parseBody(req) : {};
    const code = String(req.method === 'GET' ? req.query?.code : body.code || '').trim().toUpperCase();
    if (!codePattern.test(code)) throw new Error('ROOM_NOT_FOUND');
    const room = JSON.parse(await redis('GET', `geek:lobby:${code}`) || 'null');
    if (!room) throw new Error('ROOM_NOT_FOUND');

    if (req.method === 'GET') {
      await rateLimit('lobby-game-view', session.id, 30, 60);
      const match = await loadMatch(code);
      return sendJson(res, 200, { ok: true, match: matchView(match, session.id) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST, OPTIONS');
    await rateLimit('lobby-game-action', session.id, 25, 60);
    if (body.action === 'start') {
      await rateLimit('lobby-game-start-ip', clientFingerprint(req), 15, 60 * 60);
      if (room.hostId !== session.id) throw new Error('MATCH_HOST_REQUIRED');
      const ids = await redis('ZRANGEBYSCORE', `geek:lobby:${code}:presence`, Date.now() - PRESENCE_WINDOW, '+inf');
      if (!Array.isArray(ids) || ids.length < 2 || !ids.includes(session.id)) throw new Error('MATCH_PLAYERS_REQUIRED');
      const names = await pipeline(ids.slice(0, room.seats).map((id) => ['HGET', `geek:lobby:${code}:members`, id]));
      const roster = ids.slice(0, room.seats).map((id, index) => ({ id, name: JSON.parse(names[index] || 'null')?.name || 'Guest Geek' }));
      const match = await createMatch({ code, category: room.category, focus: room.focus, roster });
      return sendJson(res, 201, { ok: true, match: matchView(match, session.id) });
    }
    if (body.action === 'answer') {
      const match = await loadMatch(code);
      if (!match) throw new Error('MATCH_NOT_FOUND');
      const result = await submitMatchAnswer({ code, match, sessionId: session.id, questionNumber: Number(body.questionNumber), selectedIndex: Number(body.selectedIndex) });
      const latest = await loadMatch(code);
      return sendJson(res, 200, { ok: true, result, match: matchView(latest, session.id) });
    }
    throw new Error('INVALID_REQUEST');
  } catch (error) {
    return handleApiError(res, error);
  }
}
