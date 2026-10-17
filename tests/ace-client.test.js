import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json, aborted } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/study/assets/ace.js', import.meta.url), 'utf8');
const setup = fetch => {
  const ui = clientFixture(fetch), root = ui.node('[data-ace]');
  for (const key of ['question','ask','consent','answer','evidence','sources','status','opt-in']) root.append(ui.node(`[data-ace-${key}]`));
  ui.node('[data-ace-question]').reportValidity = () => true;
  ui.node('[data-ace-question]').value = 'Why do blocks need an order?';
  ui.node('[data-lesson]').dataset.topic = 'blockdag'; ui.run(source); return { ...ui, root };
};
const answer = { ok: true, mode: 'lesson', answer: 'Read the ordering rule.', note: 'From the authored lesson.', evidence: [{ title: 'Order', text: 'Consensus orders the blocks.' }], sources: ['https://eprint.iacr.org/2018/104', 'javascript:alert(1)'] };
test('lesson help is available without AI consent; responses use plain text and safe sources', async () => {
  const requests = [], ui = setup(async (url, options) => { requests.push(options); return json(options.method === 'GET' ? { ok: true, aiAvailable: false } : answer); });
  ui.root.open = true; await ui.root.emit('toggle');
  assert.equal(ui.node('[data-ace-opt-in]').hidden, true);
  await ui.node('[data-ace-ask]').emit('click');
  assert.deepEqual(JSON.parse(requests[1].body), { topic: 'blockdag', question: 'Why do blocks need an order?', useAI: false });
  assert.equal(ui.node('[data-ace-answer]').textContent, answer.answer);
  assert.equal(ui.node('[data-ace-sources]').children.length, 1);
  assert.equal(ui.node('[data-ace-evidence]').children[0].textContent, 'Order: Consensus orders the blocks.');
  assert.equal(ui.node('[data-ace-ask]').disabled, false); assert.equal(ui.timers.size, 0);
});
test('AI use requires an available service and a separately checked opt-in', async () => {
  const requests = [], ui = setup(async (url, options) => { requests.push(options); return json(options.method === 'GET' ? { ok: true, aiAvailable: true } : answer); });
  ui.root.open = true; await ui.root.emit('toggle'); await ui.node('[data-ace-ask]').emit('click');
  assert.equal(JSON.parse(requests[1].body).useAI, false);
  ui.node('[data-ace-consent]').checked = true; await ui.node('[data-ace-ask]').emit('click');
  assert.equal(JSON.parse(requests[2].body).useAI, true);
});
test('topic changes clear questions, consent and old replies; an aborted request is never automatically repeated', async () => {
  const late = deferred(), ui = setup(() => late.promise);
  const pending = ui.node('[data-ace-ask]').emit('click');
  ui.window.dispatchEvent(new CustomEvent('geek:study-topic', { detail: { id: 'wallets' } }));
  assert.equal(ui.node('[data-ace-question]').value, ''); assert.equal(ui.node('[data-ace-consent]').checked, false);
  late.resolve(json(answer)); await pending;
  assert.equal(ui.node('[data-ace-answer]').textContent, '');
  let calls = 0; const stalled = setup((url, options) => { calls++; return aborted(options.signal); });
  const timed = stalled.node('[data-ace-ask]').emit('click'); stalled.expire(25000); await timed;
  assert.equal(calls, 1); assert.equal(stalled.node('[data-ace-question]').value, 'Why do blocks need an order?');
  assert.match(stalled.node('[data-ace-answer]').textContent, /took too long/); assert.equal(stalled.node('[data-ace-ask]').disabled, false);
});
