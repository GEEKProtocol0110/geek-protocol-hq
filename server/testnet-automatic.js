import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { redis, rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';
import { isValidKaspaTestnetAddress, normalizeKaspaAddress } from './kaspa-address.js';
import { checkAsset, jsonFromIndexer, testnetConfig, transferObservation, verifiedPilotRun } from './testnet-rewards.js';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { decodeIdentityRecord } from './identity-records.js';
import { identityPlayerKey } from './identity-keys.js';
import { testnetAddressForPublicKey } from './identity-wallet.js';
import { decodeRewardAddresses, rewardAddressKey } from './reward-addresses.js';
import { approvedFreshTest, readRetirements, retiredJobKey, validateRetirements } from './testnet-fresh-test.js';
import { createFeeRepair, decodeFeeRepair } from './testnet-fee-repair.js';

const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const hex = (s, n) => typeof s === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(s);
export const autoIndex = 'geek:testnet-auto:index:v1';
export const autoJobKey = id => `geek:testnet-auto:job:${id}`;
export const enrollmentKey = id => `geek:testnet-auto:player:${id}`;
const leaseKey = 'geek:testnet-auto:sender-lease:v1';
const nonce = () => randomBytes(12).toString('hex');

export function automaticConfig() {
  if (process.env.TESTNET_AUTO_ENABLED !== 'true') return null;
  const base = testnetConfig(), sender = normalizeKaspaAddress(process.env.TESTNET_AUTO_SENDER);
  const limit = process.env.TESTNET_AUTO_DAILY_LIMIT || '10';
  // A distinct dedicated signer keeps the manually operated wallet out of the service.
  if (!base || !isValidKaspaTestnetAddress(sender) || sender === base.sender || !/^(?:[1-9]|[1-9][0-9]|100)$/.test(limit) ||
      !/^[a-f0-9]{64}$/.test(process.env.TESTNET_AUTO_WORKER_TOKEN || '')) throw new Error('TESTNET_AUTO_CONFIG_INVALID');
  const { fingerprint: ignored, ...asset } = base;
  const config = { ...asset, sender, dailyLimit: Number(limit) };
  return { ...config, fingerprint: hash(config) };
}
export function decodeEnrollment(raw, playerId) {
  if (raw === null) return null;
  let e; try { e = JSON.parse(raw); } catch { throw new Error('TESTNET_AUTO_RECORD_INVALID'); }
  if (!e || e.schema !== 1 || e.playerId !== playerId || !hex(playerId, 32) || !hex(e.version, 24) ||
      !isValidKaspaTestnetAddress(e.recipient) || !Number.isSafeInteger(e.createdAt) || typeof e.enabled !== 'boolean') throw new Error('TESTNET_AUTO_RECORD_INVALID');
  return e;
}
// Operator approval stays on the server. An account-confirmed receiving address
// takes precedence over the older wallet-derived fallback.
async function rewardEnrollment(playerId, config) {
  const key = enrollmentKey(playerId), addressKey = rewardAddressKey(playerId);
  const [raw, addressRaw] = await Promise.all([redis('GET', key), redis('GET', addressKey)]);
  const enrollment = decodeEnrollment(raw, playerId), addresses = decodeRewardAddresses(addressRaw, playerId);
  const watched = { manualRaw: raw || '', addressRaw: addressRaw || '' };
  if (!config || enrollment?.enabled === false) return { key, raw, enrollment, ...watched };
  const approved = (process.env.TESTNET_AUTO_APPROVED_WALLETS || '').split(',').map(s => s.trim()).filter(Boolean);
  if (approved.length > 100 || approved.some(a => !isValidKaspaTestnetAddress(a) || a === config.sender)) throw new Error('TESTNET_AUTO_CONFIG_INVALID');
  if (addresses) {
    const recipient = addresses['testnet-10'];
    const admitted = recipient && (approved.includes(recipient) || enrollment?.recipient === recipient);
    return { key: addressKey, raw: addressRaw, ...watched, enrollment: admitted
      ? { recipient, enabled: true, version: addresses.version, createdAt: addresses.updatedAt, source: 'saved-account-address' } : null };
  }
  if (enrollment || !approved.length) return { key, raw, enrollment, ...watched };
  const identityKey = identityPlayerKey(playerId), identityRaw = await redis('GET', identityKey);
  const identity = decodeIdentityRecord(identityRaw, playerId);
  if (!identity) return { key, raw, enrollment: null, ...watched };
  const recipient = testnetAddressForPublicKey(identity.publicKey, identity.address);
  if (!approved.includes(recipient)) return { key, raw, enrollment: null, ...watched };
  return { key: identityKey, raw: identityRaw, ...watched, enrollment: { recipient, enabled: true,
    version: '', createdAt: identity.linkedAt, source: 'verified-wallet' } };
}

export function decodeJob(raw, id) {
  let j; try { j = JSON.parse(raw); } catch { throw new Error('TESTNET_AUTO_RECORD_INVALID'); }
  if (!j || j.schema !== 1 || j.id !== id || !hex(id, 64) || !hex(j.version, 24) || !hex(j.playerId, 32) ||
      j.network !== 'testnet-10' || !hex(j.configFingerprint, 64) || !hex(j.deploymentHash, 64) ||
      !/^[A-Z]{4,6}$/.test(j.ticker) || !/^[1-9][0-9]{0,19}$/.test(j.amount) || !/^(?:[0-9]|1[0-8])$/.test(j.decimals) ||
      !isValidKaspaTestnetAddress(j.sender) || !isValidKaspaTestnetAddress(j.recipient) || j.sender === j.recipient ||
      !hex(j.proof?.runId, 40) || !Number.isSafeInteger(j.createdAt) || j.createdAt <= 0 ||
      !['queued', 'prepared', 'awaiting-indexer', 'indexed-confirmed'].includes(j.state) ||
      (j.state !== 'queued' && !validJournal(j.journal)) ||
      (j.state !== 'queued' && j.transactionHash !== (j.feeRepair?.journal?.reveal?.id || j.journal.reveal.id)) ||
      (j.state === 'indexed-confirmed' && j.observation?.accepted !== true)) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  if (j.freshTestOf !== undefined && (!hex(j.freshTestOf, 64) || j.freshTestOf === id)) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  if (j.feeRepair !== undefined && j.state === 'queued') throw new Error('TESTNET_AUTO_RECORD_INVALID');
  decodeFeeRepair(j);
  return j;
}
export const validJournal = journal => Boolean(journal && Object.keys(journal).sort().join(',') === 'commit,reveal' &&
  ['commit', 'reveal'].every(k => journal[k] && Object.keys(journal[k]).sort().join(',') === 'id,transaction' && hex(journal[k].id, 64) &&
    typeof journal[k].transaction === 'string' && journal[k].transaction.length > 50 && journal[k].transaction.length <= 2800) &&
  journal.commit.id !== journal.reveal.id);

// This is prepared on the server only, before the ranked finish commit. No chain IO.
export async function prepareAutomaticReward(playerId, run) {
  const config = automaticConfig();
  if (!config || run.unranked || run.mode !== 'daily' || run.category !== 'kaspa') return null;
  const { key, raw, enrollment, manualRaw, addressRaw } = await rewardEnrollment(playerId, config);
  if (!enrollment?.enabled || enrollment.recipient === config.sender) return null;
  let proof;
  try { proof = verifiedPilotRun(JSON.stringify(run), run.id, run.sessionId); }
  catch (error) { if (error.message === 'TESTNET_RUN_INVALID') return null; throw error; }
  const id = hash(['testnet-pilot-v1', run.id]), createdAt = Date.now(), date = new Date(createdAt).toISOString().slice(0, 10);
  const job = { schema: 1, id, version: nonce(), state: 'queued', playerId, network: config.network, ticker: config.ticker,
    sender: config.sender, recipient: enrollment.recipient, deploymentHash: config.deploymentHash,
    configFingerprint: config.fingerprint, amount: config.amount, decimals: config.decimals, proof, createdAt };
  return { keys: [key, `geek:testnet-reward:run:${run.id}`, autoJobKey(id), autoIndex,
    `geek:testnet-auto:day:${date}`, `geek:testnet-auto:recipient-day:${hash([date, enrollment.recipient])}`, enrollmentKey(playerId), rewardAddressKey(playerId)],
  args: [raw, id, JSON.stringify(job), createdAt, config.dailyLimit, manualRaw, addressRaw] };
}

// Inserted into the SAME Redis transaction as the final ranked result. The shared
// run lock excludes the old manual desk. Budget/recipient locks never expire.
export const AUTO_PREFLIGHT_LUA = `
if ARGV[13] ~= '' then
  for _, i in ipairs({8,9,10,12,13,14,15}) do
    local kind = redis.call('TYPE', KEYS[i]).ok
    if kind ~= 'none' and kind ~= 'string' then return -3 end
  end
  local kind = redis.call('TYPE', KEYS[11]).ok
  if kind ~= 'none' and kind ~= 'zset' then return -3 end
  local count = redis.call('GET', KEYS[12])
  if count and not string.match(count, '^%d+$') then return -3 end
end`;
export const AUTO_COMMIT_LUA = `
if ARGV[13] ~= '' and redis.call('GET', KEYS[8]) == ARGV[13]
  and (redis.call('GET', KEYS[14]) or '') == ARGV[18] and (redis.call('GET', KEYS[15]) or '') == ARGV[19]
  and redis.call('EXISTS', KEYS[9]) == 0
  and redis.call('EXISTS', KEYS[10]) == 0 and redis.call('EXISTS', KEYS[13]) == 0
  and redis.call('ZCARD', KEYS[11]) < 100 and tonumber(redis.call('GET', KEYS[12]) or '0') < tonumber(ARGV[17]) then
  redis.call('SET', KEYS[9], ARGV[14])
  redis.call('SET', KEYS[10], ARGV[15])
  redis.call('ZADD', KEYS[11], ARGV[16], ARGV[14])
  redis.call('INCR', KEYS[12])
  redis.call('SET', KEYS[13], ARGV[14])
end`;

const publicJob = (j, retired) => ({ id: j.id, state: j.state, network: j.network, ticker: j.ticker, amount: j.amount, decimals: j.decimals,
  recipient: j.recipient, createdAt: j.createdAt, ...(j.transactionHash ? { transactionHash: j.transactionHash } : {}),
  ...(retired ? { serviceRetriesStopped: true } : {}), ...(j.freshTestOf ? { freshTest: true } : {}) });
export async function automaticPlayerView(session) {
  const playerId = playerIdFor(session), config = automaticConfig();
  const { enrollment } = await rewardEnrollment(playerId, config);
  const ids = await redis('ZREVRANGE', autoIndex, 0, 99);
  if (!Array.isArray(ids) || ids.some(id => !hex(id, 64))) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  const rows = ids.length ? await redis('MGET', ...ids.map(autoJobKey)) : [];
  if (!Array.isArray(rows) || rows.length !== ids.length) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  const owned = rows.map((raw, i) => decodeJob(raw, ids[i])).filter(j => j.playerId === playerId);
  const retired = await readRetirements(owned.map(job => job.id));
  return { enabled: Boolean(config), enrollment, records: owned.map(job => publicJob(job, retired.get(job.id))), mainnetSettlementEnabled: false };
}
export async function automaticPlayerHandler(req, res) {
  setApiHeaders(res, 'GET'); res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  try {
    const session = await requireSession(req);
    await rateLimit('testnet-auto-player', playerIdFor(session), 60, 600);
    return sendJson(res, 200, { ok: true, ...await automaticPlayerView(session) });
  } catch (error) { return automaticError(res, error); }
}
export async function enrollAutomaticPlayer(session, body) {
  if (Object.keys(body).some(k => !['action', 'recipient', 'enabled', 'version'].includes(k)) || typeof body.enabled !== 'boolean' ||
      !isValidKaspaTestnetAddress(body.recipient)) throw new Error('INVALID_REQUEST');
  const playerId = playerIdFor(session), key = enrollmentKey(playerId), raw = await redis('GET', key), old = decodeEnrollment(raw, playerId);
  if ((old?.version || '') !== (body.version || '')) throw new Error('TESTNET_AUTO_STATE_CHANGED');
  const record = { schema: 1, playerId, recipient: normalizeKaspaAddress(body.recipient), enabled: body.enabled, version: nonce(), createdAt: Date.now() };
  const outcome = await redis('EVAL', `-- geek-testnet-auto-enroll-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2]); return 1`, 1, key, raw || '', JSON.stringify(record));
  if (outcome !== 1) throw new Error('TESTNET_AUTO_STATE_CHANGED');
  return record;
}
const UPDATE = `-- geek-testnet-auto-update-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] or redis.call('GET', KEYS[2]) ~= ARGV[3] or redis.call('EXISTS', KEYS[3]) ~= 0 then return 0 end
redis.call('SET', KEYS[1], ARGV[2]); return 1`;
const validToken = req => {
  const expected = process.env.TESTNET_AUTO_WORKER_TOKEN || '', given = String(req.headers?.authorization || '');
  return /^[a-f0-9]{64}$/.test(expected) && Buffer.byteLength(given) === 71 && timingSafeEqual(Buffer.from(given), Buffer.from(`Bearer ${expected}`));
};
export async function automaticWorkerHandler(req, res) {
  setApiHeaders(res, 'POST'); res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  if (!validToken(req) || req.headers?.cookie || req.headers?.origin || req.headers?.['sec-fetch-site']) return sendJson(res, 401, { ok: false, error: 'Worker access required.' });
  try {
    const config = automaticConfig();
    if (!config) throw new Error('TESTNET_AUTO_DISABLED');
    await rateLimit('testnet-auto-worker', 'worker', 120, 60);
    const body = parseBody(req);
    if (body.action === 'claim') {
      if (Object.keys(body).length !== 1) throw new Error('INVALID_REQUEST');
      const lease = nonce();
      const claimed = await redis('SET', leaseKey, lease, 'NX', 'EX', 120);
      if (claimed !== 'OK') return sendJson(res, 200, { ok: true, busy: true });
      const ids = await redis('ZRANGE', autoIndex, 0, 99);
      if (!Array.isArray(ids) || ids.some(id => !hex(id, 64))) throw new Error('TESTNET_AUTO_RECORD_INVALID');
      let job = null;
      const jobs = [];
      for (const id of ids) jobs.push(decodeJob(await redis('GET', autoJobKey(id)), id));
      const retirements = await readRetirements(ids);
      validateRetirements(jobs, retirements);
      job = await approvedFreshTest({ jobs, retirements, config, lease, leaseKey, jobKey: autoJobKey, index: autoIndex });
      // One unresolved payment at a time protects the sender UTXOs and token balance.
      for (const candidate of jobs) {
        if (job) break;
        if (candidate.state !== 'indexed-confirmed' && !retirements.get(candidate.id)) { job = candidate; break; }
      }
      if (job && job.configFingerprint !== config.fingerprint) throw new Error('TESTNET_AUTO_CONFIG_CHANGED');
      return sendJson(res, 200, { ok: true, lease, job, config });
    }
    if (!hex(body.lease, 24)) throw new Error('INVALID_REQUEST');
    if (body.action === 'release') {
      if (Object.keys(body).some(k => !['action', 'lease'].includes(k))) throw new Error('INVALID_REQUEST');
      await redis('EVAL', `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`, 1, leaseKey, body.lease);
      return sendJson(res, 200, { ok: true });
    }
    if (!['prepare', 'repair-fee', 'submitted', 'check'].includes(body.action) || !hex(body.id, 64) || !hex(body.version, 24) ||
        Object.keys(body).some(k => !['action', 'lease', 'id', 'version', ...(['prepare', 'repair-fee'].includes(body.action) ? ['journal'] : [])].includes(k))) throw new Error('INVALID_REQUEST');
    const key = autoJobKey(body.id), raw = await redis('GET', key), job = decodeJob(raw, body.id);
    if (job.version !== body.version || job.configFingerprint !== config.fingerprint || await redis('GET', leaseKey) !== body.lease ||
        await redis('EXISTS', retiredJobKey(body.id))) throw new Error('TESTNET_AUTO_STATE_CHANGED');
    if (body.action === 'prepare') {
      if (job.state !== 'queued' || !validJournal(body.journal)) throw new Error('TESTNET_AUTO_STATE_CHANGED');
      await checkAsset(config);
      job.journal = body.journal; job.transactionHash = body.journal.reveal.id; job.state = 'prepared';
    } else if (body.action === 'repair-fee') {
      if (!['prepared', 'awaiting-indexer'].includes(job.state) || job.feeRepair || !job.freshTestOf) throw new Error('TESTNET_AUTO_STATE_CHANGED');
      const repair = createFeeRepair(job, body.journal);
      await checkAsset(config);
      const observation = transferObservation(await jsonFromIndexer(`op/${job.transactionHash}`, { allowMissingOperation: true }), job);
      if (observation.accepted) throw new Error('TESTNET_AUTO_STATE_CHANGED');
      job.feeRepair = repair; job.transactionHash = repair.journal.reveal.id; job.state = 'prepared';
      delete job.observation; delete job.lastCheckedAt;
    } else if (body.action === 'submitted') {
      if (!['prepared', 'awaiting-indexer'].includes(job.state)) throw new Error('TESTNET_AUTO_STATE_CHANGED');
      job.state = 'awaiting-indexer';
    } else {
      if (job.state === 'queued') throw new Error('TESTNET_AUTO_STATE_CHANGED');
      await checkAsset(config);
      job.observation = transferObservation(await jsonFromIndexer(`op/${job.transactionHash}`, { allowMissingOperation: true }), job);
      job.state = job.observation.accepted ? 'indexed-confirmed' : 'awaiting-indexer';
      job.lastCheckedAt = Date.now();
    }
    job.version = nonce();
    if (await redis('EVAL', UPDATE, 3, key, leaseKey, retiredJobKey(body.id), raw, JSON.stringify(job), body.lease) !== 1) throw new Error('TESTNET_AUTO_STATE_CHANGED');
    if (body.action === 'repair-fee') console.info(JSON.stringify({ event: 'tn10-fee-repair-created', sameFundingInput: true }));
    return sendJson(res, 200, { ok: true, job });
  } catch (error) { return automaticError(res, error); }
}
export function automaticError(res, error) {
  if (error.message === 'TESTNET_AUTO_STATE_CHANGED') return sendJson(res, 409, { ok: false, error: 'Saved payout state changed. Reload the same payment.' });
  if (error.message.startsWith('TESTNET_')) return sendJson(res, 503, { ok: false, error: 'Automatic testnet payments are paused or could not be verified. Existing payment receipts are retained.' });
  return handleApiError(res, error);
}
