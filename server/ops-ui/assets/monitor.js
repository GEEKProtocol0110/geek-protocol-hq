import { ownerClient, escapeHtml as e } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session/?service=operations&action=monitor' });
export const monitorCopy = (report, serverNow, freshnessMs) => {
  if (!report) return { label: 'No checks saved', detail: 'Run a production check to create the first snapshot.' };
  const valid = Number.isSafeInteger(serverNow) && Number.isSafeInteger(freshnessMs) && freshnessMs === 900000 && Number.isSafeInteger(report.checkedAt) && report.checkedAt > 0 && report.checkedAt <= serverNow + 60000 && Array.isArray(report.checks) && report.checks.length === 20 && report.checks.every(c => typeof c.passed === 'boolean') && report.passed === report.checks.every(c => c.passed);
  if (!valid) return { label: 'Unavailable', detail: 'This snapshot could not be verified. Refresh the saved history.' };
  const stale = serverNow - report.checkedAt > freshnessMs;
  return { label: stale ? 'Stale snapshot' : report.passed ? 'Checks passed' : 'Attention required', detail: `${stale ? 'Run a new check. Last checked' : 'Checked'} ${new Date(report.checkedAt).toLocaleString()}. ${report.checks.filter(c => !c.passed).length} of ${report.checks.length} checks failed at that time.` };
};
if (typeof document !== 'undefined') {
  let busy = false, epoch = 0, lastPayload = null, receivedAt = 0;
  const clear = message => { lastPayload = null; $('[data-checks]').innerHTML = ''; $('[data-history]').innerHTML = ''; $('[data-overall]').textContent = 'No current evidence'; $('[data-checked]').textContent = ''; $('[data-message]').textContent = message; };
  const controls = () => { $('[data-refresh]').disabled = busy; $('[data-run]').disabled = busy; };
  const render = payload => {
    lastPayload = payload; receivedAt = performance.now();
    const report = payload.history[0], copy = monitorCopy(report, payload.serverNow, payload.freshnessMs);
    $('[data-overall]').textContent = copy.label; $('[data-checked]').textContent = copy.detail;
    if (copy.label === 'Unavailable') return;
    if (report) $('[data-checks]').innerHTML = `<div class="monitor-table"><table><caption>Last saved owner check</caption><thead><tr><th>Check</th><th>Result</th><th>HTTP</th><th>Response time</th></tr></thead><tbody>${report.checks.map(c => `<tr><th scope="row">${e(payload.checks.find(s => s.id === c.id)?.name || c.id)}</th><td>${c.passed ? 'Passed' : `Failed · ${e(c.reason)}`}</td><td>${e(c.status || 'No response')}</td><td>${e(c.elapsedMs)} ms</td></tr>`).join('')}</tbody></table></div>`;
    $('[data-history]').innerHTML = payload.history.length ? `<ol>${payload.history.map(r => `<li>${e(new Date(r.checkedAt).toLocaleString())} · ${r.passed ? 'Passed' : 'Attention required'} · ${r.checks.filter(c => !c.passed).length} failed · ${e(r.durationMs)} ms total</li>`).join('')}</ol>` : '<p>No owner checks have been saved yet.</p>';
  };
  const load = async () => { const payload = await client.request(); if (!Array.isArray(payload.history) || !Array.isArray(payload.checks)) throw new Error('Monitor evidence is unavailable.'); return payload; };
  const task = async run => {
    if (busy) return; const version = epoch; busy = true; controls(); clear(run ? 'Checking production…' : 'Refreshing saved evidence…');
    try { if (run) await client.request({ method: 'POST', body: { action: 'run' } }); const payload = await load(); if (version !== epoch) return; render(payload); $('[data-message]').textContent = 'Saved evidence loaded. Refresh reads history; Run production check checks the live site.'; }
    catch (error) { if (version === epoch) clear(error.message); }
    finally { if (version === epoch) { busy = false; controls(); } }
  };
  $('[data-refresh]').addEventListener('click', () => task(false)); $('[data-run]').addEventListener('click', () => task(true));
  // Age the visible snapshot locally; this timer sends no network request or mutation.
  setInterval(() => { if (busy || !lastPayload) return; const copy = monitorCopy(lastPayload.history[0], lastPayload.serverNow + Math.round(performance.now() - receivedAt), lastPayload.freshnessMs); $('[data-overall]').textContent = copy.label; $('[data-checked]').textContent = copy.detail; }, 30000);
  window.addEventListener('pagehide', () => { epoch++; client.clear(); clear('Private evidence cleared. Refresh after returning.'); busy = false; controls(); });
  $('[data-sign-out]').addEventListener('click', async () => { epoch++; client.clear(); clear('Signed-out view.'); busy = true; controls(); try { await fetch('/api/session/?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { location.href = '/ops-login/'; } });
  task(false);
}
