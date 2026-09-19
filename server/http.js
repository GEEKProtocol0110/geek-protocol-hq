import { createHash, randomBytes } from 'node:crypto';

const SESSION_COOKIE = 'geek_session';
const SESSION_TTL = 60 * 60 * 24 * 30;

export const categories = new Set([
  'kaspa',
  'video-games',
  'science-fiction',
  'technology',
  'movies',
  'history',
  'comics',
  'pop-culture'
]);

export const setApiHeaders = (res, methods = 'GET, POST, OPTIONS') => {
  res.setHeader('Allow', methods);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options', 'nosniff');
};

export const sendJson = (res, status, body) => {
  res.status(status).json(body);
};

export const parseBody = (req) => {
  if (!req.body) return {};
  if (typeof req.body === 'object') return req.body;
  if (typeof req.body !== 'string' || req.body.length > 8_000) throw new Error('INVALID_BODY');
  try {
    return JSON.parse(req.body);
  } catch {
    throw new Error('INVALID_BODY');
  }
};

export const cleanName = (value, fallback = 'Guest Geek') => {
  const name = String(value || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24);
  return name || fallback;
};

const parseCookies = (header = '') => Object.fromEntries(header.split(';').map((part) => {
  const index = part.indexOf('=');
  if (index < 0) return ['', ''];
  return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
}).filter(([key]) => key));

export const readSessionId = (req) => {
  const value = parseCookies(req.headers?.cookie)[SESSION_COOKIE] || '';
  return /^[a-f0-9]{32}$/.test(value) ? value : '';
};

export const createSessionId = () => randomBytes(16).toString('hex');

export const clientFingerprint = (req) => {
  const forwarded = String(req.headers?.['x-forwarded-for'] || '').split(',')[0].trim();
  const address = forwarded || String(req.socket?.remoteAddress || 'unknown');
  const agent = String(req.headers?.['user-agent'] || '').slice(0, 160);
  return createHash('sha256').update(`${address}|${agent}`).digest('hex').slice(0, 24);
};

export const setSessionCookie = (res, sessionId) => {
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${sessionId}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`);
};

export const sessionTtl = SESSION_TTL;

export const methodNotAllowed = (res, methods = 'GET, POST, OPTIONS') => {
  setApiHeaders(res, methods);
  sendJson(res, 405, { ok: false, error: 'Method not allowed.' });
};

export const handleApiError = (res, error) => {
  const code = error?.message || 'UNKNOWN';
  if (code === 'REDIS_NOT_CONFIGURED') {
    return sendJson(res, 503, { ok: false, code: 'SERVICE_NOT_CONFIGURED', error: 'Community services are waiting for a database connection.' });
  }
  if (code === 'RATE_LIMITED') return sendJson(res, 429, { ok: false, error: 'Slow down and try again in a moment.' });
  if (code === 'SESSION_REQUIRED') return sendJson(res, 401, { ok: false, error: 'Start a player session first.' });
  if (code === 'RUN_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'That ranked run expired or is no longer active.' });
  if (code === 'RUN_STATE_INVALID') return sendJson(res, 409, { ok: false, error: 'That ranked action is not available right now.' });
  if (code === 'ANSWER_IN_PROGRESS') return sendJson(res, 409, { ok: false, error: 'That answer is already being locked. Retry once to retrieve its result.' });
  if (code === 'INSUFFICIENT_BALANCE') return sendJson(res, 409, { ok: false, code, error: 'Your server Alpha GEEK balance is too low for the next round.' });
  if (code === 'ROOM_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'That lobby is no longer active.' });
  if (code === 'ROOM_FULL') return sendJson(res, 409, { ok: false, error: 'That lobby is full.' });
  if (code === 'CCE_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'That contribution could not be found.' });
  if (code === 'CCE_DUPLICATE') return sendJson(res, 409, { ok: false, error: 'That question is already in the review pipeline.' });
  if (code === 'CCE_STATE_INVALID') return sendJson(res, 409, { ok: false, error: 'That contribution cannot take this action in its current state.' });
  if (code === 'CCE_INVALID_SUBMISSION') return sendJson(res, 400, { ok: false, error: 'Complete every field, use four unique answers, add an HTTPS source, and confirm original submission rights.' });
  if (code === 'CCE_FORBIDDEN') return sendJson(res, 403, { ok: false, error: 'Moderator access was not accepted.' });
  if (code === 'CCE_MODERATION_NOT_CONFIGURED') return sendJson(res, 503, { ok: false, code, error: 'The private moderation key has not been configured yet.' });
  if (code === 'AUDIT_FORBIDDEN') return sendJson(res, 403, { ok: false, error: 'Audit export access was not accepted.' });
  if (code === 'AUDIT_EXPORT_NOT_CONFIGURED') return sendJson(res, 503, { ok: false, code, error: 'The private audit export is not configured.' });
  if (code === 'INVALID_KASPA_ADDRESS') return sendJson(res, 400, { ok: false, code, error: 'Enter a valid Kaspa mainnet address beginning with kaspa:.' });
  if (code === 'PAYOUT_ACK_REQUIRED') return sendJson(res, 400, { ok: false, code, error: 'Confirm that you checked the payout address before saving it.' });
  if (code === 'DAILY_ALREADY_PLAYED') return sendJson(res, 409, { ok: false, code, error: 'Today’s verified Daily Signal has already been started. A new challenge unlocks at 00:00 UTC.' });
  if (code === 'INVALID_BODY' || code === 'INVALID_REQUEST') return sendJson(res, 400, { ok: false, error: 'The request was not valid.' });
  console.error('Geek API error', error);
  return sendJson(res, 500, { ok: false, error: 'The community service hit an unexpected error.' });
};
