import { createHash } from 'node:crypto';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { pipeline, rateLimit, redis } from './redis.js';
import { operationsJsonRequest, operationsSession, operationsTrustedOrigin } from './operations-access.js';
import { auditWriteCommands, createAuditRecord } from './audit.js';

export const contributionKinds = ['questions', 'testing', 'art', 'development', 'community', 'fund-support', 'other'];
export const communityPrefix = () => `geek:${String(process.env.VERCEL_ENV || 'development').replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'development'}:community:v1`;
const key = suffix => `${communityPrefix()}:${suffix}`;
const applicationKey = id => key(`application:${id}`);
const creditKey = id => key(`credit:${id}`);
const pendingKey = () => key('pending');
const creditsKey = () => key('credits');
const ID = /^app_[a-f0-9]{32}$/;
const TTL = 90 * 86400;
const text = (value, min, max) => {
  if (typeof value !== 'string' || value.length > max || /[<>\u0000-\u0008\u000b-\u001f\u007f]/.test(value)) throw new Error('COMMUNITY_INVALID');
  const clean = value.trim();
  if (clean.length < min) throw new Error('COMMUNITY_INVALID');
  return clean;
};
export const contributionLink = value => {
  if (value === '') return '';
  const raw = text(value, 8, 400);
  try { const url = new URL(raw); if (url.protocol === 'https:' && !url.username && !url.password) return url.href; } catch { /* Fail closed. */ }
  throw new Error('COMMUNITY_INVALID');
};
const unknown = (body, allowed) => Object.keys(body).some(name => !allowed.includes(name));
const validate = body => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('COMMUNITY_INVALID');
  if (unknown(body, ['requestId', 'name', 'profile', 'kind', 'details', 'evidence', 'recognition', 'consent', 'website']) || !/^[a-f0-9-]{36}$/.test(body.requestId || '') || body.website !== '' || !contributionKinds.includes(body.kind) || typeof body.recognition !== 'boolean' || typeof body.consent !== 'boolean' || (body.recognition && !body.consent)) throw new Error('COMMUNITY_INVALID');
  return { name: text(body.name, 2, 48), profile: contributionLink(body.profile), kind: body.kind, details: text(body.details, 20, 1200), evidence: contributionLink(body.evidence), recognition: body.recognition, consent: body.consent };
};
const parse = raw => { try { return JSON.parse(raw); } catch { throw new Error('COMMUNITY_STORAGE'); } };
const validApplication = row => row?.version === 1 && ID.test(row.id) && Number.isSafeInteger(row.revision) && row.revision > 0 && ['pending', 'closed', 'published'].includes(row.status) && /^[a-f0-9]{64}$/.test(row.payloadHash || '') && Number.isSafeInteger(row.createdAt) && contributionKinds.includes(row.kind);
const publicCredit = row => {
  if (row?.version !== 1 || !ID.test(row.id) || !Number.isSafeInteger(row.revision) || row.revision < 1 || !Number.isSafeInteger(row.publishedAt) || !contributionKinds.includes(row.kind)) throw new Error('COMMUNITY_STORAGE');
  // Explicit projection: application details, evidence and owner notes stay private.
  return { id: row.id, revision: row.revision, name: text(row.name, 2, 48), profile: contributionLink(row.profile), kind: row.kind, summary: text(row.summary, 12, 500), publishedAt: row.publishedAt };
};
const CREATE = `
-- geek-community-create-v1
local old = redis.call('GET', KEYS[1])
if old then return 'CHANGED' end
for _,i in ipairs({2,4}) do local t=redis.call('TYPE',KEYS[i]).ok; if t~='none' and t~='zset' then return 'STORAGE' end end
if redis.call('EXISTS',KEYS[3])==1 then return 'STORAGE' end
redis.call('ZREMRANGEBYSCORE',KEYS[2],'-inf',ARGV[7])
if redis.call('ZCARD',KEYS[2])>=500 then return 'FULL' end
redis.call('SET',KEYS[1],ARGV[1],'EX',ARGV[2])
redis.call('ZADD',KEYS[2],ARGV[3],ARGV[4])
redis.call('SET',KEYS[3],ARGV[5])
redis.call('ZADD',KEYS[4],ARGV[6],ARGV[8])
return 'OK'
`;
const DECIDE = `
-- geek-community-decide-v1
if (redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 'CHANGED' end
if redis.call('EXISTS',KEYS[3])==1 then return 'CHANGED' end
for _,i in ipairs({2,4,6}) do local t=redis.call('TYPE',KEYS[i]).ok; if t~='none' and t~='zset' then return 'STORAGE' end end
if redis.call('EXISTS',KEYS[5])==1 then return 'STORAGE' end
if ARGV[5]~='' and redis.call('ZCARD',KEYS[4])>=200 then return 'FULL' end
redis.call('SET',KEYS[1],ARGV[2],'EX',ARGV[3])
redis.call('ZREM',KEYS[2],ARGV[4])
if ARGV[5]~='' then redis.call('SET',KEYS[3],ARGV[5]); redis.call('ZADD',KEYS[4],ARGV[6],ARGV[4]) end
redis.call('SET',KEYS[5],ARGV[7]); redis.call('ZADD',KEYS[6],ARGV[8],ARGV[9])
return 'OK'
`;
const WITHDRAW = `
-- geek-community-withdraw-v1
if (redis.call('GET',KEYS[1]) or '')~=ARGV[1] then return 'CHANGED' end
for _,i in ipairs({2,4}) do local t=redis.call('TYPE',KEYS[i]).ok; if t~='none' and t~='zset' then return 'STORAGE' end end
if redis.call('EXISTS',KEYS[3])==1 then return 'STORAGE' end
redis.call('DEL',KEYS[1]); redis.call('ZREM',KEYS[2],ARGV[2])
redis.call('SET',KEYS[3],ARGV[3]); redis.call('ZADD',KEYS[4],ARGV[4],ARGV[5])
return 'OK'
`;
const audit = (req, id, action) => createAuditRecord({ type: `community.${action}`, actorType: action === 'application.received' ? 'visitor' : 'ops-owner', actorId: clientFingerprint(req), objectType: 'community-contribution', objectId: id, reason: action, outcome: 'success' });
const resultCheck = result => { if (result !== 'OK') throw new Error(result === 'FULL' ? 'COMMUNITY_FULL' : result === 'CHANGED' ? 'COMMUNITY_CHANGED' : 'COMMUNITY_STORAGE'); };
const receipt = row => ({ ok: true, receipt: { id: row.id, status: row.status, submittedAt: row.createdAt } });
const existingApplication = async id => {
  const raw = await redis('GET', applicationKey(id));
  if (!raw) return null;
  const row = parse(raw); if (!validApplication(row) || row.id !== id) throw new Error('COMMUNITY_STORAGE');
  return { raw, row };
};
const submit = async (req, body) => {
  const data = validate(body), fingerprint = clientFingerprint(req);
  const id = 'app_' + createHash('sha256').update(`${communityPrefix()}|${fingerprint}|${body.requestId}`).digest('hex').slice(0, 32);
  const payloadHash = createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const previous = await existingApplication(id);
  if (previous) { if (previous.row.payloadHash !== payloadHash) throw new Error('COMMUNITY_CHANGED'); return receipt(previous.row); }
  await rateLimit('community-apply', fingerprint, 3, 600);
  await rateLimit('community-apply-day', fingerprint, 12, 86400);
  const now = Date.now(), row = { version: 1, id, revision: 1, status: 'pending', createdAt: now, payloadHash, ...data };
  const event = await audit(req, id, 'application.received'), [a, b] = auditWriteCommands(event);
  const result = await redis('EVAL', CREATE, 4, applicationKey(id), pendingKey(), a[1], b[1], JSON.stringify(row), TTL, now, id, JSON.stringify(event), event.sequence, now - TTL * 1000, event.eventId);
  if (result === 'CHANGED') { const saved = await existingApplication(id); if (saved?.row.payloadHash === payloadHash) return receipt(saved.row); }
  resultCheck(result); return receipt(row);
};
const pageOffset = req => {
  const raw = req.query?.offset === undefined ? '0' : String(req.query.offset);
  if (!/^\d{1,4}$/.test(raw) || Number(raw) > 500) throw new Error('COMMUNITY_INVALID');
  return Number(raw);
};
const page = async (view, offset, limit) => {
  if (view === 'pending') await redis('ZREMRANGEBYSCORE', pendingKey(), '-inf', Date.now() - TTL * 1000);
  const ids = await redis('ZREVRANGE', view === 'pending' ? pendingKey() : creditsKey(), offset, offset + limit);
  if (!Array.isArray(ids) || ids.some(id => !ID.test(id))) throw new Error('COMMUNITY_STORAGE');
  const rows = ids.length ? await pipeline(ids.slice(0, limit).map(id => ['GET', view === 'pending' ? applicationKey(id) : creditKey(id)])) : [];
  const items = rows.flatMap((raw, index) => {
    if (!raw) return [];
    const row = parse(raw);
    if (row.id !== ids[index]) throw new Error('COMMUNITY_STORAGE');
    if (view !== 'pending') return [publicCredit(row)];
    if (!validApplication(row) || row.status !== 'pending') throw new Error('COMMUNITY_STORAGE');
    // Private owner projection excludes replay hashes and rate-limit identifiers.
    return [{ id: row.id, revision: row.revision, name: row.name, profile: row.profile, kind: row.kind, details: row.details, evidence: row.evidence, recognition: row.recognition, consent: row.consent, createdAt: row.createdAt }];
  });
  return { items, hasMore: ids.length > limit, offset };
};
const decide = async (req, body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('COMMUNITY_INVALID');
  if (unknown(body, ['id', 'action', 'expectedRevision', 'note', 'summary', 'confirmed']) || !ID.test(body.id || '') || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 || !['close', 'publish', 'withdraw'].includes(body.action)) throw new Error('COMMUNITY_INVALID');
  const note = text(body.note, 8, 500);
  if (body.action === 'withdraw') {
    if (body.confirmed !== true) throw new Error('COMMUNITY_INVALID');
    const raw = await redis('GET', creditKey(body.id)); if (!raw) throw new Error('COMMUNITY_CHANGED');
    const row = publicCredit(parse(raw)); if (row.revision !== body.expectedRevision) throw new Error('COMMUNITY_CHANGED');
    const event = await audit(req, body.id, 'credit.withdrawn'), [a, b] = auditWriteCommands(event);
    resultCheck(await redis('EVAL', WITHDRAW, 4, creditKey(body.id), creditsKey(), a[1], b[1], raw, body.id, JSON.stringify(event), event.sequence, event.eventId));
    return { ok: true, decision: 'withdrawn' };
  }
  const saved = await existingApplication(body.id);
  if (!saved || saved.row.status !== 'pending' || saved.row.revision !== body.expectedRevision) throw new Error('COMMUNITY_CHANGED');
  const row = saved.row, now = Date.now(); let publicRow = null;
  if (body.action === 'publish') {
    if (!row.recognition || !row.consent || body.confirmed !== true) throw new Error('COMMUNITY_INVALID');
    publicRow = { version: 1, id: row.id, revision: 1, name: text(row.name, 2, 48), profile: contributionLink(row.profile), kind: row.kind, summary: text(body.summary, 12, 500), publishedAt: now };
  }
  const next = { ...row, revision: row.revision + 1, status: publicRow ? 'published' : 'closed', reviewedAt: now, reviewNote: note };
  const event = await audit(req, row.id, publicRow ? 'credit.published' : 'application.closed'), [a, b] = auditWriteCommands(event);
  resultCheck(await redis('EVAL', DECIDE, 6, applicationKey(row.id), pendingKey(), creditKey(row.id), creditsKey(), a[1], b[1], saved.raw, JSON.stringify(next), publicRow ? TTL : 30 * 86400, row.id, publicRow ? JSON.stringify(publicRow) : '', now, JSON.stringify(event), event.sequence, event.eventId));
  return { ok: true, decision: next.status };
};
const errors = (res, error) => {
  if (error.message === 'COMMUNITY_INVALID') return sendJson(res, 400, { ok: false, error: 'Check the fields, use public HTTPS links and confirm the required consent.' });
  if (error.message === 'COMMUNITY_CHANGED') return sendJson(res, 409, { ok: false, error: 'This request has changed or was already reviewed. Refresh before trying again.' });
  if (['COMMUNITY_STORAGE', 'COMMUNITY_FULL'].includes(error.message)) return sendJson(res, 503, { ok: false, error: 'Community contributions are temporarily unavailable. Please try later or contact the Geek community.' });
  return handleApiError(res, error);
};
export const publicCommunityHandler = async (req, res) => {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') { const result = await page('published', pageOffset(req), 20); return sendJson(res, 200, { ok: true, credits: result.items, hasMore: result.hasMore }); }
    if (req.method !== 'POST') return methodNotAllowed(res, 'GET, POST, OPTIONS');
    if (!operationsTrustedOrigin(req) || !operationsJsonRequest(req) || req.headers?.['sec-fetch-site'] === 'cross-site') return sendJson(res, 403, { ok: false, error: 'Submit from the Geek website.' });
    return sendJson(res, 200, await submit(req, parseBody(req)));
  } catch (error) { return errors(res, error); }
};
export const ownerCommunityHandler = async (req, res) => {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    if (!await operationsSession(req)) return sendJson(res, 401, { ok: false, error: 'Sign in to review community contributions.' });
    if (req.headers?.['sec-fetch-site'] === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req))) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
    if (req.method === 'GET') { const view = req.query?.view || 'pending'; if (!['pending', 'published'].includes(view)) throw new Error('COMMUNITY_INVALID'); return sendJson(res, 200, { ok: true, view, ...await page(view, pageOffset(req), 50) }); }
    if (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)) return sendJson(res, 403, { ok: false, error: 'Access was not accepted.' });
    await rateLimit('community-owner', clientFingerprint(req), 30, 60);
    return sendJson(res, 200, await decide(req, parseBody(req)));
  } catch (error) { return errors(res, error); }
};
