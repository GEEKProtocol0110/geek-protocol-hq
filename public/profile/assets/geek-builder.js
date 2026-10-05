import { customGeekId, geekParts, defaultGeek, personalGeek, normalizeGeek, geekDescription, geekSvg } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
let saved = normalizeGeek(defaultGeek), draft = { ...saved }, ready = false, saving = false, edited = false;
const sections = ['face', 'outfit', 'extras'];
let section = 'face';
const sameDesign = (left, right) => JSON.stringify(normalizeGeek(left)) === JSON.stringify(normalizeGeek(right));
const preview = () => {
  const root = $('[data-geek-preview]');
  root.innerHTML = geekSvg(draft);
  root.setAttribute('aria-label', geekDescription(draft));
  for (const [key, part] of Object.entries(geekParts)) {
    if (key === 'kind') continue;
    const control = $(`[data-geek-part="${key}"]`);
    control.value = draft[key];
    control.closest('label').hidden = Boolean(part.modes && !part.modes.includes(draft.kind));
    // Antennas are offered only for the robot style.
    if (key === 'head') control.querySelector('[value="antenna"]').hidden = draft.kind === 'human';
  }
  for (const radio of document.querySelectorAll('[name="geek-kind"]')) radio.checked = radio.value === draft.kind;
  for (const tab of document.querySelectorAll('[data-geek-tab]')) {
    const active = tab.dataset.geekTab === section;
    tab.setAttribute('aria-selected', String(active)); tab.tabIndex = active ? 0 : -1;
    $(`#geek-panel-${tab.dataset.geekTab}`).hidden = !active;
  }
  $('[data-geek-preview-state]').textContent = edited ? 'UNSAVED PREVIEW' : 'YOUR CHARACTER PREVIEW';
  $('[data-geek-preview-title]').textContent = draft.kind === 'human' ? 'Your place in the Grid.' : 'Your GIGA signal.';
  $('[data-geek-save]').disabled = !ready || saving;
  $('[data-geek-save]').textContent = saving ? 'Saving your Geek…' : 'Save & equip my Geek →';
  $('[data-geek-controls]').disabled = saving;
  $('[data-geek-reset]').disabled = saving;
  $('[data-geek-cancel]').disabled = saving || !edited;
};
const changed = message => {
  edited = !sameDesign(draft, saved); preview(); $('[data-geek-status]').textContent = message;
};
for (const [key, part] of Object.entries(geekParts)) {
  if (key === 'kind') continue;
  const label = document.createElement('label'); label.textContent = part.label;
  const select = document.createElement('select'); select.dataset.geekPart = key;
  select.append(...part.choices.map(([id, name]) => {
    const option = document.createElement('option'); option.value = id; option.textContent = name;
    if (key === 'head' && id === 'plain') option.textContent = 'No headgear';
    return option;
  }));
  select.addEventListener('change', () => {
    draft[key] = select.value;
    changed('Preview updated. Save & equip to use this Geek on your profile.');
  });
  label.append(select); $(`[data-geek-options="${part.section}"]`).append(label);
}
for (const radio of document.querySelectorAll('[name="geek-kind"]')) radio.addEventListener('change', () => {
  if (!radio.checked) return;
  draft.kind = radio.value;
  if (draft.kind === 'human' && draft.head === 'antenna') draft.head = 'plain';
  changed('Character style changed. Your preview becomes your profile character when you save & equip.');
});
for (const tab of document.querySelectorAll('[data-geek-tab]')) {
  tab.addEventListener('click', () => { section = tab.dataset.geekTab; preview(); });
  tab.addEventListener('keydown', event => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const current = sections.indexOf(section);
    section = event.key === 'Home' ? sections[0] : event.key === 'End' ? sections.at(-1) : sections[(current + (event.key === 'ArrowRight' ? 1 : -1) + sections.length) % sections.length];
    preview(); $(`[data-geek-tab="${section}"]`).focus();
  });
}
$('[data-geek-reset]').addEventListener('click', () => {
  draft = normalizeGeek(draft.kind === 'human' ? personalGeek : defaultGeek);
  changed(`${draft.kind === 'human' ? 'Personal Geek' : 'Golden GIGA'} starter preview. Save & equip to apply it.`);
});
$('[data-geek-cancel]').addEventListener('click', () => {
  draft = { ...saved }; edited = false; preview(); $('[data-geek-status]').textContent = 'Restored your saved design.';
});
$('[data-geek-save]').addEventListener('click', async () => {
  if (!ready || saving) return;
  saving = true; preview(); $('[data-geek-status]').textContent = 'Saving your profile character…';
  try {
    const response = await fetch('/api/collectibles', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'customize-avatar', customization: draft }) });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.collection?.customization || payload.collection.avatar?.id !== customGeekId) throw new Error(payload.error || 'Your Geek could not be saved. Try again.');
    edited = false; saved = normalizeGeek(payload.collection.customization); draft = { ...saved };
    window.GeekProfile?.renderCollectibles(payload);
    $('[data-geek-status]').textContent = 'Saved and equipped. Your custom Geek is now your profile character.';
  } catch (error) {
    $('[data-geek-status]').textContent = `${error.message} Your preview is still here; it has not replaced your saved character.`;
  } finally { saving = false; preview(); }
});
window.GeekBuilder = {
  receive(collection) {
    ready = true; saved = normalizeGeek(collection.customization);
    if (!edited && !saving) draft = { ...saved };
    if (!saving && !edited) $('[data-geek-status]').textContent = collection.avatar.id === customGeekId ? 'Your saved Geek is equipped. Make it yours below.' : 'Choose a personal Geek or a GIGA robot, then save & equip. All starter parts are free.';
    preview();
  },
  unavailable() { ready = false; preview(); $('[data-geek-status]').textContent = 'You can preview your Geek. Reconnect your profile below before saving.'; },
  svg: geekSvg, description: geekDescription, customGeekId
};
preview();
// The profile request may finish before this module loads.
if (window.GeekProfile?.collection) {
  window.GeekBuilder.receive(window.GeekProfile.collection);
  window.GeekProfile.renderCollectibles({ collection: window.GeekProfile.collection, trades: window.GeekProfile.trades || [] });
} else if (window.GeekProfile?.offline) window.GeekBuilder.unavailable();
