import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ownerClient, sourceLink, escapeHtml, auditSummary } from '../server/ops-ui/assets/ops-core.js';

const response = (payload = { ok: true }, status = 200) => ({ ok: status === 200, status, json: async () => payload });
test('owner workspaces use cookies without role credentials, key fields or cross-workspace requests', async () => {
  const requests=[],fetchImpl=async(url,options)=>{requests.push({url,options});return response();};
  const cce=ownerClient({endpoint:'/api/moderation/',fetchImpl}),audit=ownerClient({endpoint:'/api/audit/',fetchImpl});
  await cce.request({method:'POST',body:{action:'approve',id:'question'}});await audit.request({query:'?offset=50&limit=50'});
  for(const {options} of requests){assert.deepEqual(options.headers,{'Content-Type':'application/json'});assert.equal(options.credentials,'same-origin');}
  for(const page of ['questions','activity','payouts']){const html=readFileSync(new URL(`../server/ops-ui/${page}/index.html`,import.meta.url),'utf8');assert.equal((html.match(/data-role=/g)||[]).length,1);assert.doesNotMatch(html,/name="key"|data-access|data-lock/);assert.match(html,/aria-current="page"/);}
  const home=readFileSync(new URL('../server/ops-ui/index.html',import.meta.url),'utf8');assert.doesNotMatch(home,/data-role=/);for(const path of ['questions','activity','payouts'])assert.match(home,new RegExp(`/ops/${path}/`));
});
test('lock cancels pending access and rejects late replies even if transport ignores cancellation', async () => {
  let resolve, observedSignal;
  const client = ownerClient({ endpoint: '/api/audit', header: 'X-Audit-Admin', fetchImpl: (url, options) => { observedSignal = options.signal; return new Promise(done => { resolve = done; }); } });
  const pending = client.request(); client.clear();
  assert.equal(observedSignal.aborted, true); resolve(response({ ok: true, events: ['private'] }));
  await assert.rejects(pending, { name: 'AbortError' });
});
test('clearing a view rejects stale data and duplicate clicks cannot send a second mutation', async () => {
  const replies = [];
  const client = ownerClient({ endpoint: '/api/moderation', header: 'X-CCE-Admin', fetchImpl: () => new Promise(done => replies.push(done)) });
  const first = client.request({ method: 'POST', body: { action: 'publish' } });
  await assert.rejects(() => client.request(), /current request/); assert.equal(replies.length, 1);
  client.clear(); const second = client.request();
  replies[0](response()); await assert.rejects(first, { name: 'AbortError' });
  await assert.rejects(() => client.request(), /current request/);
  replies[1](response({ ok: true, queue: [] })); assert.deepEqual(await second, { ok: true, queue: [] });
});
test('request errors do not retry writes and preserve server access denial', async () => {
  let count = 0;
  const client = ownerClient({ endpoint: '/api/payout-review', header: 'X-Payout-Review-Admin', fetchImpl: async () => { count += 1; return response({ ok: false }, 403); } });
  await assert.rejects(() => client.request({ method: 'POST', body: { action: 'approve' } }), error => error.status === 403);
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
