(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = '/api/ranked/?service=study';
  let catalog = null;
  let selectedTopic = null;
  let state = null;
  let busy = false;
  let retry = null;
  let learning = null;
  let lessonStep = 0;
  let walkthroughTracked = false;
  const trackedRuns = new Set();
  const trackPractice = stage => {
    const key = `${stage}:${state.run.id}`;
    if (trackedRuns.has(key)) return;
    trackedRuns.add(key);
    window.GeekAnalytics?.track(`Practice ${stage}`, { mode: 'study', topic: state.run.topic, level: state.run.level });
  };
  let selectedLevel = 'foundations';
  const activeKey = 'geek-study-active-v1';
  const reviewKey = 'geek-study-review-v1';
  const storageRead = (storage, key) => { try { return JSON.parse(window[storage].getItem(key) || 'null'); } catch { return null; } };
  const storageWrite = (storage, key, value) => { try { value === null ? window[storage].removeItem(key) : window[storage].setItem(key, JSON.stringify(value)); } catch { /* Practice also works without browser storage. */ } };
  const sourceLink = (source, label) => {
    const a = document.createElement('a');
    const unavailable = () => { const span = document.createElement('span'); span.textContent = 'Source unavailable'; return span; };
    try { const url = new URL(source); if (url.protocol !== 'https:') return unavailable(); a.href = url.href; } catch { return unavailable(); }
    a.textContent = label; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a;
  };
  const request = async (url, body) => {
    const response = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.ok) { const error = new Error(data.error || 'The learning service could not respond. Please try again.'); error.status = response.status; throw error; }
    return data;
  };
  const clearError = () => { $('[data-error]').hidden = true; retry = null; };
  const showError = (error, again) => { $('[data-error-text]').textContent = error.message; $('[data-error]').hidden = false; $('[data-retry]').hidden = !again; retry = again || null; };
  const lock = value => {
    busy = value;
    document.querySelectorAll('[data-start], [data-lesson-prev], [data-lesson-next], [data-options] button, [data-next], [data-practice-missed], [data-recommended], [data-exit], [data-topics] button, [data-retry], [data-level], [data-review-topic], [data-continue], [data-progress-retry]').forEach(b => { b.disabled = value; });
    if (selectedTopic) $('[data-lesson-prev]').disabled = value || lessonStep === 0;
    $('[data-practice]').setAttribute('aria-busy', String(value));
  };
  const renderLessonStep = (focus = false) => {
    const final = lessonStep === selectedTopic.steps.length;
    window.GeekGiga?.update('study-welcome', { phase: final ? 'ready' : 'lesson', topic: selectedTopic.id });
    const step = final ? { title: 'Put the ideas together', text: selectedTopic.example } : selectedTopic.steps[lessonStep];
    $('[data-lesson-step-number]').textContent = `IDEA ${lessonStep + 1} OF ${selectedTopic.steps.length + 1}`;
    $('[data-lesson-step-title]').textContent = step.title;
    $('[data-lesson-step-text]').textContent = step.text;
    $('[data-reflection]').hidden = !final;
    $('[data-reflection]').textContent = `Think it through: ${selectedTopic.reflection}`;
    $('[data-lesson-prev]').disabled = lessonStep === 0;
    $('[data-lesson-next]').disabled = busy;
    $('[data-lesson-next]').textContent = final ? 'Start practice →' : 'Next idea →';
    $('[data-lesson-next]').classList.toggle('primary', final);
    if (focus) $('[data-lesson-step-title]').focus({ preventScroll: true });
  };
  const renderLevel = () => {
    const level = catalog.levels.find(l => l.id === selectedLevel);
    const count = Math.min(5, selectedTopic.levels.find(l => l.id === selectedLevel).count);
    $('[data-level]').value = selectedLevel;
    $('[data-level-description]').textContent = level.description;
    $('[data-practice-size]').textContent = `${count} distinct concept${count === 1 ? '' : 's'}. No timer.`;
  };
  const renderConcepts = () => {
    if (!selectedTopic) return;
    const concepts = learning?.concepts.filter(c => c.topic === selectedTopic.id) || [];
    $('[data-concept-notes]').hidden = !concepts.length;
    $('[data-concept-list]').replaceChildren(...concepts.map(c => {
      const li = document.createElement('li'); const prompt = document.createElement('span'); const status = document.createElement('small');
      prompt.textContent = c.prompt;
      status.textContent = `${c.stage === 'review' ? 'Review next' : c.stage === 'confidence' ? 'Building confidence' : 'Practicing'} · ${c.attempts} attempt${c.attempts === 1 ? '' : 's'}`;
      li.append(prompt, status); return li;
    }));
    const review = learning?.topics.find(t => t.id === selectedTopic.id)?.review || 0;
    $('[data-review-topic]').hidden = !review;
    $('[data-review-topic]').textContent = `Review ${Math.min(5, review)} saved mistake${review === 1 ? '' : 's'} →`;
  };
  const renderLearning = () => {
    if (!learning) return;
    $('[data-learning-stats]').hidden = false;
    $('[data-explored]').textContent = `${learning.explored} / ${learning.total}`;
    $('[data-review-count]').textContent = learning.review;
    $('[data-confidence]').textContent = learning.confidence;
    $('[data-progress-note]').textContent = learning.explored
      ? 'Saved to your player session. Guest access follows this browser’s session. Practice records expire after 180 days without practice.'
      : 'No practice answers saved yet. Start with Where Kaspa began, read the lesson, then try Foundations. Your feedback appears after you answer a question.';
    $('[data-progress-retry]').hidden = true;
    $('[data-continue]').hidden = false;
    $('[data-continue]').textContent = learning.explored ? `${learning.next.review ? 'Review' : 'Continue'}: ${learning.next.name} →` : 'Start your first lesson →';
    $('[data-topics]').querySelectorAll('button').forEach(b => {
      const t = learning.topics.find(t => t.id === b.dataset.topic);
      b.querySelector('.topic-progress').textContent = `${t.explored} / ${t.total} explored${t.review ? ` · ${t.review} to review` : ''}`;
    });
    renderConcepts();
  };
  const loadProgress = async () => {
    try { await request('/api/session/', {}); learning = (await request(api, { action: 'progress' })).progress; renderLearning(); }
    catch { $('[data-progress-note]').textContent = 'Saved progress is unavailable right now. Reload it, or choose a lesson below.'; $('[data-progress-retry]').hidden = false; }
  };
  const choose = (id, scroll = false) => {
    const topic = catalog.topics.find(t => t.id === id);
    if (!topic) return;
    selectedTopic = topic;
    lessonStep = 0;
    walkthroughTracked = false;
    $('[data-lesson]').hidden = false;
    $('[data-lesson-title]').textContent = topic.name;
    $('[data-lesson-text]').textContent = topic.lesson;
    $('[data-objective]').textContent = `Your goal: ${topic.objective}`;
    $('[data-lesson-sources]').replaceChildren(...topic.sources.map((s, i) => sourceLink(s, `Primary source ${i + 1} ↗`)));
    $('[data-topics]').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === id)));
    renderLessonStep(); renderLevel(); renderConcepts();
    if (scroll) $('[data-lesson]').scrollIntoView({ behavior: 'auto', block: 'center' });
  };
  const render = (focus = false) => {
    if (state.progress) { learning = state.progress; renderLearning(); }
    document.querySelector('[data-giga-guide="study-welcome"]').hidden = true;
    $('[data-browse]').hidden = true; $('[data-practice]').hidden = false;
    $('[data-topic-name]').textContent = state.topic.name;
    const answered = state.run.status === 'question' ? state.run.number - 1 : state.run.number;
    const level = catalog.levels.find(l => l.id === state.run.level);
    $('[data-step]').textContent = `${answered} of ${state.run.total} answered · ${state.run.review ? 'Focused review' : level?.name || 'Mixed challenge'} · No timer`;
    $('[data-progress]').max = state.run.total; $('[data-progress]').value = answered;
    $('[data-feedback]').hidden = !state.result; $('[data-summary]').hidden = !state.summary;
    const question = state.question;
    $('[data-question]').textContent = question?.prompt || state.result.prompt;
    $('[data-question-kicker]').textContent = question ? `QUESTION ${state.run.number} · TAKE YOUR TIME` : 'ANSWER REVIEW';
    $('[data-options]').replaceChildren();
    if (question) question.options.forEach((option, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.answer = index;
      const number = document.createElement('span'); number.textContent = index + 1;
      const text = document.createElement('b'); text.textContent = option;
      button.append(number, text); button.addEventListener('click', () => act({ action: 'answer', runId: state.run.id, questionToken: question.token, selectedIndex: index })); $('[data-options]').append(button);
    });
    if (state.result) {
      const result = state.result;
      $('[data-feedback-title]').textContent = result.correct ? 'You connected the idea.' : 'A chance to understand.';
      $('[data-your-answer]').textContent = `Your answer: ${result.selectedAnswer}`;
      $('[data-right-answer]').textContent = `Correct answer: ${result.answer}`;
      $('[data-explanation]').textContent = result.explanation;
      $('[data-guidance]').textContent = result.message;
      const link = sourceLink(result.source, 'Check the primary source ↗'); $('[data-source]').replaceWith(link); link.setAttribute('data-source', '');
      $('[data-next]').hidden = Boolean(state.summary);
    }
    if (state.summary) {
      const summary = state.summary;
      $('[data-summary-score]').textContent = `${summary.correct} of ${summary.answered} correct in this practice session.`;
      const topicProgress = learning?.topics.find(t => t.id === state.run.topic);
      $('[data-session-progress]').textContent = topicProgress ? `${topicProgress.explored} of ${topicProgress.total} concepts explored in this topic; ${topicProgress.review} to review. A short practice result is a next step, not proof of mastery.` : '';
      $('[data-recommendation]').textContent = summary.recommendation.message;
      $('[data-practice-missed]').hidden = !summary.missed.length;
      $('[data-practice-missed]').textContent = `Practice ${summary.missed.length} missed concept${summary.missed.length === 1 ? '' : 's'} →`;
      $('[data-recommended]').textContent = summary.missed.length ? 'Study this topic again →' : `Explore ${summary.recommendation.name.toLowerCase()} →`;
      $('[data-missed]').replaceChildren(...summary.missed.map(item => {
        const details = document.createElement('details'); const title = document.createElement('summary'); title.textContent = item.prompt;
        const p = document.createElement('p'); p.textContent = `${item.answer}. ${item.explanation}`;
        details.append(title, p, sourceLink(item.source, 'Read the source ↗')); return details;
      }));
      storageWrite('localStorage', reviewKey, { topic: state.run.topic, missed: summary.missed.length });
    }
    window.GeekGiga?.update('study', { phase: state.summary ? 'summary' : state.result ? state.result.correct ? 'correct' : 'missed' : 'question', topic: state.run.topic, missed: state.summary?.missed.length || 0 });
    if (focus) $('[data-question]').focus({ preventScroll: true });
  };
  const act = async (body, scroll = false) => {
    if (busy) return;
    clearError(); lock(true);
    try {
      state = await request(api, body); storageWrite('sessionStorage', activeKey, state.run.id); render(true);
      if (body.action === 'start') trackPractice('started');
      if (body.action === 'answer' && state.summary) trackPractice('completed');
      if (scroll) $('[data-practice]').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) {
      if (error.status === 409) showError(error, () => act({ action: 'resume', runId: body.runId }));
      else if (error.status === 404 || error.status === 401) { storageWrite('sessionStorage', activeKey, null); showError(error, () => { browse(); }); }
      else showError(error, () => act(body, scroll));
    } finally { lock(false); }
  };
  const start = async (practiceRunId, review = false) => {
    if (busy || !selectedTopic) return;
    clearError(); lock(true);
    try { await request('/api/session/', {}); } catch (error) { showError(error, () => start(practiceRunId, review)); lock(false); return; }
    lock(false); await act({ action: 'start', topic: selectedTopic.id, level: selectedLevel, ...(practiceRunId ? { practiceRunId } : {}), ...(review ? { review: true } : {}) }, true);
  };
  const browse = id => { document.querySelector('[data-giga-guide="study-welcome"]').hidden = false; clearError(); state = null; storageWrite('sessionStorage', activeKey, null); $('[data-practice]').hidden = true; $('[data-browse]').hidden = false; choose(id || selectedTopic?.id || 'origins', true); };
  const boot = async () => {
    clearError();
    try {
      catalog = await request(api);
      const requestedLevel = new URLSearchParams(location.search).get('level');
      if (catalog.levels.some(l => l.id === requestedLevel)) selectedLevel = requestedLevel;
      $('[data-level]').replaceChildren(...catalog.levels.map(l => { const o = document.createElement('option'); o.value = l.id; o.textContent = l.name; return o; }));
      $('[data-topics]').replaceChildren(...catalog.topics.map((topic, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'study-topic'; b.dataset.topic = topic.id; b.setAttribute('aria-pressed', 'false');
        const span = document.createElement('span'); span.textContent = `0${i + 1} / LEARN`;
        const title = document.createElement('strong'); title.textContent = topic.name;
        const count = document.createElement('small'); count.textContent = `${topic.count} distinct concepts ↗`;
        const progress = document.createElement('small'); progress.className = 'topic-progress'; progress.textContent = 'Not practiced yet';
        b.append(span, title, count, progress); b.addEventListener('click', () => choose(topic.id, true)); return b;
      }));
      const saved = storageRead('localStorage', reviewKey); const previous = catalog.topics.find(t => t.id === saved?.topic);
      if (previous) { $('[data-saved]').hidden = false; $('[data-saved]').textContent = `Your last practice topic: ${previous.name}. Your saved learning progress is shown above.`; }
      const requested = new URLSearchParams(location.search).get('topic');
      const explicitTopic = catalog.topics.some(t => t.id === requested);
      choose(explicitTopic ? requested : previous?.id || 'origins', explicitTopic);
      const active = storageRead('sessionStorage', activeKey);
      const reviewRequested = new URLSearchParams(location.search).get('review') === '1';
      if (typeof active === 'string' && /^[a-f0-9]{40}$/.test(active) && !reviewRequested) {
        if (!explicitTopic) await act({ action: 'resume', runId: active });
        else {
          try {
            const resumed = await request(api, { action: 'resume', runId: active });
            if (resumed.run.topic === requested && (!catalog.levels.some(l => l.id === requestedLevel) || resumed.run.level === requestedLevel)) { state = resumed; render(); }
          } catch (error) {
            if (error.status === 401 || error.status === 404) storageWrite('sessionStorage', activeKey, null);
            else showError(error, boot);
          }
        }
      }
      await loadProgress();
      if (explicitTopic && reviewRequested && !$('[data-review-topic]').hidden) $('[data-review-topic]').focus({ preventScroll: true });
    } catch (error) { showError(error, boot); }
  };
  $('[data-start]').addEventListener('click', () => start());
  $('[data-level]').addEventListener('change', () => { selectedLevel = $('[data-level]').value; renderLevel(); });
  $('[data-lesson-prev]').addEventListener('click', () => { if (!busy && lessonStep > 0) { lessonStep--; renderLessonStep(true); } });
  $('[data-lesson-next]').addEventListener('click', () => {
    if (busy || !selectedTopic) return;
    if (lessonStep < selectedTopic.steps.length) {
      lessonStep++; renderLessonStep(true);
      if (lessonStep === selectedTopic.steps.length && !walkthroughTracked) {
        walkthroughTracked = true;
        window.GeekAnalytics?.track('Lesson walkthrough completed', { topic: selectedTopic.id });
      }
    }
    else start();
  });
  $('[data-review-topic]').addEventListener('click', () => start(undefined, true));
  $('[data-continue]').addEventListener('click', () => {
    if (!learning.explored) selectedLevel = 'foundations';
    choose(learning.next.topic, true);
    $('[data-lesson-step-title]').focus({ preventScroll: true });
  });
  $('[data-progress-retry]').addEventListener('click', loadProgress);
  $('[data-next]').addEventListener('click', () => act({ action: 'next', runId: state.run.id, questionToken: state.result.questionToken }));
  $('[data-exit]').addEventListener('click', () => browse());
  $('[data-retry]').addEventListener('click', () => retry?.());
  $('[data-practice-missed]').addEventListener('click', () => { choose(state.run.topic); start(state.run.id); });
  $('[data-recommended]').addEventListener('click', () => browse(state.summary.recommendation.topic));
  document.addEventListener('keydown', event => {
    if (busy || !state?.question || event.repeat || event.ctrlKey || event.altKey || event.metaKey || !/^[1-4]$/.test(event.key)) return;
    $('[data-options]').querySelector(`[data-answer="${Number(event.key) - 1}"]`)?.click();
  });
  boot();
})();
