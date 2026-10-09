import { firstSignal, getChapter, checksFor } from './chapter.js';
import { campaignCards, campaignSummary } from './campaign.js';
import { defaultGeek, geekSvg, geekDescription } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
const requestedChapter = new URLSearchParams(location.search).get('chapter');
const validChapter = requestedChapter === null || Boolean(getChapter(requestedChapter));
const chapter = getChapter(requestedChapter ?? firstSignal.id) || firstSignal, questChecks = checksFor(chapter);
const apiPath = `/api/quest?chapter=${encodeURIComponent(chapter.id)}`;
let campaign = null;
const drawCampaign = () => {
  let summaries = campaign;
  if (quest && connected) {
    const selected = { chapterId: chapter.id, available: true, revision: quest.revision, status: quest.attempt?.status || 'unstarted', answered: quest.attempt?.answered || 0, total: questChecks.length, badge: quest.badge, locked: false, prerequisite: null };
    summaries = [...(campaign || []).filter(c => c.chapterId !== chapter.id), selected];
  }
  if (recordUnavailable) summaries = [...(summaries || []).filter(c => c.chapterId !== chapter.id), { chapterId: chapter.id, available: false }];
  $('[data-campaign]').innerHTML = campaignCards(summaries, validChapter ? chapter.id : null);
  if (summaries) $('[data-campaign-summary]').textContent = campaignSummary(summaries);
};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let prerequisite = getChapter(chapter.prerequisite);
let quest = null, connected = false, busy = false, selection = null, locked = false, accessPending = Boolean(chapter.prerequisite), recordUnavailable = false;
const say = message => { $('[data-status]').textContent = message; };
const api = async (path, body) => {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'Chapter service unavailable.'), { status: response.status, code: data.code, prerequisite: data.prerequisite });
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('The chapter service took too long to respond.');
    throw error;
  } finally { clearTimeout(timeout); }
};
const sourceHtml = source => `<a href="${escape(source.url)}"${source.url.startsWith('https:') ? ' target="_blank" rel="noreferrer"' : ''}>${escape(source.label)} ↗</a>`;
const noteHtml = item => `<details><summary>${escape(item.prompt)}</summary><p><b>Your answer:</b> ${escape(item.selectedAnswer)}</p><p><b>Remember:</b> ${escape(item.answer)}</p><p>${escape(item.explanation)}</p>${sourceHtml(item.source)}</details>`;
const date = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

const diagram = kind => {
  const parallel = kind === 'parallel';
  const links = parallel ? '<path d="M 110 120 L 170 58" marker-end="url(#parent-arrow)"/><path d="M 270 120 L 210 58" marker-end="url(#parent-arrow)"/><path d="M 180 208 L 116 160" marker-end="url(#parent-arrow)"/><path d="M 200 208 L 264 160" marker-end="url(#parent-arrow)"/>' : '<path d="M 172 188 L 118 110" marker-end="url(#parent-arrow)"/><path d="M 208 188 L 262 110" marker-end="url(#parent-arrow)"/>';
  const node = (name, x, y) => `<g><rect x="${x - 42}" y="${y - 20}" width="84" height="40" rx="9"/><text x="${x}" y="${y + 6}" text-anchor="middle">${name}</text></g>`;
  const description = parallel ? 'A and B both point to Genesis. C points to A and B. There is no parent path between A and B.' : 'C has two arrows pointing to its parents A and B.';
  return `<svg viewBox="0 0 380 265" role="img" aria-label="${description}"><defs><marker id="parent-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M 0 0 L 8 4 L 0 8 Z"/></marker></defs>${links}${parallel ? node('Genesis',190,35) + node('A',95,140) + node('B',285,140) + node('C',190,230) : node('A',95,90) + node('B',285,90) + node('C',190,208)}</svg><figcaption>${description} Arrows point from child to parent. This is a teaching example, not live network data.</figcaption>`;
};
const refreshCampaign = async () => {
  const button = $('[data-campaign-retry]'); button.disabled = true;
  try {
    campaign = (await api('/api/quest?campaign=1')).campaign.chapters;
    button.hidden = campaign.every(c => c.available);
  } catch { campaign = []; button.hidden = false; }
  finally { drawCampaign(); button.disabled = false; }
};
$('[data-campaign-retry]').addEventListener('click', refreshCampaign);

$('[data-giga-art]').innerHTML = geekSvg(defaultGeek);
const renderGeek = collection => document.querySelectorAll('[data-player-art]').forEach(root => {
  if (!collection || collection.avatar.id === 'giga-builder') {
    root.innerHTML = geekSvg(collection?.customization || defaultGeek);
    if (!root.hasAttribute('aria-hidden')) { root.setAttribute('role', 'img'); root.setAttribute('aria-label', collection ? geekDescription(collection.customization) : 'Starter GIGA preview while your selected Geek loads'); }
  } else {
    root.innerHTML = `<img src="${escape(collection.avatar.asset)}" alt="${root.hasAttribute('aria-hidden') ? '' : escape(collection.avatar.name)}" />`;
    root.removeAttribute('role'); root.removeAttribute('aria-label');
  }
});
renderGeek();
const number = String(chapter.number).padStart(2, '0');
document.title = `Quiz Quest: ${chapter.title} — Geek Protocol`;
$('[data-chapter-kicker]').textContent = `QUIZ QUEST · CHAPTER ${number} · FREE SOLO`;
$('[data-chapter-title]').innerHTML = `${escape(chapter.heading[0])}<br /><em>${escape(chapter.heading[1])}</em>`;
$('[data-chapter-subtitle]').textContent = chapter.subtitle;
$('[data-begin]').textContent = `Begin ${chapter.title} →`;
$('[data-badge-number]').textContent = number;
$('[data-badge-title]').textContent = chapter.title.toUpperCase();
$('[data-badge-name]').textContent = chapter.badge.name;
$('[data-mission-title]').textContent = chapter.number === 1 ? 'Follow the first signal.' : chapter.number === 2 ? 'Find the links. Understand the order.' : 'Make a deliberate decision.';
$('[data-next]').href = chapter.next.href;
$('[data-next]').textContent = `${chapter.next.name} →`;

$('[data-mission]').textContent = chapter.objective;
$('[data-reference]').innerHTML = chapter.scenes.map(scene => `<section><h3>${escape(scene.name)}</h3><p>${escape(scene.objective)}</p><ol>${scene.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ol><p>${escape(scene.example)}</p><div class="sources">${sourceHtml(scene.source)}${scene.additionalSource ? sourceHtml(scene.additionalSource) : ''}</div></section>`).join('');

const controls = () => {
  const a = quest?.attempt, gated = locked || accessPending, recovering = recordUnavailable && !quest, enabled = connected && !busy && !gated;
  $('[data-chapter-layout]').hidden = gated || recovering;
  $('[data-story-map]').hidden = gated || recovering;
  $('[data-chapter-reference]').hidden = gated;
  $('[data-chapter-lock]').hidden = !gated && !recovering;
  $('[data-lock-title]').textContent = recordUnavailable ? 'Your saved chapter needs a check.' : locked ? `Chapter ${chapter.number} is locked.` : 'Checking your chapter unlock…';
  $('[data-lock-copy]').textContent = recordUnavailable ? 'Retry loading to check your saved place. Your record has been kept. Reading the chapter notes does not change progress.' : locked ? `Complete ${prerequisite?.title || 'the previous chapter'} and choose Finish chapter & save badge to unlock ${chapter.title}.` : 'Checking saved completion of the earlier chapters.';
  $('[data-lock-link]').hidden = recordUnavailable || !prerequisite;
  if (prerequisite) { $('[data-lock-link]').href = `/quest/?chapter=${encodeURIComponent(prerequisite.id)}`; $('[data-lock-link]').textContent = `Continue ${prerequisite.title} →`; }
  $('[data-resume]').textContent = recordUnavailable ? 'Retry loading saved chapter' : locked || accessPending ? 'Check chapter unlock' : 'Resume saved chapter';
  $('[data-begin]').hidden = Boolean(a) || !connected; $('[data-begin]').disabled = !enabled;
  $('[data-continue]').hidden = !a || !['lesson', 'feedback'].includes(a.status);
  $('[data-continue]').disabled = !enabled;
  $('[data-continue]').textContent = a?.status === 'lesson' ? 'Try the first check →' : a?.index === questChecks.length - 1 ? quest.badge ? 'Finish this chapter visit →' : 'Finish chapter & save badge →' : a?.index % 2 === 1 ? 'Explore the next stop →' : 'Try the next check →';
  $('[data-replay]').hidden = a?.status !== 'complete'; $('[data-replay]').disabled = !enabled;
  $('[data-next]').hidden = a?.status !== 'complete';
  $('[data-resume]').hidden = connected; $('[data-resume]').disabled = busy;
  document.querySelectorAll('[data-answer]').forEach(button => { button.disabled = !enabled || a?.status !== 'question'; button.classList.toggle('chosen', selection === Number(button.dataset.answer)); });
  $('[data-story]').setAttribute('aria-busy', String(busy));
};
const map = () => {
  const a = quest?.attempt;
  $('[data-map]').innerHTML = chapter.scenes.map((scene, index) => {
    const done = a?.status === 'complete' || (a && index < a.sceneIndex), active = a && index === a.sceneIndex && a.status !== 'complete';
    return `<li class="map-stop ${done ? 'done' : active ? 'current' : ''}"${active ? ' aria-current="step"' : ''}><span aria-hidden="true">${done ? '✓' : index + 1}</span><b>${escape(scene.name)}</b><small>${done ? 'VISITED' : active ? 'CURRENT STOP' : !a && index === 0 ? 'START HERE' : 'NEXT STOP'}</small></li>`;
  }).join('');
};
const render = (q, focus = false) => {
  if (q.chapter.id !== chapter.id || q.chapter.version !== chapter.version) throw new Error('Chapter content changed. Refresh the page to load the current edition.');
  if (quest && q.revision < quest.revision) throw new Error('Your player session changed. Reload to reconnect to the current profile.');
  const previous = quest?.attempt;
  const changed = !previous || previous.token !== q.attempt?.token || previous.status !== q.attempt?.status;
  quest = q; connected = true; locked = false; accessPending = false; recordUnavailable = false;
  const a = q.attempt, scene = chapter.scenes[a?.sceneIndex || 0], complete = a?.status === 'complete';
  if (changed) selection = null;
  $('[data-location]').textContent = complete ? `CHAPTER ${number} / ALL STOPS VISITED` : a ? scene.location : 'YOUR FIRST ADVENTURE';
  $('[data-title]').textContent = complete ? chapter.completedTitle : a ? scene.name : chapter.entrance.title;
  $('[data-narrative]').textContent = complete ? chapter.finish : a ? scene.story : chapter.entrance.story;
  $('[data-giga]').textContent = complete ? 'Every stop is connected. Take a look at your notes, then keep exploring. Your original badge stays with you if you replay.' : q.feedback ? q.feedback.correct ? 'You connected that idea. Read A.C.E.’s notes to see why it fits.' : 'A useful discovery starts with a question. Compare your choice with A.C.E.’s explanation; you can revisit it in your saved notes.' : a ? scene.giga : 'Take your time. There is no countdown. Your chapter will save after each accepted action.';
  $('[data-lesson]').hidden = a?.status !== 'lesson';
  $('[data-objective]').textContent = scene.objective;
  $('[data-notes]').innerHTML = scene.notes.map(note => `<li>${escape(note)}</li>`).join('');
  $('[data-example]').textContent = scene.example;
  $('[data-diagram]').hidden = !scene.diagram;
  $('[data-diagram]').innerHTML = scene.diagram ? diagram(scene.diagram) : '';
  $('[data-sources]').innerHTML = sourceHtml(scene.source) + (scene.additionalSource ? sourceHtml(scene.additionalSource) : '');
  $('[data-checkpoint]').hidden = a?.status !== 'question';
  if (changed) {
    $('[data-answers]').replaceChildren();
    q.question?.options.forEach((option, index) => { const button = document.createElement('button'); button.type = 'button'; button.dataset.answer = index; button.textContent = `${index + 1}. ${option}`; $('[data-answers]').append(button); });
  }
  $('[data-check-number]').textContent = a ? `A.C.E. // CHECK ${a.index + 1} OF ${questChecks.length} · ${a.index % 2 + 1} OF 2 AT THIS STOP` : 'LEARNING CHECK';
  $('[data-question]').textContent = q.question?.prompt || '';
  $('[data-feedback]').hidden = a?.status !== 'feedback';
  if (q.feedback) {
    $('[data-feedback-title]').textContent = q.feedback.correct ? 'That idea connects.' : 'Let’s connect the idea.';
    $('[data-selected]').textContent = q.feedback.selectedAnswer;
    $('[data-correct-answer]').textContent = q.feedback.answer;
    $('[data-explanation]').textContent = q.feedback.explanation;
    $('[data-feedback-source]').innerHTML = sourceHtml(q.feedback.source);
  }
  $('[data-finish]').hidden = !complete;
  $('[data-finish-copy]').textContent = q.badge ? `Your ${chapter.badge.name} badge was saved on ${date(q.badge.awardedAt)}.` : '';
  $('[data-finish-stats]').textContent = a ? `${a.answered} / ${questChecks.length} checks attempted · ${a.correct} correct on this visit${q.review.length ? ` · ${q.review.length} notes to revisit` : ''}.` : '';
  $('[data-progress]').value = a?.answered || 0;
  $('[data-progress-count]').textContent = `${a?.answered || 0} / ${questChecks.length}`;
  $('[data-badge-state]').textContent = q.badge ? `✦ ${chapter.badge.name} · SAVED` : '✦ Completion badge waiting';
  $('[data-review-note]').textContent = q.review.length ? 'Open a note to compare your answer with A.C.E.’s explanation.' : a?.answered ? 'No missed answers in your current saved notes. You can revisit the lessons at any time.' : 'Your missed-answer notes will appear here as you explore.';
  $('[data-review]').innerHTML = q.review.map(noteHtml).join('');
  const previousNotes = a && a.status !== 'complete' && a.answered > 0 && q.lastCompleted?.missed?.length ? q.lastCompleted.missed : [];
  $('[data-previous-review]').innerHTML = previousNotes.length ? '<h3 class="previous-heading">Last completed visit</h3>' + previousNotes.map(noteHtml).join('') : '';
  $('[data-save-note]').textContent = !a ? 'Reading does not start the chapter. Choose Begin when you are ready.' : complete ? 'Chapter completion and badge are saved. Replays never grant another copy of this badge.' : 'Your last accepted step is saved. You can close this page and return to continue.';
  say(!a ? `Ready when you are. Choose Begin ${chapter.title} to save your adventure.` : complete ? `${chapter.title} complete. Your chapter badge is saved in your profile.` : 'Connected. Your chapter progress is saved on the server.');
  map(); drawCampaign(); controls();
  if (focus && changed) { const heading = a?.status === 'question' ? $('[data-question]') : a?.status === 'feedback' ? $('[data-feedback-title]') : complete ? $('#finish-title') : $('[data-title]'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); heading.scrollIntoView({ block: 'start', behavior: 'instant' }); }
};
const failure = (error, saving = false) => {
  connected = false;
  if (error.code === 'QUEST_LOCKED') {
    prerequisite = getChapter(error.prerequisite?.id) || prerequisite;
    locked = true; accessPending = false; recordUnavailable = false; quest = null; selection = null;
    campaign = [...(campaign || []).filter(c => c.chapterId !== chapter.id), { chapterId: chapter.id, available: true, locked: true, prerequisite: error.prerequisite }];
    say(error.message);
  } else {
    recordUnavailable = true;
    say(`${error.message} ${saving ? 'Your last action may have saved. ' : ''}Retry loading to see the server’s saved step.`);
    $('[data-save-note]').textContent = 'Saved progress is unverified. Retry loading before taking another chapter step.';
  }
  drawCampaign(); controls();
};
const load = async () => {
  if (busy) return;
  busy = true; controls();
  try { await Promise.all([api(apiPath).then(data => render(data.quest, true)), refreshCampaign()]); }
  catch (error) { failure(error); }
  finally { busy = false; controls(); }
};
const act = async (action, extra = {}) => {
  if (busy || !connected || !quest) return;
  const body = { action, chapterId: chapter.id, revision: quest.revision, ...(action !== 'begin' ? { attemptId: quest.attempt.id, stepToken: quest.attempt.token } : {}), ...extra };
  busy = true; controls(); say('Saving your chapter step…');
  try {
    const result = await api(apiPath, body); render(result.quest, true);
    if (result.quest.attempt?.status === 'complete') await refreshCampaign();
  }
  catch (error) {
    if (error.status === 409) { try { render((await api(apiPath)).quest, true); say('Resumed the saved step from your other request.'); } catch (next) { failure(next, true); } }
    else failure(error, true);
  } finally { busy = false; controls(); }
};
$('[data-begin]').addEventListener('click', () => act('begin'));
$('[data-continue]').addEventListener('click', () => act('continue'));
$('[data-answers]').addEventListener('click', event => { const button = event.target.closest('[data-answer]'); if (!button || button.disabled) return; selection = Number(button.dataset.answer); act('answer', { selectedIndex: selection }); });
$('[data-resume]').addEventListener('click', async () => { if (!quest) return initialize(); await load(); });
$('[data-replay]').addEventListener('click', () => $('[data-replay-dialog]').showModal());
$('[data-replay-dialog]').addEventListener('close', () => { if ($('[data-replay-dialog]').returnValue === 'replay') act('replay'); });
const initialize = async () => {
  if (busy) return; busy = true; controls();
  try {
    const session = await api('/api/session', {}); $('[data-player-name]').textContent = session.player.name;
    const results = await Promise.allSettled([validChapter ? api(apiPath) : Promise.reject(new Error('That chapter is not in this campaign. Choose a chapter from the map.')), api('/api/collectibles'), refreshCampaign()]);
    if (results[1].status === 'fulfilled') renderGeek(results[1].value.collection);
    if (results[0].status !== 'fulfilled') throw results[0].reason;
    render(results[0].value.quest);
  } catch (error) { failure(error); }
  finally { busy = false; controls(); }
};
map(); drawCampaign(); initialize();
