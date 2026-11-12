import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { redis, rateLimit } from './redis.js';
import { isValidKaspaMainnetAddress } from './kaspa-address.js';
import { decodeRewardAddresses, rewardAddressKey, validReceivingAddress } from './reward-addresses.js';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import {
  DAILY_CAP_WHOLE, GEEK_DECIMALS, GEEK_DEPLOYMENT_HASH, GEEK_PROTOCOL, GEEK_TICKER, MAINNET_PAYOUT_SENDER,
  expectedRaw, quoteGeekReward, toRaw
} from '../workers/mainnet/schedule.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const nonce = () => randomBytes(12).toString('hex');
export const PAYOUT_INDEX_CEILING = 10000;
export const payoutIndexKey = 'geek:mainnet-payout:index:v1';
export const payoutDayKey = day => `geek:mainnet-payout:day:${day}`;
export const payoutJobKey = id => `geek:mainnet-payout:job:${id}`;
export const payoutEarnKey = id => `geek:mainnet-payout:earn:${id}`;
const leaseKey = 'geek:mainnet-payout:sender-lease:v1';
export const payoutDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

export function mainnetPayoutFlags() {
  return {
    settlementEligible: false,
    withdrawalsEnabled: false,
    payoutEnabled: process.env.MAINNET_PAYOUT_ENABLED === 'true',
    signerEnabled: process.env.MAINNET_SIGNER_ENABLED === 'true'
  };
}

export function mainnetPayoutConfig() {
  if (process.env.MAINNET_PAYOUT_ENABLED !== 'true') return null;
  if (!hex(process.env.MAINNET_PAYOUT_WORKER_TOKEN || '', 64) || !isValidKaspaMainnetAddress(MAINNET_PAYOUT_SENDER)) throw new Error('MAINNET_PAYOUT_CONFIG_INVALID');
  const config = {
    network: 'mainnet', protocol: GEEK_PROTOCOL, ticker: GEEK_TICKER, deploymentHash: GEEK_DEPLOYMENT_HASH,
    decimals: String(GEEK_DECIMALS), sender: MAINNET_PAYOUT_SENDER, dailyCapRaw: toRaw(DAILY_CAP_WHOLE)
  };
  return { ...config, fingerprint: hash(config) };
}

export function earningId(playerId, run, quote, now) {
  if (quote.kind === 'daily') return hash(['geek-mainnet-payout-v1', 'daily', playerId, payoutDay(now || Date.now())]);
  return hash(['geek-mainnet-payout-v1', 'gauntlet', run.id, quote.round]);
}

export const validJournal = journal => Boolean(journal && Object.keys(journal).sort().join(',') === 'commit,reveal' &&
  ['commit', 'reveal'].every(name => journal[name] && Object.keys(journal[name]).sort().join(',') === 'id,transaction' && hex(journal[name].id, 64) &&
    typeof journal[name].transaction === 'string' && journal[name].transaction.length > 50 && journal[name].transaction.length <= 2800) &&
  journal.commit.id !== journal.reveal.id);

export function decodeJob(raw, id) {
  let job;
  try { job = JSON.parse(raw); } catch { throw new Error('MAINNET_PAYOUT_RECORD_INVALID'); }
  const proof = job?.proof;
  if (!job || job.schema !== 1 || job.id !== id || !hex(id, 64) || !hex(job.version, 24) || !hex(job.playerId, 32) ||
      job.network !== 'mainnet' || job.protocol !== GEEK_PROTOCOL || job.ticker !== GEEK_TICKER || !hex(job.configFingerprint, 64) ||
      job.deploymentHash !== GEEK_DEPLOYMENT_HASH || job.decimals !== String(GEEK_DECIMALS) || job.amount !== expectedRaw(proof) ||
      job.sender !== MAINNET_PAYOUT_SENDER || !isValidKaspaMainnetAddress(job.recipient) || job.sender === job.recipient ||
      !hex(proof?.runId, 40) || !Number.isSafeInteger(job.createdAt) || job.createdAt <= 0 ||
      !['queued', 'prepared', 'awaiting-indexer', 'indexed-confirmed'].includes(job.state) ||
      (job.state !== 'queued' && !validJournal(job.journal)) ||
      (job.state !== 'queued' && job.transactionHash !== job.journal.reveal.id) ||
      (job.state === 'indexed-confirmed' && job.observation?.accepted !== true)) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
  return job;
}

// Checked before the ranked write. A bad payout key fails the answer closed.
export const MAINNET_PAYOUT_PREFLIGHT_LUA = `
if ARGV[20] ~= '' then
  for _, i in ipairs({16,17,19}) do
    local kind = redis.call('TYPE', KEYS[i]).ok
    if kind ~= 'none' and kind ~= 'string' then return -4 end
  end
  local indexKind = redis.call('TYPE', KEYS[18]).ok
  if indexKind ~= 'none' and indexKind ~= 'zset' then return -4 end
  local addressKind = redis.call('TYPE', KEYS[20]).ok
  if addressKind ~= 'none' and addressKind ~= 'string' then return -4 end
  local spent = redis.call('GET', KEYS[19])
  if spent and not string.match(spent, '^%d+$') then return -4 end
  if not string.match(ARGV[21], '^[a-f0-9]+$') or not string.match(ARGV[23], '^[1-9]%d*$') or not string.match(ARGV[24], '^[1-9]%d*$') then return -4 end
end`;

// Same ranked commit as the learning result. An existing earn lock pays nothing again.
// Cap exhaustion records not-paid and still saves the result. The cap is temporary.
export const MAINNET_PAYOUT_COMMIT_LUA = `
if ARGV[20] ~= '' and redis.call('EXISTS', KEYS[16]) == 0 and redis.call('EXISTS', KEYS[17]) == 0
  and (redis.call('GET', KEYS[20]) or '') == ARGV[26] then
  local spent = tonumber(redis.call('GET', KEYS[19]) or '0')
  local amount = tonumber(ARGV[23])
  local cap = tonumber(ARGV[24])
  if spent and amount and cap and (spent + amount > cap or redis.call('ZCARD', KEYS[18]) >= ${PAYOUT_INDEX_CEILING}) then
    redis.call('SET', KEYS[16], 'not-paid')
  elseif spent and amount and cap then
    redis.call('SET', KEYS[16], ARGV[21])
    redis.call('SET', KEYS[17], ARGV[22])
    redis.call('ZADD', KEYS[18], ARGV[25], ARGV[21])
    redis.call('INCRBY', KEYS[19], ARGV[23])
  end
end`;

export async function prepareMainnetPayout(playerId, run) {
  const config = mainnetPayoutConfig();
  if (!config) return null;
  const quote = quoteGeekReward(run);
  if (!quote || !hex(playerId, 32) || !hex(run?.id, 40)) return null;
  const addressKey = rewardAddressKey(playerId);
  const addressRaw = await redis('GET', addressKey);
  const record = addressRaw ? decodeRewardAddresses(addressRaw, playerId) : null;
  const recipient = record?.mainnet || '';
  if (!recipient || recipient === config.sender || !validReceivingAddress(recipient, 'mainnet')) return null;
  if (!Number.isSafeInteger(record.mainnetEligibleAt) || record.mainnetEligibleAt <= 0 || record.mainnetEligibleAt > Date.now()) return null;
  const createdAt = Date.now();
  const id = earningId(playerId, run, quote, createdAt);
  const proof = { kind: quote.kind, round: quote.round, runId: run.id, correct: run.correct, answered: run.roundAnswers.length };
  if (expectedRaw(proof) !== quote.raw) throw new Error('MAINNET_PAYOUT_AMOUNT_INVALID');
  const job = {
    schema: 1, id, version: nonce(), state: 'queued', playerId, network: config.network, protocol: config.protocol,
    ticker: config.ticker, sender: config.sender, recipient, deploymentHash: config.deploymentHash,
    configFingerprint: config.fingerprint, amount: quote.raw, decimals: config.decimals, proof, createdAt
  };
  return {
    keys: [payoutEarnKey(id), payoutJobKey(id), payoutIndexKey, payoutDayKey(payoutDay(createdAt)), addressKey],
    args: ['mainnet-payout', id, JSON.stringify(job), quote.raw, config.dailyCapRaw, String(createdAt), addressRaw]
  };
}

const jsonFromIndexer = async (path, { allowMissingOperation = false } = {}) => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`https://api.kasplex.org/v1/krc20/${path}`, { signal: controller.signal, redirect: 'error', cache: 'no-store' });
    const text = await response.text();
    if (text.length > 64000) throw new Error('unavailable');
    const payload = JSON.parse(text);
    if (allowMissingOperation && /^op\/[a-f0-9]{64}$/.test(path) &&
        [403, 404].includes(response.status) && payload?.message === 'op not found' && payload.result === null) return null;
    if (!response.ok) throw new Error('unavailable');
    if (payload.message !== 'successful' || !Array.isArray(payload.result) || payload.result.length > 1) throw new Error('unavailable');
    return payload.result[0] || null;
  } catch { throw new Error('MAINNET_INDEXER_UNAVAILABLE'); }
  finally { clearTimeout(timer); }
};

const transferObservation = (operation, job) => {
  if (!operation) return { accepted: false, reason: 'not-indexed' };
  if (operation.p !== 'KRC-20' || operation.op !== 'transfer' || operation.hashRev !== job.transactionHash || operation.tick !== job.ticker ||
      operation.from !== job.sender || operation.to !== job.recipient || operation.amt !== job.amount ||
      !/^[0-9]{13}$/.test(operation.mtsAdd || '') || Number(operation.mtsAdd) < job.createdAt || Number(operation.mtsAdd) > Date.now() + 60000) throw new Error('MAINNET_TRANSFER_MISMATCH');
  if (operation.opAccept !== '1' || operation.txAccept !== '1' || operation.opError) return { accepted: false, reason: 'not-accepted' };
  if (!/^[0-9]+$/.test(operation.opScore || '') || !hex(operation.checkpoint, 64)) throw new Error('MAINNET_INDEXER_UNAVAILABLE');
  return { accepted: true, operationScore: operation.opScore, checkpoint: operation.checkpoint };
};

const checkAsset = async config => {
  const [token, deployment] = await Promise.all([jsonFromIndexer(`token/${config.ticker}`), jsonFromIndexer(`op/${config.deploymentHash}`)]);
  if (!token || token.tick !== config.ticker || token.state !== 'deployed' || token.hashRev !== config.deploymentHash || token.dec !== config.decimals ||
      !deployment || deployment.p !== 'KRC-20' || deployment.op !== 'deploy' || deployment.tick !== config.ticker || deployment.hashRev !== config.deploymentHash ||
      deployment.dec !== config.decimals || deployment.txAccept !== '1' || deployment.opAccept !== '1' || deployment.opError) throw new Error('MAINNET_ASSET_MISMATCH');
};

const UPDATE = `-- geek-mainnet-payout-update-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[3] then return 0 end
redis.call('SET', KEYS[1], ARGV[2]); return 1`;

const validToken = req => {
  const expected = process.env.MAINNET_PAYOUT_WORKER_TOKEN || '', given = String(req.headers?.authorization || '');
  return hex(expected, 64) && Buffer.byteLength(given) === 71 && timingSafeEqual(Buffer.from(given), Buffer.from(`Bearer ${expected}`));
};

export async function mainnetPayoutWorkerHandler(req, res) {
  setApiHeaders(res, 'POST'); res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!validToken(req) || req.headers?.cookie || req.headers?.origin || req.headers?.['sec-fetch-site']) return sendJson(res, 401, { ok: false, error: 'Worker access required.' });
  try {
    const config = mainnetPayoutConfig();
    if (!config) throw new Error('MAINNET_PAYOUT_DISABLED');
    await rateLimit('mainnet-payout-worker', 'worker', 120, 60);
    const body = parseBody(req);
    if (body.action === 'claim') {
      if (Object.keys(body).length !== 1) throw new Error('INVALID_REQUEST');
      const lease = nonce();
      if (await redis('SET', leaseKey, lease, 'NX', 'EX', 120) !== 'OK') return sendJson(res, 200, { ok: true, busy: true });
      let job = null;
      for (let cursor = 0; cursor < PAYOUT_INDEX_CEILING && !job; cursor += 100) {
        const page = await redis('ZRANGE', payoutIndexKey, cursor, cursor + 99);
        if (!Array.isArray(page) || page.some(id => !hex(id, 64))) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
        for (const id of page) {
          const candidate = decodeJob(await redis('GET', payoutJobKey(id)), id);
          if (candidate.state !== 'indexed-confirmed') { job = candidate; break; }
        }
        if (page.length < 100) break;
      }
      if (job && job.configFingerprint !== config.fingerprint) throw new Error('MAINNET_PAYOUT_CONFIG_CHANGED');
      return sendJson(res, 200, { ok: true, lease, job, config });
    }
    if (!hex(body.lease, 24)) throw new Error('INVALID_REQUEST');
    if (body.action === 'release') {
      if (Object.keys(body).some(key => !['action', 'lease'].includes(key))) throw new Error('INVALID_REQUEST');
      await redis('EVAL', `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`, 1, leaseKey, body.lease);
      return sendJson(res, 200, { ok: true });
    }
    if (!['prepare', 'submitted', 'check'].includes(body.action) || !hex(body.id, 64) || !hex(body.version, 24) ||
        Object.keys(body).some(key => !['action', 'lease', 'id', 'version', ...(body.action === 'prepare' ? ['journal'] : [])].includes(key))) throw new Error('INVALID_REQUEST');
    const key = payoutJobKey(body.id), raw = await redis('GET', key), job = decodeJob(raw, body.id);
    if (job.version !== body.version || job.configFingerprint !== config.fingerprint || await redis('GET', leaseKey) !== body.lease) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
    if (body.action === 'prepare') {
      if (job.state !== 'queued' || !validJournal(body.journal) || job.amount !== expectedRaw(job.proof)) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      await checkAsset(config);
      job.journal = body.journal; job.transactionHash = body.journal.reveal.id; job.state = 'prepared';
    } else if (body.action === 'submitted') {
      if (!['prepared', 'awaiting-indexer'].includes(job.state)) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      job.state = 'awaiting-indexer';
    } else {
      if (job.state === 'queued') throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      await checkAsset(config);
      job.observation = transferObservation(await jsonFromIndexer(`op/${job.transactionHash}`, { allowMissingOperation: true }), job);
      job.state = job.observation.accepted ? 'indexed-confirmed' : 'awaiting-indexer';
      job.lastCheckedAt = Date.now();
    }
    job.version = nonce();
    if (await redis('EVAL', UPDATE, 2, key, leaseKey, raw, JSON.stringify(job), body.lease) !== 1) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
    return sendJson(res, 200, { ok: true, job });
  } catch (error) { return mainnetPayoutError(res, error); }
}

export function mainnetPayoutError(res, error) {
  if (error.message === 'MAINNET_PAYOUT_STATE_CHANGED') return sendJson(res, 409, { ok: false, error: 'Saved payout state changed. Reload the same payment.' });
  if (String(error.message || '').startsWith('MAINNET_')) return sendJson(res, 503, { ok: false, error: 'Mainnet GEEK payouts are paused. No transfer was made.' });
  return handleApiError(res, error);
}
