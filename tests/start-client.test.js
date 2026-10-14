import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/start/assets/start.js', import.meta.url), 'utf8');
const page = (initial = {}, blocked = false) => {
  const storage = new Map(Object.entries(initial));
  const ui = clientFixture(() => { throw new Error('The checklist must not write server progress'); }, { localStorage: { getItem: k => storage.get(k) ?? null, setItem(k, v) { if (blocked) throw new Error('Storage blocked'); storage.set(k, v); } } });
  const boxes = ['account', 'geek', 'learn', 'play', 'progress'].map(id => { const box = ui.make('input'); box.dataset.stepCheck = id; return box; });
  ui.run(source); return { ...ui, boxes, storage };
};
test('the old Mini checklist migrates only learning and customization, leaving HQ play unchecked', () => {
  const ui = page({ geek_start_checklist_v1: JSON.stringify(['learn', 'geek', 'play', 'unknown']) });
  assert.deepEqual(ui.boxes.map(b => b.checked), [false, true, true, false, false]);
  assert.equal(ui.node('[data-start-next]').href, '#step-account'); assert.equal(ui.node('[data-start-progress]').value, 2);
});
test('all five steps and reset save only a local checklist', async () => {
  const ui = page(); ui.boxes.forEach(box => { box.checked = true; }); await ui.boxes[4].emit('change');
  assert.equal(ui.node('[data-start-next]').href, '/profile/'); assert.equal(JSON.parse(ui.storage.get('geek_start_checklist_v2')).length, 5);
  await ui.node('[data-start-reset]').emit('click'); assert.ok(ui.boxes.every(box => !box.checked)); assert.equal(ui.node('[data-start-progress]').value, 0);
});
test('blocked checklist storage keeps the current visit usable and announces the limitation', async () => {
  const ui = page({}, true); ui.boxes[0].checked = true; await ui.boxes[0].emit('change');
  assert.equal(ui.node('[data-start-next]').href, '#step-geek'); assert.match(ui.node('[data-storage-note]').textContent, /could not save/);
});
const signIn = async search => {
  const ui = clientFixture(async () => json({ identity: { linked: false } }), { location: { search } });
  for (const selector of ['[data-address-form]', '[data-signature-form]']) ui.node(selector).append(ui.make('button'));
  ui.node('[data-sign-in-hq]').href = '/profile/'; ui.node('[data-sign-in-continue]').href = '/profile/';
  ui.run(readFileSync(new URL('../public/sign-in/assets/sign-in.js', import.meta.url), 'utf8')); await new Promise(resolve => setImmediate(resolve)); return ui;
};
test('the first-visit guest and signed-in destinations return to the Geek step', async () => {
  const ui = await signIn('?next=start'); assert.equal(ui.node('[data-sign-in-hq]').href, '/start/#step-geek'); assert.equal(ui.node('[data-sign-in-continue]').href, '/start/#step-geek');
});
test('an arbitrary next URL never becomes a sign-in redirect', async () => {
  const ui = await signIn('?next=https%3A%2F%2Fexample.invalid'); assert.equal(ui.node('[data-sign-in-hq]').href, '/profile/'); assert.equal(ui.node('[data-sign-in-continue]').href, '/profile/');
});
test('mobile sign-in and guest choices return to an allowlisted activity without auto-starting a game', async () => {
  for (const [next, path] of [['study', '/study/'], ['play', '/play/#timed-games'], ['royale', '/royale/'], ['quest', '/quest/']]) {
    const ui = await signIn('?next=' + next);
    assert.equal(ui.node('[data-sign-in-hq]').href, path);
    assert.equal(ui.node('[data-sign-in-continue]').href, path);
  }
  for (const next of ['__proto__', 'constructor', '//evil.invalid', 'javascript:alert(1)']) assert.equal((await signIn('?next=' + encodeURIComponent(next))).node('[data-sign-in-continue]').href, '/profile/');
});
test('the guest action precedes wallet setup and game pages carry their return intent', () => {
  const html = readFileSync(new URL('../public/sign-in/index.html', import.meta.url), 'utf8');
  assert.ok(html.indexOf('data-sign-in-continue') < html.indexOf('data-wallet-root'));
  for (const page of ['study', 'play', 'royale', 'quest']) {
    const body = readFileSync(new URL('../public/' + page + '/index.html', import.meta.url), 'utf8');
    // Some learning pages expose sign-in via the shared menu rather than their own link.
    if (body.includes('/sign-in/')) assert.ok(body.includes('/sign-in/?next=' + page));
  }
});
