import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { parseStoredJson, redis, rateLimit } from './redis.js';
import { recordAuditEvent } from './audit.js';

const COOKIE = '__Host-geek_ops';
const TTL = 30 * 60;
const SESSION_ID = /^[a-f0-9]{64}$/;
const files = new Map([
  ['', ['index.html', 'text/html; charset=utf-8']],
  ['index', ['index.html', 'text/html; charset=utf-8']],
  ['index.html', ['index.html', 'text/html; charset=utf-8']],
  ['assets/ops.js', ['assets/ops.js', 'text/javascript; charset=utf-8']],
  ['assets/ops-core.js', ['assets/ops-core.js', 'text/javascript; charset=utf-8']],
  ['assets/ops.css', ['assets/ops.css', 'text/css; charset=utf-8']]
]);
const config = () => {
  // Sole-operator bootstrap. Set a dedicated key before sharing moderator access.
  const key = String(process.env.OPS_ACCESS_TOKEN === undefined ? process.env.CCE_ADMIN_TOKEN || '' : process.env.OPS_ACCESS_TOKEN);
  const secret = String(process.env.AUDIT_LOG_SECRET || '');
  if (key.length < 24 || key.length > 512 || secret.length < 32) throw new Error('OPS_NOT_CONFIGURED');
  return { key, fingerprint: createHmac('sha256', secret).update(`geek-ops-config-v1|${key}`).digest('hex') };
};
const equal = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
};
const cookieId = req => {
  const matches = String(req.headers?.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1) return '';
  const id = matches[0].slice(COOKIE.length + 1);
  return SESSION_ID.test(id) ? id : '';
};
const keyFor = id => `geek:ops:session:${id}`;
const setCookie = (res, id = '') => res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${id ? TTL : 0}`);
const trustedOrigin = req => {
  const candidate = String(req.headers?.origin || '');
  const allowed = [
    'https://www.geekprotocol.xyz', 'https://geekprotocol.xyz',
    ...String(process.env.OPS_ALLOWED_ORIGINS || '').split(','),
    ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)
  ].map(value => value.trim()).filter(Boolean);
  return allowed.some(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && url.origin === candidate; }
    catch { return false; }
  });
};
const authorized = async req => {
  const id = cookieId(req);
  if (!id) return false;
  const current = config(), record = parseStoredJson(await redis('GET', keyFor(id)));
  return record?.version === 1 && Number.isSafeInteger(record.expiresAt) && record.expiresAt > Date.now() && record.expiresAt <= Date.now() + TTL * 1000 && equal(record.configFingerprint, current.fingerprint);
};
const event = (req, type, outcome) => recordAuditEvent({ type, outcome, severity: outcome === 'failure' ? 'warning' : 'info', actorType: 'ops-key-holder', actorId: clientFingerprint(req), objectType: 'operations-access', objectId: 'ops', reason: outcome === 'failure' ? 'access-not-accepted' : 'access-session-transition' });

export default async function operationsHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  try {
    if (action === 'login' || action === 'logout') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      if (!trustedOrigin(req) || String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase() !== 'application/json') return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
      await rateLimit('ops-access', clientFingerprint(req), 10, 600);
      const body = parseBody(req);
      if (action === 'logout') {
        const id = cookieId(req);
        if (id) await redis('DEL', keyFor(id));
        setCookie(res);
        // Logout works even after key rotation; the cookie cannot restore a revoked session.
        try { await event(req, 'ops.access.logout', 'success'); } catch { /* No credential data is logged. */ }
        return sendJson(res, 200, { ok: true });
      }
      const current = config();
      if (typeof body.key !== 'string' || body.key.length > 512 || !equal(body.key, current.key)) {
        await event(req, 'ops.access.login', 'failure');
        return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
      }
      // Audit acceptance before creating a session. Storage failure fails closed.
      await event(req, 'ops.access.login', 'success');
      const previous = cookieId(req), id = randomBytes(32).toString('hex');
      if (previous) await redis('DEL', keyFor(previous));
      const saved = await redis('SET', keyFor(id), JSON.stringify({ version: 1, expiresAt: Date.now() + TTL * 1000, configFingerprint: current.fingerprint }), 'EX', TTL, 'NX');
      if (saved !== 'OK') throw new Error('OPS_SESSION_UNAVAILABLE');
      setCookie(res, id);
      return sendJson(res, 200, { ok: true });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return methodNotAllowed(res, 'GET, HEAD');
    const rawPath = req.query?.path ?? '';
    if (typeof rawPath !== 'string') return sendJson(res, 404, { ok: false, error: 'Not found.' });
    const requestedPath = rawPath.replace(/^\/+|\/+$/g, '');
    if (action !== 'status' && !files.has(requestedPath)) return sendJson(res, 404, { ok: false, error: 'Not found.' });
    if (!await authorized(req)) {
      if (!requestedPath || ['index', 'index.html'].includes(requestedPath)) {
        if (action !== 'status') { res.setHeader('Location', '/ops-login/'); return res.status(303).end(); }
      }
      return sendJson(res, 401, { ok: false, error: 'Sign in to open Operations.' });
    }
    if (action === 'status') return sendJson(res, 200, { ok: true, authenticated: true });
    if (action) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
    const [filename, contentType] = files.get(requestedPath);
    const content = await readFile(new URL(`ops-ui/${filename}`, import.meta.url));
    res.setHeader('Content-Type', contentType);
    return res.status(200).end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (error.message === 'OPS_NOT_CONFIGURED') return sendJson(res, 503, { ok: false, error: 'Private operator access is unavailable.' });
    return handleApiError(res, error);
  }
}
