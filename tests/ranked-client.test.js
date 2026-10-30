import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, aborted, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/play/assets/game.js', import.meta.url), 'utf8');
const id = 'a'.repeat(40), key = 'geek_hq_ranked_run_v1';
const profile = { xp: 60, balance: 0, bestRound: 0, bestScore: 0, totalRuns: 0, progression: { level: 1, prestige: 0 } };
const state = (status = 'question') => ({ ok: true, profile, run: { id, mode: 'daily', category: 'kaspa', round: 1, completedRound: status === 'question' ? 0 : 1, questionIndex: 0, questionCount: 5, maxRounds: 1, correct: 1, streak: 1, totalScore: status === 'question' ? 0 : 1500, roundScore: 1500, startBalance: 0, fees: 0, rewards: 0, status, answeredReview: [{ prompt: 'A graded question', selected: 'One', answer: 'One', correct: true, sourceState: 'Reviewed' }] }, question: status === 'question' ? { token: 'synthetic-token', number: 1, prompt: 'A learning question', options: ['One', 'Two', 'Three', 'Four'], topic: 'Kaspa', difficulty: 'easy', sourceState: 'SOURCE-REVIEWED', expiresAt: Date.now() + 15000, serverNow: Date.now(), durationMs: 15000 } : null,
  result: { correct: true, answer: 'One', correctIndex: 0, streak: 1, scoreAdded: 1500 }, roundResult: status === 'between-rounds' ? { correct: 1, answered: 5, roundScore: 1500, xpEarned: 60, reward: 0, label: 'DAILY SIGNAL' } : null });
const page = async (intercept = () => undefined, saved = null, preset = {}) => {
  const storage = new Map([...(saved ? [[key, saved]] : []), ...Object.entries(preset)]), requests = [];
  const ui = clientFixture(async (path, options = {}) => {
    const body = options.body && JSON.parse(options.body); requests.push({ path, body });
    const response = intercept(path, options, body); if (response !== undefined) return response;
    if (path.startsWith('/api/leaderboard')) return json({ entries: [] });
    if (path === '/api/session') return json({ ok: true });
    if (!body) return json({ profile });
    return json(state());
  }, { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
  ui.window.location = { search: '?mode=daily' }; ui.window.GEEK_QUESTION_COUNTS = { kaspa: 100 };
  ui.window.scrollTo = () => {}; ui.window.confirm = () => true;
  ui.window.setTimeout = ui.context.setTimeout; ui.window.clearTimeout = ui.context.clearTimeout;
  ui.window.setInterval = () => 1; ui.window.clearInterval = () => {};
  const screens = ['start', 'quiz', 'result', 'complete'].map(name => { const n = ui.node(`[data-screen="${name}"]`); const classes = new Set(); n.classList = { toggle(k, value) { value ? classes.add(k) : classes.delete(k); }, contains: k => classes.has(k) }; return n; });
  const all = ui.document.querySelectorAll;
  ui.document.querySelectorAll = selector => selector === '.screen' ? screens : all(selector);
  const answers = ui.node('[data-answers]'); let markup = '', buttons = [];
  Object.defineProperty(answers, 'innerHTML', { get: () => markup, set: value => { markup = value; buttons = [...value.matchAll(/data-answer="(\d)"/g)].map(match => { const button = ui.make('button'); button.dataset.answer = match[1]; button.classList.add = () => {}; return button; }); } });
  answers.querySelectorAll = selector => selector === '.answer' ? buttons : [];
  ui.run(source.replace('  initialize();\n})();', '  globalThis.actions = { startNewRun, answerQuestion, nextQuestion, reconnectRun, finishRun, loadLeaderboard }; globalThis.startup = initialize();\n})();'));
  await ui.context.startup; return { ...ui, requests, storage };
};

test('a lost start reply stores only a recovery pointer and reconnects without a second start', async () => {
  const ui = await page((path, options, body) => body?.action === 'start' ? Promise.reject(new TypeError('Reply lost')) : path.includes('resume=1') ? json(state()) : undefined);
  await ui.context.actions.startNewRun(); assert.equal(ui.storage.get(key), 'pending');
  assert.equal(ui.node('[data-ranked-recovery]').hidden, false); assert.equal(ui.node('[data-start]').disabled, true);
  assert.equal(ui.document.activeElement, ui.node('[data-ranked-recovery]'));
  await ui.context.actions.reconnectRun(); assert.equal(ui.storage.get(key), id);
  assert.equal(ui.requests.filter(r => r.body?.action === 'start').length, 1);
  assert.equal(ui.node('[data-question]').textContent, 'A learning question');
});

test('an unconfirmed answer locks writes; read-only reconnect offers a manual next action', async () => {
  const ui = await page((path, options, body) => body?.action === 'answer' ? Promise.reject(new TypeError('Reply lost')) : path.includes('runId=') ? json(state('awaiting-next')) : undefined);
  await ui.context.actions.startNewRun(); await ui.context.actions.answerQuestion(0); await ui.context.actions.answerQuestion(1);
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
  await ui.context.actions.reconnectRun(); assert.equal(ui.node('[data-ranked-next]').hidden, false);
  assert.match(ui.node('[data-feedback]').textContent, /Your answer was correct/);
  assert.equal(ui.requests.filter(r => r.body?.action === 'next').length, 0);
});

test('recovered round review and finish preserve one score and a saved-progress destination', async () => {
  const ui = await page((path, options, body) => path.includes('runId=') ? json(state('between-rounds')) : body?.action === 'finish' ? json({ ...state('finished'), leaderboard: { entries: [] } }) : undefined, id);
  await ui.context.actions.reconnectRun(); assert.match(ui.node('[data-round-review]').innerHTML, /A graded question/);
  await ui.context.actions.finishRun(true); assert.equal(ui.node('[data-final-score]').textContent, '1,500'); assert.equal(ui.storage.has(key), false);
});

test('an expired saved run enables a new run after the server confirms it is absent', async () => {
  const ui = await page(path => path.includes('runId=') ? json({ error: 'Run expired.' }, 404) : undefined, id);
  await ui.context.actions.reconnectRun(); assert.equal(ui.storage.has(key), false); assert.equal(ui.node('[data-start]').disabled, false);
  await ui.context.actions.startNewRun(); assert.equal(ui.requests.filter(r => r.body?.action === 'start').length, 1);
});

test('repeated next and reconnect clicks do not duplicate pending requests', async () => {
  const next = deferred();
  const ui = await page((path, options, body) => body?.action === 'next' ? next.promise : path.includes('runId=') ? json(state('awaiting-next')) : undefined, id);
  await ui.context.actions.reconnectRun(); const pending = ui.context.actions.nextQuestion();
  await ui.context.actions.nextQuestion(); await ui.context.actions.reconnectRun();
  assert.equal(ui.requests.filter(r => r.body?.action === 'next').length, 1);
  next.resolve(json(state())); await pending;
});

test('a stalled answer response body times out and offers recovery without repeating its mutation', async () => {
  const ui = await page((path, options, body) => body?.action === 'answer' ? { ok: true, json: () => aborted(options.signal) } : undefined);
  await ui.context.actions.startNewRun(); const pending = ui.context.actions.answerQuestion(0); await new Promise(resolve => setImmediate(resolve)); ui.expire(); await pending;
  assert.match(ui.node('[data-ranked-recovery-status]').textContent, /too long/);
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
});


test('deferred answer recovery confirms saving without inventing correctness', async () => {
  const pending = state('awaiting-next');
  pending.run.feedback = 'deferred'; pending.run.answeredReview = [];
  for (const field of ['correct', 'streak', 'roundScore']) delete pending.run[field];
  pending.result = { feedback: 'deferred', recorded: true, timedOut: false, locked: false };
  const ui = await page(path => path.includes('runId=') ? json(pending) : undefined, id);
  await ui.context.actions.reconnectRun();
  assert.equal(ui.node('[data-feedback]').textContent, 'Answer saved — results after the round.');
  assert.equal(ui.node('[data-ranked-next]').hidden, false);
  assert.equal(ui.requests.filter(r => r.body?.action === 'next').length, 0);
});

test('Play loads the current season after reload and labels historical boards', async () => {
  const ui = await page(path => path.startsWith('/api/leaderboard') ? json({ entries: [], seasonLabel: new URL(path, 'https://example.test').searchParams.get('season') === 'legacy' ? 'Season 0 — Public-bank Alpha' : 'Season 1 — Private-bank' }) : undefined);
  await ui.context.actions.loadLeaderboard();
  assert.match(ui.requests.at(-1).path, /season=current/);
  assert.equal(ui.node('[data-board-state]').textContent, 'Season 1 — Private-bank');
  ui.node('[data-board-season]').value = 'legacy';
  await ui.node('[data-board-season]').emit('change');
  assert.match(ui.requests.at(-1).path, /season=legacy/);
  assert.equal(ui.node('[data-board-state]').textContent, 'Season 0 — Public-bank Alpha');
});

test('an older leaderboard reply cannot replace a newly selected season', async () => {
  let stalled = false; const old = deferred();
  const ui = await page(path => path.startsWith('/api/leaderboard') ? stalled ? old.promise : json({ entries: [], seasonLabel: 'Season 1 — Private-bank' }) : undefined);
  stalled = true; const pending = ui.context.actions.loadLeaderboard();
  stalled = false; ui.node('[data-board-season]').value = 'season-1';
  await ui.node('[data-board-season]').emit('change');
  old.resolve(json({ entries: [], seasonLabel: 'Season 0 — Public-bank Alpha' })); await pending;
  assert.equal(ui.node('[data-board-state]').textContent, 'Season 1 — Private-bank');
});

test('Play remembers the season pick across reloads and drops picks the server does not list', async () => {
  const seasons = ['current', 'legacy', 'season-1'];
  const board = path => path.startsWith('/api/leaderboard') ? json({ entries: [], seasons, seasonLabel: 'x' }) : undefined;
  const ui = await page(board);
  ui.node('[data-board-season]').value = 'legacy';
  await ui.node('[data-board-season]').emit('change');
  const saved = 'legacy', storageKey = 'geek_hq_board_season_v1';
  assert.match(ui.requests.at(-1).path, /season=legacy/);
  const again = await page(board, null, { [storageKey]: saved });
  assert.equal(again.node('[data-board-season]').value, 'legacy');
  await again.context.actions.loadLeaderboard();
  assert.match(again.requests.at(-1).path, /season=legacy/);
  const stale = await page(board, null, { [storageKey]: 'season-9' });
  await stale.context.actions.loadLeaderboard();
  assert.match(stale.requests.at(-1).path, /season=current/);
  assert.equal(stale.node('[data-board-season]').value, 'current');
  assert.equal(stale.storage.has(storageKey), false);
});

test('deferred reconnect shows a neutral pending tally instead of 0 and 0x', async () => {
  for (const status of ['awaiting-next', 'question']) {
    const pending = state(status);
    pending.run.feedback = 'deferred'; pending.run.answeredReview = [];
    for (const field of ['correct', 'streak', 'roundScore', 'maxStreak']) delete pending.run[field];
    pending.result = { feedback: 'deferred', recorded: true, timedOut: false, locked: false };
    const ui = await page(path => path.includes('runId=') ? json(pending) : undefined, id);
    await ui.context.actions.reconnectRun();
    assert.equal(ui.node('[data-correct]').textContent, '—', status);
    assert.equal(ui.node('[data-streak]').textContent, '—', status);
  }
  const locked = state('between-rounds');
  const ui = await page(path => path.includes('runId=') ? json(locked) : undefined, id);
  await ui.context.actions.reconnectRun();
  assert.equal(ui.node('[data-correct]').textContent, '1');
  assert.equal(ui.node('[data-streak]').textContent, '1×');
});
