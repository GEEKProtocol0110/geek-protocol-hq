import { customGeekId, geekParts, defaultGeek, personalGeek, normalizeGeek, geekDescription, geekSvg, careerEffects } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
let saved = normalizeGeek(defaultGeek), draft = { ...saved }, ready = false, saving = false, edited = false;
const sections = ['face', 'outfit', 'extras'];
let section = 'face', view = 'front', effects = [];
const presets = [
  { name: 'Everyday', design: personalGeek },
  { name: 'Explorer', design: { ...personalGeek, outfit: 'vest', palette: 'forest', hair: 'curls', back: 'pack', pants: 'cargo' } },
  { name: 'Night signal', design: { ...personalGeek, palette: 'violet', hair: 'bob', hairColor: 'black', skin: 'brown', head: 'beanie', fx: 'stars' } },
  { name: 'GIGA', design: defaultGeek }
];
const sameDesign = (left, right) => JSON.stringify(normalizeGeek(left)) === JSON.stringify(normalizeGeek(right));
const saveCharacter = async customization => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch('/api/collectibles', { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'customize-avatar', customization }) });
    const payload = await response.json().catch(error => { if (controller.signal.aborted) throw error; return {}; });
    if (!response.ok || !payload.collection?.customization || payload.collection.avatar?.id !== customGeekId) throw new Error(payload.error || 'Your Geek save could not be confirmed.');
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Saving your Geek took too long to respond.');
    throw error;
  } finally { clearTimeout(timer); }
};
const preview = () => {
  const root = $('[data-geek-preview]');
  root.innerHTML = geekSvg(draft, view);
  root.setAttribute('aria-label', `${view} view. ${geekDescription(draft)}`);
  for (const button of document.querySelectorAll('[data-geek-view]')) button.setAttribute('aria-pressed', String(button.dataset.geekView === view));
  for (const button of document.querySelectorAll('[data-geek-palette]')) button.setAttribute('aria-pressed', String(button.dataset.geekPalette === draft.palette));
  $('[data-geek-look]').textContent = geekDescription(draft).replace('Custom Geek: ', '');
  const lockedEffect = careerEffects.find(effect => effect.id === draft.fx && !effects.some(item => item.id === effect.id && item.owned));
  $('[data-geek-unlock-note]').textContent = lockedEffect ? `${lockedEffect.requirement} to save this effect. You can preview it now.` : 'All selected parts are available for your connected profile.';
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
  $('[data-geek-save]').disabled = !ready || saving || Boolean(window.GeekProfile?.collectionBusy) || Boolean(lockedEffect);
  $('[data-geek-save]').textContent = saving ? 'Saving your Geek…' : 'Save my Geek →';
  $('[data-geek-controls]').disabled = saving;
  $('[data-geek-reset]').disabled = saving;
  for (const button of document.querySelectorAll('[data-geek-preset], [data-geek-random], [data-geek-palette]')) button.disabled = saving;
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
    changed('Preview updated. Choose Save my Geek to use this Geek on your profile.');
  });
  label.append(select); $(`[data-geek-options="${part.section}"]`).append(label);
}
for (const radio of document.querySelectorAll('[name="geek-kind"]')) radio.addEventListener('change', () => {
  if (!radio.checked) return;
  draft.kind = radio.value;
  if (draft.kind === 'human' && draft.head === 'antenna') draft.head = 'plain';
  changed('Character style changed. Your preview becomes your profile character when you save your Geek.');
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
  changed(`${draft.kind === 'human' ? 'Personal Geek' : 'Golden GIGA'} starter preview. Choose Save my Geek to apply it.`);
});
$('[data-geek-cancel]').addEventListener('click', () => {
  draft = { ...saved }; edited = false; preview(); $('[data-geek-status]').textContent = 'Restored your saved design.';
});
$('[data-geek-save]').addEventListener('click', async () => {
  if (!ready || saving || careerEffects.some(effect => effect.id === draft.fx && !effects.some(item => item.id === effect.id && item.owned))) return;
  if (window.GeekProfile?.beginCollectionWrite && !window.GeekProfile.beginCollectionWrite()) return;
  saving = true; preview(); $('[data-geek-status]').textContent = 'Saving your profile character…';
  try {
    const payload = await saveCharacter(draft);
    edited = false; saved = normalizeGeek(payload.collection.customization); draft = { ...saved };
    window.GeekProfile?.renderCollectibles(payload);
    $('[data-geek-status]').textContent = 'Saved and equipped. Your custom Geek is now your profile character.';
  } catch (error) {
    ready = false;
    window.GeekProfile?.markCollectionUnavailable?.();
    $('[data-geek-status]').textContent = `${error.message} Your preview is still here. Reconnect your profile to check whether the save was accepted before trying again.`;
  } finally { saving = false; window.GeekProfile?.endCollectionWrite?.(); preview(); }
});
window.GeekBuilder = {
  receive(collection) {
    ready = true; effects = collection.effects || []; saved = normalizeGeek(collection.customization);
    if (!edited && !saving) draft = { ...saved };
    if (!saving) edited = !sameDesign(draft, saved);
    if (!saving && !edited) $('[data-geek-status]').textContent = collection.avatar.id === customGeekId ? 'Your saved Geek is equipped. Make it yours below.' : 'Choose a personal Geek or a GIGA robot, then save your Geek. All starter parts are free.';
    preview();
  },
  unavailable() { ready = false; preview(); $('[data-geek-status]').textContent = 'You can preview your Geek. Reconnect your profile below before saving.'; },
  syncControls: preview, svg: geekSvg, description: geekDescription, customGeekId
};
for (const [index, preset] of presets.entries()) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.geekPreset = index;
  button.innerHTML = geekSvg(preset.design) + `<span>${preset.name}</span>`;
  button.addEventListener('click', () => { if (saving) return; draft = normalizeGeek(preset.design); changed(`${preset.name} starter preview. Adjust any part, then save your Geek.`); });
  $('[data-geek-presets]').append(button);
}
for (const [id, label] of geekParts.palette.choices) {
  const button = document.createElement('button'); button.type = 'button'; button.dataset.geekPalette = id;
  button.className = `geek-swatch swatch-${id}`; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => { if (saving) return; draft.palette = id; changed(`${label} preview. Choose Save my Geek to apply.`); });
  $('[data-geek-swatches]').append(button);
}
for (const button of document.querySelectorAll('[data-geek-view]')) button.addEventListener('click', () => { view = button.dataset.geekView; preview(); });
$('[data-geek-portrait]').addEventListener('click', event => {
  const button = event.currentTarget, enabled = button.getAttribute('aria-pressed') !== 'true';
  button.setAttribute('aria-pressed', String(enabled)); $('[data-geek-preview]').classList.toggle('portrait', enabled);
});
$('[data-geek-random]').addEventListener('click', () => {
  if (saving) return;
  for (const [key, part] of Object.entries(geekParts)) {
    if (key === 'kind' || (part.modes && !part.modes.includes(draft.kind))) continue;
    const choices = part.choices.filter(([id]) => !(key === 'head' && id === 'antenna' && draft.kind === 'human') && !(key === 'fx' && careerEffects.some(effect => effect.id === id) && !effects.some(effect => effect.id === id && effect.owned)));
    draft[key] = choices[Math.floor(Math.random() * choices.length)][0];
  }
  changed('A new look to try. Undo returns to your saved design.');
});
window.addEventListener('beforeunload', event => { if (edited) { event.preventDefault(); event.returnValue = ''; } });
preview();
// The profile request may finish before this module loads.
if (window.GeekProfile?.collection) {
  window.GeekBuilder.receive(window.GeekProfile.collection);
  window.GeekProfile.renderCollectibles({ collection: window.GeekProfile.collection, trades: window.GeekProfile.trades || [] });
} else if (window.GeekProfile?.offline) window.GeekBuilder.unavailable();
