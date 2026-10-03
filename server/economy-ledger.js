import { createHash } from 'node:crypto';
import { redis } from './redis.js';
import { splitFee } from '../public/economy/assets/amounts.js';
import { economyPolicy } from '../public/economy/assets/catalog.js';

export const MAX_RECEIPTS = 250;
export const transactionKinds = Object.freeze(['powerup-purchase', 'game-entry', 'marketplace-fee', 'reward-payout', 'creator-payout']);
const totalsKeys = ['grossRaw', 'feeRaw', 'recyclePendingRaw', 'burnPendingRaw'];
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const zeroTotals = () => Object.fromEntries(totalsKeys.map(key => [key, '0']));
const genesis = '0'.repeat(64);
export const emptyLedger = () => ({ version: 1, mode: 'planning-only', currency: 'GEEK', decimals: 8, policy: economyPolicy.id, sequence: 0, head: genesis, totals: zeroTotals(), receipts: [] });
export const ledgerKey = playerId => {
  if (typeof playerId !== 'string' || !/^[a-f0-9]{32}$/.test(playerId)) throw new Error('ECONOMY_LEDGER_INVALID');
  return `geek:economy:v1:${playerId}`;
};

const normalize = input => {
  if (!input || !transactionKinds.includes(input.kind) || typeof input.reference !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9:_-]{7,95}$/.test(input.reference)) throw new Error('ECONOMY_TRANSACTION_INVALID');
  return { reference: input.reference, kind: input.kind, ...splitFee(input.grossRaw, input.feeRaw) };
};
const receiptBody = (input, sequence, previousHash, createdAt) => ({ ...normalize(input), sequence, previousHash, createdAt, policy: economyPolicy.id, currency: 'GEEK', state: 'PLANNED' });
const addTotals = (totals, receipt) => Object.fromEntries(totalsKeys.map(key => [key, (BigInt(totals[key]) + BigInt(receipt[key])).toString()]));

export const decodeLedger = raw => {
  if (raw === null || raw === undefined) return emptyLedger();
  try {
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > 256 * 1024) throw new Error();
    const state = JSON.parse(raw);
    if (state.version !== 1 || state.mode !== 'planning-only' || state.currency !== 'GEEK' || state.decimals !== 8 || state.policy !== economyPolicy.id || !Array.isArray(state.receipts) || state.receipts.length > MAX_RECEIPTS || state.sequence !== state.receipts.length) throw new Error();
    let head = genesis, totals = zeroTotals(); const references = new Set();
    for (const [index, receipt] of state.receipts.entries()) {
      if (!Number.isSafeInteger(receipt.createdAt) || receipt.createdAt < 0 || references.has(receipt.reference)) throw new Error();
      const body = receiptBody(receipt, index + 1, head, receipt.createdAt);
      if (JSON.stringify(receipt) !== JSON.stringify({ ...body, hash: hash(body) })) throw new Error();
      references.add(receipt.reference); head = receipt.hash; totals = addTotals(totals, receipt);
    }
    if (state.head !== head || JSON.stringify(state.totals) !== JSON.stringify(totals)) throw new Error();
    return state;
  } catch { throw new Error('ECONOMY_LEDGER_INVALID'); }
};

export const planTransaction = (state, input, now = Date.now()) => {
  state = decodeLedger(JSON.stringify(state));
  const normalized = normalize(input);
  const existing = state.receipts.find(receipt => receipt.reference === normalized.reference);
  if (existing) {
    if (hash(normalize(existing)) !== hash(normalized)) throw new Error('ECONOMY_REFERENCE_CONFLICT');
    return { state, receipt: existing, duplicate: true };
  }
  if (state.sequence >= MAX_RECEIPTS) throw new Error('ECONOMY_LEDGER_FULL');
  if (!Number.isSafeInteger(now) || now < 0) throw new Error('ECONOMY_TRANSACTION_INVALID');
  const body = receiptBody(normalized, state.sequence + 1, state.head, now);
  const receipt = { ...body, hash: hash(body) };
  const next = { ...state, sequence: receipt.sequence, head: receipt.hash, totals: addTotals(state.totals, receipt), receipts: [...state.receipts, receipt] };
  return { state: next, receipt, duplicate: false };
};

// One-key compare-and-set: no Lua arithmetic or JSON number conversion for token amounts.
export const ledgerCasScript = `local raw = redis.call('GET', KEYS[1])
if (raw or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

// Trusted server integration only. No HTTP action accepts a transaction or a client-supplied credit.
// This writes a planning journal; it cannot debit a wallet, award GEEK, or confirm a burn.
export const appendPlannedTransaction = async (playerId, input) => {
  normalize(input); const key = ledgerKey(playerId);
  for (let attempt = 0; attempt < 8; attempt++) {
    const raw = await redis('GET', key);
    const planned = planTransaction(decodeLedger(raw), input);
    if (planned.duplicate) return planned;
    if (await redis('EVAL', ledgerCasScript, 1, key, raw ?? '', JSON.stringify(planned.state)) === 1) return planned;
  }
  throw new Error('ECONOMY_LEDGER_BUSY');
};

export const readLedger = async playerId => decodeLedger(await redis('GET', ledgerKey(playerId)));
export const ledgerView = state => {
  state = decodeLedger(JSON.stringify(state));
  return { mode: state.mode, currency: state.currency, decimals: state.decimals, policy: state.policy, sequence: state.sequence, totals: state.totals, receipts: state.receipts.slice(-20).reverse(), availableRaw: '0', fundingVerified: false, transfersEnabled: false, burnsConfirmed: false };
};
