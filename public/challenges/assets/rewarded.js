const root = document.querySelector('[data-xp-challenges]');
const $ = selector => root.querySelector(selector);
const api = '/api/ranked/?service=discoveries';
let busy = false, ready = false;
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
const link = (href, text) => { const a = element('a', text); a.href = href; return a; };
const lock = value => {
  busy = value; root.setAttribute('aria-busy', String(value));
  root.querySelectorAll('[data-xp-control]').forEach(node => { node.disabled = value || (node.dataset.xpNeedsReady === 'true' && !ready) || node.dataset.xpLocked === 'true'; });
};
const request = async body => {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(api, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: controller.signal });
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.error || 'Challenges are unavailable. Try loading your progress again.');
    return data;
  } finally { clearTimeout(timer); }
};
const render = data => {
  $('[data-hunt-progress]').textContent = `${data.found} / 5 words found · ${data.earnedXp} challenge XP earned`;
  $('[data-challenge-career]').textContent = `Career: ${data.progression.xp} XP · Level ${data.progression.level} · Prestige ${data.progression.prestige}`;
  $('[data-word-clues]').replaceChildren(...data.words.map(word => {
    const card = element('li', undefined, word.claimed ? 'xp-card is-complete' : 'xp-card');
    card.append(element('h3', `${word.claimed ? '✓' : '✦'} ${word.name}`), element('p', word.claimed ? `${word.word} · ${word.xp} XP claimed` : `${word.xp} XP · word not found yet`));
    const hint = element('details'); hint.append(element('summary', 'Show clue'), element('p', word.hint), link(word.href, 'Explore this area →')); card.append(hint); return card;
  }));
  $('[data-hunt-bonus]').textContent = data.bonus.claimed ? '✓ All five signals recovered. 75 XP bonus claimed!' : 'Find all five for an extra 75 XP. The bonus is added automatically.';
  $('[data-xp-tasks]').replaceChildren(...data.tasks.map(task => {
    const card = element('article', undefined, 'xp-card');
    card.append(element('h3', task.name), element('p', task.detail), element('p', `${task.progress} / ${task.target} · ${task.xp} XP`));
    if (!task.claimed) card.append(link(task.href, 'Go to task →'));
    const claim = element('button', task.claimed ? '✓ XP claimed' : task.eligible ? `Claim ${task.xp} XP` : 'In progress', 'study-button');
    claim.type = 'button'; claim.dataset.xpControl = ''; claim.dataset.xpLocked = String(task.claimed || !task.eligible);
    claim.addEventListener('click', () => submit({ action: 'claim', id: task.id })); card.append(claim); return card;
  }));
};
const message = text => { $('[data-xp-status]').textContent = text; };
const submit = async body => {
  if (busy || !ready) return;
  lock(true); message('Checking your saved challenges…');
  try {
    const data = await request(body); render(data);
    message(data.alreadyClaimed ? 'Already claimed for this player. Your XP is safe; no duplicate reward was added.' : `${data.awards.map(a => a.name).join(' + ')} complete! +${data.awards.reduce((sum, a) => sum + a.xp, 0)} XP added to your career.`);
    if (body.action === 'word') $('[data-hunt-word]').value = '';
  } catch (error) { message(error.name === 'AbortError' ? 'The connection timed out. Load your progress to check whether the reward was saved, or retry the same word safely.' : error.message); }
  finally { lock(false); }
};
export const refreshRewards = async () => {
  if (busy) return;
  lock(true); message('Loading your challenge list…');
  try { const data = await request({ action: 'status' }); render(data); ready = true; message('Ready to explore. Enter a recovered word below.'); }
  catch (error) { ready = false; message(error.name === 'AbortError' ? 'Challenges took too long to load. Try Load progress again.' : error.message); }
  finally { lock(false); }
};
$('[data-hunt-form]').addEventListener('submit', event => { event.preventDefault(); return submit({ action: 'word', word: $('[data-hunt-word]').value }); });
$('[data-xp-refresh]').addEventListener('click', refreshRewards);
