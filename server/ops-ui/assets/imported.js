import { ownerClient, escapeHtml as esc, sourceLink } from './ops-core.js';
const $ = s => document.querySelector(s);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=imported' });
let current = null, offset = 0, busy = false, generation = 0;
const say = message => { $('[data-message]').textContent = message; };
const clear = () => { generation++; client.clear(); current = null; $('[data-rows]').replaceChildren(); locks(false); };
function locks(value) {
  busy = value;
  document.querySelectorAll('button, [data-select], [data-filter] input, [data-filter] select').forEach(el => { el.disabled = value; });
  $('[data-save]').disabled = value || !current;
  $('[data-export]').disabled = value || !current?.rows.some(r => r.proposal && !r.staleProposal);
  $('[data-previous]').disabled = value || !current || offset === 0;
  $('[data-next]').disabled = value || !current || offset + 10 >= current.total;
}
function render() {
  $('[data-rows]').innerHTML = current.rows.map((r, index) => {
    const q = r.question, link = sourceLink(q.source);
    return `<article class="queue-card"><label><input data-select type="checkbox" value="${index}"> ${esc(q.id)} · ${esc(q.difficulty)} · ${esc(q.reviewStatus)}</label><h2>${esc(q.prompt)}</h2><ol>${q.options.map((o, i) => `<li>${esc(o)}${i === q.correctIndex ? ' — correct answer' : ''}</li>`).join('')}</ol><p>${esc(q.funFact || 'No explanation yet.')}</p>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Check source ↗</a>` : '<p>Source unavailable</p>'}<p>${r.proposal ? `Proposal: ${esc(r.proposal.decision)} · ${esc(r.proposal.checkedAt)}${r.staleProposal ? ' · SOURCE CHANGED — refresh the decision' : ''}` : 'No saved proposal'}</p><button type="button" data-edit="${index}">Edit this question</button></article>`;
  }).join('') || '<p>No questions match these filters.</p>';
  document.querySelectorAll('[data-edit]').forEach(button => button.addEventListener('click', () => {
    const index = Number(button.dataset.edit), q = current.rows[index].question, form = $('[data-decision]');
    document.querySelectorAll('[data-select]').forEach(box => { box.checked = Number(box.value) === index; });
    for (const key of ['prompt', 'difficulty', 'source', 'funFact', 'correctIndex']) form.elements[key].value = q[key] ?? '';
    q.options.forEach((value, i) => { form.elements['option' + i].value = value; });
    form.elements.decision.value = 'correct'; form.querySelector('details').open = true;
    form.elements.prompt.focus();
  }));
}
async function load() {
  if (busy) return;
  current = null; $('[data-rows]').replaceChildren(); locks(true);
  const version = generation, form = $('[data-filter]');
  try {
    const query = new URLSearchParams({ category: form.elements.category.value, filter: form.elements.filter.value, search: form.elements.search.value, offset });
    const data = await client.request({ query: '&' + query });
    if (version !== generation) return;
    current = data; render(); say(`${data.total} matching questions · showing ${data.rows.length ? offset + 1 : 0}–${offset + data.rows.length}. Proposals are not published.`);
  } catch (error) { if (version === generation) say(error.message); }
  finally { if (version === generation) locks(false); }
}
$('[data-filter]').addEventListener('submit', event => { event.preventDefault(); offset = 0; load(); });
$('[data-previous]').addEventListener('click', () => { offset = Math.max(0, offset - 10); load(); });
$('[data-next]').addEventListener('click', () => { offset += 10; load(); });
$('[data-decision]').addEventListener('submit', async event => {
  event.preventDefault(); if (busy || !current) return;
  const form = event.currentTarget, rows = [...document.querySelectorAll('[data-select]')].filter(b => b.checked).map(b => current.rows[Number(b.value)]);
  if (!rows.length || (form.elements.decision.value === 'correct' && rows.length !== 1)) return say('Select one question to correct, or up to ten to review/retire.');
  if (!form.elements.sourceChecked.checked) return say('Check the source for each selected question first.');
  const body = { category: current.category, decision: form.elements.decision.value, sourceChecked: true, note: form.elements.note.value,
    items: rows.map(r => ({ id: r.question.id, revision: r.revision, reviewVersion: r.proposal?.version || '' })) };
  if (body.decision === 'correct') body.correction = { prompt: form.elements.prompt.value, options: [0, 1, 2, 3].map(i => form.elements['option' + i].value), correctIndex: Number(form.elements.correctIndex.value), difficulty: form.elements.difficulty.value, source: form.elements.source.value, funFact: form.elements.funFact.value };
  if (!confirm(`Save ${rows.length} ${body.decision} proposal(s)? This does not publish changes.`)) return;
  const version = generation; locks(true);
  try { const data = await client.request({ method: 'POST', body }); if (version === generation) { current = null; $('[data-rows]').replaceChildren(); form.elements.sourceChecked.checked = false; say(`${data.saved} proposal(s) saved. Load questions again to review or export.`); } }
  catch (error) { if (version === generation) { current = null; $('[data-rows]').replaceChildren(); say(error.message + ' Load questions before retrying; the decision may already be saved.'); } }
  finally { if (version === generation) locks(false); }
});
$('[data-export]').addEventListener('click', () => {
  if (busy || !current) return;
  const proposals = current.rows.filter(r => r.proposal && !r.staleProposal).map(r => r.proposal);
  if (!proposals.length) return;
  const url = URL.createObjectURL(new Blob([JSON.stringify({ schema: 1, proposals }, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = `private-import-reviews-${current.category}.json`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('[data-sign-out]').addEventListener('click', async () => {
  clear(); locks(true);
  try { const response = await fetch('/api/session?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error('Sign-out failed.'); location.assign('/ops-login/'); }
  catch (error) { locks(false); say(error.message + ' Sign in again before reviewing.'); }
});
window.addEventListener('pagehide', clear);
load();
