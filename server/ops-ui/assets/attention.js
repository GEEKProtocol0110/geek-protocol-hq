import { ownerClient } from './ops-core.js';

const count = (value, max) => Number.isSafeInteger(value) && value >= 0 && value <= max;
export const attentionCopy = payload => {
  const hall = payload?.hall, questions = payload?.questions;
  const validHall = hall?.status === 'ready' && count(hall.pending, 500);
  const validQuestions = questions?.status === 'ready' && questions.limit === 100 && count(questions.scanned, 100) && count(questions.review, questions.scanned) && count(questions.publish, questions.scanned) && questions.review + questions.publish <= questions.scanned && typeof questions.hasMore === 'boolean';
  return {
    hallCount: validHall ? String(hall.pending) : 'Unavailable',
    hallDetail: validHall ? hall.pending ? 'Applications waiting for your review.' : 'No pending Hall applications at this check.' : 'Hall applications could not be checked. Refresh to try again.',
    reviewCount: validQuestions ? String(questions.review) : 'Unavailable',
    publishCount: validQuestions ? String(questions.publish) : 'Unavailable',
    reviewDetail: validQuestions ? questions.review ? 'New or revised questions awaiting a decision.' : 'No questions awaiting a decision in this window.' : 'Question reviews could not be checked.',
    publishDetail: validQuestions ? questions.publish ? 'Approved questions awaiting publication.' : 'No approved questions awaiting publication in this window.' : 'Ready-to-publish questions could not be checked.',
    questionScope: questions?.status === 'access-unavailable' ? 'Question review access is not configured for this owner session.' : validQuestions ? `Question counts cover the latest ${questions.scanned} queue entries (up to 100).${questions.hasMore ? ' More entries exist beyond this window; these counts are not full queue totals.' : ''}` : 'Question queue counts are unavailable; no zero count is assumed.'
  };
};

export const attentionPanel = ({ isReady, onExpired, documentRef = globalThis.document, fetchImpl = globalThis.fetch }) => {
  const root = documentRef.querySelector('[data-attention-root]'); if (!root) return null;
  const $ = selector => root.querySelector(selector);
  const refresh = $('[data-attention-refresh]'), message = $('[data-attention-message]'), scope = $('[data-attention-scope]');
  const fields = { hallCount: '[data-attention-hall-count]', hallDetail: '[data-attention-hall-detail]', reviewCount: '[data-attention-review-count]', reviewDetail: '[data-attention-review-detail]', publishCount: '[data-attention-publish-count]', publishDetail: '[data-attention-publish-detail]' };
  const client = ownerClient({ endpoint: '/api/session/?service=operations&action=attention', fetchImpl });
  let busy = false, epoch = 0;
  const setBusy = value => { busy = value; root.setAttribute('aria-busy', String(value)); refresh.disabled = value || !isReady(); };
  const clear = copy => { for (const [key, selector] of Object.entries(fields)) $(selector).textContent = key.endsWith('Count') ? '—' : ''; scope.textContent = ''; message.textContent = copy; };
  const lock = () => { epoch++; client.clear(); clear('Private counts cleared. Refresh after signing in.'); setBusy(false); };
  const load = async () => {
    if (busy || !isReady()) return;
    const version = epoch; clear('Checking waiting reviews…'); setBusy(true);
    try {
      const result = await client.request(); if (version !== epoch) return;
      const copy = attentionCopy(result);
      for (const [key, selector] of Object.entries(fields)) $(selector).textContent = copy[key];
      scope.textContent = copy.questionScope;
      message.textContent = Number.isSafeInteger(result.checkedAt) && result.checkedAt > 0 ? `Checked ${new Date(result.checkedAt).toLocaleString()}. Refresh for current counts; the queues can change.` : 'Refresh to check current counts.';
    } catch (error) {
      if (version !== epoch) return;
      if ([401, 403].includes(error.status)) { onExpired(); return; }
      for (const [key, selector] of Object.entries(fields)) $(selector).textContent = key.endsWith('Count') ? 'Unavailable' : '';
      message.textContent = 'Waiting reviews could not be checked. Refresh to try again.';
    } finally { if (version === epoch) setBusy(false); }
  };
  refresh.addEventListener('click', load); setBusy(false);
  return { lock, load, enableRefresh: () => setBusy(busy) };
};
