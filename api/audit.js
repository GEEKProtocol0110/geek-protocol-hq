import { auditStatus, listAuditEvents, requireAuditViewer, verifyAuditRecord } from '../server/audit.js';
import { handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    requireAuditViewer(req);
    const offset = Math.max(0, Number(req.query?.offset || 0));
    const limit = Math.max(1, Math.min(100, Number(req.query?.limit || 100)));
    const events = await listAuditEvents({ offset, limit });
    return sendJson(res, 200, {
      ok: true,
      status: auditStatus(),
      page: { offset, limit, returned: events.length },
      integrity: {
        verified: events.every(verifyAuditRecord),
        firstSequence: events.at(-1)?.sequence || null,
        lastSequence: events[0]?.sequence || null
      },
      events
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
