import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { rateLimit } from './redis.js';
import { defaultStressScenario, parseStressScenario, stressExamples } from './economy-stress.js';

export async function operationsStressHandler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const owner = await operationsSession(req);
    if (!owner) return sendJson(res, 401, { ok: false, error: 'Sign in to open the economy stress lab.' });
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req)) ||
        ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h)) ||
        (req.method === 'POST' && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)))) return sendJson(res, 403, { ok: false, error: 'Owner planning access is required.' });
    await rateLimit('ops-economy-stress', clientFingerprint(req), 30, 600);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, examples: stressExamples(), defaults: defaultStressScenario() });
    // This endpoint calculates only. It cannot append a journal, edit a profile, queue rewards or change configuration.
    return sendJson(res, 200, { ok: true, result: parseStressScenario(parseBody(req)) });
  } catch (error) {
    if (error.message === 'STRESS_CREDIT_CEILING') return sendJson(res, 400, { ok: false, error: 'This credit path exceeds the live profile counter ceiling. No grants are modeled beyond that safe-integer boundary.' });
    if (error.message === 'STRESS_SUPPLY_EXCEEDED') return sendJson(res, 400, { ok: false, error: 'The opening reserve plus this batch of fees exceeds the token supply. This model does not recirculate tokens within a batch.' });
    if (error.message.startsWith('STRESS_') || error.message === 'ECONOMY_AMOUNT_INVALID') return sendJson(res, 400, { ok: false, error: 'Use whole credit/count values, up to one million completions or claims, and exact token amounts with at most eight decimals. Reward size must be positive.' });
    return handleApiError(res, error);
  }
}
