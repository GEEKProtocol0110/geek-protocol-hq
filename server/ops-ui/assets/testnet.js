import { ownerClient, escapeHtml } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=testnet' });
let records = [], selected = '', enabled = false, busy = false;
const current = () => records.find(r => r.id === selected);
const controls = () => {
  document.querySelectorAll('button,input').forEach(el => { el.disabled = busy; });
  $('[data-queue-button]').disabled = busy || !enabled;
  $('[data-attach-button]').disabled = busy || !enabled || current()?.state !== 'queued';
  $('[data-export]').disabled = busy || !current();
};
const render = () => {
  $('[data-records]').innerHTML = records.length ? records.map(r => `<article class="workspace-card"><h2>${escapeHtml(r.state)}</h2><p>${escapeHtml(r.ticker)} · ${escapeHtml(r.amount)} raw units · ${escapeHtml(r.network)}</p><p>Receipt ${escapeHtml(r.id)}</p><p>To ${escapeHtml(r.recipient)}</p><p>Daily Signal: ${r.proof.correct} / 5 correct · score ${r.proof.score}</p>${r.transactionHash ? `<p>Reveal hash ${escapeHtml(r.transactionHash)}</p>` : '<p>No transaction hash attached.</p>'}<button type="button" data-select="${escapeHtml(r.id)}">${r.id === selected ? 'Selected receipt' : 'Select receipt'}</button>${r.transactionHash ? `<button type="button" data-check="${escapeHtml(r.id)}">Check same hash</button>` : ''}</article>`).join('') : '<p>No pilot receipts yet.</p>';
  controls();
};
const load = async () => {
  const payload = await client.request(); records = payload.records; enabled = payload.enabled;
  if (!current()) selected = '';
  $('[data-config]').textContent = enabled ? `${payload.config.ticker} on ${payload.network} · ${payload.config.amount} raw units per pilot run · no automatic signer.` : 'Disabled. Configure and verify a deployed testnet asset and approved test wallet before queuing.';
  render();
};
const task = async action => {
  if (busy) return; busy = true; controls();
  try { await action(); $('[data-message]').textContent = 'Receipts refreshed. Review the saved state before the next step.'; }
  catch (error) { records = []; selected = ''; enabled = false; render(); $('[data-message]').textContent = error.message; }
  finally { busy = false; controls(); }
};
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
  client.clear(); records = []; selected = ''; render();
  try { await fetch('/api/session?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { location.href = '/ops-login/'; }
});
window.addEventListener('pagehide', () => { client.clear(); records = []; selected = ''; render(); });
task(load);
