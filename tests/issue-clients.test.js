import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json, aborted } from './helpers/client-fixture.js';
import { handleApiError } from '../server/http.js';
import { firstSignal, getChapter, checksFor } from '../public/quest/assets/chapter.js';
import { campaignCards, campaignSummary } from '../public/quest/assets/campaign.js';
import { decodeQuest, questView } from '../server/quest.js';
const read = path => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const tick = () => new Promise(setImmediate);

test('lobby errors give distinct safe next steps without leaking provider messages', async () => {
  const source = read('public/lobby/assets/lobby.js');
  const ui = clientFixture(async () => json({ code: 'ROOM_FULL', error: 'private provider detail' }, 409));
  ui.run(source.slice(source.indexOf('  const roomError ='), source.indexOf('  const escapeHtml =')) + ';globalThis.requestRoom=api;');
  await assert.rejects(ui.context.requestRoom('/api/lobbies'), /room is full.*another room/);
  for (const [code, pattern] of [['ROOM_FULL', /room is full/], ['ROOM_NOT_FOUND', /room has closed/]]) {
    let output;
    handleApiError({ status() { return this; }, json(value) { output = value; } }, new Error(code));
    assert.equal(output.code, code); assert.match(ui.context.requestRoom ? output.error : '', /lobby/);
    const next = clientFixture(async () => json({ ...output, error: '<private provider failure>' }, 409));
    next.run(source.slice(source.indexOf('  const roomError ='), source.indexOf('  const escapeHtml =')) + ';globalThis.requestRoom=api;');
    await assert.rejects(next.context.requestRoom('/api/lobbies'), pattern);
  }
  const broken = clientFixture(async (path, options) => aborted(options.signal));
  broken.run(source.slice(source.indexOf('  const roomError ='), source.indexOf('  const escapeHtml =')) + ';globalThis.requestRoom=api;');
  const pending = broken.context.requestRoom('/api/lobbies'); await tick(); broken.expire();
  await assert.rejects(pending, /Refresh rooms to reconnect/);
});

test('Duel initial loading times out after six seconds and permits an explicit retry', async () => {
  let stalled = true, calls = 0;
  const ui = clientFixture(async (path, options) => { calls++; return stalled ? aborted(options.signal) : json({ player: { name: 'Test Guest' } }); });
  const form = ui.node('[data-create-form]'); form.elements = { displayName: ui.make('input'), opponent: { value: 'player' } };
  ui.context.location.search = '';
  ui.run(read('public/duel/assets/duel.js').replace(/^import .*;\n/gm, ''));
  assert.equal(ui.node('[data-initial-loading]').hidden, false);
  await tick(); ui.expire(6000); await tick();
  assert.match(ui.node('[data-message]').textContent, /Still loading.*Retry connection/);
  assert.equal(ui.node('[data-retry-service]').hidden, false);
  assert.equal(ui.node('[data-initial-loading]').hidden, true);
  stalled = false; await ui.node('[data-retry-service]').emit('click');
  assert.equal(calls, 2); assert.match(ui.node('[data-message]').textContent, /player is connected/);
  assert.equal(ui.node('[data-retry-service]').hidden, true);
});

test('Practice marks a pending choice immediately without accepting a second answer', async () => {
  const wait = deferred(), bodies = [];
  const practice = { id: 'test-practice', used: {}, question: { token: 'one', number: 1, options: ['A','B'], removed: [], prompt: 'Test question', expiresAt: 15000, serverNow: 0 } };
  const ui = clientFixture(async (path, options) => { const body = JSON.parse(options.body); bodies.push(body); return body.action === 'answer' ? wait.promise : json({ ok: true, practice }); }, { clearInterval() {}, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } });
  ui.run(read('public/practice/assets/practice.js'));
  await ui.node('[data-start]').emit('click');
  assert.equal(ui.node('[data-error-message]').textContent, '');
  const buttons = ui.node('[data-answers]').children;
  const pending = buttons[1].emit('click');
  assert.equal(buttons[1].getAttribute('aria-pressed'), 'true'); assert.ok(buttons.every(b => b.disabled));
  await buttons[0].emit('click'); assert.equal(bodies.filter(b => b.action === 'answer').length, 1);
  wait.resolve(json({ ok: true, practice: { ...practice, question: null, finished: true, correct: 1, answered: 1, feedback: { correct: true, answer: 'B', explanation: 'Test feedback', source: 'https://example.org/' } } })); await pending;
  assert.equal(ui.node('[data-question-panel]').hidden, true);
});


test('Quest marks an answer pending before the server replies and blocks duplicate writes', async () => {
  const wait = deferred(), writes = [];
  const quest = { ...questView(decodeQuest('')), revision: 1, attempt: { id: 'a'.repeat(32), token: 'b'.repeat(32), status: 'question', index: 0, sceneIndex: 0, answered: 0, correct: 0 }, question: { prompt: 'Test prompt', options: ['A', 'B'] } };
  const ui = clientFixture(async (path, options) => {
    if (path === '/api/session') return json({ player: { name: 'Tester' } });
    if (path === '/api/collectibles') return json({ collection: {} });
    if (path.includes('campaign=1')) return json({ campaign: { chapters: [] } });
    if (options.body) { writes.push(JSON.parse(options.body)); return wait.promise; }
    return json({ quest });
  }, { firstSignal, getChapter, checksFor, campaignCards, campaignSummary, defaultGeek: {}, geekSvg: () => '', geekDescription: () => '' });
  ui.context.location.search = '';
  ui.run(read('public/quest/assets/quest.js').replace(/^import .*;\n/gm, '')); await tick(); await tick();
  const button = ui.node('[data-answers]').children[1];
  await ui.node('[data-answers]').emit('click', { target: button });
  assert.equal(button.getAttribute('aria-pressed'), 'true'); assert.equal(button.disabled, true);
  await ui.node('[data-answers]').emit('click', { target: button }); assert.equal(writes.length, 1);
  wait.resolve(json({ quest: { ...quest, revision: 2, attempt: { ...quest.attempt, status: 'lesson', token: 'c'.repeat(32) } } })); await tick();
});
