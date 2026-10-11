const key = 'geek_start_checklist_v1';
const boxes = [...document.querySelectorAll('[data-step-check]')];
let completed = [];
try { const value = JSON.parse(localStorage.getItem(key)); if (Array.isArray(value)) completed = value.filter(id => ['learn', 'play', 'geek'].includes(id)); } catch {}
function render() {
  for (const box of boxes) box.checked = completed.includes(box.dataset.stepCheck);
  const count = boxes.filter(box => box.checked).length;
  document.querySelector('[data-start-progress]').value = count;
  document.querySelector('[data-start-status]').textContent = count === 3 ? 'Your first visit is complete. Come back to any step whenever you like.' : `${count} of 3 steps checked. Next: ${['learn one idea', 'try a little practice', 'make a Geek of your own'][boxes.findIndex(box => !box.checked)]}.`;
  for (const card of document.querySelectorAll('[data-start-card]')) card.classList.toggle('step-complete', completed.includes(card.dataset.startCard));
}
function save() {
  try { localStorage.setItem(key, JSON.stringify(completed)); }
  catch { document.querySelector('[data-storage-note]').textContent = 'Your checklist works for this visit. This browser could not save it.'; }
  render();
}
for (const box of boxes) box.addEventListener('change', () => { completed = boxes.filter(item => item.checked).map(item => item.dataset.stepCheck); save(); });
document.querySelector('[data-start-reset]').addEventListener('click', () => { completed = []; save(); });
render();
