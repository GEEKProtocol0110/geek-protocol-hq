import { createHash, randomBytes } from 'node:crypto';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson } from './http.js';
import { operationsSession, operationsTrustedOrigin, operationsJsonRequest } from './operations-access.js';
import { requireSession } from './session.js';
import { isValidKaspaTestnetAddress, normalizeKaspaAddress } from './kaspa-address.js';
import { loadQuestionBank } from './questions.js';
import { redis, rateLimit } from './redis.js';
import { recordAuditEvent } from './audit.js';
import { activeRunKeyFor, runKeyFor } from './ranked-state.js';

const HASH = /^[a-f0-9]{64}$/;
const VERSION = /^[a-f0-9]{24}$/;
const RUN = /^[a-f0-9]{40}$/;
const BASE = 'https://tn10api.kasplex.org/v1/krc20';
export const testnetRewardKey = id => `geek:testnet-reward:v1:${id}`;
export const testnetRewardIndex = 'geek:testnet-reward:index:v1';
const fingerprint = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function testnetConfig() {
  if (process.env.TESTNET_REWARDS_ENABLED !== 'true') return null;
  const config = { network: process.env.TESTNET_REWARDS_NETWORK, ticker: process.env.TESTNET_REWARDS_TICKER,
    deploymentHash: process.env.TESTNET_REWARDS_DEPLOYMENT_HASH, decimals: process.env.TESTNET_REWARDS_DECIMALS,
    sender: normalizeKaspaAddress(process.env.TESTNET_REWARDS_SENDER), amount: process.env.TESTNET_REWARDS_AMOUNT_RAW };
  if (config.network !== 'testnet-10' || !/^[A-Z]{4,6}$/.test(config.ticker || '') || !HASH.test(config.deploymentHash || '') ||
      !/^(?:[0-9]|1[0-8])$/.test(config.decimals || '') || !isValidKaspaTestnetAddress(config.sender) ||
      !/^[1-9][0-9]{0,19}$/.test(config.amount || '')) throw new Error('TESTNET_CONFIG_INVALID');
  return { ...config, fingerprint: fingerprint(config) };
}
export const jsonFromIndexer = async (path, { allowMissingOperation = false } = {}) => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${BASE}/${path}`, { signal: controller.signal, redirect: 'error', cache: 'no-store' });
    const text = await response.text();
    if (text.length > 64000) throw new Error('unavailable');
    const payload = JSON.parse(text);
    // Kasplex returns 403 (rather than a successful empty array) while an
    // operation is absent. Only the explicit transfer-reconciliation callers
    // may treat that exact response as pending. Asset/deploy checks fail closed.
    if (allowMissingOperation && /^op\/[a-f0-9]{64}$/.test(path) &&
        [403, 404].includes(response.status) && payload?.message === 'op not found' && payload.result === null) return null;
    if (!response.ok) throw new Error('unavailable');
    if (payload.message !== 'successful' || !Array.isArray(payload.result) || payload.result.length > 1) throw new Error('unavailable');
    return payload.result[0] || null;
  } catch { throw new Error('TESTNET_INDEXER_UNAVAILABLE'); }
  finally { clearTimeout(timer); }
};
export const checkAsset = async config => {
  const [token, deployment] = await Promise.all([jsonFromIndexer(`token/${config.ticker}`), jsonFromIndexer(`op/${config.deploymentHash}`)]);
  if (!token || token.tick !== config.ticker || token.state !== 'deployed' || token.hashRev !== config.deploymentHash || token.dec !== config.decimals ||
      !deployment || deployment.p !== 'KRC-20' || deployment.op !== 'deploy' || deployment.tick !== config.ticker || deployment.hashRev !== config.deploymentHash ||
      deployment.dec !== config.decimals || deployment.txAccept !== '1' || deployment.opAccept !== '1' || deployment.opError) throw new Error('TESTNET_ASSET_MISMATCH');
};
export function verifiedPilotRun(raw, id, sessionId) {
  let run;
  try { run = JSON.parse(raw); } catch { throw new Error('TESTNET_RUN_INVALID'); }
  const bank = loadQuestionBank('kaspa');
  if (!run || run.id !== id || run.sessionId !== sessionId || run.status !== 'finished' || run.unranked || run.mode !== 'daily' || run.category !== 'kaspa' ||
      run.completedRound !== 1 || run.questionCount !== 5 || run.questionIndex !== 4 || !Array.isArray(run.roundQuestionIds) || run.roundQuestionIds.length !== 5 ||
      new Set(run.roundQuestionIds).size !== 5 || !run.roundQuestionIds.every(id => bank.byId.get(id)?.reviewStatus === 'source-checked') ||
      !Array.isArray(run.roundAnswers) || run.roundAnswers.length !== 5 || run.roundAnswers.some(a => typeof a?.correct !== 'boolean') ||
      !Number.isInteger(run.correct) || run.correct < 1 || run.correct > 5 || run.roundAnswers.filter(a => a.correct).length !== run.correct ||
      !Number.isSafeInteger(run.totalScore) || run.totalScore <= 0 || run.totalScore !== run.roundScore) throw new Error('TESTNET_RUN_INVALID');
  return { runId: id, mode: run.mode, category: run.category, correct: run.correct, answered: 5, score: run.totalScore };
}
const QUEUE_LUA = `-- geek-testnet-queue-v1
local previous = redis.call('GET', KEYS[2])
if previous then return previous end
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 'CHANGED' end
if redis.call('ZCARD', KEYS[4]) >= 100 then return 'FULL' end
redis.call('SET', KEYS[2], ARGV[2])
redis.call('SET', KEYS[3], ARGV[3])
redis.call('ZADD', KEYS[4], ARGV[4], ARGV[2])
return ARGV[2]`;
const UPDATE_LUA = `-- geek-testnet-update-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 'CHANGED' end
if ARGV[3] ~= '' then
  local used = redis.call('GET', KEYS[2])
  if used and used ~= ARGV[3] then return 'USED' end
  redis.call('SET', KEYS[2], ARGV[3])
end
redis.call('SET', KEYS[1], ARGV[2])
return 'OK'`;
const decode = (raw, id) => {
  let record; try { record = JSON.parse(raw); } catch { throw new Error('TESTNET_RECORD_INVALID'); }
  if (!record || record.schema !== 1 || record.id !== id || !HASH.test(id) || !VERSION.test(record.version) || record.network !== 'testnet-10' ||
      !HASH.test(record.configFingerprint) || !HASH.test(record.deploymentHash) || !RUN.test(record.proof?.runId) ||
      !isValidKaspaTestnetAddress(record.recipient) || !isValidKaspaTestnetAddress(record.sender) || !/^[A-Z]{4,6}$/.test(record.ticker) ||
      !/^[1-9][0-9]{0,19}$/.test(record.amount) || !/^(?:[0-9]|1[0-8])$/.test(record.decimals) || !Number.isSafeInteger(record.createdAt) || record.createdAt <= 0 ||
      record.proof.mode !== 'daily' || record.proof.category !== 'kaspa' || record.proof.answered !== 5 || !Number.isInteger(record.proof.correct) || record.proof.correct < 1 || record.proof.correct > 5 ||
      !Number.isSafeInteger(record.proof.score) || record.proof.score <= 0 ||
      !['queued', 'awaiting-indexer', 'indexed-confirmed'].includes(record.state) || (record.state !== 'queued' && !HASH.test(record.transactionHash || '')) ||
      (record.state === 'indexed-confirmed' && (record.observation?.accepted !== true || !HASH.test(record.observation.checkpoint || '') || !/^[0-9]+$/.test(record.observation.operationScore || '')))) throw new Error('TESTNET_RECORD_INVALID');
  return record;
};
export const transferObservation = (operation, record) => {
  if (!operation) return { accepted: false, reason: 'not-indexed' };
  if (operation.p !== 'KRC-20' || operation.op !== 'transfer' || operation.hashRev !== record.transactionHash || operation.tick !== record.ticker ||
      operation.from !== record.sender || operation.to !== record.recipient || operation.amt !== record.amount ||
      !/^[0-9]{13}$/.test(operation.mtsAdd || '') || Number(operation.mtsAdd) < record.createdAt || Number(operation.mtsAdd) > Date.now() + 60000) throw new Error('TESTNET_TRANSFER_MISMATCH');
  if (operation.opAccept !== '1' || operation.txAccept !== '1' || operation.opError) return { accepted: false, reason: 'not-accepted' };
  if (!/^[0-9]+$/.test(operation.opScore || '') || !HASH.test(operation.checkpoint || '')) throw new Error('TESTNET_INDEXER_UNAVAILABLE');
  return { accepted: true, operationScore: operation.opScore, checkpoint: operation.checkpoint };
};
// Read the same current run and its actual remaining lifetime without renewing it.
const RUN_WINDOW_LUA = `-- geek-testnet-run-window-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return {} end
return {redis.call('GET', KEYS[2]) or '', redis.call('PTTL', KEYS[2])}`;
const latestPilotRun = async req => {
  const session = await requireSession(req), activeKey = activeRunKeyFor(session.id);
  const id = await redis('GET', activeKey);
  const base = { playerName: session.name, state: 'missing' };
  if (!RUN.test(id || '')) return base;
  const snapshot = await redis('EVAL', RUN_WINDOW_LUA, 2, activeKey, runKeyFor(id), id);
  if (!Array.isArray(snapshot)) throw new Error('TESTNET_RECORD_INVALID');
  if (!snapshot.length || !snapshot[0] || !Number.isSafeInteger(snapshot[1]) || snapshot[1] <= 0) return base;
  let proof;
  try { proof = verifiedPilotRun(snapshot[0], id, session.id); }
  catch (error) { if (error.message !== 'TESTNET_RUN_INVALID') throw error; return { ...base, state: 'ineligible' }; }
  if (snapshot[1] > 300000) return { ...base, state: 'ineligible' };
  return { playerName: session.name, state: 'eligible', run: { id, correct: proof.correct, score: proof.score, remainingMs: snapshot[1] } };
};
export async function testnetRewardsHandler(req, res) {
  try {
    if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST');
    const owner = await operationsSession(req);
    if (!owner) return sendJson(res, 401, { ok: false, error: 'Sign in to open the testnet pilot.' });
    if (!owner.permissions.includes('payout') || req.headers?.['sec-fetch-site'] === 'cross-site' ||
        ['authorization', 'x-cce-admin', 'x-audit-admin', 'x-payout-review-admin'].some(h => Object.hasOwn(req.headers || {}, h)) ||
        (req.headers?.origin && !operationsTrustedOrigin(req)) || (req.method === 'POST' && (!operationsTrustedOrigin(req) || !operationsJsonRequest(req)))) return sendJson(res, 403, { ok: false, error: 'Owner payout-review access is required.' });
    await rateLimit('testnet-pilot', clientFingerprint(req), 40, 600);
    const config = testnetConfig();
    if (req.method === 'GET') {
      if (req.query?.run !== undefined) {
        if (req.query.run !== 'latest') throw new Error('INVALID_REQUEST');
        return sendJson(res, 200, { ok: true, enabled: Boolean(config), ...(config ? await latestPilotRun(req) : { state: 'disabled' }), automaticSigning: false, mainnetSettlementEnabled: false });
      }
      const ids = await redis('ZREVRANGE', testnetRewardIndex, 0, 19);
      if (!Array.isArray(ids) || ids.some(id => !HASH.test(id))) throw new Error('TESTNET_RECORD_INVALID');
      const rows = ids.length ? await redis('MGET', ...ids.map(testnetRewardKey)) : [];
      if (!Array.isArray(rows) || rows.length !== ids.length) throw new Error('TESTNET_RECORD_INVALID');
      return sendJson(res, 200, { ok: true, enabled: Boolean(config), network: 'testnet-10', config, records: rows.map((raw, i) => decode(raw, ids[i])), automaticSigning: false, mainnetSettlementEnabled: false });
    }
    if (!config) throw new Error('TESTNET_DISABLED');
    const body = parseBody(req);
    if (body.action === 'queue') {
      if (Object.keys(body).some(k => !['action', 'runId', 'recipient'].includes(k)) || !RUN.test(body.runId || '') || !isValidKaspaTestnetAddress(body.recipient)) throw new Error('INVALID_REQUEST');
      const session = await requireSession(req), raw = await redis('GET', runKeyFor(body.runId));
      const proof = verifiedPilotRun(raw, body.runId, session.id);
      await checkAsset(config);
      const id = fingerprint(['testnet-pilot-v1', body.runId]), createdAt = Date.now();
      const record = { schema: 1, id, version: randomBytes(12).toString('hex'), state: 'queued', network: config.network, configFingerprint: config.fingerprint,
        ticker: config.ticker, deploymentHash: config.deploymentHash, sender: config.sender, recipient: normalizeKaspaAddress(body.recipient), amount: config.amount, decimals: config.decimals, proof, createdAt };
      await recordAuditEvent({ type: 'testnet.reward.queue.requested', actorType: 'owner-session', actorId: clientFingerprint(req), objectType: 'testnet-reward', objectId: id, outcome: 'success', reason: 'owner-pilot', details: { mainnet: false } });
      const saved = await redis('EVAL', QUEUE_LUA, 4, runKeyFor(body.runId), `geek:testnet-reward:run:${body.runId}`, testnetRewardKey(id), testnetRewardIndex, raw, id, JSON.stringify(record), createdAt);
      if (saved === 'CHANGED' || saved === 'FULL') throw new Error('TESTNET_STATE_CHANGED');
      if (saved !== id) throw new Error('TESTNET_RECORD_INVALID');
      const committed = decode(await redis('GET', testnetRewardKey(id)), id);
      if (committed.configFingerprint !== config.fingerprint || committed.recipient !== record.recipient) throw new Error('TESTNET_STATE_CHANGED');
      return sendJson(res, 200, { ok: true, record: committed, automaticSigning: false, mainnetSettlementEnabled: false });
    }
    if (!['attach', 'check'].includes(body.action) || Object.keys(body).some(k => !['action', 'id', 'version', 'transactionHash'].includes(k)) ||
        !HASH.test(body.id || '') || !VERSION.test(body.version || '') || (body.action === 'attach' && !HASH.test(body.transactionHash || '')) ||
        (body.action === 'check' && Object.hasOwn(body, 'transactionHash'))) throw new Error('INVALID_REQUEST');
    const raw = await redis('GET', testnetRewardKey(body.id)), record = decode(raw, body.id);
    if (record.version !== body.version || record.configFingerprint !== config.fingerprint) throw new Error('TESTNET_STATE_CHANGED');
    await checkAsset(config);
    let observation;
    if (body.action === 'attach') {
      if (record.state !== 'queued') throw new Error('TESTNET_STATE_CHANGED');
      record.transactionHash = body.transactionHash; record.state = 'awaiting-indexer'; record.attachedAt = Date.now();
    } else {
      if (record.state === 'queued') throw new Error('TESTNET_STATE_CHANGED');
      observation = transferObservation(await jsonFromIndexer(`op/${record.transactionHash}`, { allowMissingOperation: true }), record);
      // An absent, rejected or reorged observation never erases the transaction hash or permits another send.
      record.state = observation.accepted ? 'indexed-confirmed' : 'awaiting-indexer';
      record.lastCheckedAt = Date.now(); record.observation = observation;
    }
    record.version = randomBytes(12).toString('hex');
    await recordAuditEvent({ type: `testnet.reward.${body.action}.requested`, actorType: 'owner-session', actorId: clientFingerprint(req), objectType: 'testnet-reward', objectId: body.id, outcome: 'success', reason: 'owner-pilot', details: { mainnet: false } });
    const outcome = await redis('EVAL', UPDATE_LUA, 2, testnetRewardKey(body.id), `geek:testnet-reward:tx:${record.transactionHash}`, raw, JSON.stringify(record), body.action === 'attach' ? body.id : '');
    if (outcome !== 'OK') throw new Error('TESTNET_STATE_CHANGED');
    return sendJson(res, 200, { ok: true, record, observation, automaticSigning: false, mainnetSettlementEnabled: false });
  } catch (error) {
    if (error.message === 'TESTNET_STATE_CHANGED') return sendJson(res, 409, { ok: false, error: 'The pilot receipt changed, the transaction was already attached, or the 100-receipt pilot limit was reached. Refresh before continuing.' });
    if (['TESTNET_RUN_INVALID', 'TESTNET_TRANSFER_MISMATCH'].includes(error.message)) return sendJson(res, 409, { ok: false, error: error.message === 'TESTNET_RUN_INVALID' ? 'Finish a complete Kaspa Daily Signal on this player before queuing the pilot receipt. Finished runs remain available for five minutes.' : 'The indexed transfer does not match this receipt. Keep the transaction hash and investigate; do not send again.' });
    if (error.message.startsWith('TESTNET_')) return sendJson(res, 503, { ok: false, error: 'The testnet pilot is disabled or its configuration, asset, indexer or receipt storage could not be verified. No transaction was sent.' });
    return handleApiError(res, error);
  }
}
