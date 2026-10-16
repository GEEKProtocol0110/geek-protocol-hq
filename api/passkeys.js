import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { requireSession } from '../server/session.js';
import { rateLimit } from '../server/redis.js';
import { passkeyAction, passkeyContext, passkeyStatus } from '../server/passkeys.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET','POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST, OPTIONS');
  try {
    passkeyContext(req);
    const session = await requireSession(req);
    await rateLimit('passkey-session', session.id, 30, 600);
    await rateLimit('passkey-client', clientFingerprint(req), 60, 600);
    const result = req.method === 'GET' ? await passkeyStatus(session) : await passkeyAction(req, res, session, parseBody(req));
    return sendJson(res, 200, { ok: true, ...result });
  } catch (error) {
    if (error.message.startsWith('PASSKEY_')) return sendJson(res, error.message === 'PASSKEY_STATE_INVALID' ? 503 : 400, { ok: false, code: error.message,
      error: error.message === 'PASSKEY_REAUTH_REQUIRED' ? 'Sign in again with an existing passkey or verify your linked wallet before changing passkeys.' : 'Passkey verification was not completed. Your saved player has not been replaced. Try again or use your linked wallet.' });
    if (!['SESSION_REQUIRED','SESSION_STATE_INVALID','REDIS_NOT_CONFIGURED','RATE_LIMITED','INVALID_BODY','IDENTITY_STATE_INVALID'].includes(error.message)) return sendJson(res, 400, { ok: false, error: 'The passkey was not verified. Try again or choose wallet sign-in.' });
    return handleApiError(res, error);
  }
}
