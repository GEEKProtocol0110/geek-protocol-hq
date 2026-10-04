import { categories, handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { listLeaderboard, leaderboardStanding } from '../server/leaderboard.js';
import { playerIdFor, requireSession } from '../server/session.js';
import { rateLimit } from '../server/redis.js';
import { clientFingerprint } from '../server/http.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    await rateLimit('leaderboard-read', clientFingerprint(req), 90, 60);
    const category = categories.has(req.query?.category) ? req.query.category : 'kaspa';
    const mode = ['gauntlet', 'daily', 'speed'].includes(req.query?.mode) ? req.query.mode : 'gauntlet';
    const limit = req.query?.limit === '50' ? 50 : 10;
    const mine = req.query?.mine === '1' ? await leaderboardStanding(category, mode, playerIdFor(await requireSession(req))) : undefined;
    return sendJson(res, 200, { ok: true, category, mode, verified: true, limit, mine, entries: await listLeaderboard(category, mode, limit) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
