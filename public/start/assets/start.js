const key = 'geek_start_checklist_v2';
const boxes = [...document.querySelectorAll('[data-step-check]')];
const ids = boxes.map(box => box.dataset.stepCheck);
const names = ['choose your player', 'make your Geek', 'learn one idea', 'try Daily Signal', 'see your saved progress'];
let completed = [];
function read() {
  try {
    const current = localStorage.getItem(key);
    const value = JSON.parse(current ?? localStorage.getItem('geek_start_checklist_v1'));
    // Mini's old practice check does not imply an HQ result was submitted.
    completed = Array.isArray(value) ? value.filter(id => ids.includes(id) && (current !== null || ['learn', 'geek'].includes(id))) : [];
  } catch { completed = []; }
}
function render() {
  for (const box of boxes) box.checked = completed.includes(box.dataset.stepCheck);
  const count = boxes.filter(box => box.checked).length, next = boxes.findIndex(box => !box.checked);
  const progress = document.querySelector('[data-start-progress]'); progress.value = count; progress.textContent = `${count} of ${boxes.length}`;
  document.querySelector('[data-start-status]').textContent = next < 0 ? 'Your first visit is complete. Come back to any step whenever you like.' : `${count} of ${boxes.length} steps checked. Next: ${names[next]}.`;
  const link = document.querySelector('[data-start-next]');
  link.href = next < 0 ? '/profile/' : `#step-${ids[next]}`;
  link.textContent = next < 0 ? 'Return to My HQ →' : `${names[next].charAt(0).toUpperCase()}${names[next].slice(1)} →`;
  for (const card of document.querySelectorAll('[data-start-card]')) card.classList.toggle('step-complete', completed.includes(card.dataset.startCard));
}
function save() {
  try { localStorage.setItem(key, JSON.stringify(completed)); }
  catch { document.querySelector('[data-storage-note]').textContent = 'Your checklist works for this visit. This browser could not save it.'; }
  render();
}
for (const box of boxes) box.addEventListener('change', () => { completed = boxes.filter(item => item.checked).map(item => item.dataset.stepCheck); save(); });
document.querySelector('[data-start-reset]').addEventListener('click', () => { completed = []; save(); });
window.addEventListener('storage', event => { if ([key, 'geek_start_checklist_v1', null].includes(event.key)) { read(); render(); } });
read(); render();
