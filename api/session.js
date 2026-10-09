import { cleanName, clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { rateLimit } from '../server/redis.js';
import { readSession, upsertSession } from '../server/session.js';
import { collectiblesHandler, profileHandler } from '../server/player-api.js';
import vaultHandler from '../server/vault.js';
import economyHandler from '../server/economy.js';
import prestigeHandler from '../server/prestige.js';
import operationsHandler from '../server/operations.js';
import { publicAppearanceHandler } from '../server/appearance.js';
import { publicCommunityHandler } from '../server/community-contributions.js';

export default async function handler(req, res) {
  if (req.query?.service === 'community') return publicCommunityHandler(req, res);
  if (req.query?.service === 'appearance') return publicAppearanceHandler(req, res);
  if (req.query?.service === 'operations') return operationsHandler(req, res);
  if (req.query?.service === 'prestige') return prestigeHandler(req, res);
  if (req.query?.service === 'economy') return economyHandler(req, res);
  if (req.query?.service === 'vault') return vaultHandler(req, res);
  if (req.query?.service === 'profile') return profileHandler(req, res);
  if (req.query?.service === 'collectibles') return collectiblesHandler(req, res);
  setApiHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');
  try {
    const body = parseBody(req);
    const existing = await readSession(req);
    if (body.action === 'rename') {
      if (!existing) throw new Error('SESSION_REQUIRED');
      if (typeof body.displayName !== 'string' || body.displayName.length > 24 || !cleanName(body.displayName, '')) {
        return sendJson(res, 400, { ok: false, error: 'Enter a profile name with 1–24 characters.' });
      }
    }
    // A shared network can onboard a 100-player event without disabling per-player limits.
    const fingerprint = clientFingerprint(req);
    await rateLimit('session-ip', fingerprint, 600, 60 * 10);
    if (!existing) await rateLimit('session-create-ip', fingerprint, 120, 60 * 10);
    if (existing) await rateLimit('session', existing.id, 40, 60);
    const session = await upsertSession(req, res, body.displayName);
    if (!existing) await rateLimit('session', session.id, 40, 60);
    return sendJson(res, 200, { ok: true, player: { name: session.name, createdAt: session.createdAt } });
  } catch (error) {
    return handleApiError(res, error);
  }
}
