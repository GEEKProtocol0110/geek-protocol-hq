import { randomBytes } from 'node:crypto';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { redis, rateLimit } from './redis.js';
import { probeProduction, validMonitorReport, MONITOR_FRESH_MS, monitorChecks } from './production-monitor.js';

export const monitorHistoryKey = 'geek:production-monitor:history:v1';
export const monitorLockKey = 'geek:production-monitor:lock:v1';
const SAVE = `-- geek-production-monitor-save-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('LPUSH',KEYS[2],ARGV[2])
redis.call('LTRIM',KEYS[2],0,24)
redis.call('EXPIRE',KEYS[2],604800)
return 1`;
export async function operationsMonitorHandler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const owner = await operationsSession(req);
    if (!owner) return sendJson(res, 401, { ok: false, error: 'Sign in to open production monitoring.' });
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req)) ||
      ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h)) ||
      (req.method === 'POST' && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)))) return sendJson(res, 403, { ok: false, error: 'Owner monitoring access is required.' });
    await rateLimit('ops-monitor-read', clientFingerprint(req), 40, 600);
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action !== 'run' || Object.keys(body).some(k => k !== 'action')) throw new Error('INVALID_REQUEST');
      await rateLimit('ops-monitor-run', clientFingerprint(req), 3, 600);
      const lock = randomBytes(12).toString('hex');
      if (await redis('SET', monitorLockKey, lock, 'EX', 30, 'NX') !== 'OK') return sendJson(res, 409, { ok: false, error: 'A production check just started. Wait thirty seconds and refresh its saved result.' });
      const report = await probeProduction();
      if (!validMonitorReport(report)) throw new Error('MONITOR_STATE_INVALID');
      // Keep the 30-second lock after completion to bound bursts and uncertain-response retries.
      if (Number(await redis('EVAL', SAVE, 2, monitorLockKey, monitorHistoryKey, lock, JSON.stringify(report))) !== 1) throw new Error('MONITOR_STATE_INVALID');
      return sendJson(res, 200, { ok: true, report, serverNow: Date.now(), freshnessMs: MONITOR_FRESH_MS });
    }
    const raw = await redis('LRANGE', monitorHistoryKey, 0, 24);
    if (!Array.isArray(raw)) throw new Error('MONITOR_STATE_INVALID');
    const history = raw.map(value => { let report; try { report = JSON.parse(value); } catch { throw new Error('MONITOR_STATE_INVALID'); } if (!validMonitorReport(report)) throw new Error('MONITOR_STATE_INVALID'); return report; });
    return sendJson(res, 200, { ok: true, history, serverNow: Date.now(), freshnessMs: MONITOR_FRESH_MS, checks: monitorChecks.map(({ id, name }) => ({ id, name })) });
  } catch (error) {
    if (error.message.startsWith('MONITOR_')) return sendJson(res, 503, { ok: false, error: 'Monitor evidence could not be verified. Existing results are preserved.' });
    return handleApiError(res, error);
  }
}
