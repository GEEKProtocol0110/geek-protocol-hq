// Play client error UX: fixed client-side strings by status / failure type; server
// bodies and raw error messages are never rendered (and never via innerHTML).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, json } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/play/assets/game.js', import.meta.url), 'utf8');
const id = 'b'.repeat(40), key = 'geek_hq_ranked_run_v1';
const profile = { xp: 60, balance: 0, bestRound: 0, bestScore: 0, totalRuns: 0, progression: { level: 1, prestige: 0 } };
const state = (status = 'question', mode = 'daily') => ({ ok: true, profile, run: { id, mode, category: 'kaspa', round: 1, completedRound: status === 'question' ? 0 : 1, questionIndex: 0, questionCount: 5, maxRounds: 1, correct: 1, streak: 1, totalScore: status === 'question' ? 0 : 1500, roundScore: 1500, startBalance: 0, fees: 0, rewards: 0, status, answeredReview: [{ prompt: 'A graded question', selected: 'One', answer: 'One', correct: true, sourceState: 'Reviewed' }] }, question: status === 'question' ? { token: 'synthetic-token', number: 1, prompt: 'A learning question', options: ['One', 'Two', 'Three', 'Four'], topic: 'Kaspa', difficulty: 'easy', sourceState: 'SOURCE-REVIEWED', expiresAt: Date.now() + 15000, serverNow: Date.now(), durationMs: 15000 } : null,
  result: { correct: true, answer: 'One', correctIndex: 0, streak: 1, scoreAdded: 1500 }, roundResult: status === 'between-rounds' ? { correct: 1, answered: 5, roundScore: 1500, xpEarned: 60, reward: 0, label: 'DAILY SIGNAL' } : null });
const HTML_502 = '<!doctype html><html><head><title>502 Bad Gateway</title></head><body><h1>Bad Gateway</h1><script>alert(1)</script></body></html>';
const html = (status = 502) => new Response(HTML_502, { status, headers: { 'content-type': 'text/html' } });
const page = async (intercept = () => undefined, preset = {}, { online = true } = {}) => {
  const storage = new Map(Object.entries(preset)), requests = [];
  const ui = clientFixture(async (path, options = {}) => {
    const body = options.body && JSON.parse(options.body); requests.push({ path, body });
    const response = await intercept(path, options, body); if (response !== undefined) return response;
    if (path.startsWith('/api/leaderboard')) return json({ entries: [] });
    if (path === '/api/session') return json({ ok: true });
    if (!body) return json({ profile });
    return json(state());
  }, { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
  ui.context.navigator.onLine = online;
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
const visibleText = ui => ['[data-ranked-recovery-status]', '[data-feedback]', '[data-entry-warning]', '.local-note', '[data-start]', '[data-bank-status]', '[data-gauntlet-setup]']
  .map(s => `${ui.node(s).textContent}\n${ui.node(s).innerHTML}`).join('\n');
const assertNoRawError = (ui, extra = []) => {
  const text = visibleText(ui);
  for (const bad of ['<!doctype', '<html', 'Bad Gateway', '<script', 'alert(1)', 'Unexpected token', 'JSON', 'Failed to fetch', 'TypeError', ...extra]) assert.equal(text.includes(bad), false, `rendered ${bad}`);
};

test('an HTML 502 during startup is not rendered; the notice is expanded and the front-door CTA disabled', async () => {
  const ui = await page(path => path === '/api/ranked' ? html(502) : undefined);
  assertNoRawError(ui);
  assert.match(ui.node('.local-note').textContent, /Ranked service unavailable: The game service hit a problem/);
  assert.equal(ui.node('[data-bank-status]').textContent, 'OFFLINE');
  assert.equal(ui.node('[data-start]').disabled, true);
  assert.equal(ui.node('#timed-games').open, true, 'outage notice section expanded');
  assert.equal(ui.node('[data-gauntlet-setup]').disabled, true, 'Play the Gauntlet CTA disabled');
  assert.match(ui.node('[data-gauntlet-setup]').textContent, /unavailable/);
});

test('an HTML 503 on answer shows a fixed message, not the body or a parse error', async () => {
  const ui = await page((path, options, body) => body?.action === 'answer' ? html(503) : undefined);
  await ui.context.actions.startNewRun(); await ui.context.actions.answerQuestion(0);
  assertNoRawError(ui);
  assert.match(ui.node('[data-ranked-recovery-status]').textContent, /^The game service is temporarily unavailable\. Try again shortly\. Your answer has not been confirmed/);
});

test('server-provided error text is never displayed, even for JSON errors', async () => {
  const hostile = '<img src=x onerror=alert(1)> server said something';
  const ui = await page((path, options, body) => body?.action === 'start' ? json({ ok: false, error: hostile, code: 'WHATEVER' }, 409) : undefined);
  await ui.context.actions.startNewRun();
  assertNoRawError(ui, ['<img', 'server said']);
  assert.match(ui.node('.local-note').textContent, /^Could not start: That action is not available right now/);
});

test('going offline while the next question loads shows a friendly offline message with reconnect', async () => {
  let offline = false;
  const ui = await page((path, options, body) => {
    if (offline) return Promise.reject(new TypeError('Failed to fetch'));
    if (path.includes('runId=')) return json(state('question'));
    if (body?.action === 'answer') return json({ ...state('awaiting-next'), result: { feedback: 'deferred', recorded: true, timedOut: false, locked: false } });
    return undefined;
  });
  await ui.context.actions.startNewRun(); await ui.context.actions.answerQuestion(0);
  offline = true; ui.context.navigator.onLine = false;
  await ui.context.actions.nextQuestion();
  assertNoRawError(ui);
  assert.equal(ui.node('[data-ranked-recovery-status]').textContent, 'You appear to be offline. Check your connection, then reconnect to continue.');
  assert.equal(ui.node('[data-ranked-reconnect]').hidden, false, 'retry is offered');
  // Back online: reconnect recovers the run.
  offline = false; ui.context.navigator.onLine = true;
  await ui.context.actions.reconnectRun();
  assert.equal(ui.node('[data-ranked-recovery]').hidden, true);
});

test('a network failure while online uses the generic unreachable message', async () => {
  const ui = await page((path, options, body) => body?.action === 'next' ? Promise.reject(new TypeError('Failed to fetch')) : body?.action === 'answer' ? json({ ...state('awaiting-next'), result: { feedback: 'deferred', recorded: true } }) : undefined);
  await ui.context.actions.startNewRun(); await ui.context.actions.answerQuestion(0); await ui.context.actions.nextQuestion();
  assertNoRawError(ui);
  assert.match(ui.node('[data-ranked-recovery-status]').textContent, /could not be reached/);
});

test('a 500 on run start then Reconnect says no run was started, not that it expired', async () => {
  const ui = await page((path, options, body) => body?.action === 'start' ? html(500) : path.includes('resume=1') ? json({ ok: false, code: 'RUN_NOT_FOUND', error: 'That ranked run expired or is no longer active.' }, 404) : undefined);
  await ui.context.actions.startNewRun();
  assertNoRawError(ui);
  assert.equal(ui.storage.get(key), 'pending');
  await ui.context.actions.reconnectRun();
  const status = ui.node('[data-ranked-recovery-status]').textContent;
  assert.match(status, /No run was started/); assert.doesNotMatch(status, /expired/);
  assert.equal(ui.storage.has(key), false); assert.equal(ui.node('[data-start]').disabled, false, 'a new run can start');
});

test('a saved run that is gone on the server still reports it expired', async () => {
  const ui = await page(path => path.includes('runId=') ? json({ ok: false, code: 'RUN_NOT_FOUND' }, 404) : undefined, { [key]: id });
  await ui.context.actions.reconnectRun();
  assert.match(ui.node('[data-ranked-recovery-status]').textContent, /expired or is no longer active/);
});

test('reconnecting a Speed run shows the Speed note, not the Gauntlet Alpha note', async () => {
  const ui = await page(path => path.includes('runId=') ? json(state('question', 'speed')) : undefined, { [key]: id });
  ui.window.location = { search: '' };
  await ui.context.actions.reconnectRun();
  const note = ui.node('.local-note').innerHTML + ui.node('.local-note').textContent;
  assert.doesNotMatch(note, /Alpha play/); assert.match(note, /Quick mode/);
  assert.match(ui.node('[data-selected-mode]').textContent, /Speed/i);
});
