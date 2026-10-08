import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseStoredJson, redis } from './redis.js';

export const OPERATIONS_TTL = 30 * 60;
const COOKIE = '__Host-geek_ops';
const SESSION_ID = /^[a-f0-9]{64}$/;
const roles = { cce: 'CCE_ADMIN_TOKEN', audit: 'AUDIT_ADMIN_TOKEN', payout: 'PAYOUT_REVIEW_ADMIN_TOKEN' };
export const operationsPermissions = () => Object.entries(roles).filter(([, name]) => String(process.env[name] || '').length >= 24).map(([role]) => role);
export const operationsConfig = () => {
  // The current sole owner can keep using the CCE key. Separate it before sharing CCE access.
  const key = String(process.env.OPS_ACCESS_TOKEN === undefined ? process.env.CCE_ADMIN_TOKEN || '' : process.env.OPS_ACCESS_TOKEN);
  const secret = String(process.env.AUDIT_LOG_SECRET || '');
  if (key.length < 24 || key.length > 512 || secret.length < 32) throw new Error('OPS_NOT_CONFIGURED');
  const credentials = Object.values(roles).map(name => String(process.env[name] || ''));
  return { key, fingerprint: createHmac('sha256', secret).update(JSON.stringify(['geek-ops-owner-v2', key, ...credentials])).digest('hex') };
};
export const operationsEqual = (a, b) => {
  const x = Buffer.from(String(a || '')), y = Buffer.from(String(b || ''));
  return x.length === y.length && timingSafeEqual(x, y);
};
export const operationsCookieId = req => {
  const matches = String(req.headers?.cookie || '').split(';').map(part => part.trim()).filter(part => part.startsWith(COOKIE + '='));
  if (matches.length !== 1) return '';
  const id = matches[0].slice(COOKIE.length + 1);
  return SESSION_ID.test(id) ? id : '';
};
export const operationsSessionKey = id => `geek:ops:session:${id}`;
export const setOperationsCookie = (res, id = '') => res.setHeader('Set-Cookie', `${COOKIE}=${id}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${id ? OPERATIONS_TTL : 0}`);
export const operationsTrustedOrigin = req => {
  const candidate = String(req.headers?.origin || '');
  const allowed = ['https://www.geekprotocol.xyz', 'https://geekprotocol.xyz', ...String(process.env.OPS_ALLOWED_ORIGINS || '').split(','), ...[process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL].filter(Boolean).map(host => `https://${host}`)].map(value => value.trim()).filter(Boolean);
  return allowed.some(value => {
    try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash && url.origin === candidate; }
    catch { return false; }
  });
};
export const operationsJsonRequest = req => String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase() === 'application/json';
export const operationsSession = async req => {
  const id = operationsCookieId(req);
  if (!id) return null;
  const current = operationsConfig(), record = parseStoredJson(await redis('GET', operationsSessionKey(id)));
  // Older page-only sessions must reauthenticate; they never inherit owner permissions.
  if (record?.version !== 2 || record.role !== 'owner' || !Array.isArray(record.permissions) || !record.permissions.every(role => Object.hasOwn(roles, role))) return null;
  if (!Number.isSafeInteger(record.expiresAt) || record.expiresAt <= Date.now() || record.expiresAt > Date.now() + OPERATIONS_TTL * 1000 || !operationsEqual(record.configFingerprint, current.fingerprint)) return null;
  return record;
};
export const createOperationsSession = async (req, res, current) => {
  const previous = operationsCookieId(req), id = randomBytes(32).toString('hex');
  if (previous) await redis('DEL', operationsSessionKey(previous));
  const saved = await redis('SET', operationsSessionKey(id), JSON.stringify({ version: 2, role: 'owner', permissions: operationsPermissions(), expiresAt: Date.now() + OPERATIONS_TTL * 1000, configFingerprint: current.fingerprint }), 'EX', OPERATIONS_TTL, 'NX');
  if (saved !== 'OK') throw new Error('OPS_SESSION_UNAVAILABLE');
  setOperationsCookie(res, id);
};
export const requireOperationsRole = async (req, role, requireToken) => {
  if (!Object.hasOwn(roles, role)) throw new Error('OPS_ROLE_FORBIDDEN');
  // Explicit API credentials retain their existing role checks; a wrong key cannot fall back to the cookie.
  const credentialHeaders = ['x-cce-admin', 'x-audit-admin', 'x-payout-review-admin', 'authorization'];
  if (String(process.env[roles[role]] || '').length < 24 || credentialHeaders.some(header => Object.hasOwn(req.headers || {}, header))) return requireToken(req);
  const session = await operationsSession(req);
  if (!session?.permissions.includes(role)) return requireToken(req);
  if (String(req.headers?.['sec-fetch-site'] || '') === 'cross-site' || (req.headers?.origin && !operationsTrustedOrigin(req))) throw new Error('OPS_ROLE_FORBIDDEN');
  if (!['GET', 'HEAD'].includes(req.method) && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req))) throw new Error('OPS_ROLE_FORBIDDEN');
};
