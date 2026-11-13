import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { jobMac, jobMacMatches, jobMacSecret } from '../workers/mainnet/job-mac.mjs';
import { redis, rateLimit } from './redis.js';
import { isValidKaspaMainnetAddress } from './kaspa-address.js';
import { decodeRewardAddresses, rewardAddressKey, validReceivingAddress } from './reward-addresses.js';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import {
  DAILY_CAP_WHOLE, GEEK_DECIMALS, GEEK_DEPLOYMENT_HASH, GEEK_PROTOCOL, GEEK_TICKER, MAINNET_PAYOUT_SENDER,
  PLAYER_DAILY_CAP_WHOLE, expectedRaw, quoteGeekReward, toRaw
} from '../workers/mainnet/schedule.mjs';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = (value, length) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${length}}$`).test(value);
const nonce = () => randomBytes(12).toString('hex');
export const PAYOUT_INDEX_CEILING = 10000;
// Outstanding jobs only. Completed and stuck jobs are removed, so the ceiling can shrink.
export const STUCK_AFTER_MS = 6 * 60 * 60 * 1000;
export const payoutIndexKey = 'geek:mainnet-payout:active:v1';
export const payoutDayKey = day => `geek:mainnet-payout:day:${day}`;
export const payoutPlayerDayKey = (day, playerId) => `geek:mainnet-payout:player-day:${day}:${playerId}`;
export const payoutAddressDayKey = (day, recipient) => `geek:mainnet-payout:address-day:${day}:${createHash('sha256').update(String(recipient)).digest('hex')}`;
export const payoutJobKey = id => `geek:mainnet-payout:job:${id}`;
export const payoutEarnKey = id => `geek:mainnet-payout:earn:${id}`;
export const payoutStuckKey = 'geek:mainnet-payout:stuck:v1';
export const payoutSignedKey = 'geek:mainnet-payout:signed:v1';
export const payoutQuarantineKey = 'geek:mainnet-payout:quarantine:v1';
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
  // Preview and any non-production environment cannot admit, even if a secret is present.
  // A missing worker token skips admission; it must not fail the player's answer.
  if (process.env.VERCEL_ENV !== 'production' || process.env.MAINNET_PAYOUT_ENABLED !== 'true') return null;
  if (!jobMacSecret() || !hex(process.env.MAINNET_PAYOUT_WORKER_TOKEN || '', 64) || !isValidKaspaMainnetAddress(MAINNET_PAYOUT_SENDER)) return null;
  const identity = {
    network: 'mainnet', protocol: GEEK_PROTOCOL, ticker: GEEK_TICKER, deploymentHash: GEEK_DEPLOYMENT_HASH,
    decimals: String(GEEK_DECIMALS), sender: MAINNET_PAYOUT_SENDER
  };
  return {
    ...identity, dailyCapRaw: toRaw(DAILY_CAP_WHOLE), playerCapRaw: toRaw(PLAYER_DAILY_CAP_WHOLE), addressCapRaw: toRaw(PLAYER_DAILY_CAP_WHOLE),
    fingerprint: hash(identity)
  };
}

export function payoutIdentityFingerprint(fields) {
  return hash({
    network: fields.network, protocol: fields.protocol, ticker: fields.ticker,
    deploymentHash: fields.deploymentHash, decimals: String(fields.decimals), sender: fields.sender
  });
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
  const states = ['queued', 'prepared', 'awaiting-indexer', 'indexed-confirmed', 'stuck'];
  const journalRequired = ['prepared', 'awaiting-indexer', 'indexed-confirmed'].includes(job?.state);
  if (!job || job.schema !== 1 || job.id !== id || !hex(id, 64) || !hex(job.version, 24) || !hex(job.playerId, 32) ||
      job.network !== 'mainnet' || job.protocol !== GEEK_PROTOCOL || job.ticker !== GEEK_TICKER || !hex(job.configFingerprint, 64) ||
      job.deploymentHash !== GEEK_DEPLOYMENT_HASH || job.decimals !== String(GEEK_DECIMALS) || job.amount !== expectedRaw(proof) ||
      job.sender !== MAINNET_PAYOUT_SENDER || !isValidKaspaMainnetAddress(job.recipient) || job.sender === job.recipient ||
      !hex(proof?.runId, 40) || !qualifyingProofCorrect(proof) || !Number.isSafeInteger(job.createdAt) || job.createdAt <= 0 ||
      !states.includes(job.state) ||
      (job.state === 'queued' && job.journal) ||
      (journalRequired && !validJournal(job.journal)) ||
      (job.state === 'stuck' && job.journal && !validJournal(job.journal)) ||
      (job.journal && job.transactionHash !== job.journal.reveal.id) ||
      (job.preparedAt !== undefined && (!Number.isSafeInteger(job.preparedAt) || job.preparedAt <= 0)) ||
      (job.state === 'indexed-confirmed' && job.observation?.accepted !== true)) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
  return job;
}

const qualifyingProofCorrect = proof => proof?.kind === 'daily'
  ? Number.isInteger(proof.correctCount) && proof.correctCount >= 1 && proof.correctCount <= 5
  : Number.isInteger(proof?.correctCount) && proof.correctCount >= 1 && proof.correctCount <= 10;

// A journaled job that is still unconfirmed after the window is stuck.
// Queued jobs have not been signed and stay available for the signer.
// The clock starts when the original journal is first submitted, not when it is prepared.
// A prepared job that was never broadcast is not abandoned.
export function jobIsStuck(job, now = Date.now()) {
  if (job?.state !== 'awaiting-indexer' || !job.journal) return false;
  if (!Number.isSafeInteger(job.submittedAt) || job.submittedAt <= 0) return false;
  return now - job.submittedAt >= STUCK_AFTER_MS;
}

// Checked before the ranked write. A bad payout key fails the answer closed.
export const MAINNET_PAYOUT_PREFLIGHT_LUA = `
if ARGV[20] ~= '' then
  for _, i in ipairs({16,17,19,21,22}) do
    local kind = redis.call('TYPE', KEYS[i]).ok
    if kind ~= 'none' and kind ~= 'string' then return -4 end
  end
  local indexKind = redis.call('TYPE', KEYS[18]).ok
  if indexKind ~= 'none' and indexKind ~= 'zset' then return -4 end
  local addressKind = redis.call('TYPE', KEYS[20]).ok
  if addressKind ~= 'none' and addressKind ~= 'string' then return -4 end
  for _, i in ipairs({19,21,22}) do
    local spent = redis.call('GET', KEYS[i])
    if spent and not string.match(spent, '^%d+$') then return -4 end
  end
  if not string.match(ARGV[21], '^[a-f0-9]+$') or not string.match(ARGV[23], '^[1-9]%d*$') or not string.match(ARGV[24], '^[1-9]%d*$')
    or not string.match(ARGV[27], '^[1-9]%d*$') or not string.match(ARGV[28], '^[1-9]%d*$') then return -4 end
end`;

// Same ranked commit as the learning result. An existing earn lock pays nothing again.
// Any of the temporary caps records not-paid and still saves the result.
// KEYS[18] counts outstanding jobs only.
export const MAINNET_PAYOUT_COMMIT_LUA = `
if ARGV[20] ~= '' and redis.call('EXISTS', KEYS[16]) == 0 and redis.call('EXISTS', KEYS[17]) == 0
  and (redis.call('GET', KEYS[20]) or '') == ARGV[26] then
  local spent = tonumber(redis.call('GET', KEYS[19]) or '0')
  local playerSpent = tonumber(redis.call('GET', KEYS[21]) or '0')
  local addressSpent = tonumber(redis.call('GET', KEYS[22]) or '0')
  local amount = tonumber(ARGV[23])
  local cap = tonumber(ARGV[24])
  local playerCap = tonumber(ARGV[27])
  local addressCap = tonumber(ARGV[28])
  local over = not spent or not playerSpent or not addressSpent or not amount or not cap or not playerCap or not addressCap
    or spent + amount > cap or playerSpent + amount > playerCap or addressSpent + amount > addressCap
    or redis.call('ZCARD', KEYS[18]) >= ${PAYOUT_INDEX_CEILING}
  if over then
    redis.call('SET', KEYS[16], 'not-paid')
  else
    redis.call('SET', KEYS[16], ARGV[21])
    redis.call('SET', KEYS[17], ARGV[22])
    redis.call('ZADD', KEYS[18], ARGV[25], ARGV[21])
    redis.call('INCRBY', KEYS[19], ARGV[23])
    redis.call('INCRBY', KEYS[21], ARGV[23])
    redis.call('INCRBY', KEYS[22], ARGV[23])
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
  const proof = { kind: quote.kind, round: quote.round, runId: run.id, correctCount: quote.correctCount, answered: run.roundAnswers.length };
  if (expectedRaw(proof) !== quote.raw) throw new Error('MAINNET_PAYOUT_AMOUNT_INVALID');
  const job = {
    schema: 1, id, version: nonce(), state: 'queued', playerId, network: config.network, protocol: config.protocol,
    ticker: config.ticker, sender: config.sender, recipient, deploymentHash: config.deploymentHash,
    configFingerprint: config.fingerprint, amount: quote.raw, decimals: config.decimals, proof, createdAt
  };
  job.mac = jobMac(job, jobMacSecret());
  if (!job.mac) return null;
  const day = payoutDay(createdAt);
  return {
    keys: [payoutEarnKey(id), payoutJobKey(id), payoutIndexKey, payoutDayKey(day), addressKey, payoutPlayerDayKey(day, playerId), payoutAddressDayKey(day, recipient)],
    args: ['mainnet-payout', id, JSON.stringify(job), quote.raw, config.dailyCapRaw, String(createdAt), addressRaw, config.playerCapRaw, config.addressCapRaw]
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

// The saved job and live lease are checked before any write. A terminal stuck
// score also joins stuck:v1 in this same script. Check the list before writing:
// a script error after SET is not reverted, so a failed update must not leave
// a stuck job unlisted. The PAYOUT_UNCONFIRMED log runs only after success.
const UPDATE = `-- geek-mainnet-payout-update-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[3] then return 0 end
if ARGV[6] ~= '' then
  if not string.match(ARGV[6], '^%d+$') then return -2 end
  local stuckKind = redis.call('TYPE', KEYS[4]).ok
  if stuckKind ~= 'none' and stuckKind ~= 'zset' then return -2 end
  local indexKind = redis.call('TYPE', KEYS[3]).ok
  if indexKind ~= 'none' and indexKind ~= 'zset' then return -2 end
end
redis.call('SET', KEYS[1], ARGV[2])
if ARGV[4] == '1' then redis.call('ZREM', KEYS[3], ARGV[5]) end
if ARGV[6] ~= '' then redis.call('ZADD', KEYS[4], ARGV[6], ARGV[5]) end
return 1`;
const saveJob = async (key, raw, job, lease, terminal, stuckScore = '') => {
  job.version = nonce();
  const result = await redis('EVAL', UPDATE, 4, key, leaseKey, payoutIndexKey, payoutStuckKey, raw, JSON.stringify(job), lease, terminal ? '1' : '0', job.id, stuckScore);
  if (result === -2) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
  if (result !== 1) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
  return job;
};
const quarantineJob = async (id, code) => {
  await redis('ZADD', payoutQuarantineKey, String(Date.now()), id);
  await redis('ZREM', payoutIndexKey, id);
  console.info(JSON.stringify({ event: 'mainnet-payout-quarantine', code }));
};
// Validate every condition before writing. A lost response can leave both the
// journal and replay marker committed, but never a marker without its journal.
const PREPARE = `-- geek-mainnet-payout-prepare-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[3] then return 0 end
local kind = redis.call('TYPE', KEYS[3]).ok
if kind ~= 'none' and kind ~= 'hash' then return -2 end
local prior = redis.call('HGET', KEYS[3], ARGV[4])
if prior and prior ~= ARGV[5] then return -1 end
redis.call('HSET', KEYS[3], ARGV[4], ARGV[5])
redis.call('SET', KEYS[1], ARGV[2])
return 1`;

const savePreparedJob = async (key, raw, job, lease) => {
  job.version = nonce();
  const result = await redis('EVAL', PREPARE, 3, key, leaseKey, payoutSignedKey,
    raw, JSON.stringify(job), lease, job.id, job.journal.reveal.id);
  if (result === -1) throw new Error('MAINNET_PAYOUT_ALREADY_SIGNED');
  if (result === -2) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
  if (result !== 1) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
};

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
      const page = await redis('ZRANGE', payoutIndexKey, 0, 49);
      if (!Array.isArray(page) || page.some(id => !hex(id, 64))) throw new Error('MAINNET_PAYOUT_RECORD_INVALID');
      let job = null;
      for (const id of page) {
        const key = payoutJobKey(id), raw = await redis('GET', key);
        if (!raw) { await quarantineJob(id, 'PAYOUT_RECORD_INVALID'); continue; }
        let candidate;
        try { candidate = decodeJob(raw, id); }
        catch { await quarantineJob(id, 'PAYOUT_RECORD_INVALID'); continue; }
        if (!jobMacMatches(candidate, jobMacSecret())) { await quarantineJob(id, 'PAYOUT_MAC_INVALID'); continue; }
        const signedReveal = await redis('HGET', payoutSignedKey, candidate.id);
        if (signedReveal && candidate.journal?.reveal?.id !== signedReveal) { await quarantineJob(id, 'PAYOUT_ALREADY_SIGNED'); continue; }
        if (candidate.state === 'indexed-confirmed' || candidate.state === 'stuck') { await redis('ZREM', payoutIndexKey, id); continue; }
        if (jobIsStuck(candidate)) {
          const journal = candidate.journal ? JSON.stringify(candidate.journal) : '';
          candidate.state = 'stuck'; candidate.stuckAt = Date.now();
          if (journal && JSON.stringify(candidate.journal) !== journal) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
          await saveJob(key, raw, candidate, lease, true, String(candidate.stuckAt));
          console.info(JSON.stringify({ event: 'mainnet-payout-stuck', code: 'PAYOUT_UNCONFIRMED' }));
          continue;
        }
        if (!job) job = candidate;
      }
      if (job && job.configFingerprint !== config.fingerprint) throw new Error('MAINNET_PAYOUT_CONFIG_CHANGED');
      const signedReveal = job ? await redis('HGET', payoutSignedKey, job.id) : '';
      return sendJson(res, 200, { ok: true, lease, job, config, signedReveal: signedReveal || '' });
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
    if (job.version !== body.version || job.configFingerprint !== config.fingerprint || await redis('GET', leaseKey) !== body.lease || !jobMacMatches(job, jobMacSecret())) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
    if (job.state === 'stuck' && body.action !== 'check') throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
    let terminal = false;
    if (body.action === 'prepare') {
      if (job.state !== 'queued' || !validJournal(body.journal) || job.amount !== expectedRaw(job.proof)) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      await checkAsset(config);
      job.journal = body.journal; job.transactionHash = body.journal.reveal.id; job.state = 'prepared'; job.preparedAt = Date.now();
    } else if (body.action === 'submitted') {
      if (!['prepared', 'awaiting-indexer'].includes(job.state)) throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      if (!Number.isSafeInteger(job.submittedAt)) job.submittedAt = Date.now();
      job.state = 'awaiting-indexer';
    } else {
      if (!job.journal || job.state === 'queued') throw new Error('MAINNET_PAYOUT_STATE_CHANGED');
      await checkAsset(config);
      job.observation = transferObservation(await jsonFromIndexer(`op/${job.transactionHash}`, { allowMissingOperation: true }), job);
      if (job.observation.accepted) { job.state = 'indexed-confirmed'; terminal = true; }
      else if (job.state !== 'stuck') job.state = 'awaiting-indexer';
      job.lastCheckedAt = Date.now();
    }
    if (body.action === 'prepare') await savePreparedJob(key, raw, job, body.lease);
    else await saveJob(key, raw, job, body.lease, terminal);
    if (job.state === 'indexed-confirmed') await redis('ZREM', payoutStuckKey, job.id);
    return sendJson(res, 200, { ok: true, job });
  } catch (error) { return mainnetPayoutError(res, error); }
}

export function mainnetPayoutError(res, error) {
  if (error.message === 'MAINNET_PAYOUT_STATE_CHANGED') return sendJson(res, 409, { ok: false, error: 'Saved payout state changed. Reload the same payment.' });
  if (String(error.message || '').startsWith('MAINNET_')) return sendJson(res, 503, { ok: false, error: 'Mainnet GEEK payouts are paused. No transfer was made.' });
  return handleApiError(res, error);
}
