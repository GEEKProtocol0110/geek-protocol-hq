(() => {
  'use strict';

  let QUESTIONS = [];
  let activeCategory = 'kaspa';
  let loadRequest = 0;
  const queryParams = new URLSearchParams(window.location.search);
  const requestedFocus = ['ghostdag', 'builders'].includes(queryParams.get('focus')) ? queryParams.get('focus') : '';
  const BANK_CACHE = new Map();
  const CATEGORY_BANKS = {
    kaspa: { name: 'Kaspa: Proof of Learning', shortName: 'Kaspa', file: 'kaspa-questions.json', supplement: 'kaspa-current-questions.json', count: 1032, detail: '80 core concepts + 32 current items', sourced: true },
    'video-games': { name: 'Video Games', shortName: 'Video Games', file: 'video-games-questions.json', count: 1000, detail: 'games, consoles & lore' },
    'science-fiction': { name: 'Science Fiction', shortName: 'Science Fiction', file: 'science-fiction-questions.json', count: 1000, detail: 'worlds, stories & futures' },
    technology: { name: 'Technology', shortName: 'Technology', file: 'technology-questions.json', count: 1000, detail: 'computing, science & invention' },
    movies: { name: 'Movies', shortName: 'Movies', file: 'movies-questions.json', count: 1000, detail: 'cinema, characters & creators' },
    history: { name: 'History', shortName: 'History', file: 'history-questions.json', count: 1000, detail: 'people, places & turning points' },
    comics: { name: 'Comics', shortName: 'Comics', file: 'comics-questions.json', count: 1000, detail: 'heroes, creators & panels' },
    'pop-culture': { name: 'Pop Culture', shortName: 'Pop Culture', file: 'pop-culture-questions.json', count: 1000, detail: 'music, television & culture' }
  };
  const STORAGE_KEY = 'geek-gauntlet-profile-v1';
  const TIMER_SECONDS = 15;
  const TIMER_CIRCUMFERENCE = 125.66;
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
  const shuffle = (values) => {
    const copy = [...values];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };

  const loadProfile = () => {
    const fallback = { balance: 0, xp: 0, bestRound: 0, bestScore: 0, totalRuns: 0, totalCorrect: 0 };
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      const merged = { ...fallback, ...(stored || {}) };
      Object.keys(fallback).forEach((key) => {
        const value = Number(merged[key]);
        merged[key] = Number.isFinite(value) && value >= 0 ? Math.floor(value) : fallback[key];
      });
      return merged;
    } catch {
      return fallback;
    }
  };

  let profile = loadProfile();
  let run = null;
  let roundQuestions = [];
  let optionOrder = [];
  let timerId = null;
  let deadline = 0;
  let locked = false;

  const elements = {
    screens: $$('.screen'),
    level: $('[data-level]'),
    xp: $('[data-xp]'),
    balance: $('[data-balance]'),
    ladder: $('[data-ladder]'),
    round: $('[data-round]'),
    questionNumber: $('[data-question-number]'),
    correct: $('[data-correct]'),
    streak: $('[data-streak]'),
    score: $('[data-score]'),
    timer: $('[data-timer]'),
    timerLine: $('[data-timer-line]'),
    timerWrap: $('.timer-wrap'),
    questionProgress: $('[data-question-progress]'),
    category: $('[data-category]'),
    difficulty: $('[data-difficulty]'),
    sourceState: $('[data-source-state]'),
    question: $('[data-question]'),
    answers: $('[data-answers]'),
    feedback: $('[data-feedback]'),
    ace: $('[data-ace]'),
    resultKicker: $('[data-result-kicker]'),
    resultTitle: $('[data-result-title]'),
    resultMessage: $('[data-result-message]'),
    resultCorrect: $('[data-result-correct]'),
    resultScore: $('[data-result-score]'),
    resultXp: $('[data-result-xp]'),
    resultReward: $('[data-result-reward]'),
    continueButton: $('[data-continue]'),
    entryWarning: $('[data-entry-warning]'),
    startBalance: $('[data-start-balance]'),
    fees: $('[data-fees]'),
    rewards: $('[data-rewards]'),
    profit: $('[data-profit]'),
    runProgress: $('[data-run-progress]'),
    finalScore: $('[data-final-score]'),
    completeMessage: $('[data-complete-message]'),
    rules: $('[data-rules]'),
    startButton: $('[data-start]'),
    bankStatus: $('[data-bank-status]'),
    localNote: $('.local-note'),
    selectedMode: $('[data-selected-mode]'),
    modeDetail: $('[data-mode-detail]'),
    roundReview: $('[data-round-review]'),
    careerRound: $('[data-career-round]'),
    careerScore: $('[data-career-score]'),
    careerRuns: $('[data-career-runs]'),
    categoryButtons: $$('[data-category-key]')
  };

  const saveProfile = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
    updateProfileUI();
  };

  const updateProfileUI = () => {
    const level = Math.max(1, Math.floor(profile.xp / 250) + 1);
    elements.level.textContent = String(level);
    elements.xp.textContent = format.format(profile.xp);
    elements.balance.textContent = format.format(profile.balance);
    elements.careerRound.textContent = pad(profile.bestRound);
    elements.careerScore.textContent = format.format(profile.bestScore);
    elements.careerRuns.textContent = format.format(profile.totalRuns);
    renderLadder(run?.round || Math.max(1, profile.bestRound + 1));
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

  const startNewRun = () => {
    if (QUESTIONS.length < 1000) return;
    clearTimer();
    run = {
      round: 1,
      questionIndex: 0,
      correct: 0,
      roundScore: 0,
      totalScore: 0,
      streak: 0,
      maxStreak: 0,
      startBalance: profile.balance,
      fees: 0,
      rewards: 0,
      usedQuestionIds: [],
      roundAnswers: [],
      category: activeCategory
    };
    startRound();
  };

  const startRound = () => {
    const config = ROUND_CONFIG[run.round - 1];
    if (profile.balance < config.entry) {
      showStartAfterRun(`Round ${pad(run.round)} requires ${format.format(config.entry)} Alpha GEEK.`);
      return;
    }

    profile.balance -= config.entry;
    run.fees += config.entry;
    run.questionIndex = 0;
    run.correct = 0;
    run.roundScore = 0;
    run.roundAnswers = [];
    const tier = difficultyForRound(run.round);
    roundQuestions = selectRoundQuestions(tier, run.usedQuestionIds);
    run.usedQuestionIds.push(...roundQuestions.map((question) => question.id));

    if (roundQuestions.length < 10) {
      elements.ace.textContent = 'Question bank fault. This round cannot initialize.';
      return;
    }

    saveProfile();
    renderLadder(run.round);
    showScreen('quiz');
    showQuestion();
  };

  const showQuestion = () => {
    locked = false;
    clearTimer();
    const question = roundQuestions[run.questionIndex];
    optionOrder = shuffle(question.options);

    elements.round.textContent = pad(run.round);
    elements.questionNumber.textContent = pad(run.questionIndex + 1);
    elements.correct.textContent = String(run.correct);
    elements.streak.textContent = `${run.streak}×`;
    elements.score.textContent = format.format(run.totalScore + run.roundScore);
    elements.questionProgress.style.width = `${run.questionIndex * 10}%`;
    elements.category.textContent = displayTopic(question.topic).toUpperCase();
    elements.difficulty.textContent = question.difficulty.toUpperCase();
    elements.sourceState.textContent = question.priority ? 'SOURCE-REVIEWED' : question.volatile ? 'TIME-SENSITIVE' : CATEGORY_BANKS[run.category].sourced ? 'SOURCE-LINKED' : 'DRAFT BANK';
    elements.sourceState.className = question.priority ? 'reviewed' : question.volatile ? 'time-sensitive' : CATEGORY_BANKS[run.category].sourced ? 'source-linked' : 'draft';
    elements.question.textContent = question.prompt;
    elements.feedback.textContent = '';
    elements.feedback.className = 'feedback';
    elements.ace.textContent = getAcePrompt(run.round, run.questionIndex);
    elements.answers.innerHTML = optionOrder.map((option, index) => `
      <button class="answer" type="button" data-answer="${index}">
        <span class="answer-key">${index + 1}</span>
        <span class="answer-text"></span>
      </button>
    `).join('');
    $$('.answer', elements.answers).forEach((button, index) => {
      $('.answer-text', button).textContent = optionOrder[index];
      button.addEventListener('click', () => answerQuestion(index));
    });
    startTimer();
  };

  const getAcePrompt = (round, questionIndex) => {
    const prompts = [
      'Signal acquired. Choose the cleanest answer.',
      'Speed adds score. Accuracy builds the run.',
      'One answer. No rewrites. Commit when ready.',
      'Difficulty is rising. So is the reward curve.',
      'The Grid remembers every correct signal.'
    ];
    return prompts[(round + questionIndex) % prompts.length];
  };

  const startTimer = () => {
    deadline = Date.now() + TIMER_SECONDS * 1000;
    updateTimer();
    timerId = window.setInterval(updateTimer, 100);
  };

  const updateTimer = () => {
    const remaining = Math.max(0, (deadline - Date.now()) / 1000);
    const whole = Math.ceil(remaining);
    elements.timer.textContent = String(whole);
    elements.timerLine.style.strokeDashoffset = String(TIMER_CIRCUMFERENCE * (1 - remaining / TIMER_SECONDS));
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

  const answerQuestion = (selectedIndex, timedOut = false) => {
    if (locked) return;
    locked = true;
    clearTimer();

    const question = roundQuestions[run.questionIndex];
    const selected = optionOrder[selectedIndex];
    const isCorrect = selected === question.answer;
    const remaining = Math.max(0, (deadline - Date.now()) / 1000);
    const buttons = $$('.answer', elements.answers);

    run.roundAnswers.push({
      prompt: question.prompt,
      selected: timedOut ? 'No answer' : selected,
      answer: question.answer,
      correct: isCorrect,
      source: question.source,
      sourceState: question.priority ? 'Reviewed current item' : question.volatile ? 'Time-sensitive item' : CATEGORY_BANKS[run.category].sourced ? 'Source-linked practice item' : 'Draft practice item'
    });

    buttons.forEach((button, index) => {
      button.disabled = true;
      if (optionOrder[index] === question.answer) button.classList.add('correct');
      if (index === selectedIndex && !isCorrect) button.classList.add('wrong');
    });

    if (isCorrect) {
      run.streak += 1;
      run.maxStreak = Math.max(run.maxStreak, run.streak);
      const speedScore = Math.round(remaining * 30);
      const streakScore = Math.min(run.streak, 5) * 100;
      const questionScore = 1000 + speedScore + streakScore;
      run.correct += 1;
      run.roundScore += questionScore;
      elements.feedback.textContent = `Correct · ${run.streak}× streak · +${format.format(questionScore)} score`;
      elements.feedback.className = 'feedback good';
      elements.ace.textContent = question.funFact || 'Verified. Clean signal added to the run.';
    } else {
      run.streak = 0;
      elements.feedback.textContent = timedOut ? `Time expired · ${question.answer}` : `Not this time · ${question.answer}`;
      elements.feedback.className = 'feedback bad';
      elements.ace.textContent = question.funFact || (timedOut ? 'Clock hit zero. The correct answer is now revealed.' : 'Wrong signal. Lock it in, learn it, move forward.');
    }

    elements.correct.textContent = String(run.correct);
    elements.streak.textContent = `${run.streak}×`;
    elements.score.textContent = format.format(run.totalScore + run.roundScore);
    elements.questionProgress.style.width = `${(run.questionIndex + 1) * 10}%`;
    window.setTimeout(nextQuestion, 1250);
  };

  const nextQuestion = () => {
    run.questionIndex += 1;
    if (run.questionIndex < 10) showQuestion();
    else completeRound();
  };

  const completeRound = () => {
    clearTimer();
    const config = ROUND_CONFIG[run.round - 1];
    const reward = run.correct * config.reward;
    const xpEarned = run.correct * 10 + Math.round(run.roundScore / 1000);
    run.totalScore += run.roundScore;
    run.rewards += reward;
    profile.balance += reward;
    profile.xp += xpEarned;
    profile.totalCorrect += run.correct;
    profile.bestRound = Math.max(profile.bestRound, run.round);
    profile.bestScore = Math.max(profile.bestScore, run.totalScore);
    saveProfile();

    elements.resultKicker.textContent = `ROUND ${pad(run.round)} COMPLETE · ${config.label}`;
    elements.resultTitle.textContent = run.correct >= 8 ? 'ACCESS GRANTED' : run.correct >= 5 ? 'SIGNAL ACCEPTED' : 'ROUND SURVIVED';
    elements.resultMessage.textContent = `${run.correct} verified answers and a ${run.maxStreak}× best streak produced ${format.format(reward)} Alpha GEEK in the local practice ledger.`;
    elements.resultCorrect.textContent = `${run.correct}/10`;
    elements.resultScore.textContent = format.format(run.roundScore);
    elements.resultXp.textContent = `+${format.format(xpEarned)}`;
    elements.resultReward.textContent = `+${format.format(reward)}`;
    elements.startBalance.textContent = `${format.format(run.startBalance)} GEEK`;
    elements.fees.textContent = `${format.format(run.fees)} GEEK`;
    elements.rewards.textContent = `${format.format(run.rewards)} GEEK`;
    const profit = run.rewards - run.fees;
    elements.profit.textContent = `${profit >= 0 ? '+' : ''}${format.format(profit)} GEEK`;
    elements.runProgress.style.width = `${run.round * 10}%`;

    if (run.round === 10) {
      elements.continueButton.disabled = false;
      elements.continueButton.innerHTML = 'Claim Apex Status <span>→</span>';
      elements.entryWarning.textContent = 'All ten rounds cleared. The Apex Protocol is open.';
    } else {
      const next = ROUND_CONFIG[run.round];
      const canAfford = profile.balance >= next.entry;
      elements.continueButton.disabled = !canAfford;
      elements.continueButton.innerHTML = `Continue to Round ${pad(next.round)} <span>→</span>`;
    elements.entryWarning.textContent = canAfford
        ? `Next entry: ${format.format(next.entry)} Alpha GEEK · Max reward: ${format.format(next.max)}`
        : `You need ${format.format(next.entry - profile.balance)} more Alpha GEEK to enter Round ${pad(next.round)}.`;
    }

    renderRoundReview();

    showScreen('result');
  };

  const continueRun = () => {
    if (!run) return;
    if (run.round === 10) {
      finishGauntlet();
      return;
    }
    run.round += 1;
    startRound();
  };

  const cashOut = () => {
    if (run) profile.totalRuns += 1;
    saveProfile();
    run = null;
    showScreen('start');
  };

  const showStartAfterRun = (message) => {
    profile.totalRuns += 1;
    saveProfile();
    run = null;
    elements.localNote.innerHTML = `<b>Run closed:</b> ${message} Your saved local balance is ${format.format(profile.balance)} Alpha GEEK.`;
    showScreen('start');
  };

  const finishGauntlet = () => {
    profile.totalRuns += 1;
    saveProfile();
    elements.finalScore.textContent = format.format(run.totalScore);
    elements.completeMessage.textContent = `You cleared 100 ${CATEGORY_BANKS[run.category].shortName} questions and closed the run with ${format.format(profile.balance)} Alpha GEEK on this device.`;
    showScreen('complete');
  };

  const resetProgress = () => {
    if (!window.confirm('Reset your local XP, Alpha GEEK balance, career stats, and best round?')) return;
    clearTimer();
    profile = { balance: 0, xp: 0, bestRound: 0, bestScore: 0, totalRuns: 0, totalCorrect: 0 };
    run = null;
    localStorage.removeItem(STORAGE_KEY);
    updateProfileUI();
    showScreen('start');
  };

  elements.startButton.addEventListener('click', startNewRun);
  elements.categoryButtons.forEach((button) => button.addEventListener('click', () => loadQuestionBank(button.dataset.categoryKey)));
  $('[data-new-run]').addEventListener('click', startNewRun);
  $('[data-continue]').addEventListener('click', continueRun);
  $('[data-cashout]').addEventListener('click', cashOut);
  $('[data-quit]').addEventListener('click', () => {
    if (!run || !window.confirm('End this run? Your earned Alpha GEEK and XP stay saved.')) return;
    clearTimer();
    profile.totalRuns += 1;
    saveProfile();
    run = null;
    elements.localNote.innerHTML = '<b>Run closed:</b> Your local Alpha GEEK and XP were saved on this device.';
    showScreen('start');
  });
  $('[data-reset]').addEventListener('click', resetProgress);
  $('[data-how]').addEventListener('click', () => elements.rules.showModal());
  $$('[data-close]').forEach((button) => button.addEventListener('click', () => elements.rules.close()));
  elements.rules.addEventListener('click', (event) => {
    if (event.target === elements.rules) elements.rules.close();
  });

  document.addEventListener('keydown', (event) => {
    if (!$('[data-screen="quiz"]').classList.contains('active') || locked) return;
    const index = Number(event.key) - 1;
    if (index >= 0 && index < 4) $('.answer[data-answer="' + index + '"]', elements.answers)?.click();
  });

  function difficultyForRound(round) {
    if (round <= 3) return 'easy';
    if (round <= 7) return 'medium';
    return 'hard';
  }

  function displayTopic(topic) {
    return topic === 'KRC-20 & Smart Contracts' ? 'Tokens & Programmability' : topic;
  }

  function renderRoundReview() {
    elements.roundReview.innerHTML = run.roundAnswers.map((item, index) => {
      const result = item.correct ? 'Correct' : `${item.selected === 'No answer' ? 'No answer' : `Your answer: ${item.selected}`} · Correct: ${item.answer}`;
      const source = item.source
        ? `<a href="${escapeHtml(item.source)}" target="_blank" rel="noreferrer">Open source ↗</a>`
        : '<span>No source recorded</span>';
      return `<li class="${item.correct ? 'correct-review' : 'wrong-review'}"><div><b>${index + 1}. ${escapeHtml(item.prompt)}</b><small>${escapeHtml(result)} · ${escapeHtml(item.sourceState)}</small></div>${source}</li>`;
    }).join('');
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
  }

  function selectRoundQuestions(tier, excludedIds) {
    const excluded = new Set(excludedIds);
    const pool = shuffle(QUESTIONS.filter((question) => question.difficulty === tier && !excluded.has(question.id)));
    const focusTerms = requestedFocus === 'ghostdag'
      ? ['ghostdag', 'consensus', 'blockdag']
      : requestedFocus === 'builders'
        ? ['toccata', 'programmability', 'developer', 'covenant', 'toolchain']
        : [];
    const selected = [];
    const addUnique = (question) => {
      if (question && !selected.some((item) => item.id === question.id)) selected.push(question);
    };
    if (focusTerms.length) {
      shuffle(pool.filter((question) => focusTerms.some((term) => `${question.topic} ${question.tags.join(' ')}`.toLowerCase().includes(term)))).slice(0, 4).forEach(addUnique);
    }
    shuffle(pool.filter((question) => question.priority)).slice(0, 2).forEach(addUnique);
    const bySubcategory = new Map();
    pool.forEach((question) => {
      if (!bySubcategory.has(question.topic)) bySubcategory.set(question.topic, []);
      bySubcategory.get(question.topic).push(question);
    });

    shuffle([...bySubcategory.values()]).forEach((group) => {
      if (group.length && selected.length < 8) addUnique(group[0]);
    });
    const selectedIds = new Set(selected.map((question) => question.id));
    selected.push(...pool.filter((question) => !selectedIds.has(question.id)).slice(0, 10 - selected.length));
    return shuffle(selected);
  }

  const loadQuestionBank = async (categoryKey = 'kaspa') => {
    const config = CATEGORY_BANKS[categoryKey];
    if (!config || run) return;
    const request = ++loadRequest;
    activeCategory = categoryKey;
    QUESTIONS = [];
    elements.categoryButtons.forEach((button) => {
      const selected = button.dataset.categoryKey === categoryKey;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-checked', String(selected));
    });
    elements.selectedMode.textContent = config.name;
    elements.modeDetail.textContent = `${format.format(config.count)} practice items · ${config.detail}`;
    elements.bankStatus.textContent = 'LOADING';
    elements.startButton.disabled = true;
    elements.startButton.textContent = `Loading ${config.shortName} Bank`;

    try {
      let bank = BANK_CACHE.get(categoryKey);
      if (!bank) {
        const response = await fetch(`./assets/${config.file}`, { cache: 'force-cache' });
        if (!response.ok) throw new Error('Question bank request failed');
        bank = await response.json();
        if (config.supplement) {
          const supplementResponse = await fetch(`./assets/${config.supplement}`, { cache: 'force-cache' });
          if (!supplementResponse.ok) throw new Error('Question supplement request failed');
          const supplement = await supplementResponse.json();
          bank = { ...bank, questions: [...bank.questions, ...supplement.questions] };
        }
        BANK_CACHE.set(categoryKey, bank);
      }
      if (request !== loadRequest) return;
      if (!Array.isArray(bank.questions) || bank.questions.length !== config.count) throw new Error('Question bank count is invalid');

      QUESTIONS = bank.questions.map((question) => ({
        id: question.id,
        category: question.category,
        topic: question.subcategory || question.category,
        difficulty: question.difficulty,
        prompt: question.prompt,
        options: question.options,
        answer: question.options[question.correctIndex],
        funFact: question.funFact,
        source: question.source,
        volatile: Boolean(question.volatile),
        priority: Boolean(question.priority),
        tags: Array.isArray(question.tags) ? question.tags : []
      }));

      const valid = QUESTIONS.every((question) =>
        question.id && question.prompt && question.category && question.topic &&
        ['easy', 'medium', 'hard'].includes(question.difficulty) &&
        Array.isArray(question.options) && question.options.length === 4 &&
        question.options.includes(question.answer)
      );
      if (!valid) throw new Error('Question bank schema is invalid');

      elements.bankStatus.textContent = config.sourced ? 'SOURCE-LINKED' : 'READY';
      elements.startButton.disabled = false;
      elements.startButton.innerHTML = 'Start Round 01 <span>→</span>';
      elements.localNote.innerHTML = config.sourced
        ? `<b>Kaspa review layer:</b> 1,000 practice variants across 80 core concepts plus 32 priority questions reviewed against primary sources on September 5, 2026.`
        : `<b>Draft practice bank:</b> ${config.shortName} contains 1,000 playable items and still requires full editorial review before any production reward use.`;
    } catch {
      if (request !== loadRequest) return;
      elements.bankStatus.textContent = 'ERROR';
      elements.startButton.disabled = true;
      elements.startButton.textContent = 'Question bank unavailable';
      elements.localNote.innerHTML = `<b>Load error:</b> The ${config.shortName} question bank could not be opened. Choose another category or refresh the page.`;
    }
  };

  updateProfileUI();
  const requestedCategory = queryParams.get('category');
  loadQuestionBank(CATEGORY_BANKS[requestedCategory] ? requestedCategory : 'kaspa');
})();
