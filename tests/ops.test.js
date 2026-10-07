import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { roleClient, sourceLink, escapeHtml, auditSummary } from '../server/ops-ui/assets/ops-core.js';

const response = (payload = { ok: true }, status = 200) => ({ ok: status === 200, status, json: async () => payload });
test('operations access keys are separated by role and never included in request bodies or URLs', async () => {
  const requests = [], fetchImpl = async (url, options) => { requests.push({ url, options }); return response(); };
  const cce = roleClient({ endpoint: '/api/moderation', header: 'X-CCE-Admin', fetchImpl });
  const audit = roleClient({ endpoint: '/api/audit', header: 'X-Audit-Admin', fetchImpl });
  cce.unlock('cce-test-only'); audit.unlock('audit-test-only');
  await cce.request({ method: 'POST', body: { action: 'approve', id: 'question' } }); await audit.request({ query: '?offset=50&limit=50' });
  assert.equal(requests[0].options.headers['X-CCE-Admin'], 'cce-test-only');
  assert.equal(requests[1].options.headers['X-Audit-Admin'], 'audit-test-only');
  assert.equal(requests[0].options.headers['X-Audit-Admin'], undefined);
  assert.equal(requests[1].options.headers['X-CCE-Admin'], undefined);
  assert.equal(requests[0].options.body.includes('test-only'), false);
  assert.equal(requests.some(item => item.url.includes('test-only')), false);
  cce.clear(); await assert.rejects(() => cce.request(), /access key/); assert.equal(audit.hasKey(), true);
});
test('lock cancels pending access and rejects late replies even if transport ignores cancellation', async () => {
  let resolve, observedSignal;
  const client = roleClient({ endpoint: '/api/audit', header: 'X-Audit-Admin', fetchImpl: (url, options) => { observedSignal = options.signal; return new Promise(done => { resolve = done; }); } });
  client.unlock('synthetic'); const pending = client.request(); client.clear();
  assert.equal(observedSignal.aborted, true); resolve(response({ ok: true, events: ['private'] }));
  await assert.rejects(pending, { name: 'AbortError' }); assert.equal(client.hasKey(), false);
});
test('role changes reject stale data and duplicate clicks cannot send a second mutation', async () => {
  const replies = [];
  const client = roleClient({ endpoint: '/api/moderation', header: 'X-CCE-Admin', fetchImpl: () => new Promise(done => replies.push(done)) });
  client.unlock('first'); const first = client.request({ method: 'POST', body: { action: 'publish' } });
  await assert.rejects(() => client.request(), /current request/); assert.equal(replies.length, 1);
  client.unlock('second'); const second = client.request();
  replies[0](response()); await assert.rejects(first, { name: 'AbortError' });
  await assert.rejects(() => client.request(), /current request/);
  replies[1](response({ ok: true, queue: [] })); assert.deepEqual(await second, { ok: true, queue: [] });
});
test('request errors do not retry writes and preserve server access denial', async () => {
  let count = 0;
  const client = roleClient({ endpoint: '/api/payout-review', header: 'X-Payout-Review-Admin', fetchImpl: async () => { count += 1; return response({ ok: false }, 403); } });
  client.unlock('synthetic'); await assert.rejects(() => client.request({ method: 'POST', body: { action: 'approve' } }), error => error.status === 403);
  assert.equal(count, 1);
});
test('question evidence cannot create executable or credential-bearing links', () => {
  for (const url of ['javascript:alert(1)', 'data:text/html,<script>', '/relative', 'https://user:pass@example.org', 'not a url']) assert.equal(sourceLink(url), '');
  assert.equal(sourceLink('https://example.org/evidence'), 'https://example.org/evidence');
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});
test('audit risk counts describe loaded events, not inferred attacks', () => {
  assert.deepEqual(auditSummary([{severity:'warning',outcome:'success'},{severity:'critical',outcome:'failure'},{severity:'info',outcome:'failure'}]), {warning:1,critical:1,failures:2});
});
test('operations has no analytics, wallet signer, persistent credentials, or public privileged data', () => {
  const html = readFileSync(new URL('../server/ops-ui/index.html', import.meta.url), 'utf8');
  const js = readFileSync(new URL('../server/ops-ui/assets/ops.js', import.meta.url), 'utf8');
  const core = readFileSync(new URL('../server/ops-ui/assets/ops-core.js', import.meta.url), 'utf8');
  assert.match(html, /noindex,nofollow/); assert.doesNotMatch(html, /analytics\.js|site\.js|wallet\.js/);
  assert.doesNotMatch(js + core, /localStorage|sessionStorage|sendKaspa|signKRC|console\./);
  assert.match(js, /pagehide/); assert.match(js, /window\.confirm/); assert.match(js, /version !== epoch/);
});
