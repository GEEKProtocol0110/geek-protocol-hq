// Shared read-only probes for the owner desk and independent GitHub runner.
import { GEEK_DEPLOYMENT } from './geek-deployment.js';
export const MONITOR_ORIGIN = 'https://www.geekprotocol.xyz';
export const MONITOR_TIMEOUT = 5000;
export const MONITOR_FRESH_MS = 15 * 60 * 1000;
const pages = [
  ['home', 'Home', '/', 'id="home-gauntlet-title"'], ['study', 'Study', '/study/', 'data-topics'],
  ['play', 'Play', '/play/', 'data-mode'], ['royale', 'Royale', '/royale/', 'data-create-form'],
  ['sign-in', 'Sign-in', '/sign-in/', 'data-sign-in-continue'],
  ['widget-guide', 'Widget installation', '/tools/kaspa-widget/', 'id="widget-version"']
];
export const monitorChecks = Object.freeze([
  ...pages.map(([id, name, path, marker]) => ({ id, name, path, kind: 'page', marker })),
  { id: 'health', name: 'Database health', path: '/api/health/', kind: 'health' },
  { id: 'study-api', name: 'Learning catalog', path: '/api/ranked/?service=study', kind: 'study' },
  { id: 'royale-api', name: 'Public room discovery', path: '/api/royale/?discover=1', kind: 'royale' },
  { id: 'economy', name: 'Payment gates', path: '/api/session/?service=economy', kind: 'economy' },
  { id: 'widget-api', name: 'Widget release metadata', path: '/api/widget/', kind: 'widget' },
  { id: 'mint-status', name: 'Verified GEEK mint availability', path: '/api/mint/?fresh=1', kind: 'mint' },
  ...['imported', 'testnet', 'monitor'].flatMap(page => [
    { id: `${page}-page`, name: `${page} page protection`, path: `/ops/${page}/`, kind: 'private-page' },
    { id: `${page}-api`, name: `${page} API protection`, path: `/api/session/?service=operations&action=${page}`, kind: 'private-api' },
    { id: `${page}-asset`, name: `${page} script protection`, path: `/ops/assets/${page}.js`, kind: 'private-api' }
  ])
]);
const PRIVATE_KEYS = new Set(['correctIndex', 'questionHash', 'playerId', 'sessionId', 'hostId', 'players', 'answers']);
const leaks = value => value && typeof value === 'object' && Object.entries(value).some(([key, child]) => PRIVATE_KEYS.has(key) || leaks(child));
const header = (response, name) => response.headers.get(name) || '';
const privateHeaders = response => /(?:^|,)\s*private\b/i.test(header(response, 'cache-control')) && /\bno-store\b/i.test(header(response, 'cache-control'));
const mintStatusValid = data => {
  const { deployment, mint, transaction } = data;
  if (deployment?.verified !== true || !Object.entries(GEEK_DEPLOYMENT).every(([key, value]) => deployment[key] === value) ||
    !['https://api.kasplex.org/v1/krc20/token/GEEK', 'https://api-fallback.kasplex.org/v1/krc20/token/GEEK'].includes(data.sourceUrl) ||
    !Number.isSafeInteger(data.checkedAt) || Math.abs(Date.now() - data.checkedAt) > 60_000 ||
    typeof mint?.mintedRaw !== 'string' || !/^(?:0|[1-9][0-9]{0,19})$/.test(mint.mintedRaw) ||
    mint.maximumRaw !== GEEK_DEPLOYMENT.maxRaw || mint.perMintRaw !== GEEK_DEPLOYMENT.limitRaw ||
    transaction?.userApprovalRequired !== true || transaction.custodial !== false || transaction.type !== 3 ||
    transaction.inscription !== JSON.stringify({ p: 'KRC-20', op: 'mint', tick: 'GEEK' })) return false;
  const minted = BigInt(mint.mintedRaw), maximum = BigInt(GEEK_DEPLOYMENT.maxRaw), limit = BigInt(GEEK_DEPLOYMENT.limitRaw);
  if (minted > maximum || minted % limit !== 0n) return false;
  const remaining = (maximum - minted) / limit, scale = 10n ** BigInt(GEEK_DEPLOYMENT.decimals);
  return mint.completedMints === String(minted / limit) && mint.totalMints === String(maximum / limit) &&
    mint.remainingMints === String(remaining) && mint.minted === String(minted / scale) &&
    mint.maximum === String(maximum / scale) && mint.perMint === String(limit / scale) &&
    mint.progressBasisPoints === Number(minted * 10_000n / maximum) &&
    (remaining > 0n ? mint.state === 'deployed' && mint.open === true : ['deployed', 'finished'].includes(mint.state) && mint.open === false);
};
export function validateProbe(spec, response, text) {
  if (spec.kind === 'private-page') {
    const target = spec.path === '/ops/testnet/' ? '/ops-login/?next=testnet' : '/ops-login/';
    return response.status === 303 && privateHeaders(response) &&
      [target, `${MONITOR_ORIGIN}${target}`].includes(header(response, 'location')) && !text;
  }
  if (spec.kind === 'private-api') {
    if (response.status !== 401 || !privateHeaders(response)) return false;
    const data = JSON.parse(text);
    return data.ok === false && typeof data.error === 'string' && Object.keys(data).every(key => ['ok', 'error'].includes(key));
  }
  if (response.status !== 200) return false;
  if (spec.kind === 'page') return /text\/html/i.test(header(response, 'content-type')) && /<!doctype html/i.test(text) && text.includes(spec.marker);
  const data = JSON.parse(text);
  if (spec.kind === 'widget') return /^\d+\.\d+\.\d+$/.test(data.version || '') && Number.isSafeInteger(data.size) && data.size > 0 && data.size <= 20 * 1024 * 1024 && /^[a-f0-9]{64}$/.test(data.sha256 || '') && data.release === `https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/tag/v${data.version}`;
  if (data.ok !== true || !/\bno-store\b/i.test(header(response, 'cache-control')) || leaks(data)) return false;
  if (spec.kind === 'mint') return mintStatusValid(data);
  if (spec.kind === 'health') return data.storage === 'connected';
  if (spec.kind === 'study') return Array.isArray(data.topics) && data.topics.length >= 8 && data.topics.length <= 100 && new Set(data.topics.map(t => t.id)).size === data.topics.length && data.topics.every(t => typeof t.id === 'string' && Number.isSafeInteger(t.count) && t.count > 0) && data.ranked === false && data.rewardsEnabled === false;
  if (spec.kind === 'royale') return Number.isSafeInteger(data.discovery?.serverNow) && Array.isArray(data.discovery?.rooms) && data.discovery.rooms.length <= 20 && data.discovery.rooms.every(r => Object.keys(r).every(key => ['code', 'category', 'capacity', 'seats', 'online', 'createdAt', 'expiresAt'].includes(key)) && /^ROY-[A-Z2-9]{8}$/.test(r.code || '') && Number.isInteger(r.seats) && r.seats > 0 && r.seats < r.capacity && Number.isInteger(r.capacity) && r.capacity <= 100 && Number.isInteger(r.online) && r.online > 0 && r.online <= r.seats);
  if (spec.kind === 'economy') return data.economy?.journal === 'planning-only' && data.economy.purchasesEnabled === false && data.economy.payoutsEnabled === false && data.economy.burnsEnabled === false && data.economy.reserve?.signingEnabled === false;
  return false;
}
const boundedText = async (response, maximum) => {
  if (!response.body) return '';
  const reader = response.body.getReader(), chunks = []; let bytes = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > maximum) throw new Error('BODY_LIMIT'); chunks.push(part.value); }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const all = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { all.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(all);
};
export async function probeProduction({ fetchImpl = globalThis.fetch } = {}) {
  const checkedAt = Date.now(), started = performance.now();
  const checks = await Promise.all(monitorChecks.map(async spec => {
    const since = performance.now(), controller = new AbortController();
    let expire;
    const deadline = new Promise((_, reject) => { expire = reject; });
    const timer = setTimeout(() => { controller.abort(); expire(new Error('timeout')); }, MONITOR_TIMEOUT);
    let status = 0, reason = 'request-failed', passed = false;
    try {
      // Never forward the owner's cookie, authorization or arbitrary URLs. Redirects are evidence.
      passed = await Promise.race([(async () => {
        const response = await fetchImpl(MONITOR_ORIGIN + spec.path, { method: 'GET', credentials: 'omit', redirect: 'manual', cache: 'no-store', signal: controller.signal,
          headers: { 'User-Agent': 'Geek-HQ-Production-Monitor/1', 'Cache-Control': 'no-cache' } });
        status = response.status;
        const text = await boundedText(response, spec.kind === 'page' ? 384000 : 64000);
        if (controller.signal.aborted) throw new Error('timeout');
        return validateProbe(spec, response, text);
      })(), deadline]);
      reason = passed ? 'expected-response' : 'response-mismatch';
    } catch (error) { reason = controller.signal.aborted ? 'timed-out' : error.message === 'BODY_LIMIT' ? 'response-too-large' : 'request-failed'; }
    finally { clearTimeout(timer); controller.abort(); }
    return { id: spec.id, passed, status, elapsedMs: Math.max(0, Math.round(performance.now() - since)), reason };
  }));
  return { schema: 2, checkedAt, durationMs: Math.round(performance.now() - started), passed: checks.every(c => c.passed), checks };
}
export function validMonitorReport(report, now = Date.now()) {
  // Preserve exact pre-mint snapshots; schema 1 never claims the expanded coverage.
  const definitions = report?.schema === 1 ? monitorChecks.filter(c => c.id !== 'mint-status') : monitorChecks;
  return Boolean(report && Object.keys(report).every(key => ['schema', 'checkedAt', 'durationMs', 'passed', 'checks'].includes(key)) && [1, 2].includes(report.schema) && Number.isSafeInteger(report.checkedAt) && report.checkedAt > 0 && report.checkedAt <= now + 60000 &&
    Number.isSafeInteger(report.durationMs) && report.durationMs >= 0 && report.durationMs <= 60000 && typeof report.passed === 'boolean' &&
    Array.isArray(report.checks) && report.checks.length === definitions.length && report.checks.every((c, i) => c && Object.keys(c).every(key => ['id', 'passed', 'status', 'elapsedMs', 'reason'].includes(key)) && c.id === definitions[i].id && typeof c.passed === 'boolean' && Number.isInteger(c.status) && c.status >= 0 && c.status <= 599 && Number.isSafeInteger(c.elapsedMs) && c.elapsedMs >= 0 && c.elapsedMs <= 60000 &&
      ['expected-response', 'response-mismatch', 'timed-out', 'response-too-large', 'request-failed'].includes(c.reason) && c.passed === (c.reason === 'expected-response') &&
      (!c.passed || c.status === (definitions[i].kind === 'private-page' ? 303 : definitions[i].kind === 'private-api' ? 401 : 200))) && report.passed === report.checks.every(c => c.passed));
}
