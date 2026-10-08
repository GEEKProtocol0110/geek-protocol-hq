import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { redis, rateLimit } from './redis.js';
import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { auditWriteCommands, createAuditRecord } from './audit.js';
import { effectiveHoliday, holidayById, upcomingHolidayWindows, HOLIDAY_TIMEZONE } from '../public/assets/holiday-calendar.js';

export const appearanceKey = () => `geek:${String(process.env.VERCEL_ENV || 'development').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 24) || 'development'}:appearance:v1`;
const DEFAULT = Object.freeze({ version: 1, revision: 0, mode: 'off', holiday: null, updatedAt: 0 });
const SAVE_SCRIPT = `
-- geek-appearance-save-v1
local previous = redis.call('GET', KEYS[1]) or ''
if previous ~= ARGV[1] then return 'CHANGED' end
if redis.call('EXISTS', KEYS[2]) == 1 then return 'AUDIT_CONFLICT' end
local indexType = redis.call('TYPE', KEYS[3]).ok
if indexType ~= 'none' and indexType ~= 'zset' then return 'AUDIT_INVALID' end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])
return 'OK'
`;
const validConfig = c => c && c.version === 1 && Number.isSafeInteger(c.revision) && c.revision > 0 && ['off', 'auto', 'manual'].includes(c.mode) && (c.mode === 'manual' ? Boolean(holidayById(c.holiday)) : c.holiday === null) && Number.isSafeInteger(c.updatedAt) && c.updatedAt > 0;
export const loadAppearance = async () => {
  const raw = await redis('GET', appearanceKey());
  if (raw === null) return { raw: '', config: { ...DEFAULT } };
  let config;
  try { config = JSON.parse(raw); } catch { throw new Error('APPEARANCE_STATE_INVALID'); }
  if (!validConfig(config)) throw new Error('APPEARANCE_STATE_INVALID');
  return { raw, config };
};
const view = config => ({ config, active: effectiveHoliday(config), upcoming: upcomingHolidayWindows(), timeZone: HOLIDAY_TIMEZONE });
const errors = (res, error) => {
  if (error.message === 'APPEARANCE_STATE_INVALID') return sendJson(res, 503, { ok: false, error: 'Holiday settings could not be read safely. Saved settings have not been replaced.' });
  if (error.message === 'APPEARANCE_CHANGED') return sendJson(res, 409, { ok: false, error: 'Holiday settings changed in another window. Refresh settings before saving again.' });
  if (error.message === 'APPEARANCE_AUDIT_FAILED') return sendJson(res, 503, { ok: false, error: 'The appearance change could not be recorded. Refresh settings before trying again.' });
  if (error.message === 'APPEARANCE_INVALID') return sendJson(res, 400, { ok: false, error: 'Choose Off, Automatic, or a listed holiday, then refresh if needed.' });
  return handleApiError(res, error);
};
export const publicAppearanceHandler = async (req, res) => {
  setApiHeaders(res, 'GET, HEAD, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'HEAD'].includes(req.method)) return methodNotAllowed(res, 'GET, HEAD, OPTIONS');
  try {
    const { config } = await loadAppearance();
    const active = effectiveHoliday(config);
    const theme = active ? { id: active.id } : null;
    res.setHeader('Cache-Control', 'public, max-age=30, s-maxage=30');
    if (req.method === 'HEAD') return res.status(200).end();
    // Only an allowlisted decoration identifier is public, never owner records.
    return sendJson(res, 200, { ok: true, theme });
  } catch (error) { return errors(res, error); }
};
export const ownerAppearanceHandler = async (req, res) => {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const session = await operationsSession(req);
    if (!session) return sendJson(res, 401, { ok: false, error: 'Sign in to change holiday settings.' });
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req))) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, ...view((await loadAppearance()).config) });
    if (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
    await rateLimit('appearance-owner-write', clientFingerprint(req), 12, 60);
    const body = parseBody(req);
    if (Object.keys(body).some(key => !['mode', 'holiday', 'expectedRevision'].includes(key)) || !['off', 'auto', 'manual'].includes(body.mode) || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || (body.mode === 'manual' ? !holidayById(body.holiday) : body.holiday !== null)) throw new Error('APPEARANCE_INVALID');
    const { raw, config } = await loadAppearance();
    if (body.expectedRevision !== config.revision) throw new Error('APPEARANCE_CHANGED');
    const next = { version: 1, revision: config.revision + 1, mode: body.mode, holiday: body.holiday, updatedAt: Date.now() };
    const audit = await createAuditRecord({ type: 'appearance.holiday.changed', actorType: 'ops-owner', actorId: clientFingerprint(req), objectType: 'site-appearance', objectId: appearanceKey(), outcome: 'success', reason: 'owner-selected-holiday-style', details: { mode: next.mode, holiday: next.holiday || 'none', revision: next.revision } });
    const [eventWrite, indexWrite] = auditWriteCommands(audit);
    const result = await redis('EVAL', SAVE_SCRIPT, 3, appearanceKey(), eventWrite[1], indexWrite[1], raw, JSON.stringify(next), JSON.stringify(audit), audit.sequence, audit.eventId);
    if (result === 'AUDIT_INVALID' || result === 'AUDIT_CONFLICT') throw new Error('APPEARANCE_AUDIT_FAILED');
    if (result !== 'OK') throw new Error('APPEARANCE_CHANGED');
    return sendJson(res, 200, { ok: true, ...view(next) });
  } catch (error) { return errors(res, error); }
};
