import { defaultGeek, personalGeek, normalizeGeek, geekSvg, geekDescription } from '../../assets/geek-avatar.js';
import { storeGroups, storeItems, tryStoreItem } from './catalog.js';
import { saveStorePreview } from './preview.js';
const $ = selector => document.querySelector(selector);
let draft = { ...personalGeek }, group = 'all', view = 'front';
const status = text => { $('[data-store-status]').textContent = text; };
const itemFits = item => !item.part || (item.modes.includes(draft.kind) && !(draft.kind === 'human' && item.part === 'head' && item.value === 'antenna'));
function preview() {
  $('[data-store-preview]').innerHTML = geekSvg(draft, view);
  $('[data-store-preview]').setAttribute('aria-label', `${view} view. ${geekDescription(draft)}`);
  $('[data-store-look]').textContent = geekDescription(draft).replace('Custom Geek: ', '');
  for (const b of document.querySelectorAll('[data-store-view]')) b.setAttribute('aria-pressed', String(b.dataset.storeView === view));
}
function render() {
  const search = $('[data-store-search]').value.trim().toLocaleLowerCase();
  const items = storeItems.filter(item => itemFits(item) && (group === 'all' || item.group === group) && `${item.name} ${item.description} ${item.rule}`.toLocaleLowerCase().includes(search));
  $('[data-store-count]').textContent = `${items.length} item${items.length === 1 ? '' : 's'} shown`;
  $('[data-store-items]').replaceChildren(...items.map(item => {
    const card = document.createElement('article'); card.className = 'store-card';
    const badge = document.createElement('span'); badge.className = 'store-badge';
    badge.textContent = ({ free: 'Free studio part', career: 'Earn through play', 'free-practice': 'Free practice trial', planned: 'In development' })[item.availability];
    const h = document.createElement('h3'); h.textContent = item.name;
    const p = document.createElement('p'); p.textContent = item.description;
    const rule = document.createElement('small'); rule.textContent = item.rule;
    card.append(badge, h, p, rule);
    if (item.part) {
      const art = document.createElement('div'); art.className = 'store-item-art'; art.setAttribute('aria-hidden', 'true'); art.innerHTML = geekSvg(tryStoreItem(draft, item.id)); card.prepend(art);
      const button = document.createElement('button'); button.type = 'button'; button.dataset.storeItem = item.id; button.textContent = 'Try on'; button.setAttribute('aria-label', `Try on ${item.name}`); button.setAttribute('aria-pressed', String(draft[item.part] === item.value));
      button.addEventListener('click', () => { draft = tryStoreItem(draft, item.id); $('[data-store-fitting]').open = true; preview(); render(); $(`[data-store-item="${item.id}"]`)?.focus({ preventScroll: true }); status(`${item.name} added to your unsaved preview. Review the look in your studio to save it.`); $('[data-store-preview]').scrollIntoView({ block: 'nearest', behavior: 'auto' }); }); card.append(button);
    } else if (item.practiceUrl) {
      const a = document.createElement('a'); a.href = item.practiceUrl; a.textContent = 'Try in free practice →'; card.append(a);
    } else {
      const note = document.createElement('span'); note.className = 'store-planned'; note.textContent = 'Availability and price to be decided'; card.append(note);
    }
    return card;
  }));
  if (!items.length) { const p = document.createElement('p'); p.textContent = 'No matching items. Try another filter or search.'; $('[data-store-items]').append(p); }
  for (const b of document.querySelectorAll('[data-store-group]')) b.setAttribute('aria-pressed', String(b.dataset.storeGroup === group));
}
for (const [id, label] of Object.entries(storeGroups)) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.storeGroup = id; b.textContent = label; b.setAttribute('aria-pressed', String(id === group));
  b.addEventListener('click', () => { group = id; render(); }); $('[data-store-filters]').append(b);
}
$('[data-store-search]').addEventListener('input', render);
$('[data-store-kind]').addEventListener('change', event => {
  draft = normalizeGeek({ ...draft, kind: event.target.value }); preview(); render(); status('Character style changed. Your saved profile is unchanged.');
});
for (const b of document.querySelectorAll('[data-store-view]')) b.addEventListener('click', () => { view = b.dataset.storeView; preview(); });
$('[data-store-reset]').addEventListener('click', () => { draft = { ...(draft.kind === 'human' ? personalGeek : defaultGeek) }; preview(); render(); status('Preview reset. Your saved profile is unchanged.'); });
$('[data-store-review]').addEventListener('click', () => {
  try { saveStorePreview(window.sessionStorage, draft); window.location.assign('/profile/?store=preview#geek-builder'); }
  catch { status('This browser could not carry the preview to your studio. Open My Geek and choose these free parts there.'); }
});
if (window.matchMedia?.('(min-width: 851px)')?.matches) $('[data-store-fitting]').open = true;
preview(); render();
