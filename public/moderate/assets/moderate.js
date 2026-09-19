(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('[data-access-form]');
  const list = $('[data-review-list]');
  const accessMessage = $('[data-access-message]');
  let token = sessionStorage.getItem('geek-cce-admin') || '';

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const api = async (options = {}) => {
    const response = await fetch('/api/moderation', { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CCE-Admin': token }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'Moderation service unavailable.');
    return payload;
  };
  const setAccess = (copy, live = false) => { accessMessage.textContent = copy; accessMessage.classList.toggle('live', live); };
  const render = (queue = []) => {
    $('[data-queue-count]').textContent = queue.length;
    if (!queue.length) {
      list.innerHTML = '<div class="locked-state"><b>Queue clear</b><span>No submissions are waiting for review or publication.</span></div>';
      return;
    }
    list.innerHTML = queue.map((item) => `
      <article class="review-card" data-id="${escapeHtml(item.id)}">
        <header class="review-card__head"><div><span class="state">${escapeHtml(item.status)}</span><span>${escapeHtml(item.category)}</span><span>${escapeHtml(item.difficulty)}</span><span>${escapeHtml(item.topic)}</span></div><small>${escapeHtml(item.displayName)} · ${new Date(item.submittedAt).toLocaleDateString()}</small></header>
        <div class="review-card__body"><div><h3>${escapeHtml(item.prompt)}</h3><ol class="review-options">${item.options.map((option, index) => `<li class="${index === item.correctIndex ? 'correct' : ''}">${String.fromCharCode(65 + index)} · ${escapeHtml(option)}</li>`).join('')}</ol></div><aside class="evidence"><span>Explanation</span><p>${escapeHtml(item.explanation)}</p><span>Primary source</span><p><a href="${escapeHtml(item.source)}" target="_blank" rel="noopener noreferrer">${escapeHtml(item.source)}</a></p><span>Reward on first use</span><p>${Number(item.reward?.amount || 0).toLocaleString()} GEEK · launch-gated ledger</p></aside></div>
        <div class="review-actions"><input type="text" maxlength="400" data-note placeholder="Review note (required for changes or rejection)" /><div class="action-buttons">${item.status === 'approved' ? '<button type="button" data-action="publish">Publish to game</button><button type="button" data-action="request-changes">Request changes</button>' : '<button type="button" data-action="approve">Approve</button><button type="button" data-action="request-changes">Request changes</button><button type="button" data-action="reject">Reject</button>'}</div></div>
      </article>`).join('');
  };
  const load = async () => {
    try {
      const payload = await api();
      render(payload.queue);
      setAccess('Private review access active.', true);
    } catch (error) {
      setAccess(error.message, false);
      list.innerHTML = `<div class="locked-state"><b>Queue unavailable</b><span>${escapeHtml(error.message)}</span></div>`;
    }
  };
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    token = form.elements.token.value.trim();
    sessionStorage.setItem('geek-cce-admin', token);
    load();
  });
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    const card = button.closest('[data-id]');
    const note = $('[data-note]', card).value.trim();
    if (['request-changes', 'reject'].includes(button.dataset.action) && note.length < 6) {
      setAccess('Add a clear review note before returning or rejecting a question.', false);
      return;
    }
    card.querySelectorAll('button').forEach((item) => { item.disabled = true; });
    try {
      const payload = await api({ method: 'POST', body: JSON.stringify({ action: button.dataset.action, id: card.dataset.id, note }) });
      render(payload.queue);
      setAccess(`${button.dataset.action.replace('-', ' ')} recorded.`, true);
    } catch (error) {
      setAccess(error.message, false);
      card.querySelectorAll('button').forEach((item) => { item.disabled = false; });
    }
  });
  if (token) { form.elements.token.value = token; load(); }
})();
