import { ownerClient, escapeHtml, formatTokenUnits } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=testnet-auto' });
let enrollment = null, busy = false, generation = 0, timer;
const form = $('[data-auto-enroll]'), status = $('[data-auto-status]'), list = $('[data-auto-records]');
const render = payload => {
  enrollment = payload.enrollment;
  form.elements.recipient.value = enrollment?.recipient || '';
  form.elements.enabled.checked = enrollment?.enabled === true;
  status.textContent = payload.enabled
    ? 'Automatic TN10 queue enabled. Enroll this player once; eligible future Dailies queue when saved. The separate funded signing worker sends and checks them.'
    : 'Automatic TN10 queue is off. You can save this player’s test enrollment now. Activation requires the dedicated funded signing worker and server configuration.';
  list.innerHTML = payload.records.map(r => `<article class="workspace-card"><h3>${escapeHtml(r.serviceRetriesStopped ? 'Retries stopped · receipt retained' : r.state)}</h3>${r.freshTest ? '<p>Fresh test · original receipt retained.</p>' : ''}<p>${escapeHtml(formatTokenUnits(r.amount, r.decimals))} ${escapeHtml(r.ticker)} · testnet-10</p><p>To ${escapeHtml(r.recipient)}</p>${r.transactionHash ? `<p>Reveal hash ${escapeHtml(r.transactionHash)}</p>` : '<p>Waiting for the signing worker.</p>'}<p>${r.serviceRetriesStopped ? 'The service will not retry this original attempt. This does not prove chain cancellation.' : 'This payment is managed by the worker. Do not send it from Kasware.'}</p></article>`).join('');
};
const refresh = async body => {
  if (busy) return; const version = generation; busy = true; clearTimeout(timer);
  form.querySelector('button').disabled = true;
  try {
    const payload = await client.request(body ? { method: 'POST', body } : {});
    if (generation !== version) return;
    render(payload);
    if (payload.records.some(r => r.state !== 'indexed-confirmed')) timer = setTimeout(() => refresh(), 15000);
  } catch (error) { if (version === generation) status.textContent = error.message; }
  finally { if (version === generation) { busy = false; form.querySelector('button').disabled = false; } }
};
form.addEventListener('submit', event => {
  event.preventDefault(); refresh({ action: 'enroll', recipient: form.elements.recipient.value,
    enabled: form.elements.enabled.checked, version: enrollment?.version || '' });
});
const clear = () => { generation += 1; client.clear(); clearTimeout(timer); enrollment = null; busy = false;
  form.reset(); list.replaceChildren(); status.textContent = ''; };
window.addEventListener('pagehide', clear);
$('[data-sign-out]').addEventListener('click', clear);
window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else refresh(); });
refresh();
