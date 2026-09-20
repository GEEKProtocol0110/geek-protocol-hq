import { handleApiError, methodNotAllowed, sendJson, setApiHeaders } from '../server/http.js';
import { geekMintInscription, loadGeekMintStatus } from '../server/mint.js';

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    const fresh = req.query?.fresh === '1';
    const status = await loadGeekMintStatus({ force: fresh });
    res.setHeader('Cache-Control', fresh ? 'no-store, max-age=0' : 'public, s-maxage=10, stale-while-revalidate=30');
    return sendJson(res, 200, {
      ok: true,
      ...status,
      transaction: {
        wallet: 'Kasware',
        type: 3,
        inscription: geekMintInscription(),
        userApprovalRequired: true,
        custodial: false,
        priorityFeeKas: '0'
      }
    });
  } catch (error) {
    return handleApiError(res, error);
  }
}
