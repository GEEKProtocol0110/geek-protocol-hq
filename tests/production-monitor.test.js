import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monitorChecks, MONITOR_ORIGIN, MONITOR_TIMEOUT, probeProduction, validMonitorReport, validateProbe } from '../server/production-monitor.js';
import { expectedProbe } from './helpers/monitor-fixture.js';

test('all production probes use the fixed HQ, GET, no credentials and manual redirects; reports contain no response data', async () => {
  const calls = [];
  const report = await probeProduction({ fetchImpl: async (url, options) => {
    calls.push({ url, options }); const spec = monitorChecks.find(s => url === MONITOR_ORIGIN + s.path); assert.ok(spec);
    assert.equal(options.method, 'GET'); assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'manual');
    assert.deepEqual(Object.keys(options.headers).sort(), ['Cache-Control', 'User-Agent']); return expectedProbe(spec);
  } });
  assert.equal(calls.length, 21); assert.equal(report.passed, true); assert.equal(report.schema, 2); assert.equal(validMonitorReport(report), true);
  assert.ok(report.checks.every(c => Object.keys(c).sort().join(',') === 'elapsedMs,id,passed,reason,status'));
  const { probe } = JSON.parse(JSON.stringify({ probe: report })); probe.checks[0].passed = false; assert.equal(validMonitorReport(probe), false);
  assert.equal(validMonitorReport({ ...report, playerId: 'private' }), false);
  assert.equal(validMonitorReport({ ...report, checks: report.checks.slice(1) }), false);
  const forged = structuredClone(report); forged.checks[0].status = 503;
  assert.equal(validMonitorReport(forged), false, 'A failure status cannot be stored as a passing check');
});
test('mint monitoring rejects unavailable, stale, mismatched or inconsistent success but accepts verified exhaustion', async () => {
  const spec = monitorChecks.find(s => s.id === 'mint-status');
  assert.equal(spec.path, '/api/mint/?fresh=1');
  const response = expectedProbe(spec), base = JSON.parse(await response.text());
  for (const patch of [
    { deployment: { ...base.deployment, deploymentHash: 'f'.repeat(64) } },
    { deployment: { ...base.deployment, ticker: 'GEEKT' } },
    { deployment: { ...base.deployment, verified: false } },
    { sourceUrl: 'https://untrusted.invalid/token/GEEK' }, { checkedAt: Date.now() - 61_000 },
    { mint: { ...base.mint, remainingMints: '1' } }, { mint: { ...base.mint, mintedRaw: '1' } },
    { mint: { ...base.mint, mintedRaw: '14400000000000000001' } },
    { mint: { ...base.mint, open: false } }, { transaction: { ...base.transaction, userApprovalRequired: false } }
  ]) assert.equal(validateProbe(spec, response, JSON.stringify({ ...base, ...patch })), false, JSON.stringify(patch));
  assert.equal(validateProbe(spec, new Response('unavailable', { status: 503 }), 'unavailable'), false);
  const exhausted = { ...base, mint: { ...base.mint, state: 'finished', open: false, minted: base.mint.maximum, mintedRaw: base.mint.maximumRaw, completedMints: '1440000', remainingMints: '0', progressBasisPoints: 10000 } };
  assert.equal(validateProbe(spec, response, JSON.stringify(exhausted)), true);
  exhausted.mint.open = true; assert.equal(validateProbe(spec, response, JSON.stringify(exhausted)), false);
  const report = await probeProduction({ fetchImpl: async url => {
    const check = monitorChecks.find(s => url === MONITOR_ORIGIN + s.path);
    return check.id === 'mint-status' ? new Response('upstream problem', { status: 503 }) : expectedProbe(check);
  } });
  assert.equal(report.passed, false); assert.deepEqual(report.checks.filter(c => !c.passed).map(c => c.id), ['mint-status']);
  assert.doesNotMatch(JSON.stringify(report), /upstream problem|kasplex/);
});
test('legacy reports remain readable without pretending to cover mint availability', async () => {
  const report = await probeProduction({ fetchImpl: async url => expectedProbe(monitorChecks.find(s => url === MONITOR_ORIGIN + s.path)) });
  const legacy = { ...report, schema: 1, checks: report.checks.filter(c => c.id !== 'mint-status') };
  assert.equal(validMonitorReport(legacy), true);
  assert.equal(validMonitorReport({ ...legacy, schema: 2 }), false);
  assert.equal(validMonitorReport({ ...report, schema: 1 }), false);
});
test('privacy and gate regressions fail even when endpoints return HTTP 200', async () => {
  for (const id of ['study-api', 'royale-api']) {
    const spec = monitorChecks.find(s => s.id === id), response = expectedProbe(spec), body = JSON.parse(await response.text());
    body.extra = { correctIndex: 2, playerId: 'private' }; assert.equal(validateProbe(spec, response, JSON.stringify(body)), false);
  }
  const gate = monitorChecks.find(s => s.id === 'economy'), response = expectedProbe(gate), body = JSON.parse(await response.text());
  body.economy.payoutsEnabled = true; assert.equal(validateProbe(gate, response, JSON.stringify(body)), false);
  for (const kind of ['private-page', 'private-api']) {
    const spec = monitorChecks.find(s => s.kind === kind), response = expectedProbe(spec);
    assert.equal(validateProbe(spec, new Response('login', { status: 200, headers: response.headers }), 'login'), false);
    assert.equal(validateProbe(spec, new Response('', { status: 303, headers: { Location: 'https://evil.invalid/', 'Cache-Control': 'private, no-store' } }), ''), false);
  }
});
test('the actual shipped public pages satisfy the monitor contract', () => {
  for (const spec of monitorChecks.filter(s => s.kind === 'page')) {
    const path = `../public${spec.path}index.html`;
    const html = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal(validateProbe(spec, new Response(html, { headers: { 'Content-Type': 'text/html' } }), html), true, spec.path);
  }
});
test('an outage preserves failed HTTP status without recording a body or upstream error', async () => {
  const report = await probeProduction({ fetchImpl: async url => {
    const spec = monitorChecks.find(s => url === MONITOR_ORIGIN + s.path);
    return spec.id === 'health' ? new Response('Sensitive upstream details', { status: 503 }) : expectedProbe(spec);
  } });
  assert.equal(report.passed, false); assert.equal(report.checks.filter(c => !c.passed).length, 1);
  assert.equal(report.checks.find(c => c.id === 'health').status, 503);
  assert.equal(JSON.stringify(report).includes('Sensitive'), false);
});
test('deadlines bound transport and response-body hangs even when cancellation is ignored', async t => {
  const timers = []; t.mock.method(globalThis, 'setTimeout', (fn, ms) => { assert.equal(ms, MONITOR_TIMEOUT); timers.push(fn); return 1; }); t.mock.method(globalThis, 'clearTimeout', () => {});
  const pending = probeProduction({ fetchImpl: async () => ({ status: 200, headers: new Headers(), body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => {} }) } }) });
  await new Promise(setImmediate); timers.forEach(fn => fn());
  const report = await pending; assert.ok(report.checks.every(c => !c.passed && c.reason === 'timed-out' && c.status === 200));
  timers.length = 0;
  const stalled = probeProduction({ fetchImpl: () => new Promise(() => {}) }); timers.forEach(fn => fn());
  assert.ok((await stalled).checks.every(c => c.reason === 'timed-out' && c.status === 0));
});
test('oversized responses fail and scheduled monitoring is credential-free with pinned actions', async () => {
  const report = await probeProduction({ fetchImpl: async () => new Response('x'.repeat(384001)) });
  assert.ok(report.checks.every(c => c.reason === 'response-too-large'));
  const workflow = readFileSync(new URL('../.github/workflows/production-monitor.yml', import.meta.url), 'utf8');
  assert.match(workflow, /cron: '7,22,37,52 \* \* \* \*'/); assert.match(workflow, /contents: read/);
  assert.doesNotMatch(workflow, /secrets\.|pull_request_target|issues: write|curl|npm ci/);
  for (const pin of workflow.matchAll(/uses: ([^\s]+)/g)) assert.match(pin[1], /@[a-f0-9]{40}$/);
});

test('Testnet page monitoring requires the fixed post-login desk destination',()=>{
  const spec=monitorChecks.find(s=>s.id==='testnet-page');
  const response=location=>new Response('',{status:303,headers:{Location:location,'Cache-Control':'private, no-store'}});
  assert.equal(validateProbe(spec,response('/ops-login/?next=testnet'),''),true);
  for(const location of ['/ops-login/','/ops-login/?next=https://evil.invalid','https://evil.invalid/ops-login/?next=testnet'])assert.equal(validateProbe(spec,response(location),''),false);
});
