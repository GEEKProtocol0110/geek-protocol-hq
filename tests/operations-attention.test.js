import test from 'node:test';
import assert from 'node:assert/strict';
import { attentionCopy, attentionPanel } from '../server/ops-ui/assets/attention.js';

const snapshot = (extra = {}) => ({ ok: true, checkedAt: Date.now(), hall: { status: 'ready', pending: 2 }, questions: { status: 'ready', review: 3, publish: 1, scanned: 4, limit: 100, hasMore: true }, ...extra });
const response = (body, status = 200) => ({ ok: status === 200, status, json: async () => body });
const elements = () => {
  const nodes = new Map(), element = selector => { if (!nodes.has(selector)) nodes.set(selector, { textContent: '', disabled: false, addEventListener() {} }); return nodes.get(selector); };
  const root = { querySelector: element, setAttribute() {} };
  return { documentRef: { querySelector: () => root }, element };
};
test('attention wording labels bounded windows and treats missing, negative or forged counts as unavailable', () => {
  const copy = attentionCopy(snapshot()); assert.equal(copy.hallCount, '2'); assert.equal(copy.publishCount, '1'); assert.match(copy.questionScope, /not full queue totals/);
  const empty = attentionCopy(snapshot({ hall: { status: 'ready', pending: 0 }, questions: { status: 'ready', review: 0, publish: 0, scanned: 0, limit: 100, hasMore: false } }));
  assert.equal(empty.hallCount, '0'); assert.match(empty.hallDetail, /No pending/); assert.equal(empty.reviewCount, '0');
  for (const hall of [{ status: 'unavailable' }, { status: 'ready', pending: -1 }, { status: 'ready', pending: 501 }, { status: 'ready', pending: '<script>' }]) assert.equal(attentionCopy(snapshot({ hall })).hallCount, 'Unavailable');
  for (const questions of [{ status: 'unavailable' }, { status: 'ready', review: 999, publish: 0, scanned: 4, limit: 100, hasMore: false }, { status: 'ready', review: 3, publish: 3, scanned: 4, limit: 100, hasMore: false }]) assert.equal(attentionCopy(snapshot({ questions })).reviewCount, 'Unavailable');
  assert.match(attentionCopy(snapshot({ questions: { status: 'access-unavailable' } })).questionScope, /not configured/);
});
test('attention locks clear private counts and reject late replies after logout, even if cancellation is ignored', async () => {
  const ui = elements(); let finish, signal, ready = true;
  const panel = attentionPanel({ ...ui, isReady: () => ready, onExpired() {}, fetchImpl: (_url, options) => { signal = options.signal; return new Promise(resolve => { finish = resolve; }); } });
  const loading = panel.load(); assert.equal(ui.element('[data-attention-refresh]').disabled, true);
  ready = false; panel.lock(); assert.equal(signal.aborted, true); finish(response(snapshot())); await loading;
  assert.equal(ui.element('[data-attention-hall-count]').textContent, '—'); assert.equal(ui.element('[data-attention-scope]').textContent, ''); assert.equal(ui.element('[data-attention-refresh]').disabled, true);
});
test('attention clears stale badges before refreshing, preserves access denial, and never assumes zero on an outage', async () => {
  const ui = elements(); let attempt = 0, expired = false;
  const panel = attentionPanel({ ...ui, isReady: () => true, onExpired() { expired = true; panel.lock(); }, fetchImpl: async () => { if (attempt++ === 0) return response(snapshot()); if (attempt === 2) throw Error('Synthetic outage'); return response({ ok: false }, 401); } });
  await panel.load(); assert.equal(ui.element('[data-attention-hall-count]').textContent, '2');
  await panel.load(); assert.equal(ui.element('[data-attention-hall-count]').textContent, 'Unavailable'); assert.equal(ui.element('[data-attention-scope]').textContent, '');
  await panel.load(); assert.equal(expired, true); assert.equal(ui.element('[data-attention-hall-count]').textContent, '—');
});
