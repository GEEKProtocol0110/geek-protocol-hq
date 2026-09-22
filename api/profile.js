import { handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { loadProfile } from '../server/profile.js';
import { buildJourneyProfile } from '../server/progression.js';
import { playerIdFor, requireSession } from '../server/session.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    const session = await requireSession(req);
    const profile = await loadProfile(playerIdFor(session));
    return sendJson(res, 200, { ok: true, verified: true, profile: buildJourneyProfile(profile, session) });
  } catch (error) {
    return handleApiError(res, error);
  }
}

