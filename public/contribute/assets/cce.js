(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('[data-question-form]');
  const list = $('[data-submission-list]');
  const message = $('[data-form-message]');
  const serviceState = $('[data-service-state]');
  const NAME_KEY = 'geek-cce-name-v1';
  let dashboard = { submissions: [], stats: {} };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The community service is unavailable.');
    return payload;
  };

  const setMessage = (copy, kind = '') => {
    message.textContent = copy;
    message.className = `form-message ${kind}`.trim();
  };

  const syncSession = async () => {
    const displayName = form.elements.displayName.value.trim() || 'Community Geek';
    localStorage.setItem(NAME_KEY, displayName);
    const payload = await api('/api/session', { method: 'POST', body: JSON.stringify({ displayName }) });
    form.elements.displayName.value = payload.player.name;
    serviceState.textContent = 'SERVER READY';
    serviceState.classList.add('live');
  };

  const formatDate = (timestamp) => timestamp ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp)) : 'Pending';
  const formatStatus = (status) => ({ submitted: 'In review', approved: 'Approved', published: 'Published', rejected: 'Rejected', 'changes-requested': 'Changes requested' })[status] || status;

  const render = (payload) => {
    dashboard = payload;
    ['submitted', 'accepted', 'used', 'earned'].forEach((key) => { $(`[data-stat="${key}"]`).textContent = Number(payload.stats?.[key] || 0).toLocaleString(); });
    const submissions = Array.isArray(payload.submissions) ? payload.submissions : [];
    if (!submissions.length) {
      list.innerHTML = '<div class="empty-state"><b>No submissions yet.</b><span>Your review history will appear here on this browser.</span></div>';
      return;
    }
    list.innerHTML = submissions.map((item) => `
      <article class="submission-card">
        <div class="submission-card__top"><small>${escapeHtml(item.category)} · ${escapeHtml(item.difficulty)}</small><small class="status ${escapeHtml(item.status)}">${escapeHtml(formatStatus(item.status))}</small></div>
        <h3>${escapeHtml(item.prompt)}</h3>
        ${item.reviewNote ? `<p><b>Review note:</b> ${escapeHtml(item.reviewNote)}</p>` : '<p>Awaiting the next moderation step.</p>'}
        <div class="submission-card__meta"><span>${escapeHtml(formatDate(item.updatedAt))}</span><b>${escapeHtml(item.reward?.status === 'earned' ? `${item.reward.amount} GEEK EARNED` : `${item.reward?.amount || 25} GEEK · ${item.reward?.status || 'PENDING'}`)}</b></div>
        ${item.status === 'changes-requested' ? `<button type="button" data-revise="${escapeHtml(item.id)}">Revise this question</button>` : ''}
      </article>`).join('');
  };

  const loadDashboard = async () => {
    try {
      await syncSession();
      render(await api('/api/content'));
    } catch (error) {
      serviceState.textContent = 'SERVICE PAUSED';
      serviceState.classList.remove('live');
      setMessage(error.message, 'error');
    }
  };

  const formPayload = () => ({
    action: form.elements.submissionId.value ? 'revise' : 'submit',
    id: form.elements.submissionId.value || undefined,
    displayName: form.elements.displayName.value,
    category: form.elements.category.value,
    topic: form.elements.topic.value,
    difficulty: form.elements.difficulty.value,
    prompt: form.elements.prompt.value,
    options: [0, 1, 2, 3].map((index) => form.elements[`option${index}`].value),
    correctIndex: Number(new FormData(form).get('correctIndex')),
    explanation: form.elements.explanation.value,
    source: form.elements.source.value,
    original: form.elements.original.checked
  });

  const resetForm = () => {
    const name = form.elements.displayName.value;
    const category = form.elements.category.value;
    form.reset();
    form.elements.displayName.value = name;
    form.elements.category.value = category;
    form.elements.submissionId.value = '';
    $('[data-cancel-revision]').hidden = true;
    $('.submit-question').innerHTML = 'Send to review <span>→</span>';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('.submit-question');
    button.disabled = true;
    button.textContent = form.elements.submissionId.value ? 'Sending revision…' : 'Submitting…';
    try {
      await syncSession();
      const payload = await api('/api/content', { method: 'POST', body: JSON.stringify(formPayload()) });
      render(payload);
      resetForm();
      setMessage(payload.submission.status === 'submitted' ? 'Submitted. Your question is now private in the moderation queue.' : 'Revision received.', 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      button.disabled = false;
      if (!button.querySelector('span')) button.innerHTML = form.elements.submissionId.value ? 'Send revision <span>→</span>' : 'Send to review <span>→</span>';
    }
  });

  list.addEventListener('click', (event) => {
    const button = event.target.closest('[data-revise]');
    if (!button) return;
    const item = dashboard.submissions.find((submission) => submission.id === button.dataset.revise);
    if (!item) return;
    form.elements.submissionId.value = item.id;
    form.elements.displayName.value = item.displayName;
    form.elements.category.value = item.category;
    form.elements.topic.value = item.topic;
    form.elements.difficulty.value = item.difficulty;
    form.elements.prompt.value = item.prompt;
    item.options.forEach((option, index) => { form.elements[`option${index}`].value = option; });
    form.elements.correctIndex.value = String(item.correctIndex);
    form.elements.explanation.value = item.explanation;
    form.elements.source.value = item.source;
    form.elements.original.checked = true;
    $('[data-cancel-revision]').hidden = false;
    $('.submit-question').innerHTML = 'Send revision <span>→</span>';
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('[data-cancel-revision]').addEventListener('click', () => { resetForm(); setMessage('Revision canceled.'); });
  $('[data-refresh]').addEventListener('click', loadDashboard);
  form.elements.displayName.value = localStorage.getItem(NAME_KEY) || 'Community Geek';
  loadDashboard();
})();
