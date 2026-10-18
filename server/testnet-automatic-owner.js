import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { requireSession, playerIdFor } from './session.js';
import { rateLimit } from './redis.js';
import { automaticConfig, automaticError, automaticPlayerView, enrollAutomaticPlayer } from './testnet-automatic.js';
import { methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';

export async function ownerAutomaticHandler(req, res) {
  setApiHeaders(res, 'GET, POST'); res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const owner = await operationsSession(req);
    if (!owner) return sendJson(res, 401, { ok: false, error: 'Owner access required.' });
    if (!owner.permissions.includes('payout') || req.headers?.['sec-fetch-site'] === 'cross-site' ||
        ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h)) ||
        (req.headers?.origin && !operationsTrustedOrigin(req)) ||
        (req.method === 'POST' && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)))) return sendJson(res, 403, { ok: false, error: 'Owner payout access required.' });
    const session = await requireSession(req);
    await rateLimit('testnet-auto-owner', playerIdFor(session), 40, 600);
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action !== 'enroll') throw new Error('INVALID_REQUEST');
      await enrollAutomaticPlayer(session, body);
    }
    return sendJson(res, 200, { ok: true, config: automaticConfig(), ...await automaticPlayerView(session) });
  } catch (error) { return automaticError(res, error); }
}
