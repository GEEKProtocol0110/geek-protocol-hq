import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseStoredJson, pipeline, redis } from './redis.js';

const AUDIT_EVENT_PREFIX = 'geek:audit:event:';
const AUDIT_EVENT_INDEX = 'geek:audit:index';
const AUDIT_SEQUENCE = 'geek:audit:sequence';
const EVENT_TYPE = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;
const MAX_DETAILS = 24;
const MAX_TEXT = 180;

const eventKey = (eventId) => `${AUDIT_EVENT_PREFIX}${eventId}`;
const auditSecret = () => String(process.env.AUDIT_LOG_SECRET || '');
const cleanText = (value, maximum = MAX_TEXT) => String(value ?? '')
  .replace(/[\u0000-\u001f\u007f]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()
  .slice(0, maximum);

const canonicalValue = (value) => {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalValue(value[key])]));
  }
  return value;
};

const canonicalJson = (value) => JSON.stringify(canonicalValue(value));

const sanitizeDetails = (details = {}) => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) return {};
  const result = {};
  for (const [rawKey, rawValue] of Object.entries(details).slice(0, MAX_DETAILS)) {
    const key = cleanText(rawKey, 48).replace(/[^a-zA-Z0-9_.-]/g, '_');
    if (!key || /(?:secret|token|cookie|authorization|private|mnemonic|signature|rawAddress)/i.test(key)) continue;
    if (typeof rawValue === 'boolean' || typeof rawValue === 'number') result[key] = rawValue;
    else if (typeof rawValue === 'string') result[key] = cleanText(rawValue);
    else if (Array.isArray(rawValue)) result[key] = rawValue.slice(0, 12).map((item) => cleanText(item, 80));
  }
  return result;
};

const digestFor = (record, algorithm = auditIntegrityMode()) => {
  const payload = canonicalJson(record);
  if (algorithm === 'hmac-sha256') return createHmac('sha256', auditSecret()).update(payload).digest('hex');
  return createHash('sha256').update(payload).digest('hex');
};

export const auditIntegrityMode = () => auditSecret().length >= 32 ? 'hmac-sha256' : 'sha256-alpha';

export const hashAuditIdentifier = (value) => createHash('sha256')
  .update(`geek-protocol-audit-v1|${String(value || 'unknown')}`)
  .digest('hex');

export const createAuditRecord = async ({
  type,
  severity = 'info',
  actorType = 'system',
  actorId = 'geek-protocol',
  objectType = 'service',
  objectId = 'geek-protocol-hq',
  outcome = 'success',
  reason = '',
  interactionId = '',
  details = {}
}) => {
  const normalizedType = cleanText(type, 96).toLowerCase();
  if (!EVENT_TYPE.test(normalizedType)) throw new Error('AUDIT_EVENT_INVALID');
  const sequence = Number(await redis('INCR', AUDIT_SEQUENCE));
  const core = {
    schemaVersion: '1.0',
    eventId: `aud_${randomBytes(12).toString('hex')}`,
    sequence,
    occurredAt: Date.now(),
    service: 'geek-protocol-hq',
    environment: cleanText(process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown', 32),
    type: normalizedType,
    severity: ['info', 'warning', 'critical'].includes(severity) ? severity : 'info',
    actor: { type: cleanText(actorType, 48), idHash: hashAuditIdentifier(actorId) },
    object: { type: cleanText(objectType, 48), idHash: hashAuditIdentifier(objectId) },
    outcome: ['success', 'failure', 'deferred'].includes(outcome) ? outcome : 'failure',
    reason: cleanText(reason, 120),
    interactionId: interactionId ? hashAuditIdentifier(interactionId) : '',
    details: sanitizeDetails(details)
  };
  const algorithm = auditIntegrityMode();
  return {
    ...core,
    integrity: {
      algorithm,
      keyId: algorithm === 'hmac-sha256' ? cleanText(process.env.AUDIT_KEY_ID || 'primary', 48) : 'alpha-unkeyed',
      digest: digestFor(core, algorithm)
    }
  };
};

export const auditWriteCommands = (record) => [
  ['SET', eventKey(record.eventId), JSON.stringify(record), 'NX'],
  ['ZADD', AUDIT_EVENT_INDEX, record.sequence, record.eventId]
];

export const recordAuditEvent = async (input) => {
  const record = await createAuditRecord(input);
  await pipeline(auditWriteCommands(record), true);
  return record;
};

export const verifyAuditRecord = (record) => {
  if (!record?.integrity?.digest || !record.integrity.algorithm) return false;
  const { integrity, ...core } = record;
  if (integrity.algorithm === 'hmac-sha256' && auditSecret().length < 32) return false;
  if (!['hmac-sha256', 'sha256-alpha'].includes(integrity.algorithm)) return false;
  const expected = Buffer.from(digestFor(core, integrity.algorithm), 'hex');
  const actual = Buffer.from(String(integrity.digest), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
};

export const listAuditEvents = async ({ offset = 0, limit = 100 } = {}) => {
  const safeOffset = Math.max(0, Math.min(10_000, Number(offset) || 0));
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 100));
  const ids = await redis('ZREVRANGE', AUDIT_EVENT_INDEX, safeOffset, safeOffset + safeLimit - 1);
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', eventKey(id)])) : [];
  return stored.map(parseStoredJson).filter(Boolean);
};

const providedAuditToken = (req) => {
  const explicit = String(req.headers?.['x-audit-admin'] || '');
  const authorization = String(req.headers?.authorization || '');
  return explicit || (authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
};

export const requireAuditViewer = (req) => {
  const expected = String(process.env.AUDIT_ADMIN_TOKEN || '');
  const provided = providedAuditToken(req);
  if (expected.length < 24) throw new Error('AUDIT_EXPORT_NOT_CONFIGURED');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) throw new Error('AUDIT_FORBIDDEN');
};

export const auditStatus = () => ({
  schemaVersion: '1.0',
  integrityMode: auditIntegrityMode(),
  keyedIntegrityConfigured: auditIntegrityMode() === 'hmac-sha256',
  exportConfigured: String(process.env.AUDIT_ADMIN_TOKEN || '').length >= 24,
  payoutReviewConfigured: String(process.env.PAYOUT_REVIEW_ADMIN_TOKEN || '').length >= 24,
  settlementEnabled: false,
  independentAudit: 'not-completed'
});
