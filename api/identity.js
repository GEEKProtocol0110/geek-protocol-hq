import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { createIdentityChallenge, identityStatus, verifyIdentityChallenge } from '../server/identity.js';
import { rateLimit } from '../server/redis.js';
import { playerIdFor, requireSession } from '../server/session.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    await rateLimit('identity-player', playerIdFor(session), 30, 60 * 10);
    await rateLimit('identity-client', clientFingerprint(req), 50, 60 * 10);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, identity: await identityStatus(session) });
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST, OPTIONS');
    const body = parseBody(req);
    if (body.action === 'challenge') {
      const challenge = await createIdentityChallenge({
        req,
        session,
        address: body.address,
        publicKey: body.publicKey,
        intent: body.intent,
        operation: body.operation,
        payoutAddress: body.payoutAddress
      });
      return sendJson(res, 201, { ok: true, challenge });
    }
    if (body.action === 'verify') {
      const result = await verifyIdentityChallenge({ req, session, challengeId: body.challengeId, signature: body.signature });
      return sendJson(res, 200, { ok: true, ...result });
    }
    throw new Error('INVALID_REQUEST');
  } catch (error) {
    return handleApiError(res, error);
  }
}
