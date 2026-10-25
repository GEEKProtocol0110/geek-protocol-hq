import { createHash, randomBytes } from 'node:crypto';
import { redis } from './redis.js';
import { isValidKaspaTestnetAddress } from './kaspa-address.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = (value, size) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${size}}$`).test(value);
export const retiredJobKey = id => `geek:testnet-auto:retired:v1:${id}`;
export const freshTestId = id => hash(['owner-approved-fresh-test-v1', id]);
export function decodeRetirement(raw, id) {
  if (raw === null) return null;
  let record; try { record = JSON.parse(raw); } catch { throw new Error('TESTNET_AUTO_RECORD_INVALID'); }
  if (!record || record.schema !== 1 || record.originalId !== id || !hex(id, 64) || record.freshId !== freshTestId(id) ||
      !hex(record.originalRevealHash, 64) || !hex(record.authorizationHash, 64) || !hex(record.journalHash, 64) ||
      !isValidKaspaTestnetAddress(record.recipient) || record.amount !== '100000000' || record.decimals !== '8' ||
      record.network !== 'testnet-10' || record.ticker !== 'GEEKT' || record.riskAccepted !== true ||
      !Number.isSafeInteger(record.createdAt) || record.createdAt <= 0 ||
      !Number.isSafeInteger(record.approvedAt) || record.approvedAt <= 0) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  return record;
}
export async function readRetirements(ids) {
  if (!ids.length) return new Map();
  const rows = await redis('MGET', ...ids.map(retiredJobKey));
  if (!Array.isArray(rows) || rows.length !== ids.length) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  return new Map(ids.map((id, i) => [id, decodeRetirement(rows[i], id)]));
}
export function validateRetirements(jobs, retirements) {
  const byId = new Map(jobs.map(job => [job.id, job]));
  for (const original of jobs) {
    const marker = retirements.get(original.id); if (!marker) continue;
    const child = byId.get(marker.freshId);
    if (!child || child.freshTestOf !== original.id || marker.originalRevealHash !== original.transactionHash ||
        marker.journalHash !== hash(original.journal) || marker.recipient !== original.recipient ||
        ['recipient', 'sender', 'ticker', 'amount', 'decimals', 'network', 'configFingerprint', 'playerId'].some(k => child[k] !== original[k]) ||
        hash(child.proof) !== hash(original.proof)) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  }
}
const approval = () => {
  const raw = process.env.TESTNET_AUTO_FRESH_TEST_APPROVAL;
  if (!raw) return null;
  let value; try { value = JSON.parse(raw); } catch { throw new Error('TESTNET_AUTO_FRESH_TEST_CONFIG_INVALID'); }
  if (raw.length > 600 || !value || Object.keys(value).sort().join(',') !== 'approvedAt,originalRevealHash,recipient,riskAccepted' ||
      !hex(value.originalRevealHash, 64) || !isValidKaspaTestnetAddress(value.recipient) || value.riskAccepted !== true ||
      !Number.isSafeInteger(value.approvedAt) || value.approvedAt <= 0) throw new Error('TESTNET_AUTO_FRESH_TEST_CONFIG_INVALID');
  return value;
};
const CREATE = `-- geek-testnet-one-fresh-test-v1
for _, i in ipairs({1,2,3,4,6,7}) do
  local kind = redis.call('TYPE', KEYS[i]).ok
  if kind ~= 'none' and kind ~= 'string' then return -1 end
end
local kind = redis.call('TYPE', KEYS[5]).ok
if kind ~= 'zset' then return -1 end
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[2]
  or redis.call('EXISTS', KEYS[3]) ~= 0 or redis.call('EXISTS', KEYS[4]) ~= 0 then return 0 end
local count = redis.call('GET', KEYS[6])
if count and not string.match(count, '^%d+$') then return -1 end
if redis.call('ZCARD', KEYS[5]) >= 100 or tonumber(count or '0') >= tonumber(ARGV[7])
  or redis.call('EXISTS', KEYS[7]) ~= 0 then return -2 end
redis.call('SET', KEYS[3], ARGV[3])
redis.call('SET', KEYS[4], ARGV[4])
redis.call('ZADD', KEYS[5], ARGV[6], ARGV[5])
redis.call('INCR', KEYS[6])
redis.call('SET', KEYS[7], ARGV[5])
return 1`;

// A separately approved exception creates ONE child; the original job/journal
// and every original earning/recipient lock stay byte-for-byte untouched.
export async function approvedFreshTest({ jobs, retirements, config, lease, leaseKey, jobKey, index }) {
  const consent = approval(); if (!consent) return null;
  const original = jobs.find(job => job.transactionHash === consent.originalRevealHash && job.recipient === consent.recipient);
  if (!original || original.freshTestOf || original.network !== 'testnet-10' || original.ticker !== 'GEEKT' ||
      original.amount !== '100000000' || original.decimals !== '8' || original.configFingerprint !== config.fingerprint ||
      config.amount !== '100000000' || config.decimals !== '8' || config.ticker !== 'GEEKT') throw new Error('TESTNET_AUTO_FRESH_TEST_CONFIG_INVALID');
  const existing = retirements.get(original.id);
  if (existing) {
    const child = jobs.find(job => job.id === existing.freshId);
    if (!child || child.freshTestOf !== original.id || child.recipient !== original.recipient ||
        existing.journalHash !== hash(original.journal)) throw new Error('TESTNET_AUTO_RECORD_INVALID');
    return child.state === 'indexed-confirmed' ? null : child;
  }
  if (original.state === 'indexed-confirmed') return null;
  const now = Date.now();
  if (!original.journal || !['prepared', 'awaiting-indexer'].includes(original.state) ||
      consent.approvedAt > now + 60000 || now - consent.approvedAt > 86400000) throw new Error('TESTNET_AUTO_FRESH_TEST_CONFIG_INVALID');
  const id = freshTestId(original.id), date = new Date(now).toISOString().slice(0, 10);
  const { journal, transactionHash, observation, lastCheckedAt, ...earned } = original;
  const child = { ...earned, id, version: randomBytes(12).toString('hex'), state: 'queued', createdAt: now, freshTestOf: original.id };
  const marker = { schema: 1, originalId: original.id, freshId: id, originalRevealHash: original.transactionHash,
    journalHash: hash(journal), authorizationHash: hash(consent), recipient: original.recipient, amount: original.amount,
    decimals: original.decimals, ticker: original.ticker, network: original.network, riskAccepted: true, approvedAt: consent.approvedAt, createdAt: now };
  const outcome = await redis('EVAL', CREATE, 7, leaseKey, jobKey(original.id), retiredJobKey(original.id), jobKey(id), index,
    `geek:testnet-auto:day:${date}`, `geek:testnet-auto:recipient-day:${hash([date, original.recipient])}`,
    lease, JSON.stringify(original), JSON.stringify(marker), JSON.stringify(child), id, now, config.dailyLimit);
  if (outcome !== 1) throw new Error(outcome === -2 ? 'TESTNET_AUTO_FRESH_TEST_LIMIT' : 'TESTNET_AUTO_STATE_CHANGED');
  console.info(JSON.stringify({ event: 'tn10-fresh-test-created', originalRetriesStopped: true }));
  return child;
}
