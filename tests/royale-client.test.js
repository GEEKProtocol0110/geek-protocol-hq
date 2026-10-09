import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/royale/assets/royale.js', import.meta.url), 'utf8');
const room = (extra = {}) => ({ id: 'a'.repeat(32), code: 'ROY-ABCDEFG2', category: 'kaspa', capacity: 4, state: 'question',
  serverNow: 1000, startsAt: 1000, questionNumber: 1, questionCount: 100, questionEndsAt: 16000, reviewEndsAt: 21000,
  isHost: true, yourSlot: 1, yourAnswer: null, canAnswer: true, canStart: false, remaining: 2,
  players: [{ slot: 1, name: 'Host', host: true, ready: true, online: true, alive: true }, { slot: 2, name: 'Guest', host: false, ready: true, online: true, alive: true }],
  question: { prompt: 'Synthetic learning check', options: ['One', 'Two', 'Three', 'Four'] }, review: null, result: null, ...extra });
const savedAnswer = () => room({ yourAnswer: { selectedIndex: 1 }, canAnswer: false });
const page = async (intercept = () => undefined, { search = '?code=ROY-ABCDEFG2', wait = true } = {}) => {
  const requests = [];
  const ui = clientFixture(async (path, options) => {
    const body = options.body && JSON.parse(options.body); requests.push({ path, body });
    const result = intercept(path, options, body); if (result !== undefined) return result;
    if (path === '/api/session') return json({ ok: true, player: { name: body?.displayName || 'Explorer' } });
    return json({ ok: true, royale: room() });
  }, { location: { search, pathname: '/royale/', href: `https://example.test/royale/${search}` } });
  const setup = ui.node('[data-setup]'), create = ui.node('[data-create-form]', 'form'), join = ui.node('[data-join-form]', 'form');
  create.elements = { displayName: { value: '' }, category: { value: 'kaspa' }, capacity: { value: '4' } };
  join.elements = { code: { value: '' } }; create.append(ui.make('button')); join.append(ui.make('button')); setup.append(create, join);
  ui.run(source.replace('  connect();\n})();', '  globalThis.startup = connect(); globalThis.actions = { act, connect, refresh, enter };\n})();'));
  if (wait) await ui.context.startup;
  return { ...ui, requests };
};

test('a rejected Royale answer reloads its saved lock once without repeating the write', async () => {
  let answered = false;
  const ui = await page((path, options, body) => {
    if (body?.action === 'answer') { answered = true; return json({ error: 'This answer is already locked.' }, 409); }
    if (answered && path.startsWith('/api/royale?')) return json({ ok: true, royale: savedAnswer() });
  });
  await ui.context.actions.act('answer', { questionNumber: 1, selectedIndex: 1 });
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
  assert.equal(ui.requests.filter(r => r.path.startsWith('/api/royale?')).length, 2);
  assert.match(ui.node('[data-answer-status]').textContent, /Answer locked/);
  assert.match(ui.node('[data-status]').textContent, /state has been reloaded/);
  assert.ok(ui.node('[data-answers]').querySelectorAll('button').every(b => b.disabled));
});

test('an unreadable room after rejection blocks mutations until manual read-only reconnect', async () => {
  let reads = 0;
  const ui = await page((path, options, body) => {
    if (body?.action === 'answer') return json({ error: 'Room authorization changed.' }, 403);
    if (path.startsWith('/api/royale?')) {
      reads++;
      if (reads === 2) return json({ error: 'Saved room unavailable.' }, 503);
      if (reads === 3) return json({ ok: true, royale: savedAnswer() });
    }
  });
  await ui.context.actions.act('answer', { questionNumber: 1, selectedIndex: 1 });
  assert.equal(ui.node('[data-reconnect]').hidden, false);
  assert.ok(ui.node('[data-answers]').querySelectorAll('button').every(b => b.disabled));
  await ui.context.actions.act('answer', { questionNumber: 1, selectedIndex: 2 });
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
  await ui.context.actions.connect();
  assert.match(ui.node('[data-answer-status]').textContent, /Answer locked/);
  assert.equal(ui.node('[data-reconnect]').hidden, true);
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
});

for (const failed of [false, true]) test(`a late ${failed ? 'failed' : 'successful'} Royale poll cannot undo a newer answer receipt`, async () => {
  const oldPoll = deferred(); let reads = 0;
  const ui = await page((path, options, body) => {
    if (path.startsWith('/api/royale?') && ++reads === 2) return oldPoll.promise;
    if (body?.action === 'answer') return json({ ok: true, royale: savedAnswer() });
  });
  const pending = ui.context.actions.refresh();
  await ui.context.actions.act('answer', { questionNumber: 1, selectedIndex: 1 });
  if (failed) oldPoll.reject(new TypeError('Old connection failed.')); else oldPoll.resolve(json({ ok: true, royale: room() }));
  await pending;
  assert.match(ui.node('[data-answer-status]').textContent, /Answer locked/);
  assert.equal(ui.node('[data-reconnect]').hidden, true);
  assert.equal(ui.requests.filter(r => r.body?.action === 'answer').length, 1);
});

test('an expired invitation keeps setup available and reconnect preserves the chosen display name', async () => {
  const ui = await page(path => path.startsWith('/api/royale?') ? json({ error: 'That invitation has expired.' }, 404) : undefined);
  assert.ok(ui.node('[data-setup]').querySelectorAll('button').every(b => !b.disabled));
  assert.match(ui.node('[data-error-text]').textContent, /expired/);
  assert.doesNotMatch(ui.node('[data-status]').textContent, /player could not connect/);
  ui.node('[data-create-form]').elements.displayName.value = 'Chosen Geek';
  await ui.context.actions.connect();
  assert.equal(ui.node('[data-create-form]').elements.displayName.value, 'Chosen Geek');
  assert.ok(ui.node('[data-setup]').querySelectorAll('button').every(b => !b.disabled));
});

test('a manually entered invitation can recover an accepted join after its reply was lost', async () => {
  let joined = false;
  const ui = await page((path, options, body) => {
    if (body?.action === 'join') { joined = true; return Promise.reject(new TypeError('Join reply lost.')); }
    if (joined && path.startsWith('/api/royale?')) return json({ ok: true, royale: room({ state: 'waiting', yourSlot: 2, isHost: false, question: null, canAnswer: false }) });
  }, { search: '' });
  ui.node('[data-join-form]').elements.code.value = 'roy-abcdefg2';
  await ui.context.actions.enter('join', { code: 'ROY-ABCDEFG2' });
  await ui.context.actions.connect();
  assert.equal(ui.requests.filter(r => r.body?.action === 'join').length, 1);
  assert.match(ui.requests.find(r => r.path.startsWith('/api/royale?')).path, /ROY-ABCDEFG2/);
  assert.equal(ui.node('[data-setup]').hidden, true);
  assert.equal(ui.node('[data-room-code]').textContent, 'ROY-ABCDEFG2');
});

test('repeated Royale reconnect clicks do not duplicate a pending session request', async () => {
  const reply = deferred();
  const ui = await page(path => path === '/api/session' ? reply.promise : undefined, { search: '', wait: false });
  await ui.context.actions.connect();
  assert.equal(ui.requests.filter(r => r.path === '/api/session').length, 1);
  assert.equal(ui.node('[data-error-retry]').disabled, true);
  ui.node('[data-create-form]').elements.displayName.value = 'Draft name';
  reply.resolve(json({ ok: true, player: { name: 'Saved name' } })); await ui.context.startup;
  assert.equal(ui.node('[data-create-form]').elements.displayName.value, 'Draft name');
  assert.equal(ui.node('[data-error-retry]').disabled, false);
});
