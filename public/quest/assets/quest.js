import { firstSignal, questChecks } from './chapter.js';
import { defaultGeek, geekSvg, geekDescription } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let quest = null, connected = false, busy = false, selection = null;
const say = message => { $('[data-status]').textContent = message; };
const api = async (path, body) => {
  const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'Chapter service unavailable.'), { status: response.status });
    return data;
  } finally { clearTimeout(timeout); }
};
const sourceHtml = source => `<a href="${escape(source.url)}"${source.url.startsWith('https:') ? ' target="_blank" rel="noreferrer"' : ''}>${escape(source.label)} ↗</a>`;
const noteHtml = item => `<details><summary>${escape(item.prompt)}</summary><p><b>Your answer:</b> ${escape(item.selectedAnswer)}</p><p><b>Remember:</b> ${escape(item.answer)}</p><p>${escape(item.explanation)}</p>${sourceHtml(item.source)}</details>`;
const date = value => new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value));

$('[data-giga-art]').innerHTML = geekSvg(defaultGeek);
$('[data-player-art]').innerHTML = geekSvg(defaultGeek);
$('[data-player-art]').setAttribute('role', 'img');
$('[data-player-art]').setAttribute('aria-label', 'Starter GIGA preview while your selected Geek loads');
$('[data-mission]').textContent = firstSignal.objective;
$('[data-reference]').innerHTML = firstSignal.scenes.map(scene => `<section><h3>${escape(scene.name)}</h3><p>${escape(scene.objective)}</p><ol>${scene.notes.map(note => `<li>${escape(note)}</li>`).join('')}</ol><p>${escape(scene.example)}</p><div class="sources">${sourceHtml(scene.source)}${scene.additionalSource ? sourceHtml(scene.additionalSource) : ''}</div></section>`).join('');

const controls = () => {
  const a = quest?.attempt, enabled = connected && !busy;
  $('[data-begin]').hidden = Boolean(a); $('[data-begin]').disabled = !enabled;
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
  $('[data-map]').innerHTML = firstSignal.scenes.map((scene, index) => {
    const done = a?.status === 'complete' || (a && index < a.sceneIndex), active = a && index === a.sceneIndex && a.status !== 'complete';
    return `<li class="map-stop ${done ? 'done' : active ? 'current' : ''}"${active ? ' aria-current="step"' : ''}><span aria-hidden="true">${done ? '✓' : index + 1}</span><b>${escape(scene.name)}</b><small>${done ? 'VISITED' : active ? 'CURRENT STOP' : !a && index === 0 ? 'START HERE' : 'NEXT STOP'}</small></li>`;
  }).join('');
};
const render = (q, focus = false) => {
  if (q.chapter.id !== firstSignal.id || q.chapter.version !== firstSignal.version) throw new Error('Chapter content changed. Refresh the page to load the current edition.');
  if (quest && q.revision < quest.revision) throw new Error('Your player session changed. Reload to reconnect to the current profile.');
  const previous = quest?.attempt;
  const changed = !previous || previous.token !== q.attempt?.token || previous.status !== q.attempt?.status;
  quest = q; connected = true;
  const a = q.attempt, scene = firstSignal.scenes[a?.sceneIndex || 0], complete = a?.status === 'complete';
  if (changed) selection = null;
  $('[data-location]').textContent = complete ? 'CHAPTER 01 / ALL STOPS VISITED' : a ? scene.location : 'YOUR FIRST ADVENTURE';
  $('[data-title]').textContent = complete ? 'Your first signal is connected.' : a ? scene.name : 'Step into the archive.';
  $('[data-narrative]').textContent = complete ? firstSignal.finish : a ? scene.story : 'GIGA is waiting at the entrance. Together, you will explore where Kaspa began, why parallel blocks need an order, and how KAS differs from GEEK.';
  $('[data-giga]').textContent = complete ? 'Every stop is connected. Take a look at your notes, then keep exploring. Your original badge stays with you if you replay.' : q.feedback ? q.feedback.correct ? 'You connected that idea. Read A.C.E.’s notes to see why it fits.' : 'A useful discovery starts with a question. Compare your choice with A.C.E.’s explanation; you can revisit it in your saved notes.' : a ? scene.giga : 'Take your time. There is no countdown. Your chapter will save after each accepted action.';
  $('[data-lesson]').hidden = a?.status !== 'lesson';
  $('[data-objective]').textContent = scene.objective;
  $('[data-notes]').innerHTML = scene.notes.map(note => `<li>${escape(note)}</li>`).join('');
  $('[data-example]').textContent = scene.example;
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
  $('[data-finish-copy]').textContent = q.badge ? `Your First Signal Explorer badge was saved on ${date(q.badge.awardedAt)}.` : '';
  $('[data-finish-stats]').textContent = a ? `${a.answered} / ${questChecks.length} checks attempted · ${a.correct} correct on this visit${q.review.length ? ` · ${q.review.length} notes to revisit` : ''}.` : '';
  $('[data-progress]').value = a?.answered || 0;
  $('[data-progress-count]').textContent = `${a?.answered || 0} / ${questChecks.length}`;
  $('[data-badge-state]').textContent = q.badge ? '✦ First Signal Explorer · SAVED' : '✦ Completion badge waiting';
  $('[data-review-note]').textContent = q.review.length ? 'Open a note to compare your answer with A.C.E.’s explanation.' : a?.answered ? 'No missed answers in your current saved notes. You can revisit the lessons at any time.' : 'Your missed-answer notes will appear here as you explore.';
  $('[data-review]').innerHTML = q.review.map(noteHtml).join('');
  const previousNotes = a && a.status !== 'complete' && a.answered > 0 && q.lastCompleted?.missed?.length ? q.lastCompleted.missed : [];
  $('[data-previous-review]').innerHTML = previousNotes.length ? '<h3 class="previous-heading">Last completed visit</h3>' + previousNotes.map(noteHtml).join('') : '';
  $('[data-save-note]').textContent = !a ? 'Reading does not start the chapter. Choose Begin when you are ready.' : complete ? 'Chapter completion and badge are saved. Replays never grant another copy of this badge.' : 'Your last accepted step is saved. You can close this page and return to continue.';
  say(!a ? 'Ready when you are. Choose Begin First Signal to save your adventure.' : complete ? 'First Signal complete. Your chapter badge is saved in your profile.' : 'Connected. Your chapter progress is saved on the server.');
  map(); controls();
  if (focus && changed) { const heading = a?.status === 'question' ? $('[data-question]') : a?.status === 'feedback' ? $('[data-feedback-title]') : complete ? $('#finish-title') : $('[data-title]'); heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
};
const failure = error => { connected = false; say(`${error.message} Saving could not be confirmed. Resume to see the server’s saved step.`); controls(); };
const load = async () => {
  if (busy) return;
  busy = true; controls();
  try { render((await api('/api/quest')).quest, true); }
  catch (error) { failure(error); }
  finally { busy = false; controls(); }
};
const act = async (action, extra = {}) => {
  if (busy || !connected || !quest) return;
  const body = { action, revision: quest.revision, ...(action !== 'begin' ? { attemptId: quest.attempt.id, stepToken: quest.attempt.token } : {}), ...extra };
  busy = true; controls(); say('Saving your chapter step…');
  try { render((await api('/api/quest', body)).quest, true); }
  catch (error) {
    if (error.status === 409) { try { render((await api('/api/quest')).quest, true); say('Resumed the saved step from your other request.'); } catch (next) { failure(next); } }
    else failure(error);
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
    const results = await Promise.allSettled([api('/api/quest'), api('/api/collectibles')]);
    if (results[0].status !== 'fulfilled') throw results[0].reason;
    render(results[0].value.quest);
    if (results[1].status === 'fulfilled') {
      const c = results[1].value.collection, root = $('[data-player-art]');
      if (c.avatar.id === 'giga-builder') { root.innerHTML = geekSvg(c.customization); root.setAttribute('aria-label', geekDescription(c.customization)); }
      else { root.innerHTML = `<img src="${escape(c.avatar.asset)}" alt="${escape(c.avatar.name)}" />`; root.removeAttribute('role'); root.removeAttribute('aria-label'); }
    }
  } catch (error) { failure(error); }
  finally { busy = false; controls(); }
};
map(); initialize();
