import { economyPolicy, powerups, treasuryAccounts } from '../public/economy/assets/catalog.js';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { isValidKaspaMainnetAddress } from './kaspa-address.js';
import { ledgerView, readLedger } from './economy-ledger.js';
import { playerIdFor, requireSession } from './session.js';
import { rateLimit } from './redis.js';

export const economyStatus = () => {
  const configured = process.env.GEEK_REWARD_RESERVE_ADDRESS || '';
  return { policy: economyPolicy, powerups, treasuryAccounts, reserve: { configuration: !configured ? 'not-configured' : isValidKaspaMainnetAddress(configured) ? 'address-configured' : 'invalid-address', fundingVerified: false, signingEnabled: false }, journal: 'planning-only', purchasesEnabled: false, payoutsEnabled: false, burnsEnabled: false };
};

export default async function economyHandler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST, OPTIONS');
  try {
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, economy: economyStatus() });
    const session = await requireSession(req);
    await rateLimit('economy', playerIdFor(session), 60, 600);
    const body = parseBody(req);
    if (body.action !== 'ledger') return sendJson(res, 409, { ok: false, code: 'ECONOMY_TRANSFERS_DISABLED', error: 'Purchases, payouts and burns are not enabled. No transaction was recorded.', purchasesEnabled: false, payoutsEnabled: false, burnsEnabled: false });
    return sendJson(res, 200, { ok: true, ledger: ledgerView(await readLedger(playerIdFor(session))) });
  } catch (error) {
    if (error.message.startsWith('ECONOMY_')) return sendJson(res, 503, { ok: false, code: 'ECONOMY_LEDGER_UNAVAILABLE', error: 'Your journal could not be verified. No funds moved. Please try again later.' });
    return handleApiError(res, error);
  }
}
