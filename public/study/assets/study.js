(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = '/api/ranked/?service=study';
  let catalog = null;
  let selectedTopic = null;
  let state = null;
  let busy = false;
  let retry = null;
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
  const lock = value => { busy = value; document.querySelectorAll('[data-start], [data-options] button, [data-next], [data-practice-missed], [data-recommended], [data-exit], [data-topics] button, [data-retry]').forEach(b => { b.disabled = value; }); $('[data-practice]').setAttribute('aria-busy', String(value)); };
  const choose = (id, scroll = false) => {
    const topic = catalog.topics.find(t => t.id === id);
    if (!topic) return;
    selectedTopic = topic;
    $('[data-lesson]').hidden = false;
    $('[data-lesson-title]').textContent = topic.name;
    $('[data-lesson-text]').textContent = topic.lesson;
    $('[data-lesson-sources]').replaceChildren(...topic.sources.map((s, i) => sourceLink(s, `Primary source ${i + 1} ↗`)));
    $('[data-topics]').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === id)));
    if (scroll) $('[data-lesson]').scrollIntoView({ behavior: 'auto', block: 'center' });
  };
  const render = (focus = false) => {
    $('[data-browse]').hidden = true; $('[data-practice]').hidden = false;
    $('[data-topic-name]').textContent = state.topic.name;
    const answered = state.run.status === 'question' ? state.run.number - 1 : state.run.number;
    $('[data-step]').textContent = `${answered} of ${state.run.total} answered · No timer`;
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
    if (focus) $('[data-question]').focus({ preventScroll: true });
  };
  const act = async (body, scroll = false) => {
    if (busy) return;
    clearError(); lock(true);
    try {
      state = await request(api, body); storageWrite('sessionStorage', activeKey, state.run.id); render(true);
      if (scroll) $('[data-practice]').scrollIntoView({ behavior: 'auto', block: 'start' });
    } catch (error) {
      if (error.status === 409) showError(error, () => act({ action: 'resume', runId: body.runId }));
      else if (error.status === 404 || error.status === 401) { storageWrite('sessionStorage', activeKey, null); showError(error, () => { browse(); }); }
      else showError(error, () => act(body, scroll));
    } finally { lock(false); }
  };
  const start = async practiceRunId => {
    if (busy || !selectedTopic) return;
    clearError(); lock(true);
    try { await request('/api/session/', {}); } catch (error) { showError(error, () => start(practiceRunId)); lock(false); return; }
    lock(false); await act({ action: 'start', topic: selectedTopic.id, ...(practiceRunId ? { practiceRunId } : {}) }, true);
  };
  const browse = id => { clearError(); state = null; storageWrite('sessionStorage', activeKey, null); $('[data-practice]').hidden = true; $('[data-browse]').hidden = false; choose(id || selectedTopic?.id || 'origins', true); };
  const boot = async () => {
    clearError();
    try {
      catalog = await request(api);
      $('[data-topics]').replaceChildren(...catalog.topics.map((topic, i) => {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'study-topic'; b.dataset.topic = topic.id; b.setAttribute('aria-pressed', 'false');
        const span = document.createElement('span'); span.textContent = `0${i + 1} / LEARN`;
        const title = document.createElement('strong'); title.textContent = topic.name;
        const count = document.createElement('small'); count.textContent = `${topic.count} distinct concepts ↗`;
        b.append(span, title, count); b.addEventListener('click', () => choose(topic.id, true)); return b;
      }));
      const saved = storageRead('localStorage', reviewKey); const previous = catalog.topics.find(t => t.id === saved?.topic);
      if (previous) { $('[data-saved]').hidden = false; $('[data-saved]').textContent = `Your last practice topic: ${previous.name}. Practice notes stay in this browser.`; }
      const requested = new URLSearchParams(location.search).get('topic');
      choose(catalog.topics.some(t => t.id === requested) ? requested : previous?.id || 'origins');
      const active = storageRead('sessionStorage', activeKey);
      if (typeof active === 'string' && /^[a-f0-9]{40}$/.test(active)) await act({ action: 'resume', runId: active });
    } catch (error) { showError(error, boot); }
  };
  $('[data-start]').addEventListener('click', () => start());
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
