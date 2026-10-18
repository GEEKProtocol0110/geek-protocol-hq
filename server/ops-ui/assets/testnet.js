import { ownerClient, escapeHtml, formatTokenUnits } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=testnet' });
const runClient = ownerClient({ endpoint: '/api/session?service=operations&action=testnet&run=latest' });
const runId = () => $('[data-queue]').elements.runId;
let records = [], selected = '', enabled = false, busy = false, generation = 0;
let eligibleId = '', eligibleUntil = 0, expiryTimer = null;
const clearRun = () => {
  clearTimeout(expiryTimer); expiryTimer = null; eligibleId = ''; eligibleUntil = 0; runId().value = '';
  $('[data-run-window]').textContent = '';
};
const timeLeft = () => Math.max(0, eligibleUntil - performance.now());
const runReady = () => Boolean(eligibleId && runId().value === eligibleId && timeLeft() > 0);
const current = () => records.find(r => r.id === selected);
const amountLabel = record => {
  const units = formatTokenUnits(record.amount, record.decimals);
  return units === null ? `${record.amount} base units · wallet amount unavailable; verify decimals before sending`
    : `${units} ${record.ticker} (${record.amount} base units; ${record.decimals} decimals)`;
};
const controls = () => {
  document.querySelectorAll('button,input').forEach(el => { el.disabled = busy; });
  $('[data-queue-button]').disabled = busy || !enabled || !runReady();
  $('[data-load-run]').disabled = busy || !enabled;
  $('[data-attach-button]').disabled = busy || !enabled || current()?.state !== 'queued';
  $('[data-export]').disabled = busy || !current();
};
const render = () => {
  $('[data-records]').innerHTML = records.length ? records.map(r => `<article class="workspace-card"><h2>${escapeHtml(r.state)}</h2><p>${escapeHtml(amountLabel(r))} · ${escapeHtml(r.network)}</p><p>Receipt ${escapeHtml(r.id)}</p><p>To ${escapeHtml(r.recipient)}</p><p>Daily Signal: ${r.proof.correct} / 5 correct · score ${r.proof.score}</p>${r.transactionHash ? `<p>Reveal hash ${escapeHtml(r.transactionHash)}</p><p>Reconcile this same hash. Do not send another transfer.</p>` : '<p>No transaction hash attached. A queued receipt has not sent any tokens.</p>'}<button type="button" data-select="${escapeHtml(r.id)}">${r.id === selected ? 'Selected receipt' : 'Select receipt'}</button>${r.transactionHash ? `<button type="button" data-check="${escapeHtml(r.id)}">Check same hash</button>` : ''}</article>`).join('') : '<p>No pilot receipts yet. Complete and save an eligible Daily, load it here and queue within five minutes. Then export the receipt, send once in your TN10 wallet, attach its reveal hash and check that same hash.</p>';
  const record = current(), amount = record ? formatTokenUnits(record.amount, record.decimals) : null;
  $('[data-transfer-review]').hidden = !record;
  $('[data-transfer-amount]').value = record && amount !== null ? `${amount} ${record.ticker}` : '';
  $('[data-transfer-recipient]').value = record?.recipient || '';
  $('[data-transfer-json]').value = record && amount !== null ? JSON.stringify({p:'krc-20',op:'transfer',tick:record.ticker,amt:record.amount,to:record.recipient},null,2) : '';
  $('[data-transfer-note]').textContent = !record ? '' : record.transactionHash ? 'A reveal hash is already attached. Reconcile that same hash; do not send another transfer.' : amount === null ? 'Wallet amount unavailable. Verify the token decimals before sending anything.' : `${record.network} · Queued instructions only. Review the exported sender and deployment, then send exactly once in your TN10 wallet.`;
  controls();
};
const load = async () => {
  const payload = await client.request(); records = payload.records; enabled = payload.enabled;
  if (!current()) selected = '';
  $('[data-config]').textContent = enabled ? `${amountLabel(payload.config)} on ${payload.network} per eligible pilot run. Configuration loaded; the server verifies the pinned asset when queuing. No automatic signer or token transfer.` : 'Disabled. Configure and verify a deployed testnet asset and approved test wallet before queuing.';
  render();
};
const task = async action => {
  if (busy) return; const version = generation; busy = true; controls();
  try { const message = await action(); if (version === generation) $('[data-message]').textContent = message || 'Receipts refreshed. Review the saved state before the next step.'; }
  catch (error) { if (version === generation) { records = []; selected = ''; enabled = false; clearRun(); render(); $('[data-message]').textContent = error.message; } }
  finally { if (version === generation) { busy = false; controls(); } }
};
const tickWindow = () => {
  clearTimeout(expiryTimer); expiryTimer = null;
  const seconds = Math.floor(timeLeft() / 1000);
  if (!eligibleId) return;
  if (seconds <= 0) {
    clearRun();
    $('[data-run-status]').textContent = 'The receipt window has expired. An expired run cannot be recovered here. If today’s Daily has already been started, the next challenge unlocks at 00:00 UTC.';
  } else {
    $('[data-run-window]').textContent = `Queue within ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')} (conservative estimate). The server rechecks the run when you queue.`;
    expiryTimer = setTimeout(tickWindow, 1000);
  }
  controls();
};
const loadCurrentRun = async () => {
  clearRun();
  $('[data-run-status]').textContent = 'Checking this browser’s current player run…';
  const started = performance.now();
  try {
    const payload = await runClient.request(), run = payload.run;
    if (payload.state === 'eligible' && /^[a-f0-9]{40}$/.test(run?.id) &&
        Number.isInteger(run.correct) && run.correct >= 1 && run.correct <= 5 &&
        Number.isSafeInteger(run.remainingMs) && run.remainingMs > 0 && run.remainingMs <= 300000) {
      eligibleId = run.id; eligibleUntil = started + run.remainingMs; runId().value = run.id;
      $('[data-run-status]').textContent = `Finished Kaspa Daily for ${String(payload.playerName || 'this player')}: ${run.correct} / 5 correct. Review the recipient and queue now. Loading does not extend the window.`;
      tickWindow();
    } else {
      $('[data-run-status]').textContent = payload.state === 'missing'
        ? 'No saved run is available. It may have expired. An expired run cannot be recovered here. If today’s Daily has already been started, the next challenge unlocks at 00:00 UTC.'
        : 'No eligible finished Kaspa Daily selected. Complete all five questions with at least one correct, then choose Finish & save result and return here. Loading does not finish a run.';
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('[data-run-status]').textContent = error.status === 401 || error.status === 403
      ? 'Sign in to owner access and your HQ player in this same browser. Your player session is separate from owner access. Then complete the Kaspa Daily and return here.'
      : `Could not load the player run. ${error.message}`;
  }
  return 'Player run checked. No receipt or transfer was created.';
};
$('[data-load-run]').addEventListener('click', () => task(loadCurrentRun));
$('[data-refresh]').addEventListener('click', () => task(load));
$('[data-records]').addEventListener('click', event => {
  const select = event.target.closest('[data-select]'), check = event.target.closest('[data-check]');
  if (select && !busy) { selected = select.dataset.select; render(); }
  if (check && !busy) task(async () => {
    const record = records.find(r => r.id === check.dataset.check);
    await client.request({ method: 'POST', body: { action: 'check', id: record.id, version: record.version } }); await load();
  });
});
$('[data-queue]').addEventListener('submit', event => {
  event.preventDefault(); const fields = event.currentTarget.elements;
  if (!runReady()) { tickWindow(); return; }
  task(async () => { const payload = await client.request({ method: 'POST', body: { action: 'queue', runId: fields.runId.value, recipient: fields.recipient.value } }); selected = payload.record.id; clearRun(); await load(); });
});
$('[data-attach]').addEventListener('submit', event => {
  event.preventDefault(); const fields = event.currentTarget.elements, record = current();
  if (!record || !fields.submitted.checked) return;
  task(async () => { await client.request({ method: 'POST', body: { action: 'attach', id: record.id, version: record.version, transactionHash: fields.transactionHash.value } }); fields.submitted.checked = false; fields.transactionHash.value = ''; await load(); });
});
$('[data-export]').addEventListener('click', () => {
  const record = current(); if (!record || busy) return;
  const receipt = { ...record, automaticSigning: false, mainnetSettlementEnabled: false, transfer: { p: 'krc-20', op: 'transfer', tick: record.ticker, amt: record.amount, to: record.recipient } };
  const url = URL.createObjectURL(new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `geek-testnet-${record.id.slice(0,12)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('[data-sign-out]').addEventListener('click', async () => {
  generation += 1; busy = false; enabled = false; client.clear(); runClient.clear(); clearRun(); $('[data-run-status]').textContent = ''; records = []; selected = ''; render();
  try { await fetch('/api/session?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { location.href = '/ops-login/'; }
});
window.addEventListener('pagehide', () => { generation += 1; busy = false; enabled = false; client.clear(); runClient.clear(); clearRun(); $('[data-run-status]').textContent = ''; records = []; selected = ''; render(); });
const refreshView = () => task(async () => { await load(); if (enabled) return loadCurrentRun(); });
const returnToDesk = () => { if (!document.hidden && enabled && !busy) task(loadCurrentRun); };
window.addEventListener('focus', returnToDesk);
document.addEventListener('visibilitychange', returnToDesk);
window.addEventListener('pageshow', event => { if (event.persisted) refreshView(); });
refreshView();
