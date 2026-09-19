import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { isValidKaspaMainnetAddress, maskKaspaAddress, normalizeKaspaAddress } from '../server/kaspa-address.js';
import { loadProfile, saveProfile } from '../server/profile.js';
import { rateLimit } from '../server/redis.js';
import { requireSession } from '../server/session.js';

const payoutView = (profile) => ({
  address: profile.payoutAddress || '',
  maskedAddress: maskKaspaAddress(profile.payoutAddress),
  configuredAt: Number(profile.payoutAddressSetAt || 0),
  network: 'kaspa-mainnet',
  status: profile.payoutAddress ? 'registered-alpha' : 'not-configured',
  withdrawalsEnabled: false
});

export default async function handler(req, res) {
  setApiHeaders(res, 'GET, POST, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    await rateLimit('rewards', session.id, 30, 60 * 10);
    const profile = await loadProfile(session.id);

    if (req.method === 'GET') {
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile) });
    }

    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.acknowledged !== true) throw new Error('PAYOUT_ACK_REQUIRED');
      if (!isValidKaspaMainnetAddress(body.address)) throw new Error('INVALID_KASPA_ADDRESS');
      const address = normalizeKaspaAddress(body.address);
      profile.payoutAddress = address;
      profile.payoutAddressSetAt = Date.now();
      await saveProfile(session.id, profile);
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile) });
    }

    if (req.method === 'DELETE') {
      delete profile.payoutAddress;
      delete profile.payoutAddressSetAt;
      await saveProfile(session.id, profile);
      return sendJson(res, 200, { ok: true, balance: profile.balance, payout: payoutView(profile) });
    }

    return methodNotAllowed(res, 'GET, POST, DELETE, OPTIONS');
  } catch (error) {
    return handleApiError(res, error);
  }
}
