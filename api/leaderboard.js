import { categories, handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { SEASON_LABELS, listLeaderboard, leaderboardStanding } from '../server/leaderboard.js';
import { playerIdFor, requireSession } from '../server/session.js';
import { rateLimit } from '../server/redis.js';
import { clientFingerprint } from '../server/http.js';
import { rankedSourceMode } from '../server/question-source.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    await rateLimit('leaderboard-read', clientFingerprint(req), 90, 60);
    const category = categories.has(req.query?.category) ? req.query.category : 'kaspa';
    const mode = ['gauntlet', 'daily', 'speed'].includes(req.query?.mode) ? req.query.mode : 'gauntlet';
    const limit = req.query?.limit === '50' ? 50 : 10;
    // Default board is Season 0 — Public-bank Alpha (legacy keys, history preserved).
    const season = req.query?.season === 'current'
      ? rankedSourceMode() === 'private' ? 'season-1' : 'legacy'
      : Object.hasOwn(SEASON_LABELS, req.query?.season) ? req.query.season : 'legacy';
    const mine = req.query?.mine === '1' ? await leaderboardStanding(category, mode, playerIdFor(await requireSession(req)), season) : undefined;
    return sendJson(res, 200, { ok: true, category, mode, verified: true, limit, season, seasonLabel: SEASON_LABELS[season], mine, entries: await listLeaderboard(category, mode, limit, season) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
