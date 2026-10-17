const root = document.querySelector('[data-xp-challenges]');
const $ = selector => root.querySelector(selector);
const api = '/api/ranked/?service=discoveries';
let busy = false, ready = false, saved = null, pageSize = 12;
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
const control = (text, action, disabled = false) => {
  const button=element('button',text,'study-button');button.type='button';button.dataset.xpControl='';button.dataset.xpNeedsReady='true';button.dataset.xpLocked=String(disabled);
  button.addEventListener('click',action);return button;
};
const taskCard = task => {
  const card=element('article',undefined,`xp-card tier-${(task.tierName||'bronze').toLowerCase()}${task.claimed?' is-complete':''}`);
  card.append(element('small',`${task.tierName||'Bronze'} · ${task.seriesName||'Career'}`,'career-tier'),element('h3',task.name),element('p',task.detail),element('p',`${task.progress.toLocaleString()} / ${task.target.toLocaleString()} · ${task.xp} XP`));
  const bar=element('progress');bar.max=task.target;bar.value=task.progress;bar.setAttribute('aria-label',`${task.name} progress`);card.append(bar);
  if(task.sinceUpdate)card.append(element('small','Tracked from the mastery update. Earlier rounds are not reconstructed.'));
  if(!task.claimed)card.append(link(task.href,'Go to task →'));
  card.append(control(task.claimed?'✓ XP claimed':task.locked?'Claim earlier tier first':task.eligible?`Claim ${task.xp} XP`:'In progress',()=>submit({action:'claim',id:task.id}),task.claimed||!task.eligible));
  if(task.seriesId)card.append(control(task.tracked?'Untrack path':'Track path',()=>submit({action:'track',id:task.seriesId,tracked:!task.tracked})));
  return card;
};
const renderCatalog = () => {
  if(!saved)return;
  const view=$('[data-career-view]').value||'next',path=$('[data-career-path]').value||'all',tier=$('[data-career-tier]').value||'all',search=($('[data-career-search]').value||'').trim().toLowerCase();
  const first=new Set();
  const shown=saved.tasks.filter(t=>{
    let matches=true;
    if(view==='next'){matches=!t.claimed&&!first.has(t.seriesId);if(matches)first.add(t.seriesId);}
    else if(view==='ready')matches=t.eligible;
    else if(view==='earned')matches=t.complete;
    else if(view==='claimed')matches=t.claimed;
    return matches&&(path==='all'||t.seriesId===path)&&(tier==='all'||t.tierName===tier)&&(!search||`${t.name} ${t.detail} ${t.group}`.toLowerCase().includes(search));
  });
  $('[data-career-catalog]').replaceChildren(...shown.slice(0,pageSize).map(taskCard));
  $('[data-career-count]').textContent=shown.length?`${Math.min(pageSize,shown.length)} of ${shown.length} matching challenges`:'No challenges match this view. Try another filter.';
  $('[data-career-more]').hidden=shown.length<=pageSize;
  lock(busy);
};
const render = data => {
  saved=data;
  $('[data-hunt-progress]').textContent = `${data.found} / 5 words found · ${data.earnedXp} challenge XP earned`;
  $('[data-challenge-career]').textContent = `Career: ${data.progression.xp.toLocaleString()} XP · Level ${data.progression.level} · Prestige ${data.progression.prestige}`;
  const career=data.career;
  $('[data-claim-ready]').dataset.xpLocked=String(!career?.ready);
  $('[data-career-summary]').textContent=career?`${career.completed} / ${career.total} career achievements · ${career.ready} rewards ready · ${career.mastered} / ${career.masteries.length} mastery emblems`:'Your career challenges';
  $('[data-xp-tasks]').replaceChildren(...(career?.recommended||data.tasks).map(taskCard));
  if(career){
    $('[data-tracked-goals]').replaceChildren(...(career.tracked.length?career.tracked.map(taskCard):[element('p','No paths tracked yet. Choose Track path on a challenge you like.')]));
    $('[data-career-emblems]').replaceChildren(...career.masteries.map(m=>{const card=element('article',undefined,`career-emblem${m.unlocked?' earned':''}`);card.append(element('span',m.unlocked?'◆':'◇'),element('h3',m.name),element('p',`${m.tiersComplete} / 5 tiers · ${m.unlocked?'Emblem earned':m.trackName}`));return card;}));
  }
  const pathSelect=$('[data-career-path]'),selected=pathSelect.value||'all',paths=new Map(data.tasks.map(t=>[t.seriesId,t.seriesName]));
  pathSelect.replaceChildren(...[['all','All paths'],...[...paths].filter(([id])=>id)].map(([id,name])=>{const option=element('option',name);option.value=id;return option;}));pathSelect.value=selected;
  $('[data-word-clues]').replaceChildren(...data.words.map(word => {
    const card = element('li', undefined, word.claimed ? 'xp-card is-complete' : 'xp-card');
    card.append(element('h3', `${word.claimed ? '✓' : '✦'} ${word.name}`), element('p', word.claimed ? `${word.word} · ${word.xp} XP claimed` : `${word.xp} XP · word not found yet`));
    const hint = element('details'); hint.append(element('summary', 'Show clue'), element('p', word.hint), link(word.href, 'Explore this area →')); card.append(hint); return card;
  }));
  $('[data-hunt-bonus]').textContent = data.bonus.claimed ? '✓ All five signals recovered. 75 XP bonus claimed!' : 'Find all five for an extra 75 XP. The bonus is added automatically.';
  renderCatalog();
};
const message = text => { $('[data-xp-status]').textContent = text; $('[data-hunt-feedback]').textContent = text; };
const submit = async body => {
  if (busy || !ready) return;
  lock(true); message('Checking your saved challenges…');
  try {
    const data = await request(body); render(data);
    message(data.trackingUpdated ? 'Tracked paths updated. Your choices also appear in My HQ.' : data.alreadyClaimed ? 'Already claimed for this player. Your XP is safe; no duplicate reward was added.' : `${data.awards.map(a => a.name).join(' + ')} complete! +${data.awards.reduce((sum, a) => sum + a.xp, 0)} XP added to your career.`);
    if (body.action === 'word') $('[data-hunt-word]').value = '';
  } catch (error) { message(error.name === 'AbortError' ? 'The connection timed out. Load your progress to check whether the reward was saved, or retry the same word safely.' : error.message); }
  finally { lock(false); }
};
export const refreshRewards = async () => {
  if (busy) return;
  lock(true); message('Loading your challenge list…');
  try { const data = await request({ action: 'status' }); render(data); ready = true; message('Ready. Choose a next goal, track a path, or explore the hidden word hunt.'); }
  catch (error) { ready = false; message(error.name === 'AbortError' ? 'Challenges took too long to load. Try Load progress again.' : error.message); }
  finally { lock(false); }
};
$('[data-hunt-form]').addEventListener('submit', event => { event.preventDefault(); return submit({ action: 'word', word: $('[data-hunt-word]').value }); });
$('[data-xp-refresh]').addEventListener('click', refreshRewards);

for(const selector of ['[data-career-view]','[data-career-path]','[data-career-tier]'])$(selector).addEventListener('change',()=>{pageSize=12;renderCatalog();});
$('[data-career-search]').addEventListener('input',()=>{pageSize=12;renderCatalog();});
$('[data-career-more]').addEventListener('click',()=>{pageSize+=12;renderCatalog();});
$('[data-claim-ready]').addEventListener('click',()=>submit({action:'claim-ready',ids:saved.tasks.filter(t=>t.eligible).slice(0,8).map(t=>t.id)}));
