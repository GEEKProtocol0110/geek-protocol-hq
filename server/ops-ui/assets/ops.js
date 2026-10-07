import { roleClient, escapeHtml as e, sourceLink, auditSummary } from './ops-core.js';

const $ = (selector, root = document) => root.querySelector(selector);
const roles = { cce: ['/api/moderation', 'X-CCE-Admin'], payout: ['/api/payout-review', 'X-Payout-Review-Admin'], audit: ['/api/audit', 'X-Audit-Admin'] };
const date = value => Number(value) > 0 ? new Date(Number(value)).toLocaleString() : 'Not recorded';
const panels = [];
const categoryNames = { kaspa: 'Kaspa', 'video-games': 'Video Games', 'science-fiction': 'Science Fiction', technology: 'Technology', movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop Culture' };
const counts = window.GEEK_QUESTION_COUNTS;
if (counts && Object.keys(categoryNames).every(id => Number.isInteger(counts[id]) && counts[id] > 0)) {
  $('[data-bank-total]').textContent = Object.values(counts).reduce((sum, count) => sum + count, 0).toLocaleString();
  $('[data-bank-breakdown]').innerHTML = `<div class="bank-counts">${Object.entries(categoryNames).map(([id, name]) => `<div><span>${e(name)}</span><b>${counts[id].toLocaleString()}</b></div>`).join('')}</div>`;
} else { $('[data-bank-total]').textContent = 'Counts unavailable'; }

let overviewController = null, overviewVersion = 0;
const refreshOverview = async () => {
  overviewController?.abort();
  const controller = new AbortController(), version = ++overviewVersion;
  overviewController = controller;
  const timer = setTimeout(() => controller.abort(), 15_000);
  $('[data-health-state]').textContent = 'Checking…'; $('[data-reserve-state]').textContent = 'Checking…';
  $('[data-operator-readiness]').textContent = 'Checking operator access configuration…';
  $('[data-health-time]').textContent = ''; $('[data-reserve-time]').textContent = '';
  $('[data-health-detail]').textContent = 'Waiting for the database check.';
  $('[data-reserve-detail]').textContent = 'Funding has not been verified.';
  const read = async url => {
    const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error('Service unavailable.');
    return payload;
  };
  const results = await Promise.allSettled([read('/api/health'), read('/api/session?service=economy')]);
  clearTimeout(timer);
  if (version !== overviewVersion) return;
  const [health, economy] = results;
  $('[data-health-state]').textContent = health.status === 'fulfilled' && health.value.storage === 'connected' ? 'Connected' : 'Unavailable';
  $('[data-health-detail]').textContent = health.status === 'fulfilled' ? 'Community service responded. This check does not cover every game or wallet operation.' : 'Could not verify the community service. Refresh to try again.';
  $('[data-health-time]').textContent = `Checked ${new Date().toLocaleTimeString()}`;
  const readiness = health.status === 'fulfilled' ? health.value.audit : null;
  $('[data-operator-readiness]').textContent = readiness ? `Audit viewer key: ${readiness.exportConfigured ? 'configured' : 'not configured'}. Payout reviewer key: ${readiness.payoutReviewConfigured ? 'configured' : 'not configured'}. These checks do not grant access.` : 'Operator access configuration could not be checked.';
  const reserve = economy.status === 'fulfilled' ? economy.value.economy?.reserve : null;
  $('[data-reserve-state]').textContent = ({ 'not-configured': 'Not configured', 'address-configured': 'Address configured', 'invalid-address': 'Invalid address' })[reserve?.configuration] || 'Unavailable';
  $('[data-reserve-detail]').textContent = reserve ? 'Address configuration only. No reserve balance is verified and signing is disabled.' : 'Could not read reserve readiness. No funded balance is shown.';
  $('[data-reserve-time]').textContent = `Checked ${new Date().toLocaleTimeString()}`;
};
$('[data-refresh-overview]').addEventListener('click', refreshOverview);

const questionCards = queue => queue.map(item => {
  const url = sourceLink(item.source), options = Array.isArray(item.options) ? item.options : [];
  const actions = item.status === 'approved' ? ['publish', 'request-changes', 'reject'] : ['approve', 'request-changes', 'reject'];
  const actionNames = { approve: 'Approve question', publish: 'Publish to games', 'request-changes': 'Request changes', reject: 'Reject question' };
  return `<article class="queue-card" data-id="${e(item.id)}"><div class="card-meta"><span class="badge">${e(item.status)}</span><span>${e(categoryNames[item.category] || item.category)} · ${e(item.difficulty)}</span><span>${e(item.displayName)} · ${e(date(item.submittedAt))}</span></div><h3>${e(item.prompt)}</h3><ol class="question-options">${options.map((option, index) => `<li class="${index === item.correctIndex ? 'correct' : ''}">${String.fromCharCode(65 + index)}. ${e(option)}${index === item.correctIndex ? ' — Correct answer' : ''}</li>`).join('')}</ol><div class="evidence"><p><b>Explanation:</b> ${e(item.explanation)}</p><p>${url ? `<a class="evidence-link" href="${e(url)}" target="_blank" rel="noopener noreferrer">Open submitted source ↗</a>` : 'Source link unavailable; request corrected evidence.'}</p><p><b>Review note:</b> ${e(item.reviewNote || 'None recorded.')}</p><p>First-use reward: ${e(Number(item.reward?.amount || 0).toLocaleString())} internal Alpha credits. No token payment.</p></div><div class="card-actions"><label for="note-${e(item.id)}">Decision note (at least 6 characters)<textarea id="note-${e(item.id)}" data-note maxlength="400" rows="2"></textarea></label><div class="action-buttons">${actions.map(action => `<button type="button" ${action === 'reject' ? 'class="danger"' : action === 'request-changes' ? 'class="secondary"' : ''} data-action="${action}">${actionNames[action]}</button>`).join('')}</div></div></article>`;
}).join('');
const payoutCards = queue => queue.map(item => `<article class="queue-card" data-id="${e(item.id)}"><div class="card-meta"><span class="badge">${e(item.status)}</span><span>${e(date(item.createdAt))}</span></div><h3>${e(item.addressMasked || 'Masked destination unavailable')}</h3><p class="evidence">Reasons: ${e((Array.isArray(item.reasons) ? item.reasons : []).join(', ') || 'Not recorded')} · Destination version ${e(item.payoutVersion)}</p><small>Review ${e(item.id)}. No funds will move.</small><div class="card-actions"><label for="note-${e(item.id)}">Decision note (at least 8 characters)<textarea id="note-${e(item.id)}" data-note maxlength="500" rows="2"></textarea></label><div class="action-buttons"><button type="button" data-action="approve">Approve risk review</button><button type="button" class="danger" data-action="reject">Reject risk review</button></div></div></article>`).join('');

for (const root of document.querySelectorAll('[data-role]')) {
  const role = root.dataset.role, [endpoint, header] = roles[role];
  const client = roleClient({ endpoint, header });
  const form = $('[data-access]', root), content = $('[data-content]', root), message = $('[data-message]', root), counter = $('[data-count]', root);
  let epoch = 0, busy = false, offset = 0, auditPayload = null;
  const tell = (copy, error = false) => { message.textContent = copy; message.dataset.error = String(error); };
  const setBusy = value => {
    busy = value; root.setAttribute('aria-busy', String(value));
    form.querySelector('button[type="submit"]').disabled = value;
    form.elements.key.disabled = value;
    $('[data-refresh]', root).disabled = value || !client.hasKey();
    content.querySelectorAll('[data-action]').forEach(button => { button.disabled = value; });
    if (role === 'audit') {
      $('[data-newer]', root).disabled = value || offset === 0;
      $('[data-older]', root).disabled = value || !auditPayload || auditPayload.events.length < 50 || offset >= 10_000;
    }
  };
  const lock = () => {
    epoch += 1; client.clear(); form.reset(); offset = 0; auditPayload = null;
    content.innerHTML = '<p class="empty">Access locked. Enter the key to load this section.</p>';
    counter.textContent = 'Locked'; tell('Access cleared from this page.');
    if (role === 'audit') $('[data-audit-tools]', root).hidden = true;
    setBusy(false);
  };
  const renderAudit = () => {
    if (!auditPayload) return;
    const events = auditPayload.events, filter = $('#audit-filter').value;
    const visible = events.filter(item => filter === 'risk' ? ['warning', 'critical'].includes(item.severity) : filter === 'failure' ? item.outcome === 'failure' : filter === 'cce' ? String(item.type).startsWith('cce.') : filter === 'payout' ? String(item.type).startsWith('payout.') : true);
    const summary = auditSummary(events);
    const integrity = !events.length ? 'No records on this page to verify.' : auditPayload.integrity?.verified === true ? `Record digests verified on this page (${e(auditPayload.status?.integrityMode || 'unknown mode')}).` : '<span class="integrity-warning">Record verification failed. Investigate before relying on these records.</span>';
    counter.textContent = `${events.length} loaded`;
    content.innerHTML = `<div class="audit-summary">Page ${Math.floor(offset / 50) + 1} · ${events.length} records · ${summary.warning} warnings · ${summary.critical} critical · ${summary.failures} failed operations.<br>${integrity}<br>Independent audit: ${e(auditPayload.status?.independentAudit || 'unknown')}.</div>${visible.length ? `<ol class="event-list">${visible.map(item => `<li><div class="card-meta"><span class="badge">${e(item.severity)}</span><span>${e(item.outcome)} · #${e(item.sequence)} · ${e(date(item.occurredAt))}</span></div><h3>${e(item.type)}</h3><p>${e(item.reason || 'No reason recorded.')} · ${e(item.object?.type || 'Unknown object')}</p></li>`).join('')}</ol>` : '<p class="empty">No matching events on this page. Choose another filter or page.</p>'}`;
    $('[data-audit-tools]', root).hidden = false;
  };
  const render = payload => {
    if (role === 'audit') { auditPayload = payload; renderAudit(); return; }
    const queue = Array.isArray(payload.queue) ? payload.queue : [];
    counter.textContent = `${queue.length} loaded`;
    content.innerHTML = queue.length ? `<p class="muted">Up to 100 queued records per refresh. This is the returned queue window, not a total count.</p>${role === 'cce' ? questionCards(queue) : payoutCards(queue)}` : '<p class="empty">No queued records returned.</p>';
  };
  const load = async () => {
    if (busy) return;
    const version = epoch; setBusy(true); tell('Loading…');
    // Clear stale rows, so a failed refresh cannot leave actionable old decisions.
    content.innerHTML = '<p class="empty">Loading current records…</p>'; counter.textContent = 'Loading…';
    if (role === 'audit') { auditPayload = null; $('[data-audit-tools]', root).hidden = true; }
    try {
      const payload = await client.request({ query: role === 'audit' ? `?offset=${offset}&limit=50` : '' });
      if (version !== epoch) return;
      render(payload); tell(`Updated ${new Date().toLocaleTimeString()}.`);
    } catch (error) {
      if (version !== epoch) return;
      if ([401, 403].includes(error.status)) client.clear();
      content.innerHTML = '<p class="empty">Records could not be loaded. Check access or refresh when the service returns.</p>'; counter.textContent = 'Unavailable';
      tell(error.message || 'Service unavailable.', true);
    } finally { if (version === epoch) setBusy(false); }
  };
  form.addEventListener('submit', event => {
    event.preventDefault(); if (busy) return;
    const key = form.elements.key.value;
    if (!key.trim()) return;
    epoch += 1; client.unlock(key); form.elements.key.value = ''; offset = 0; load();
  });
  $('[data-refresh]', root).addEventListener('click', () => { if (busy) return; offset = 0; load(); });
  $('[data-lock]', root).addEventListener('click', lock);
  content.addEventListener('click', async event => {
    const button = event.target.closest('[data-action]');
    if (!button || busy || !client.hasKey() || role === 'audit') return;
    const card = button.closest('[data-id]'), note = $('[data-note]', card).value.trim(), action = button.dataset.action;
    if (note.length < (role === 'cce' ? 6 : 8)) { tell('Add a clear decision note before continuing.', true); $('[data-note]', card).focus(); return; }
    const confirmation = role === 'payout' ? `${action === 'approve' ? 'Approve' : 'Reject'} this payout-setting risk review? No funds will move.` : action === 'publish' ? 'Publish this approved question into the community game pool?' : action === 'reject' ? 'Reject this question submission?' : '';
    if (confirmation && !window.confirm(confirmation)) return;
    const version = epoch; setBusy(true); tell('Recording decision…');
    try {
      const payload = await client.request({ method: 'POST', body: { id: card.dataset.id, action, note } });
      if (version !== epoch) return;
      if (role === 'cce') { render(payload); tell('Question decision recorded.'); }
      else {
        // Payout-review POST returns a decision receipt, not the remaining queue.
        content.innerHTML = '<p class="empty">Risk decision recorded. Refresh the queue to continue. No funds moved.</p>';
        counter.textContent = 'Refresh needed'; tell('Risk decision recorded. Token settlement remains disabled.');
      }
    } catch (error) {
      if (version !== epoch) return;
      if ([401, 403].includes(error.status)) client.clear();
      content.innerHTML = '<p class="empty">Refresh the queue before another decision. A lost response may mean the decision was already recorded.</p>'; counter.textContent = 'Refresh needed';
      tell(error.message || 'Decision response unavailable.', true);
    } finally { if (version === epoch) setBusy(false); }
  });
  if (role === 'audit') {
    $('#audit-filter').addEventListener('change', renderAudit);
    $('[data-newer]', root).addEventListener('click', () => { if (busy) return; offset = Math.max(0, offset - 50); load(); });
    $('[data-older]', root).addEventListener('click', () => { if (busy) return; offset = Math.min(10_000, offset + 50); load(); });
  }
  panels.push({ lock }); setBusy(false);
}
const lockAll = () => { panels.forEach(panel => panel.lock()); $('[data-global-message]').textContent = 'All role access and loaded private records cleared.'; };
$('[data-lock-all]').addEventListener('click', lockAll);
window.addEventListener('pagehide', () => { lockAll(); overviewVersion += 1; overviewController?.abort(); });
refreshOverview();

$('[data-sign-out]').addEventListener('click', async event => {
  lockAll(); const button = event.currentTarget; button.disabled = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('/api/session?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (response.ok || response.status === 401) { window.location.replace('/ops-login/'); return; }
    throw new Error('Sign-out unavailable.');
  } catch { $('[data-global-message]').textContent = 'Role access cleared here, but server sign-out could not finish. Retry Sign out.'; }
  finally { clearTimeout(timer); button.disabled = false; }
});
// Recheck the short-lived server session when the operator returns to this tab.
let gateChecking = false;
const checkGate = async () => {
  if (gateChecking || document.hidden) return; gateChecking = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch('/api/session?service=operations&action=status', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    if (!response.ok) { lockAll(); window.location.replace('/ops-login/'); }
  } catch { lockAll(); $('[data-global-message]').textContent = 'Private access could not be checked. Sign out and sign in again when the service returns.'; }
  finally { clearTimeout(timer); gateChecking = false; }
};
window.addEventListener('focus', checkGate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkGate(); });
setInterval(checkGate, 60_000);
