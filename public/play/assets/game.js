(() => {
  'use strict';

  const queryParams = new URLSearchParams(window.location.search);
  const requestedFocus = ['ghostdag', 'builders'].includes(queryParams.get('focus')) ? queryParams.get('focus') : '';
  const IDENTITY_KEY = 'geek-lobby-identity-v1';
  const TIMER_SECONDS = 15;
  const TIMER_CIRCUMFERENCE = 125.66;
  const GAME_MODES = {
    gauntlet: { name: 'Geek Gauntlet', detail: '10 rounds × 10 questions · Alpha practice economy', start: 'Start Verified Round 01' },
    daily: { name: 'Daily Signal', detail: '5 server-selected questions · one verified attempt per UTC day', start: 'Start Today’s Signal' },
    speed: { name: 'Speed Signal', detail: 'Answer up to 10 questions before the 30-second server clock closes', start: 'Start 30-Second Signal' }
  };
  const CATEGORY_BANKS = {
    kaspa: { name: 'Kaspa: Proof-of-Learning', shortName: 'Kaspa', count: 1032, detail: '1,000 practice variants + 32 current items', sourced: true },
    'video-games': { name: 'Video Games', shortName: 'Video Games', count: 1000, detail: 'games, consoles & lore' },
    'science-fiction': { name: 'Science Fiction', shortName: 'Science Fiction', count: 1000, detail: 'worlds, stories & futures' },
    technology: { name: 'Technology', shortName: 'Technology', count: 1000, detail: 'computing, science & invention' },
    movies: { name: 'Movies', shortName: 'Movies', count: 1000, detail: 'cinema, characters & creators' },
    history: { name: 'History', shortName: 'History', count: 1000, detail: 'people, places & turning points' },
    comics: { name: 'Comics', shortName: 'Comics', count: 1000, detail: 'heroes, creators & panels' },
    'pop-culture': { name: 'Pop Culture', shortName: 'Pop Culture', count: 1000, detail: 'music, television & culture' }
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
  let profile = { balance: 0, xp: 0, bestRound: 0, bestScore: 0, totalRuns: 0, totalCorrect: 0, progression: { level: 1, prestige: 0 } };
  let run = null;
  let currentQuestion = null;
  let timerId = null;
  let deadline = 0;
  let timerSeconds = TIMER_SECONDS;
  let locked = false;

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
    localNote: $('.local-note'), selectedMode: $('[data-selected-mode]'), modeDetail: $('[data-mode-detail]'), roundReview: $('[data-round-review]'),
    careerRound: $('[data-career-round]'), careerScore: $('[data-career-score]'), careerRuns: $('[data-career-runs]'),
    leaderboard: $('[data-leaderboard]'), boardState: $('[data-board-state]'), categoryButtons: $$('[data-category-key]'), modeButtons: $$('[data-mode-key]'),
    cashoutButton: $('[data-cashout]'), startScreen: $('[data-screen="start"]'), completeKicker: $('[data-complete-kicker]'), completeTitle: $('[data-complete-title]')
  };

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Ranked service unavailable.');
      error.code = payload.code || response.status;
      throw error;
    }
    return payload;
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

  const applyServerState = (payload, resetReview = false) => {
    if (payload.profile) profile = payload.profile;
    if (payload.run) {
      const roundAnswers = resetReview ? [] : run?.roundAnswers || [];
      run = { ...payload.run, roundAnswers };
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

  const loadLeaderboard = async (category = activeCategory, mode = activeMode) => {
    elements.boardState.textContent = communityReady ? 'REFRESHING' : 'CONNECTING';
    try {
      const payload = await api(`/api/leaderboard?category=${encodeURIComponent(category)}&mode=${encodeURIComponent(mode)}`);
      elements.boardState.textContent = 'SERVER VERIFIED';
      renderLeaderboard(payload.entries);
    } catch {
      elements.boardState.textContent = 'OFFLINE';
      elements.leaderboard.innerHTML = '<li class="board-empty">Verified leaderboard unavailable.</li>';
    }
  };

  const refreshSelection = () => {
    const category = CATEGORY_BANKS[activeCategory];
    const mode = GAME_MODES[activeMode];
    elements.startScreen.dataset.mode = activeMode;
    elements.selectedMode.textContent = `${mode.name} · ${category.shortName}`;
    elements.modeDetail.textContent = `${mode.detail} · ${format.format(category.count)} private items`;
    elements.bankStatus.textContent = communityReady ? 'SERVER READY' : 'CONNECTING';
    elements.startButton.disabled = !communityReady;
    elements.startButton.innerHTML = communityReady ? `${mode.start} <span>→</span>` : 'Connecting Ranked Service';
    elements.localNote.innerHTML = communityReady
      ? activeMode === 'gauntlet'
        ? '<b>Server-authoritative Gauntlet:</b> private answers, enforced deadlines, and a server-only leaderboard. Alpha GEEK remains a no-value practice balance.'
        : '<b>Server-authoritative quick mode:</b> the server owns the answers, clock, score, and board. Daily and Speed award XP and verified scores—not Alpha GEEK.'
      : '<b>Ranked service required:</b> the answer bank is not shipped to browsers. Play unlocks after the secure game service connects.';
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
    if (!communityReady || run) return;
    elements.startButton.disabled = true;
    elements.startButton.textContent = 'Opening Verified Run…';
    try {
      const payload = await postRanked('start', { category: activeCategory, focus: requestedFocus, mode: activeMode });
      applyServerState(payload, true);
      showScreen('quiz');
      showQuestion(payload.question);
    } catch (error) {
      elements.localNote.innerHTML = `<b>Could not start:</b> ${escapeHtml(error.message)}`;
      elements.startButton.disabled = false;
      elements.startButton.innerHTML = 'Retry Verified Run <span>→</span>';
    }
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
    elements.correct.textContent = String(run.correct);
    elements.streak.textContent = `${run.streak || 0}×`;
    elements.score.textContent = format.format(run.totalScore + run.roundScore);
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
    if (timerId) window.clearInterval(timerId);
    timerId = null;
  };

  const answerQuestion = async (selectedIndex, timedOut = false) => {
    if (locked || !currentQuestion) return;
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
      buttons.forEach((button, index) => {
        if (index === result.correctIndex) button.classList.add('correct');
        if (index === selectedIndex && !result.correct) button.classList.add('wrong');
      });
      run.roundAnswers.push({
        prompt: currentQuestion.prompt,
        selected: timedOut || result.timedOut ? 'No answer' : selected,
        answer: result.answer,
        correct: result.correct,
        source: result.source,
        sourceState: result.sourceState
      });
      if (result.correct) {
        elements.feedback.textContent = `Server verified · ${result.streak}× streak · +${format.format(result.scoreAdded)} score`;
        elements.feedback.className = 'feedback good';
      } else {
        elements.feedback.textContent = result.timedOut ? `Server clock expired · ${result.answer}` : `Not this time · ${result.answer}`;
        elements.feedback.className = 'feedback bad';
      }
      elements.ace.textContent = result.funFact || 'Answer locked by the ranked service.';
      elements.correct.textContent = String(run.correct);
      elements.streak.textContent = `${result.streak}×`;
      elements.score.textContent = format.format(run.totalScore + run.roundScore);
      elements.questionProgress.style.width = `${Math.min(100, (currentQuestion.number / (run.questionCount || 10)) * 100)}%`;
      window.setTimeout(() => payload.roundResult ? completeRound(payload.roundResult) : nextQuestion(), 1250);
    } catch (error) {
      locked = false;
      buttons.forEach((button) => { button.disabled = false; });
      elements.feedback.textContent = `${error.message} Retry before the server clock closes.`;
      elements.feedback.className = 'feedback bad';
      startTimer();
    }
  };

  const nextQuestion = async () => {
    try {
      const payload = await postRanked('next', { runId: run.id });
      applyServerState(payload);
      showQuestion(payload.question);
    } catch (error) {
      elements.feedback.textContent = error.message;
      elements.feedback.className = 'feedback bad';
    }
  };

  const completeRound = (result) => {
    clearTimer();
    const config = ROUND_CONFIG[run.round - 1];
    const quickMode = run.mode !== 'gauntlet';
    elements.resultKicker.textContent = quickMode ? `${GAME_MODES[run.mode].name.toUpperCase()} · SERVER VERIFIED` : `ROUND ${pad(run.round)} VERIFIED · ${result.label}`;
    elements.resultTitle.textContent = result.correct >= 8 ? 'ACCESS GRANTED' : result.correct >= 5 ? 'SIGNAL ACCEPTED' : 'ROUND SURVIVED';
    elements.resultMessage.textContent = quickMode
      ? `${result.answered} answers were locked and scored by the server. Quick modes build XP and verified scores without issuing Alpha GEEK.`
      : `${result.correct} answers were scored by the server, producing ${format.format(result.reward)} Alpha GEEK in the practice ledger.`;
    elements.resultCorrect.textContent = `${result.correct}/${result.answered || result.questionCount}`;
    elements.resultScore.textContent = format.format(result.roundScore);
    elements.resultXp.textContent = `+${format.format(result.xpEarned)}`;
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
      elements.continueButton.innerHTML = 'Record Verified Result <span>→</span>';
      elements.entryWarning.textContent = 'No entry fee. No Alpha GEEK reward. The score remains server-verified.';
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
    if (!run) return;
    if (run.mode !== 'gauntlet') return finishRun(true);
    if (run.round === 10) return finishRun(true);
    elements.continueButton.disabled = true;
    try {
      const payload = await postRanked('continue', { runId: run.id });
      applyServerState(payload, true);
      showScreen('quiz');
      showQuestion(payload.question);
    } catch (error) {
      elements.entryWarning.textContent = error.message;
    }
  };

  const finishRun = async (apex = false) => {
    if (!run) return;
    clearTimer();
    try {
      const payload = await postRanked('finish', { runId: run.id });
      applyServerState(payload);
      elements.boardState.textContent = payload.leaderboard?.improved ? 'NEW VERIFIED BEST' : 'SERVER VERIFIED';
      if (payload.leaderboard) renderLeaderboard(payload.leaderboard.entries);
      if (apex) {
        elements.finalScore.textContent = format.format(run.totalScore);
        const quickMode = run.mode !== 'gauntlet';
        elements.completeKicker.textContent = quickMode ? `${GAME_MODES[run.mode].name.toUpperCase()} // COMPLETE` : 'APEX PROTOCOL // COMPLETE';
        elements.completeTitle.innerHTML = quickMode ? 'SIGNAL<br /><span>RECORDED</span>' : 'GAUNTLET<br /><span>CONQUERED</span>';
        elements.completeMessage.textContent = quickMode
          ? `The server recorded this ${CATEGORY_BANKS[run.category].shortName} ${GAME_MODES[run.mode].name} score on its separate verified board.`
          : `The server verified all 100 ${CATEGORY_BANKS[run.category].shortName} answers and recorded the completed run.`;
        showScreen('complete');
      } else {
        run = null;
        selectCategory(activeCategory);
        showScreen('start');
      }
    } catch (error) {
      elements.entryWarning.textContent = error.message;
    }
  };

  const renderRoundReview = () => {
    elements.roundReview.innerHTML = run.roundAnswers.map((item, index) => {
      const result = item.correct ? 'Correct' : `${item.selected === 'No answer' ? 'No answer' : `Your answer: ${item.selected}`} · Correct: ${item.answer}`;
      const source = item.source ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer">Open source ↗</a>` : '<span>No source recorded</span>';
      return `<li class="${item.correct ? 'correct-review' : 'wrong-review'}"><div><b>${index + 1}. ${escapeHtml(item.prompt)}</b><small>${escapeHtml(result)} · ${escapeHtml(item.sourceState)}</small></div>${source}</li>`;
    }).join('');
  };

  const initialize = async () => {
    selectMode(activeMode);
    selectCategory(activeCategory);
    try {
      const displayName = localStorage.getItem(IDENTITY_KEY) || 'Guest Geek';
      await api('/api/session', { method: 'POST', body: JSON.stringify({ displayName }) });
      const status = await api('/api/ranked');
      profile = status.profile;
      communityReady = true;
      updateProfileUI();
      selectCategory(activeCategory);
    } catch (error) {
      communityReady = false;
      elements.bankStatus.textContent = 'OFFLINE';
      elements.startButton.disabled = true;
      elements.startButton.textContent = 'Ranked Service Offline';
      elements.localNote.innerHTML = `<b>Ranked service unavailable:</b> ${escapeHtml(error.message)} Answers are not exposed for insecure browser-only play.`;
    }
  };

  const displayTopic = (topic) => topic === 'KRC-20 & Smart Contracts' ? 'Tokens & Programmability' : topic;

  elements.startButton.addEventListener('click', startNewRun);
  elements.modeButtons.forEach((button) => button.addEventListener('click', () => selectMode(button.dataset.modeKey)));
  elements.categoryButtons.forEach((button) => button.addEventListener('click', () => selectCategory(button.dataset.categoryKey)));
  $('[data-new-run]').addEventListener('click', () => {
    run = null;
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
