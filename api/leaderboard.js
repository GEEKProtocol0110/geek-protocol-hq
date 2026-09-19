import { categories, handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { listLeaderboard } from '../server/leaderboard.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    const category = categories.has(req.query?.category) ? req.query.category : 'kaspa';
    const mode = ['gauntlet', 'daily', 'speed'].includes(req.query?.mode) ? req.query.mode : 'gauntlet';
    return sendJson(res, 200, { ok: true, category, mode, verified: true, entries: await listLeaderboard(category, mode) });
  } catch (error) {
    return handleApiError(res, error);
  }
}
