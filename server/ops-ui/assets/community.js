import { ownerClient, escapeHtml as e } from './ops-core.js';
const safeLink = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; } };
const link = (value, label) => safeLink(value) ? `<a href="${e(safeLink(value))}" target="_blank" rel="noopener noreferrer">${label} ↗</a>` : '';
export const communityPanel = ({ isReady, onExpired }) => {
  const root = document.querySelector('[data-community-root]'); if (!root) return null;
  const $ = s => root.querySelector(s), content = $('[data-community-records]'), message = $('[data-community-message]');
  const refresh = $('[data-community-refresh]'), older = $('[data-community-older]'), newer = $('[data-community-newer]'), view = $('[data-community-view]');
  const client = ownerClient({ endpoint: '/api/session/?service=operations&action=community' });
  let busy = false, epoch = 0, offset = 0, hasMore = false;
  const setBusy = value => { busy = value; root.setAttribute('aria-busy', String(value)); refresh.disabled = value || !isReady(); view.disabled = value || !isReady(); older.disabled = value || !isReady() || !hasMore; newer.disabled = value || !isReady() || offset === 0; content.querySelectorAll('button').forEach(b => { b.disabled = value || !isReady(); }); };
  const lock = () => { epoch++; client.clear(); offset = 0; hasMore = false; content.replaceChildren(); $('[data-community-count]').textContent = ''; message.textContent = 'Private records cleared. Refresh to load again.'; setBusy(false); };
  const render = result => {
    hasMore = result.hasMore; const records = result.items;
    $('[data-community-count]').textContent = `${records.length} loaded · page ${offset / 50 + 1}`;
    content.innerHTML = records.length ? records.map(item => {
      const common = `<article class="queue-card" data-community-id="${e(item.id)}" data-revision="${e(item.revision)}"><div class="card-meta"><span class="badge">${e(item.kind)}</span><span>${e(new Date(item.createdAt || item.publishedAt).toLocaleString())}</span></div><h3>${e(item.name)}</h3><p>${link(item.profile, 'Public profile')}</p>`;
      if (result.view === 'published') return `${common}<p>${e(item.summary)}</p><label>Withdrawal note<textarea data-review-note minlength="8" maxlength="500" rows="2"></textarea></label><button type="button" class="danger" data-community-action="withdraw">Withdraw public credit</button></article>`;
      return `${common}<p class="community-private-details">${e(item.details)}</p><p>${link(item.evidence, 'Submitted contribution evidence')}</p><p>${item.recognition && item.consent ? 'Requested recognition and consented to a public credit.' : 'Offer to help only. Public recognition is not authorized.'}</p><label>Private review note<textarea data-review-note minlength="8" maxlength="500" rows="2"></textarea></label>${item.recognition && item.consent ? '<label>Public contribution description<textarea data-public-summary minlength="12" maxlength="500" rows="3" placeholder="Describe the contribution you have checked. This text will be public."></textarea></label><label class="community-review-confirm"><input type="checkbox" data-contribution-confirmed /> I checked the contribution and the public identity.</label><button type="button" data-community-action="publish">Publish reviewed credit</button>' : ''}<button type="button" class="secondary" data-community-action="close">Close application</button></article>`;
    }).join('') : '<p class="empty">No records on this page.</p>';
  };
  const load = async () => {
    if (busy || !isReady()) return; const version = epoch; setBusy(true); content.replaceChildren(); message.textContent = 'Loading current records…';
    try { const result = await client.request({ query: `&view=${view.value}&offset=${offset}` }); if (version !== epoch) return; render(result); message.textContent = 'Review evidence before publishing. Fund contributions are not automatically verified.'; }
    catch (error) { if (version !== epoch) return; if ([401, 403].includes(error.status)) { onExpired(); return; } message.textContent = error.message; }
    finally { if (version === epoch) setBusy(false); }
  };
  refresh.addEventListener('click', () => { offset = 0; load(); });
  view.addEventListener('change', () => { offset = 0; load(); });
  older.addEventListener('click', () => { offset += 50; load(); }); newer.addEventListener('click', () => { offset = Math.max(0, offset - 50); load(); });
  $('[data-community-clear]').addEventListener('click', lock);
  content.addEventListener('click', async event => {
    const button = event.target.closest('[data-community-action]'); if (!button || busy || !isReady()) return;
    const card = button.closest('[data-community-id]'), action = button.dataset.communityAction, note = card.querySelector('[data-review-note]').value.trim();
    const summary = card.querySelector('[data-public-summary]')?.value.trim() || '', confirmed = card.querySelector('[data-contribution-confirmed]')?.checked || false;
    if (note.length < 8 || (action === 'publish' && (summary.length < 12 || !confirmed))) { message.textContent = 'Add a review note. Publishing also needs a public description and confirmation that you checked the contribution.'; return; }
    if (!window.confirm(action === 'publish' ? 'Publish this name, profile link and reviewed description in the Hall of Thanks?' : action === 'withdraw' ? 'Remove this credit from the public hall?' : 'Close this private application without publishing it?')) return;
    const version = epoch; setBusy(true); message.textContent = 'Recording your decision…';
    try { await client.request({ method: 'POST', body: { id: card.dataset.communityId, expectedRevision: Number(card.dataset.revision), action, note, summary, confirmed: action === 'withdraw' || confirmed } }); if (version !== epoch) return; content.replaceChildren(); hasMore = false; message.textContent = 'Decision saved. Refresh to review the current list.'; }
    catch (error) { if (version !== epoch) return; content.replaceChildren(); hasMore = false; if ([401, 403].includes(error.status)) { onExpired(); return; } message.textContent = `${error.message} Refresh before another decision; a lost response may mean it was already saved.`; }
    finally { if (version === epoch) setBusy(false); }
  });
  setBusy(false);
  return { lock, load, enableRefresh: () => setBusy(busy) };
};
