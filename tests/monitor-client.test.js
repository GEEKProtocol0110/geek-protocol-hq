import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { monitorCopy } from '../server/ops-ui/assets/monitor.js';
import { ownerClient, escapeHtml } from '../server/ops-ui/assets/ops-core.js';
import { clientFixture, json } from './helpers/client-fixture.js';
const report = { checkedAt: Date.now(), passed: true, durationMs: 42, checks: Array.from({ length: 20 }, (_, i) => ({ id: String(i), passed: true, status: 200, elapsedMs: 2, reason: 'expected-response' })) };
const source = readFileSync(new URL('../server/ops-ui/assets/monitor.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '').replace('export const monitorCopy', 'const monitorCopy');
const settle = () => new Promise(setImmediate);
test('monitor copy never calls absent, inconsistent or stale evidence healthy', () => {
  assert.equal(monitorCopy(null).label, 'No checks saved');
  assert.equal(monitorCopy(report, report.checkedAt, 900000).label, 'Checks passed');
  assert.equal(monitorCopy(report, report.checkedAt + 900001, 900000).label, 'Stale snapshot');
  assert.equal(monitorCopy({ ...report, checks: [] }, report.checkedAt, 900000).label, 'Unavailable');
  const failed = { ...report, passed: false, checks: report.checks.map((c, i) => ({ ...c, passed: i !== 0 })) };
  assert.equal(monitorCopy(failed, report.checkedAt, 900000).label, 'Attention required');
});
test('visible evidence ages without extra requests, and a failed refresh clears old green results', async () => {
  let clock = 0, update, fail = false, requests = 0;
  const fetchImpl = async () => { requests++; return fail ? json({ ok: false }, 503) : json({ ok: true, history: [report], serverNow: report.checkedAt, freshnessMs: 900000, checks: [] }); };
  const fixture = clientFixture(fetchImpl, { ownerClient: args => ownerClient({ ...args, fetchImpl }), e: escapeHtml, performance: { now: () => clock }, setInterval(fn) { update = fn; } });
  fixture.run(source); await settle(); assert.equal(fixture.node('[data-overall]').textContent, 'Checks passed');
  clock = 900001; update(); assert.equal(fixture.node('[data-overall]').textContent, 'Stale snapshot'); assert.equal(requests, 1);
  fail = true; await fixture.node('[data-refresh]').emit('click'); await settle();
  assert.equal(fixture.node('[data-overall]').textContent, 'No current evidence'); assert.equal(fixture.node('[data-checks]').innerHTML, '');
  await fixture.window.emit('pagehide'); assert.equal(fixture.node('[data-history]').innerHTML, '');
});
