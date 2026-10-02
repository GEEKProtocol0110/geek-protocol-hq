import { randomBytes } from 'node:crypto';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { redis, rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

const DAY = 86400000;
export const vaultSeals = [
  { id: 'signal', name: 'Signal', glyph: '⌁', color: '#70e6dc', weekday: 'Monday' },
  { id: 'connection', name: 'Connection', glyph: '◇', color: '#a993ff', weekday: 'Tuesday' },
  { id: 'curiosity', name: 'Curiosity', glyph: '?', color: '#f6c643', weekday: 'Wednesday' },
  { id: 'discovery', name: 'Discovery', glyph: '✦', color: '#72e6a1', weekday: 'Thursday' },
  { id: 'reflection', name: 'Reflection', glyph: '◉', color: '#ff8f83', weekday: 'Friday' },
  { id: 'exploration', name: 'Exploration', glyph: '↗', color: '#70e6dc', weekday: 'Saturday' },
  { id: 'possibility', name: 'Possibility', glyph: '∞', color: '#f6c643', weekday: 'Sunday' }
];
export const vaultDay = (now = Date.now()) => {
  const opensAt = Math.floor(now / DAY) * DAY;
  return { id: new Date(opensAt).toISOString().slice(0, 10), opensAt, closesAt: opensAt + DAY, seal: vaultSeals[(new Date(opensAt).getUTCDay() + 6) % 7], quantity: 1 };
};
export const vaultKey = playerId => `geek:vault:${playerId}`;

// One record owns both claim eligibility and inventory. No read/modify/write profile race.
const claimScript = `-- geek-vault-claim-v1
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
if now < tonumber(ARGV[1]) or now >= tonumber(ARGV[2]) then return {'DAY_CHANGED'} end
local raw = redis.call('GET', KEYS[1])
local state = raw and cjson.decode(raw) or {version=1, total=0, lastDay='', inventory={}, history={}}
if state.version ~= 1 or type(state.total) ~= 'number' or state.total < 0 or state.total % 1 ~= 0 or state.total >= 9007199254740991 or type(state.lastDay) ~= 'string' or type(state.inventory) ~= 'table' or type(state.history) ~= 'table' then return {'STATE_INVALID'} end
for _, quantity in pairs(state.inventory) do
  if type(quantity) ~= 'number' or quantity < 0 or quantity % 1 ~= 0 or quantity >= 9007199254740991 then return {'STATE_INVALID'} end
end
if state.lastDay == ARGV[3] then return {'ALREADY_CLAIMED', raw} end
if state.lastDay > ARGV[3] then return {'STATE_INVALID'} end
local receipt = {id=ARGV[5], day=ARGV[3], sealId=ARGV[4], quantity=1, claimedAt=now}
state.total = state.total + 1
state.lastDay = ARGV[3]
state.inventory[ARGV[4]] = tonumber(state.inventory[ARGV[4]] or 0) + 1
table.insert(state.history, 1, receipt)
while #state.history > 14 do table.remove(state.history) end
local encoded = cjson.encode(state)
redis.call('SET', KEYS[1], encoded)
return {'CLAIMED', encoded}`;

const emptyVault = () => ({ version: 1, total: 0, lastDay: '', inventory: {}, history: [] });
const decodeVault = raw => {
  const state = raw ? JSON.parse(raw) : emptyVault();
  if (state.version !== 1 || !Number.isSafeInteger(state.total) || state.total < 0 || typeof state.lastDay !== 'string' || !state.inventory || !Array.isArray(state.history)) throw new Error('VAULT_STATE_INVALID');
  return state;
};
const view = (state, day, session, now) => ({
  serverNow: now, day, claimed: state.lastDay === day.id, nextOpensAt: day.closesAt,
  totalClaimed: state.total, collection: vaultSeals.map(seal => ({ ...seal, quantity: Number(state.inventory[seal.id] || 0) })),
  receipt: state.history.find(receipt => receipt.day === day.id) || null,
  history: state.history, walletProtected: Boolean(session.identityVersion),
  collectionStatus: 'off-chain-alpha', transferable: false, xpEnabled: false, creditsEnabled: false, tokensEnabled: false
});

export default async function vaultHandler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  try {
    const session = await requireSession(req);
    const playerId = playerIdFor(session);
    await rateLimit('vault', playerId, 90, 300);
    let state, claimStatus;
    if (req.method === 'POST') {
      const body = parseBody(req);
      if (body.action !== 'claim' || typeof body.dayId !== 'string') throw new Error('INVALID_REQUEST');
      await rateLimit('vault-claim-ip', clientFingerprint(req), 40, 3600);
      const day = vaultDay();
      if (body.dayId !== day.id) throw new Error('VAULT_DAY_CHANGED');
      const result = await redis('EVAL', claimScript, 1, vaultKey(playerId), day.opensAt, day.closesAt, day.id, day.seal.id, randomBytes(12).toString('hex'));
      if (result[0] === 'DAY_CHANGED') throw new Error('VAULT_DAY_CHANGED');
      if (result[0] === 'STATE_INVALID') throw new Error('VAULT_STATE_INVALID');
      if (!['CLAIMED', 'ALREADY_CLAIMED'].includes(result[0])) throw new Error('VAULT_STATE_INVALID');
      claimStatus = result[0] === 'CLAIMED' ? 'claimed' : 'already-claimed';
      state = decodeVault(result[1]);
    } else state = decodeVault(await redis('GET', vaultKey(playerId)));
    const now = Date.now();
    return sendJson(res, 200, { ok: true, ...(claimStatus ? { claimStatus, claimReceipt: state.history[0] } : {}), vault: view(state, vaultDay(now), session, now) });
  } catch (error) {
    if (error.message === 'VAULT_DAY_CHANGED') return sendJson(res, 409, { ok: false, code: error.message, error: 'A new UTC day has opened. Refresh the vault to see today’s contents.' });
    if (error.message === 'VAULT_STATE_INVALID') return sendJson(res, 503, { ok: false, code: error.message, error: 'Your vault could not be verified. No new claim was recorded. Please try again later.' });
    return handleApiError(res, error);
  }
}
