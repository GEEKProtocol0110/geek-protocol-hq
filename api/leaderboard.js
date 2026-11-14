import { categories, handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { listLeaderboard, leaderboardStanding } from '../server/leaderboard.js';
import { playerIdFor, requireSession } from '../server/session.js';
import { rateLimit } from '../server/redis.js';
import { clientFingerprint } from '../server/http.js';
import { rankedSourceMode } from '../server/question-source.js';
import { currentSeasonNumber, leaderboardSeasonIds, leaderboardSeasonLabel } from '../server/seasons.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    await rateLimit('leaderboard-read', clientFingerprint(req), 90, 60);
    const category = categories.has(req.query?.category) ? req.query.category : 'kaspa';
    const mode = ['gauntlet', 'daily', 'speed'].includes(req.query?.mode) ? req.query.mode : 'gauntlet';
    const limit = req.query?.limit === '50' ? 50 : 10;
    const now = Date.now();
    // Viewable boards: Season 0 (legacy keys, history preserved) plus monthly
    // private seasons 1..current. Future or malformed ids are not listed.
    const seasonIds = leaderboardSeasonIds(now);
    // A misconfigured ranked source or season clock must not take the read-only
    // leaderboard down; "current" falls back to the legacy Season 0 board.
    const currentSeason = () => {
      try { return rankedSourceMode() === 'private' ? `season-${currentSeasonNumber(now)}` : 'legacy'; } catch { return 'legacy'; }
    };
    const requested = req.query?.season;
    const season = requested === 'current' ? currentSeason() : seasonIds.includes(requested) ? requested : 'legacy';
    const seasonLabels = Object.fromEntries(seasonIds.map(id => [id, leaderboardSeasonLabel(id)]));
    const mine = req.query?.mine === '1' ? await leaderboardStanding(category, mode, playerIdFor(await requireSession(req)), season) : undefined;
    return sendJson(res, 200, { ok: true, category, mode, verified: true, limit, season, seasonLabel: seasonLabels[season] || leaderboardSeasonLabel(season), seasons: ['current', ...seasonIds], seasonLabels, mine, entries: await listLeaderboard(category, mode, limit, season) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
