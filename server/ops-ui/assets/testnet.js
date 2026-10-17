import { ownerClient, escapeHtml, formatTokenUnits } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=testnet' });
const runClient = ownerClient({ endpoint: '/api/ranked?resume=1' });
const runId = () => $('[data-queue]').elements.runId;
let records = [], selected = '', enabled = false, busy = false;
const current = () => records.find(r => r.id === selected);
const amountLabel = record => {
  const units = formatTokenUnits(record.amount, record.decimals);
  return units === null ? `${record.amount} base units · wallet amount unavailable; verify decimals before sending`
    : `${units} ${record.ticker} (${record.amount} base units; ${record.decimals} decimals)`;
};
const controls = () => {
  document.querySelectorAll('button,input').forEach(el => { el.disabled = busy; });
  $('[data-queue-button]').disabled = busy || !enabled;
  $('[data-load-run]').disabled = busy || !enabled;
  $('[data-attach-button]').disabled = busy || !enabled || current()?.state !== 'queued';
  $('[data-export]').disabled = busy || !current();
};
const render = () => {
  $('[data-records]').innerHTML = records.length ? records.map(r => `<article class="workspace-card"><h2>${escapeHtml(r.state)}</h2><p>${escapeHtml(amountLabel(r))} · ${escapeHtml(r.network)}</p><p>Receipt ${escapeHtml(r.id)}</p><p>To ${escapeHtml(r.recipient)}</p><p>Daily Signal: ${r.proof.correct} / 5 correct · score ${r.proof.score}</p>${r.transactionHash ? `<p>Reveal hash ${escapeHtml(r.transactionHash)}</p><p>Reconcile this same hash. Do not send another transfer.</p>` : '<p>No transaction hash attached. A queued receipt has not sent any tokens.</p>'}<button type="button" data-select="${escapeHtml(r.id)}">${r.id === selected ? 'Selected receipt' : 'Select receipt'}</button>${r.transactionHash ? `<button type="button" data-check="${escapeHtml(r.id)}">Check same hash</button>` : ''}</article>`).join('') : '<p>No pilot receipts yet. Complete and save an eligible Daily, load it here and queue within five minutes. Then export the receipt, send once in your TN10 wallet, attach its reveal hash and check that same hash.</p>';
  controls();
};
const load = async () => {
  const payload = await client.request(); records = payload.records; enabled = payload.enabled;
  if (!current()) selected = '';
  $('[data-config]').textContent = enabled ? `${amountLabel(payload.config)} on ${payload.network} per eligible pilot run. Configuration loaded; the server verifies the pinned asset when queuing. No automatic signer or token transfer.` : 'Disabled. Configure and verify a deployed testnet asset and approved test wallet before queuing.';
  render();
};
const task = async action => {
  if (busy) return; busy = true; controls();
  try { const message = await action(); $('[data-message]').textContent = message || 'Receipts refreshed. Review the saved state before the next step.'; }
  catch (error) { records = []; selected = ''; enabled = false; render(); $('[data-message]').textContent = error.message; }
  finally { busy = false; controls(); }
};
const loadCurrentRun = async () => {
  runId().value = '';
  $('[data-run-status]').textContent = 'Checking this browser’s current player run…';
  try {
    const { run } = await runClient.request();
    const complete = run?.status === 'finished' && run.mode === 'daily' && run.category === 'kaspa' &&
      /^[a-f0-9]{40}$/.test(run.id) && run.completedRound === 1 && run.questionCount === 5 &&
      run.questionIndex === 4 && Number.isInteger(run.correct) && run.correct >= 1 && run.correct <= 5;
    if (!complete) {
      $('[data-run-status]').textContent = 'No eligible finished Kaspa Daily selected. Complete all five questions with at least one correct, then choose Finish & save result and return here. Loading does not finish a run.';
    } else {
      runId().value = run.id;
      $('[data-run-status]').textContent = `Finished Kaspa Daily loaded: ${run.correct} / 5 correct. Enter the recipient and queue now. The five-minute window starts when you finish; loading does not extend it. The server rechecks eligibility when you queue.`;
    }
  } catch (error) {
    if (error.name === 'AbortError') return;
    $('[data-run-status]').textContent = error.status === 404
      ? 'No saved run is available for this player in this browser. It may have expired after five minutes. An expired run cannot be recovered here. If today’s Daily has already been started, the next challenge unlocks at 00:00 UTC.'
      : error.status === 401 || error.status === 403
        ? 'Start or sign in to your HQ player in this same browser, complete the Kaspa Daily, then return here. Your player session is separate from owner access.'
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
  task(async () => { const payload = await client.request({ method: 'POST', body: { action: 'queue', runId: fields.runId.value, recipient: fields.recipient.value } }); selected = payload.record.id; await load(); });
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
  client.clear(); runClient.clear(); runId().value = ''; $('[data-run-status]').textContent = ''; records = []; selected = ''; render();
  try { await fetch('/api/session?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { location.href = '/ops-login/'; }
});
window.addEventListener('pagehide', () => { client.clear(); runClient.clear(); runId().value = ''; $('[data-run-status]').textContent = ''; records = []; selected = ''; render(); });
task(async () => { await load(); if (enabled) return loadCurrentRun(); });
