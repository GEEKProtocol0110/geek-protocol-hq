import { handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { auditStatus } from '../server/audit.js';
import { redis } from '../server/redis.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    await redis('PING');
    return sendJson(res, 200, { ok: true, service: 'community-alpha', storage: 'connected', audit: auditStatus() });
  } catch (error) {
    return handleApiError(res, error);
  }
}
