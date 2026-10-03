import { customGeekId, geekParts, defaultGeek, normalizeGeek, geekDescription, geekSvg } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
let saved = { ...defaultGeek }, draft = { ...defaultGeek }, ready = false, saving = false, edited = false;
const preview = () => {
  const root = $('[data-geek-preview]'); root.innerHTML = geekSvg(draft); root.setAttribute('aria-label', geekDescription(draft));
  for (const key of Object.keys(geekParts)) $(`[data-geek-part="${key}"]`).value = draft[key];
  $('[data-geek-save]').disabled = !ready || saving;
  $('[data-geek-save]').textContent = saving ? 'Saving your Geek…' : 'Save & equip my Geek →';
  $('[data-geek-controls]').disabled = saving;
  $('[data-geek-reset]').disabled = saving; $('[data-geek-cancel]').disabled = saving;
};
for (const [key, part] of Object.entries(geekParts)) {
  const label = document.createElement('label'); label.textContent = part.label;
  const select = document.createElement('select'); select.dataset.geekPart = key;
  select.append(...part.choices.map(([id, name]) => { const option = document.createElement('option'); option.value = id; option.textContent = name; return option; }));
  select.addEventListener('change', () => { draft[key] = select.value; edited = true; preview(); $('[data-geek-status]').textContent = 'Preview updated. Save & equip to use this Geek on your profile.'; });
  label.append(select); $('[data-geek-options]').append(label);
}
$('[data-geek-reset]').addEventListener('click', () => { draft = { ...defaultGeek }; edited = true; preview(); $('[data-geek-status]').textContent = 'Golden GIGA starter preview. Save & equip to apply it.'; });
$('[data-geek-cancel]').addEventListener('click', () => { draft = { ...saved }; edited = false; preview(); $('[data-geek-status]').textContent = 'Restored your saved design.'; });
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
  } catch (error) { $('[data-geek-status]').textContent = `${error.message} Your preview is still here; it has not replaced your saved character.`; }
  finally { saving = false; preview(); }
});
window.GeekBuilder = {
  receive(collection) {
    ready = true; saved = normalizeGeek(collection.customization);
    if (!edited && !saving) draft = { ...saved };
    if (!saving && !edited) $('[data-geek-status]').textContent = collection.avatar.id === customGeekId ? 'Your saved Geek is equipped. Customize it below.' : 'Choose your parts, then save & equip your Geek. All starter parts are free.';
    preview();
  },
  unavailable() { ready = false; preview(); $('[data-geek-status]').textContent = 'You can preview your Geek. Reconnect your profile below before saving.'; },
  svg: geekSvg, customGeekId
};
preview();
// The profile request may finish before this module loads.
if (window.GeekProfile?.collection) { window.GeekBuilder.receive(window.GeekProfile.collection); window.GeekProfile.renderCollectibles({ collection: window.GeekProfile.collection, trades: window.GeekProfile.trades || [] }); }
else if (window.GeekProfile?.offline) window.GeekBuilder.unavailable();
