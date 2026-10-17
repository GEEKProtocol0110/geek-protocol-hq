import { readFile } from 'node:fs/promises';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { redis, rateLimit } from './redis.js';
import { operationsConfig as config, operationsEqual as equal, operationsCookieId as cookieId, operationsSessionKey as keyFor, setOperationsCookie as setCookie, operationsTrustedOrigin as trustedOrigin, operationsJsonRequest, operationsSession, createOperationsSession } from './operations-access.js';
import { recordAuditEvent } from './audit.js';
import { ownerAppearanceHandler } from './appearance.js';
import { consumeOperationsCode } from './operations-mfa.js';
import { ownerCommunityHandler } from './community-contributions.js';
import { operationsAttentionHandler } from './operations-attention.js';
import { importedReviewHandler } from './imported-review.js';
import { testnetRewardsHandler } from './testnet-rewards.js';
import { operationsMonitorHandler } from './operations-monitor.js';
import { operationsStressHandler } from './operations-stress.js';
import { aceReadiness } from './ace-tutor.js';

const files = new Map([
  ['', ['index.html', 'text/html; charset=utf-8']],
  ['index', ['index.html', 'text/html; charset=utf-8']],
  ['index.html', ['index.html', 'text/html; charset=utf-8']],
  ...['questions', 'activity', 'payouts', 'appearance', 'community'].flatMap(page => [page, `${page}/index`, `${page}/index.html`].map(path => [path, [`${page}/index.html`, 'text/html; charset=utf-8']])),
  ['imported', ['imported/index.html', 'text/html; charset=utf-8']],
  ['assets/imported.js', ['assets/imported.js', 'text/javascript; charset=utf-8']],
  ['testnet', ['testnet/index.html', 'text/html; charset=utf-8']],
  ['assets/testnet.js', ['assets/testnet.js', 'text/javascript; charset=utf-8']],
  ['ace', ['ace/index.html', 'text/html; charset=utf-8']],
  ['assets/ace.js', ['assets/ace.js', 'text/javascript; charset=utf-8']],
  ['monitor', ['monitor/index.html', 'text/html; charset=utf-8']],
  ['stress', ['stress/index.html', 'text/html; charset=utf-8']],
  ['assets/stress.js', ['assets/stress.js', 'text/javascript; charset=utf-8']],
  ['assets/monitor.js', ['assets/monitor.js', 'text/javascript; charset=utf-8']],
  ['assets/ops.js', ['assets/ops.js', 'text/javascript; charset=utf-8']],
  ['assets/ops-core.js', ['assets/ops-core.js', 'text/javascript; charset=utf-8']],
  ['assets/appearance.js', ['assets/appearance.js', 'text/javascript; charset=utf-8']],
  ['assets/community.js', ['assets/community.js', 'text/javascript; charset=utf-8']],
  ['assets/attention.js', ['assets/attention.js', 'text/javascript; charset=utf-8']],
  ['assets/ops.css', ['assets/ops.css', 'text/css; charset=utf-8']]
]);
const event = (req, type, outcome) => recordAuditEvent({ type, outcome, severity: outcome === 'failure' ? 'warning' : 'info', actorType: 'ops-key-holder', actorId: clientFingerprint(req), objectType: 'operations-access', objectId: 'ops', reason: outcome === 'failure' ? 'access-not-accepted' : 'access-session-transition' });

export default async function operationsHandler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Vary', 'Cookie');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const action = typeof req.query?.action === 'string' ? req.query.action : '';
  try {
    if (action === 'ace') {
      if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
      if (!await operationsSession(req)) return sendJson(res, 401, { ok: false, error: 'Sign in to check A.C.E. readiness.' });
      if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !trustedOrigin(req)) || ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h))) return sendJson(res, 403, { ok: false, error: 'Owner access is required.' });
      await rateLimit('ops-ace', clientFingerprint(req), 40, 600);
      try { return sendJson(res, 200, { ok: true, checkedAt: Date.now(), readiness: await aceReadiness() }); }
      catch { return sendJson(res, 503, { ok: false, error: 'A.C.E. readiness could not be checked. No readiness is assumed.' }); }
    }
    if (action === 'appearance') return ownerAppearanceHandler(req, res);
    if (action === 'community') return ownerCommunityHandler(req, res);
    if (action === 'attention') return operationsAttentionHandler(req, res);
    if (action === 'imported') return importedReviewHandler(req, res);
    if (action === 'testnet') return testnetRewardsHandler(req, res);
    if (action === 'monitor') return operationsMonitorHandler(req, res);
    if (action === 'stress') return operationsStressHandler(req, res);
    if (action === 'login' || action === 'logout') {
      if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
      if (!trustedOrigin(req) || !operationsJsonRequest(req)) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
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
      if (typeof body.key !== 'string' || body.key.length > 512 || !equal(body.key, current.key) || !await consumeOperationsCode(current, body.code)) {
        await event(req, 'ops.access.login', 'failure');
        return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
      }
      // Audit acceptance before creating a session. Storage failure fails closed.
      await event(req, 'ops.access.login', 'success');
      await createOperationsSession(req, res, current);
      return sendJson(res, 200, { ok: true });
    }
    if (!['GET', 'HEAD'].includes(req.method)) return methodNotAllowed(res, 'GET, HEAD');
    const rawPath = req.query?.path ?? '';
    if (typeof rawPath !== 'string') return sendJson(res, 404, { ok: false, error: 'Not found.' });
    const requestedPath = rawPath.replace(/^\/+|\/+$/g, '');
    if (action !== 'status' && !files.has(requestedPath)) return sendJson(res, 404, { ok: false, error: 'Not found.' });
    const session = await operationsSession(req);
    if (!session) {
      if (files.get(requestedPath)?.[1].startsWith('text/html')) {
        if (action !== 'status') { res.setHeader('Location', '/ops-login/'); return res.status(303).end(); }
      }
      return sendJson(res, 401, { ok: false, error: 'Sign in to open Operations.' });
    }
    if (action === 'status') return sendJson(res, 200, { ok: true, authenticated: true, role: 'owner', permissions: session.permissions, expiresAt: session.expiresAt, mfaEnabled: Boolean(config().totpSecret) });
    if (action) return sendJson(res, 400, { ok: false, error: 'Invalid request.' });
    const [filename, contentType] = files.get(requestedPath);
    const content = await readFile(new URL(`ops-ui/${filename}`, import.meta.url));
    res.setHeader('Content-Type', contentType);
    return res.status(200).end(req.method === 'HEAD' ? undefined : content);
  } catch (error) {
    if (['OPS_NOT_CONFIGURED', 'OPS_MFA_UNAVAILABLE'].includes(error.message)) return sendJson(res, 503, { ok: false, error: 'Private operator access is unavailable.' });
    return handleApiError(res, error);
  }
}
