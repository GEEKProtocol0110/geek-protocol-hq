(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = '/api/ranked/?service=challenges';
  const previous = new URLSearchParams(location.search).get('previous') === '1';
  const requestedKind = new URLSearchParams(location.search).get('kind');
  let catalog, attempts = [], state = null, busy = false, retry = null, paused = false;
  let receivedAt = performance.now();
  const activeKey = 'geek-challenge-active-v1';
  const remember = value => { try { value ? sessionStorage.setItem(activeKey, JSON.stringify(value)) : sessionStorage.removeItem(activeKey); } catch { /* Recovery also works from the private challenge cards. */ } };
  const recalled = () => { try { return JSON.parse(sessionStorage.getItem(activeKey) || 'null'); } catch { return null; } };
  const request = async (url, body) => {
    const res = await fetch(url, { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : {}, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) { const error = new Error(data.error || 'The challenge service could not respond. Please try again.'); error.code = data.code; error.status = res.status; throw error; }
    return data;
  };
  const clearError = () => { $('[data-error]').hidden = true; retry = null; };
  const showError = (error, again) => { paused = true; $('[data-error-text]').textContent = error.message; $('[data-error]').hidden = false; $('[data-retry]').hidden = !again; retry = again; };
  const lock = value => {
    busy = value;
    document.querySelectorAll('.challenges-main button, [data-player-name]').forEach(el => { el.disabled = value || el.dataset.locked === 'true'; });
    $('[data-attempt]').setAttribute('aria-busy', String(value));
  };
  const element = (tag, text, className) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; };
  const sourceLink = url => {
    try { const source = new URL(url); if (source.protocol !== 'https:') throw Error(); const a = element('a', 'Read the primary source ↗'); a.href = source.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
    catch { return element('span', 'Source unavailable'); }
  };
  const date = time => new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(time);
  const renderCards = () => {
    $('[data-periods]').replaceChildren(...catalog.periods.map(period => {
      const card = element('article', undefined, `period-card ${period.kind}`); card.dataset.cardKind = period.kind;
      card.append(element('span', `${period.kind.toUpperCase()} / KASPA`, 'ace-label'), element('h3', period.title), element('p', period.kind === 'weekly' ? 'A focused signal across the fundamentals.' : 'A longer circuit through what you have learned.', 'period-description'));
      const facts = element('div', undefined, 'period-facts'); facts.append(...[`${period.questionCount} concepts`, '15s per question', `${period.budgetMs / 60000} min overall`].map(text => element('span', text))); card.append(facts);
      const opened = element('time', `Opened: ${date(period.opensAt)}`, 'period-date'); opened.dateTime = new Date(period.opensAt).toISOString();
      const closes = element('time', `${previous ? 'Closed' : 'Closes'}: ${date(period.closesAt)}`, 'period-date'); closes.dateTime = new Date(period.closesAt).toISOString(); card.append(opened, closes);
      const own = attempts.find(a => a.periodId === period.id);
      const note = element('p', own ? `Your attempt: ${own.score} points · ${own.answered} / ${own.total} answered${own.status === 'closed' ? ' · not submitted' : own.status === 'complete' ? ' · submitted' : ' · active'}` : previous ? 'This period is closed.' : 'One attempt per player. Starting uses this period’s attempt.', 'period-own'); card.append(note);
      const button = element('button', own ? own.status === 'complete' || own.status === 'closed' ? 'View your result →' : 'Resume your attempt →' : previous ? 'Period closed' : `Start ${period.title} →`, 'study-button primary'); button.type = 'button'; button.dataset.periodAction = period.kind;
      if (!own && previous) { button.dataset.locked = 'true'; button.disabled = true; }
      button.disabled = busy || button.dataset.locked === 'true';
      button.addEventListener('click', () => own ? act({ action: 'resume', periodId: period.id, runId: own.id }) : start(period)); card.append(button);
      const board = element('section', undefined, 'challenge-board'); const title = element('h4', 'Period standings'); board.append(title, element('p', `${period.completed} completed submission${period.completed === 1 ? '' : 's'} · top ten shown · tied scores share rank`));
      const list = element('ol'); list.dataset.board = period.kind;
      period.entries.forEach(entry => { const row = element('li'); row.append(element('span', entry.rank, 'board-rank'), element('span', entry.name, 'board-name'), element('span', entry.score, 'board-score')); list.append(row); });
      if (!period.entries.length) board.append(element('p', 'No submitted results yet.')); else board.append(list);
      card.append(board); return card;
    }));
  };
  const show = () => {
    $('[data-hub]').hidden = true; $('[data-attempt]').hidden = false;
    const run = state.run;
    $('[data-attempt-title]').textContent = `${state.period.title} // KASPA`;
    $('[data-attempt-step]').textContent = `${run.answered} of ${run.total} answered · one attempt this period`;
    $('[data-score]').textContent = run.score;
    $('[data-question-progress]').max = run.total; $('[data-question-progress]').value = run.answered;
    $('[data-options]').replaceChildren();
    $('[data-question]').textContent = state.question?.prompt || state.result?.prompt || (run.status === 'closed' ? 'This period has closed.' : 'Your attempt is submitted.');
    $('[data-question-kicker]').textContent = state.question ? `QUESTION ${run.number} / ${run.total} · ${state.question.difficulty.toUpperCase()}` : 'ANSWER REVIEW';
    if (state.question) state.question.options.forEach((option, index) => {
      const button = element('button'); button.type = 'button'; button.append(element('span', index + 1), element('b', option));
      button.addEventListener('click', () => act({ action: 'answer', periodId: run.periodId, runId: run.id, questionToken: state.question.token, selectedIndex: index })); $('[data-options]').append(button);
    });
    $('[data-feedback]').hidden = !state.result;
    if (state.result) {
      $('[data-feedback-title]').textContent = state.result.timedOut ? 'The question clock ended.' : state.result.correct ? 'Correct. +100 points.' : 'Keep this idea for next time.';
      $('[data-answer]').textContent = `Correct answer: ${state.result.answer}`;
      $('[data-explanation]').textContent = state.result.explanation;
      $('[data-source]').replaceChildren(sourceLink(state.result.source));
    }
    $('[data-next]').hidden = run.status !== 'review';
    $('[data-feedback] .clock-note').hidden = Boolean(state.summary);
    $('[data-summary]').hidden = !state.summary;
    $('[data-finish-panel]').hidden = Boolean(state.summary);
    $('[data-back]').textContent = state.summary ? 'Return to challenge cards' : 'Return to cards · attempt stays active';
    if (state.summary) {
      const summary = state.summary;
      $('[data-summary-title]').textContent = summary.ranked ? `Signal submitted. Rank ${summary.rank}.` : 'Period closed. Attempt not submitted.';
      $('[data-summary-score]').textContent = `${summary.score} points · ${summary.correct} correct / ${summary.total} concepts · ${summary.answered} answered`;
      $('[data-summary-note]').textContent = summary.ranked ? `${summary.reason === 'time-limit' ? 'The overall timer ended. ' : summary.reason === 'finished-early' ? 'You finished early. ' : ''}Unanswered questions count as zero. Equal scores share rank. Challenge standings do not award XP, credits, or tokens.` : 'Your recorded answers remain available to review. This attempt did not enter the standings before the period closed.';
      $('[data-review]').replaceChildren(...summary.review.map(item => { const details = element('details'); details.append(element('summary', item.prompt), element('p', `${item.correct ? 'Correct' : item.timedOut ? 'Timed out' : 'Review'}: ${item.answer}. ${item.explanation}`), sourceLink(item.source)); return details; }));
    }
    $('[data-question]').focus({ preventScroll: true });
    tick();
  };
  const act = async body => {
    if (busy) return;
    clearError(); lock(true); paused = true;
    try {
      state = await request(api, body); receivedAt = performance.now(); paused = false; remember({ periodId: state.run.periodId, runId: state.run.id }); show();
      $('[data-attempt]').scrollIntoView({ block: 'start', behavior: 'auto' });
    } catch (error) {
      showError(error, error.code === 'CHALLENGE_STATE_CHANGED' ? () => act({ action: 'resume', periodId: body.periodId, runId: body.runId }) : error.code === 'CHALLENGE_PERIOD_CHANGED' || error.code === 'CHALLENGE_CLOSED' || error.status === 401 || error.status === 404 ? () => home() : () => act(body));
    } finally { lock(false); }
  };
  const start = async period => {
    if (busy) return;
    clearError(); lock(true);
    try { await request('/api/session/', { displayName: $('[data-player-name]').value }); }
    catch (error) { showError(error, () => start(period)); lock(false); return; }
    lock(false); await act({ action: 'start', kind: period.kind, periodId: period.id });
  };
  const home = async () => {
    if (busy) return;
    paused = true; clearError(); remember(null); state = null; $('[data-attempt]').hidden = true; $('[data-hub]').hidden = false; await boot(false);
  };
  const boot = async (resume = true) => {
    clearError(); lock(true);
    try {
      catalog = await request(api + (previous ? '&previous=1' : ''));
      renderCards();
      const session = await request('/api/session/', {});
      $('[data-player-name]').value = session.player.name;
      attempts = (await request(api, { action: 'status' })).attempts; renderCards();
      let saved = resume && recalled();
      if (['weekly', 'monthly'].includes(requestedKind) && saved && !saved.periodId?.startsWith(`${requestedKind}:`)) saved = null;
      lock(false);
      if (saved && typeof saved.periodId === 'string' && /^[a-f0-9]{40}$/.test(saved.runId)) await act({ action: 'resume', periodId: saved.periodId, runId: saved.runId });
      else if (['weekly', 'monthly'].includes(requestedKind)) {
        const button = $(`[data-card-kind="${requestedKind}"] [data-period-action]`);
        button?.scrollIntoView({ block: 'center', behavior: 'auto' }); button?.focus({ preventScroll: true });
      }
    } catch (error) { showError(error, () => boot(resume)); }
    finally { lock(false); }
  };
  const tick = () => {
    if (!state || $('[data-attempt]').hidden) return;
    if (state.summary) { $('[data-clock]').textContent = '—'; $('[data-overall]').textContent = '—'; return; }
    const now = state.serverNow + performance.now() - receivedAt;
    const remaining = Math.max(0, state.run.overallDeadline - now);
    const seconds = Math.ceil(remaining / 1000);
    $('[data-overall]').textContent = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    $('[data-clock]').textContent = state.question ? `${Math.max(0, Math.ceil((state.question.expiresAt - now) / 1000))}s` : '—';
    if (paused || busy || state.summary) return;
    if (state.question && now >= state.question.expiresAt) act({ action: 'answer', periodId: state.run.periodId, runId: state.run.id, questionToken: state.question.token, selectedIndex: -1 });
    else if (!state.question && remaining === 0) act({ action: 'finish', periodId: state.run.periodId, runId: state.run.id });
  };
  $('[data-next]').addEventListener('click', () => act({ action: 'next', periodId: state.run.periodId, runId: state.run.id, questionToken: state.result.questionToken }));
  $('[data-finish]').addEventListener('click', () => act({ action: 'finish', periodId: state.run.periodId, runId: state.run.id }));
  $('[data-back]').addEventListener('click', home); $('[data-result-home]').addEventListener('click', home); $('[data-error-home]').addEventListener('click', home); $('[data-retry]').addEventListener('click', () => retry?.());
  document.addEventListener('keydown', event => { if (!state?.question || paused || busy || event.repeat || event.ctrlKey || event.altKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(event.target.tagName) || !/^[1-4]$/.test(event.key)) return; event.preventDefault(); $('[data-options]').children[Number(event.key) - 1]?.click(); });
  (previous ? $('[data-previous-link]') : $('[data-current-link]')).setAttribute('aria-current', 'page');
  if (previous) { $('[data-period-kicker]').textContent = 'PREVIOUS PERIODS / UTC'; $('[data-period-title]').textContent = 'The previous signal.'; }
  setInterval(tick, 150); boot();
})();
