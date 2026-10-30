(() => {
  'use strict';

  const queryParams = new URLSearchParams(window.location.search);
  const requestedFocus = ['ghostdag', 'builders'].includes(queryParams.get('focus')) ? queryParams.get('focus') : '';
  const TIMER_SECONDS = 15;
  const TIMER_CIRCUMFERENCE = 125.66;
  const GAME_MODES = {
    gauntlet: { name: 'Geek Gauntlet', detail: '10 rounds · 10 questions each', start: 'Start round 1' },
    daily: { name: 'Daily Signal', detail: '5 questions · one scored attempt each day (UTC)', start: 'Start today’s questions' },
    speed: { name: 'Speed Signal', detail: 'Answer up to 10 questions in 30 seconds', start: 'Start 30-second challenge' }
  };
  const CATEGORY_BANKS = {
    kaspa: { name: 'Kaspa: Proof-of-Learning', shortName: 'Kaspa', count: window.GEEK_QUESTION_COUNTS['kaspa'], detail: 'distinct, source-checked questions', sourced: true },
    'video-games': { name: 'Video Games', shortName: 'Video Games', count: window.GEEK_QUESTION_COUNTS['video-games'], detail: 'games, consoles & lore' },
    'science-fiction': { name: 'Science Fiction', shortName: 'Science Fiction', count: window.GEEK_QUESTION_COUNTS['science-fiction'], detail: 'worlds, stories & futures' },
    technology: { name: 'Technology', shortName: 'Technology', count: window.GEEK_QUESTION_COUNTS['technology'], detail: 'computing, science & invention' },
    movies: { name: 'Movies', shortName: 'Movies', count: window.GEEK_QUESTION_COUNTS['movies'], detail: 'cinema, characters & creators' },
    history: { name: 'History', shortName: 'History', count: window.GEEK_QUESTION_COUNTS['history'], detail: 'people, places & turning points' },
    comics: { name: 'Comics', shortName: 'Comics', count: window.GEEK_QUESTION_COUNTS['comics'], detail: 'heroes, creators & panels' },
    'pop-culture': { name: 'Pop Culture', shortName: 'Pop Culture', count: window.GEEK_QUESTION_COUNTS['pop-culture'], detail: 'music, television & culture' }
  };
  const ROUND_CONFIG = [
    { round: 1, entry: 0, reward: 10, max: 100, label: 'INITIATION' },
    { round: 2, entry: 40, reward: 20, max: 200, label: 'BASIC PROTOCOLS' },
    { round: 3, entry: 100, reward: 40, max: 400, label: 'NETWORK LAYER' },
    { round: 4, entry: 200, reward: 80, max: 800, label: 'DATA STREAMS' },
    { round: 5, entry: 400, reward: 150, max: 1500, label: 'GRID ACCESS' },
    { round: 6, entry: 750, reward: 280, max: 2800, label: 'DEEP PROTOCOL' },
    { round: 7, entry: 1250, reward: 450, max: 4500, label: 'CIPHER DESCENT' },
    { round: 8, entry: 2000, reward: 700, max: 7000, label: 'CORE BREACH' },
    { round: 9, entry: 3500, reward: 1100, max: 11000, label: 'OMNISCIENT GATE' },
    { round: 10, entry: 6000, reward: 1800, max: 18000, label: 'APEX PROTOCOL' }
  ];

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const format = new Intl.NumberFormat('en-US');
  const pad = (value) => String(value).padStart(2, '0');
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

  let activeCategory = Object.hasOwn(CATEGORY_BANKS, queryParams.get('category')) ? queryParams.get('category') : 'kaspa';
  let activeMode = Object.hasOwn(GAME_MODES, queryParams.get('mode')) ? queryParams.get('mode') : 'gauntlet';
  let communityReady = false;
  let boardSequence = 0;
  let profile = { balance: 0, xp: 0, bestRound: 0, bestScore: 0, totalRuns: 0, totalCorrect: 0, progression: { level: 1, prestige: 0 } };
  let run = null;
  let currentQuestion = null;
  let timerId = null, transitionTimer = null;
  let deadline = 0;
  let timerSeconds = TIMER_SECONDS;
  let locked = false, requestBusy = false, recoveryNeeded = false;
  const savedRunKey = 'geek_hq_ranked_run_v1';
  const rememberRun = id => { try { id ? localStorage.setItem(savedRunKey, id) : localStorage.removeItem(savedRunKey); } catch { /* Storage is optional; the current visit still works. */ } };
  const readSavedRun = () => { try { const id = localStorage.getItem(savedRunKey); return id === 'pending' || /^[a-f0-9]{40}$/.test(id || '') ? id : null; } catch { return null; } };

  const elements = {
    screens: $$('.screen'), level: $('[data-level]'), prestige: $('[data-prestige]'), xp: $('[data-xp]'), balance: $('[data-balance]'), ladder: $('[data-ladder]'),
    round: $('[data-round]'), roundTotal: $('[data-round-total]'), questionNumber: $('[data-question-number]'), questionTotal: $('[data-question-total]'), correct: $('[data-correct]'), streak: $('[data-streak]'),
    score: $('[data-score]'), timer: $('[data-timer]'), timerLine: $('[data-timer-line]'), timerWrap: $('.timer-wrap'),
    questionProgress: $('[data-question-progress]'), category: $('[data-category]'), difficulty: $('[data-difficulty]'),
    sourceState: $('[data-source-state]'), question: $('[data-question]'), answers: $('[data-answers]'), feedback: $('[data-feedback]'),
    ace: $('[data-ace]'), resultKicker: $('[data-result-kicker]'), resultTitle: $('[data-result-title]'), resultMessage: $('[data-result-message]'),
    resultCorrect: $('[data-result-correct]'), resultScore: $('[data-result-score]'), resultXp: $('[data-result-xp]'), resultReward: $('[data-result-reward]'),
    continueButton: $('[data-continue]'), entryWarning: $('[data-entry-warning]'), startBalance: $('[data-start-balance]'), fees: $('[data-fees]'),
    rewards: $('[data-rewards]'), profit: $('[data-profit]'), runProgress: $('[data-run-progress]'), finalScore: $('[data-final-score]'),
    completeMessage: $('[data-complete-message]'), rules: $('[data-rules]'), startButton: $('[data-start]'), bankStatus: $('[data-bank-status]'),
    localNote: $('.local-note'), selectedMode: $('[data-selected-mode]'), modeDetail: $('[data-mode-detail]'), categorySummary: $('[data-category-summary]'), roundReview: $('[data-round-review]'),
    careerRound: $('[data-career-round]'), careerScore: $('[data-career-score]'), careerRuns: $('[data-career-runs]'),
    leaderboard: $('[data-leaderboard]'), boardState: $('[data-board-state]'), categoryButtons: $$('[data-category-key]'), modeButtons: $$('[data-mode-key]'),
    cashoutButton: $('[data-cashout]'), startScreen: $('[data-screen="start"]'), resultScreen: $('[data-screen="result"]'), completeKicker: $('[data-complete-kicker]'), completeTitle: $('[data-complete-title]')
  };

  const api = async (path, options = {}) => {
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options, signal: controller.signal });
      const payload = await response.json();
      if (!response.ok) { const error = new Error(payload.error || 'Ranked service unavailable.'); error.code = payload.code || response.status; throw error; }
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The game took too long to respond. Reconnect to check your saved run.');
      throw error;
    } finally { clearTimeout(timeout); }
  };

  const postRanked = (action, body = {}) => api('/api/ranked', { method: 'POST', body: JSON.stringify({ action, ...body }) });

  const updateProfileUI = () => {
    const level = profile.progression?.level || Math.max(1, Math.floor(profile.xp / 250) + 1);
    elements.level.textContent = String(level);
    elements.prestige.textContent = `P${profile.progression?.prestige || 0}`;
    elements.xp.textContent = format.format(profile.xp);
    elements.balance.textContent = format.format(profile.balance);
    elements.careerRound.textContent = pad(profile.bestRound);
    elements.careerScore.textContent = format.format(profile.bestScore);
    elements.careerRuns.textContent = format.format(profile.totalRuns);
    renderLadder(run?.round || Math.max(1, profile.bestRound + 1));
  };

  // Deferred ranked rounds: the server withholds correct/streak until the round
  // locks, so show a neutral pending mark rather than a misleading 0.
  const talliesPending = () => !run || run.feedback === 'deferred' && !['between-rounds', 'finished'].includes(run.status) || !Number.isInteger(run.correct);
  const renderTallies = () => {
    const pending = talliesPending();
    elements.correct.textContent = pending ? '—' : String(run.correct);
    elements.streak.textContent = pending ? '—' : `${run.streak || 0}×`;
  };
  const applyServerState = (payload, resetReview = false) => {
    if (payload.profile) profile = payload.profile;
    if (payload.run) {
      const roundAnswers = payload.run.answeredReview || (resetReview ? [] : run?.roundAnswers || []);
      run = { ...payload.run, roundAnswers };
      rememberRun(run.id);
      renderTallies();
    }
    updateProfileUI();
  };

  const renderLadder = (currentRound = 1) => {
    elements.ladder.innerHTML = ROUND_CONFIG.map((config) => {
      const state = config.round <= profile.bestRound ? 'complete' : config.round === currentRound ? 'current' : '';
      return `<li class="${state}"><b>${pad(config.round)}</b><span>${config.label}</span><strong>${format.format(config.max)}</strong></li>`;
    }).join('');
  };

  const showScreen = (name) => {
    elements.screens.forEach((screen) => screen.classList.toggle('active', screen.dataset.screen === name));
    window.scrollTo({ top: 0, behavior: 'instant' });
  };

  const renderLeaderboard = (entries = []) => {
    elements.leaderboard.innerHTML = entries.length
      ? entries.map((entry) => `<li><b>${pad(entry.rank)}</b><span>${escapeHtml(entry.name)}</span><small>${activeMode === 'gauntlet' ? `R${pad(entry.round)}` : activeMode === 'daily' ? 'DAILY' : 'SPEED'}</small><strong>${format.format(entry.score)}</strong></li>`).join('')
      : '<li class="board-empty">No verified scores yet. Set the first signal.</li>';
  };

  // Remember the leaderboard season pick across reloads; validated against the server's list.
  const seasonStorageKey = 'geek_hq_board_season_v1';
  const storedSeason = () => { try { const value = localStorage.getItem(seasonStorageKey); return /^[a-z0-9-]{1,32}$/.test(value || '') ? value : null; } catch { return null; } };
  const storeSeason = value => { try { value && value !== 'current' ? localStorage.setItem(seasonStorageKey, value) : localStorage.removeItem(seasonStorageKey); } catch { /* Storage is optional. */ } };
  const restoreSeason = () => { const select = $('[data-board-season]'), saved = storedSeason(); if (saved && (!select.options || [...select.options].some(option => option.value === saved))) select.value = saved; };
  // Returns true when the requested season is unknown to the server (pick reset to current).
  const rejectUnknownSeason = (season, payload) => {
    if (season === 'current' || !Array.isArray(payload.seasons) || payload.seasons.includes(season)) return false;
    $('[data-board-season]').value = 'current'; storeSeason(null); return true;
  };
  const loadLeaderboard = async (category = activeCategory, mode = activeMode) => {
    const sequence = ++boardSequence;
    elements.boardState.textContent = communityReady ? 'REFRESHING' : 'CONNECTING';
    try {
      const season = $('[data-board-season]').value || 'current';
      const payload = await api(`/api/leaderboard?${new URLSearchParams({ category, mode, season })}`);
      if (sequence !== boardSequence) return;
      if (rejectUnknownSeason(season, payload)) return loadLeaderboard(category, mode);
      elements.boardState.textContent = payload.seasonLabel || 'SERVER VERIFIED';
      renderLeaderboard(payload.entries);
    } catch {
      if (sequence !== boardSequence) return;
      elements.boardState.textContent = 'OFFLINE';
      elements.leaderboard.innerHTML = '<li class="board-empty">Verified leaderboard unavailable.</li>';
    }
  };

  const refreshSelection = () => {
    const category = CATEGORY_BANKS[activeCategory];
    const mode = GAME_MODES[activeMode];
    elements.startScreen.dataset.mode = activeMode;
    elements.selectedMode.textContent = `${mode.name} · ${category.shortName}`;
    elements.modeDetail.textContent = `${mode.detail} · ${format.format(category.count)} distinct questions`;
    elements.categorySummary.textContent = category.shortName;
    elements.bankStatus.textContent = communityReady ? 'SERVER READY' : 'CONNECTING';
    elements.startButton.disabled = !communityReady;
    elements.startButton.innerHTML = communityReady ? `${mode.start} <span>→</span>` : 'Connecting your game…';
    elements.localNote.innerHTML = communityReady
      ? activeMode === 'gauntlet'
        ? '<b>Alpha play:</b> credits are for practice and cannot be withdrawn. Scores are checked by the server.'
        : '<b>Quick mode:</b> earn XP and a verified score. No Alpha GEEK is awarded.'
      : '<b>Connecting:</b> play unlocks when the ranked service is ready.';
    loadLeaderboard(activeCategory, activeMode);
  };

  const selectMode = (modeKey) => {
    if (!Object.hasOwn(GAME_MODES, modeKey) || run) return;
    activeMode = modeKey;
    elements.modeButtons.forEach((button) => {
      const selected = button.dataset.modeKey === modeKey;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    refreshSelection();
  };

  const selectCategory = (categoryKey) => {
    if (!Object.hasOwn(CATEGORY_BANKS, categoryKey) || run) return;
    activeCategory = categoryKey;
    elements.categoryButtons.forEach((button) => {
      const selected = button.dataset.categoryKey === categoryKey;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    refreshSelection();
  };

  const startNewRun = async () => {
    if (requestBusy) return;
    if (!communityReady || run) return;
    requestBusy = true; recoveryNeeded = false; $('[data-ranked-recovery]').hidden = true;
    elements.startButton.disabled = true;
    elements.startButton.textContent = 'Getting your questions…';
    rememberRun('pending');
    try {
      const payload = await postRanked('start', { category: activeCategory, focus: requestedFocus, mode: activeMode });
      applyServerState(payload, true);
      showScreen('quiz');
      showQuestion(payload.question);
    } catch (error) {
      elements.localNote.innerHTML = `<b>Could not start:</b> ${escapeHtml(error.message)}`;
      showRecovery(`${error.message} Reconnect to check whether your run started before trying again.`);
    } finally { requestBusy = false; }
  };

  const showQuestion = (question) => {
    currentQuestion = question;
    locked = false;
    clearTimer();
    deadline = Date.now() + Math.max(0, question.expiresAt - question.serverNow);
    timerSeconds = Math.max(1, Number(question.durationMs || TIMER_SECONDS * 1000) / 1000);
    elements.round.textContent = pad(run.round);
    elements.roundTotal.textContent = String(run.maxRounds || 1);
    elements.questionNumber.textContent = pad(question.number);
    elements.questionTotal.textContent = String(run.questionCount || 10);
    renderTallies();
    elements.score.textContent = format.format(run.totalScore + (['question', 'awaiting-next'].includes(run.status) ? (run.roundScore || 0) : 0));
    elements.questionProgress.style.width = `${((question.number - 1) / (run.questionCount || 10)) * 100}%`;
    elements.category.textContent = displayTopic(question.topic).toUpperCase();
    elements.difficulty.textContent = question.difficulty.toUpperCase();
    elements.sourceState.textContent = question.sourceState;
    elements.sourceState.className = ['SOURCE-REVIEWED', 'COMMUNITY-REVIEWED'].includes(question.sourceState) ? 'reviewed' : question.sourceState === 'TIME-SENSITIVE' ? 'time-sensitive' : question.sourceState === 'SOURCE-LINKED' ? 'source-linked' : 'draft';
    elements.question.textContent = question.prompt;
    elements.feedback.textContent = '';
    elements.feedback.className = 'feedback';
    elements.ace.textContent = getAcePrompt(run.round, question.number - 1);
    elements.answers.innerHTML = question.options.map((option, index) => `
      <button class="answer" type="button" data-answer="${index}"><span class="answer-key">${index + 1}</span><span class="answer-text">${escapeHtml(option)}</span></button>
    `).join('');
    $$('.answer', elements.answers).forEach((button, index) => button.addEventListener('click', () => answerQuestion(index)));
    startTimer();
    elements.question.focus();
  };

  const getAcePrompt = (round, questionIndex) => {
    const prompts = [
      'The answer key is sealed server-side. Choose the cleanest signal.',
      'The server clock is authoritative. Speed still adds score.',
      'One answer. One signed session. No rewrites.',
      'Difficulty is rising. The server is keeping score.',
      'Only completed, server-scored rounds reach the board.'
    ];
    return prompts[(round + questionIndex) % prompts.length];
  };

  const startTimer = () => {
    updateTimer();
    timerId = window.setInterval(updateTimer, 100);
  };

  const updateTimer = () => {
    const remaining = Math.max(0, (deadline - Date.now()) / 1000);
    elements.timer.textContent = String(Math.ceil(remaining));
    elements.timerLine.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - Math.min(1, remaining / timerSeconds)));
    elements.timerWrap.classList.toggle('warning', remaining <= 10 && remaining > 5);
    elements.timerWrap.classList.toggle('danger', remaining <= 5);
    if (remaining <= 0) {
      clearTimer();
      answerQuestion(-1, true);
    }
  };

  const clearTimer = () => {
    window.clearTimeout(transitionTimer); transitionTimer = null;
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  };

  const answerQuestion = async (selectedIndex, timedOut = false) => {
    if (locked || requestBusy || !currentQuestion) return;
    requestBusy = true;
    locked = true;
    clearTimer();
    const buttons = $$('.answer', elements.answers);
    buttons.forEach((button) => { button.disabled = true; });
    elements.feedback.textContent = 'Server verifying answer…';
    const selected = selectedIndex >= 0 ? currentQuestion.options[selectedIndex] : 'No answer';
    try {
      const payload = await postRanked('answer', { runId: run.id, questionToken: currentQuestion.token, selectedIndex });
      applyServerState(payload);
      const result = payload.result;
      if (result.feedback === 'deferred') {
        // Ranked answers are locked in; correctness is revealed after the round locks.
        if (selectedIndex >= 0) buttons[selectedIndex]?.classList.add('selected');
        elements.feedback.textContent = result.timedOut ? 'Server clock expired · answer recorded' : 'Answer locked · results after the round';
        elements.feedback.className = 'feedback';
        elements.ace.textContent = 'Ranked feedback is revealed when the round locks.';
        elements.questionProgress.style.width = `${Math.min(100, (currentQuestion.number / (run.questionCount || 10)) * 100)}%`;
        transitionTimer = window.setTimeout(() => payload.roundResult ? completeRound(payload.roundResult) : nextQuestion(), 600);
        return;
      }
      buttons.forEach((button, index) => {
        if (index === result.correctIndex) button.classList.add('correct');
        if (index === selectedIndex && !result.correct) button.classList.add('wrong');
      });
      if (result.correct) {
        elements.feedback.textContent = `Server verified · ${result.streak}× streak · +${format.format(result.scoreAdded)} score`;
        elements.feedback.className = 'feedback good';
      } else {
        elements.feedback.textContent = timedOut || result.timedOut ? `Server clock expired · ${result.answer}` : `Not this time · ${result.answer}`;
        elements.feedback.className = 'feedback bad';
      }
      elements.ace.textContent = result.funFact || 'Answer locked by the ranked service.';
      elements.correct.textContent = String(run.correct);
      elements.streak.textContent = `${result.streak}×`;
      elements.score.textContent = format.format(run.totalScore + (['question', 'awaiting-next'].includes(run.status) ? run.roundScore : 0));
      elements.questionProgress.style.width = `${Math.min(100, (currentQuestion.number / (run.questionCount || 10)) * 100)}%`;
      transitionTimer = window.setTimeout(() => payload.roundResult ? completeRound(payload.roundResult) : nextQuestion(), 1250);
    } catch (error) {
      showRecovery(`${error.message} Your answer has not been confirmed. Reconnect before answering again.`);
    } finally { requestBusy = false; }
  };

  const nextQuestion = async () => {
    if (requestBusy || !run) return;
    requestBusy = true; $('[data-ranked-next]').disabled = true;
    try {
      const payload = await postRanked('next', { runId: run.id });
      applyServerState(payload);
      recoveryNeeded = false; $('[data-ranked-recovery]').hidden = true;
      showQuestion(payload.question);
    } catch (error) { showRecovery(error.message); }
    finally { requestBusy = false; $('[data-ranked-next]').disabled = false; }
  };

  const completeRound = (result) => {
    clearTimer();
    const config = ROUND_CONFIG[run.round - 1];
    const quickMode = run.mode !== 'gauntlet';
    elements.resultScreen.classList.toggle('quick-mode', quickMode);
    elements.resultKicker.textContent = quickMode ? `${GAME_MODES[run.mode].name.toUpperCase()} · SERVER VERIFIED` : `ROUND ${pad(run.round)} VERIFIED · ${result.label}`;
    elements.resultTitle.textContent = quickMode ? 'Challenge complete!' : result.correct >= 8 ? 'Great round!' : result.correct >= 5 ? 'Nice progress!' : 'Round complete!';
    elements.resultMessage.textContent = quickMode
      ? `${result.answered} questions completed. The server calculated your score and XP. No Alpha GEEK is awarded in quick modes.`
      : `${result.correct} answers were scored by the server, producing ${format.format(result.reward)} Alpha GEEK in the practice ledger.`;
    elements.resultCorrect.textContent = `${result.correct}/${result.answered || result.questionCount}`;
    elements.resultScore.textContent = format.format(result.roundScore);
    elements.resultXp.textContent = `+${format.format(result.xpEarned)}`;
    const careerNotice=$('[data-career-unlocks]');
    careerNotice.hidden=!(result.newAchievements?.length||result.careerRewardsReady);
    $('[data-career-unlock-copy]').textContent=`${result.newAchievements?.length?`${result.newAchievements.length} career ${result.newAchievements.length===1?'achievement':'achievements'} earned! `:''}${result.careerRewardsReady||0} challenge XP rewards ready to claim. Finish your run, then open Challenges.`;
    elements.resultReward.textContent = `+${format.format(result.reward)}`;
    elements.startBalance.textContent = `${format.format(run.startBalance)} Alpha GEEK`;
    elements.fees.textContent = `${format.format(run.fees)} Alpha GEEK`;
    elements.rewards.textContent = `${format.format(run.rewards)} Alpha GEEK`;
    const profit = run.rewards - run.fees;
    elements.profit.textContent = `${profit >= 0 ? '+' : ''}${format.format(profit)} Alpha GEEK`;
    elements.runProgress.style.width = quickMode ? '100%' : `${run.round * 10}%`;
    elements.cashoutButton.hidden = quickMode;
    if (quickMode) {
      elements.continueButton.disabled = false;
      elements.continueButton.innerHTML = 'Finish &amp; save result <span>→</span>';
      elements.entryWarning.textContent = '';
    } else if (run.round === 10) {
      elements.continueButton.disabled = false;
      elements.continueButton.innerHTML = 'Seal Verified Run <span>→</span>';
      elements.entryWarning.textContent = 'All ten rounds cleared. Submit the server-verified result.';
    } else {
      elements.continueButton.disabled = !result.canContinue;
      elements.continueButton.innerHTML = `Continue to Round ${pad(run.round + 1)} <span>→</span>`;
      elements.entryWarning.textContent = result.canContinue
        ? `Next entry: ${format.format(result.nextEntry)} Alpha GEEK · Max reward: ${format.format(result.nextMax)}`
        : `The verified balance needs ${format.format(result.nextEntry - profile.balance)} more Alpha GEEK. End this run to submit the completed rounds.`;
    }
    renderRoundReview();
    showScreen('result');
  };

  const continueRun = async () => {
    if (!run || requestBusy || recoveryNeeded) return;
    if (run.mode !== 'gauntlet') return finishRun(true);
    if (run.round === 10) return finishRun(true);
    requestBusy = true; elements.continueButton.disabled = true;
    try {
      const payload = await postRanked('continue', { runId: run.id });
      applyServerState(payload, true);
      showScreen('quiz');
      showQuestion(payload.question);
    } catch (error) {
      showRecovery(error.message);
    } finally { requestBusy = false; elements.continueButton.disabled = recoveryNeeded; }
  };

  const finishRun = async (apex = false) => {
    if (!run || requestBusy || recoveryNeeded) return;
    requestBusy = true; elements.continueButton.disabled = true; elements.cashoutButton.disabled = true;
    clearTimer();
    try {
      const payload = await postRanked('finish', { runId: run.id });
      applyServerState(payload);
      window.dispatchEvent(new Event('geek:run-saved'));
      ++boardSequence;
      $('[data-board-season]').value = run.season === 'season-1' ? 'season-1' : 'legacy';
      elements.boardState.textContent = `${run.seasonLabel || 'Season 0 — Public-bank Alpha'}${payload.leaderboard?.improved ? ' · NEW VERIFIED BEST' : ''}`;
      if (payload.leaderboard) renderLeaderboard(payload.leaderboard.entries);
      rememberRun(null); $('[data-ranked-recovery]').hidden = true;
      if (apex) {
        elements.finalScore.textContent = format.format(run.totalScore);
        const quickMode = run.mode !== 'gauntlet';
        elements.completeKicker.textContent = quickMode ? `${GAME_MODES[run.mode].name.toUpperCase()} // COMPLETE` : run.completedRound === 10 ? 'APEX PROTOCOL // COMPLETE' : 'GAUNTLET // SAVED';
        elements.completeTitle.innerHTML = quickMode ? 'Challenge<br /><span>saved.</span>' : run.completedRound === 10 ? 'Gauntlet<br /><span>complete!</span>' : 'Run<br /><span>saved.</span>';
        elements.completeMessage.textContent = quickMode
          ? `The server recorded this ${CATEGORY_BANKS[run.category].shortName} ${GAME_MODES[run.mode].name} score on its separate verified board.`
          : `The server recorded your completed ${CATEGORY_BANKS[run.category].shortName} rounds. Check My HQ for career progress.`;
        showScreen('complete');
      } else {
        run = null;
        selectCategory(activeCategory);
        showScreen('start');
      }
    } catch (error) {
      showRecovery(error.message);
    } finally { requestBusy = false; elements.continueButton.disabled = recoveryNeeded; elements.cashoutButton.disabled = recoveryNeeded; }
  };

  const renderRoundReview = () => {
    elements.roundReview.innerHTML = run.roundAnswers.map((item, index) => {
      const result = item.correct ? 'Correct' : `${item.selected === 'No answer' ? 'No answer' : `Your answer: ${item.selected}`} · Correct: ${item.answer}`;
      const source = item.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer">Open source ↗</a>` : '<span>No source recorded</span>';
      return `<li class="${item.correct ? 'correct-review' : 'wrong-review'}"><div><b>${index + 1}. ${escapeHtml(item.prompt)}</b><small>${escapeHtml(result)} · ${escapeHtml(item.sourceState)}</small></div>${source}</li>`;
    }).join('') || '<li>Your last answer is saved. Earlier answers from an older run are not available for review here.</li>';
  };

  const showRecovery = message => {
    recoveryNeeded = true; locked = true; clearTimer();
    $$('.answer', elements.answers).forEach(button => { button.disabled = true; });
    $('[data-ranked-recovery]').hidden = false; $('[data-ranked-next]').hidden = true; $('[data-ranked-finish]').hidden = true;
    $('[data-ranked-reconnect]').hidden = false;
    $('[data-ranked-recovery-status]').textContent = message;
    elements.feedback.textContent = message; elements.entryWarning.textContent = message;
    elements.continueButton.disabled = true; elements.cashoutButton.disabled = true;
    const panel = $('[data-ranked-recovery]'); panel.tabIndex = -1; panel.focus({ preventScroll: true }); panel.scrollIntoView({ block: 'start', behavior: 'instant' });
  };
  const reconnectRun = async () => {
    const id = run?.id || readSavedRun() || (recoveryNeeded ? 'pending' : null);
    if (!id || requestBusy) return;
    requestBusy = true; clearTimer(); $('[data-ranked-reconnect]').disabled = true;
    try {
      const payload = await api(`/api/ranked?${new URLSearchParams(id === 'pending' ? { resume: '1' } : { runId: id })}`);
      if (Object.hasOwn(GAME_MODES, payload.run?.mode)) activeMode = payload.run.mode;
      if (Object.hasOwn(CATEGORY_BANKS, payload.run?.category)) activeCategory = payload.run.category;
      applyServerState(payload); recoveryNeeded = false;
      $('[data-ranked-recovery]').hidden = true; $('[data-ranked-next]').hidden = true; $('[data-ranked-finish]').hidden = true;
      if (run.status === 'question' && payload.question) { showScreen('quiz'); showQuestion(payload.question); }
      else if (run.status === 'between-rounds' && payload.roundResult) completeRound(payload.roundResult);
      else if (run.status === 'awaiting-next') {
        currentQuestion = null; locked = true; showScreen('quiz'); elements.answers.innerHTML = '';
        elements.question.textContent = 'Your answer is saved.';
        elements.feedback.textContent = payload.result?.feedback === 'deferred'
          ? 'Answer saved — results after the round.'
          : payload.result ? `Correct answer: ${payload.result.answer}. ${payload.result.correct ? 'Your answer was correct.' : 'Read the feedback, then continue.'}` : 'Continue to your next question.';
        elements.ace.textContent = payload.result?.funFact || '';
        $('[data-ranked-recovery]').hidden = false; $('[data-ranked-next]').hidden = false;
        $('[data-ranked-recovery-status]').textContent = 'Your last answer is confirmed. Continue when you’re ready.';
      } else if (run.status === 'finished') {
        rememberRun(null); elements.finalScore.textContent = format.format(run.totalScore);
        elements.completeKicker.textContent = 'SERVER-SAVED RUN'; elements.completeTitle.textContent = 'Run saved.';
        elements.completeMessage.textContent = 'Your completed rounds and career progress are saved. Confirm the leaderboard submission below or visit My HQ.';
        showScreen('complete');
        $('[data-ranked-recovery]').hidden = false; $('[data-ranked-finish]').hidden = false;
        $('[data-ranked-recovery-status]').textContent = 'Your run is finished. Confirm its leaderboard submission or visit My HQ.';
      } else throw new Error('The saved run could not be displayed. Your progress has not been reset.');
    } catch (error) {
      showRecovery(error.message);
      if (error.code === 404 || error.code === 'RUN_NOT_FOUND') { rememberRun(null); run = null; recoveryNeeded = false; selectCategory(activeCategory); showScreen('start'); $('[data-ranked-reconnect]').hidden = true; }
    } finally { requestBusy = false; $('[data-ranked-reconnect]').disabled = false; }
  };
  $('[data-ranked-reconnect]').addEventListener('click', reconnectRun);
  restoreSeason();
  $('[data-board-season]').addEventListener('change', () => { storeSeason($('[data-board-season]').value); return loadLeaderboard(); });
  $('[data-ranked-next]').addEventListener('click', nextQuestion);
  $('[data-ranked-finish]').addEventListener('click', async () => { $('[data-ranked-finish]').hidden = true; $('[data-ranked-recovery]').hidden = true; await finishRun(true); });

  const initialize = async () => {
    selectMode(activeMode);
    selectCategory(activeCategory);
    try {
      await api('/api/session', { method: 'POST', body: '{}' });
      const status = await api('/api/ranked');
      profile = status.profile;
      communityReady = true;
      updateProfileUI();
      selectCategory(activeCategory);
      if (readSavedRun()) { $('[data-ranked-recovery]').hidden = false; $('[data-ranked-recovery-status]').textContent = 'You have a saved run from this browser. Reconnect to check its current question or result; the server timer keeps running.'; }
    } catch (error) {
      communityReady = false;
      elements.bankStatus.textContent = 'OFFLINE';
      elements.startButton.disabled = true;
      elements.startButton.textContent = 'Game unavailable · reload to retry';
      elements.localNote.innerHTML = `<b>Ranked service unavailable:</b> ${escapeHtml(error.message)} Answers are not exposed for insecure browser-only play.`;
    }
  };

  const displayTopic = (topic) => topic === 'KRC-20 & Smart Contracts' ? 'Tokens & Programmability' : topic;

  elements.startButton.addEventListener('click', startNewRun);
  elements.modeButtons.forEach((button) => button.addEventListener('click', () => selectMode(button.dataset.modeKey)));
  $('[data-gauntlet-setup]').addEventListener('click', () => {
    selectMode('gauntlet');
    const setup = $('#timed-games');
    setup.open = true;
    setup.querySelector('summary').focus({ preventScroll: true });
    setup.scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  elements.categoryButtons.forEach((button) => button.addEventListener('click', () => selectCategory(button.dataset.categoryKey)));
  $('[data-new-run]').addEventListener('click', () => {
    if (requestBusy) return;
    run = null; recoveryNeeded = false; rememberRun(null); $('[data-ranked-recovery]').hidden = true;
    selectCategory(activeCategory);
    showScreen('start');
  });
  $('[data-continue]').addEventListener('click', continueRun);
  $('[data-cashout]').addEventListener('click', () => finishRun(false));
  $('[data-quit]').addEventListener('click', () => {
    if (run && window.confirm('End this verified run? Only completed rounds will reach the leaderboard.')) finishRun(false);
  });
  $('[data-how]').addEventListener('click', () => elements.rules.showModal());
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => elements.rules.close()));
  elements.rules.addEventListener('click', (event) => { if (event.target === elements.rules) elements.rules.close(); });
  document.addEventListener('keydown', (event) => {
    if (!$('[data-screen="quiz"]').classList.contains('active') || locked) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 4) $(`.answer[data-answer="${index}"]`, elements.answers)?.click();
  });

  initialize();
})();
