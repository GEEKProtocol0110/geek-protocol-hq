import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/royale/assets/discovery.js', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
test('discovery chooses a code without joining, and failed refresh clears the old seat counts', async () => {
  const calls = []; let fail = false;
  const fixture = clientFixture(async (url, options) => {
    calls.push({ url, options });
    return fail ? json({ error: 'offline' }, 503) : json({ ok: true, discovery: { rooms: [{ code: 'ROY-ABCDEFG2', category: 'kaspa', capacity: 10, seats: 3, online: 2 }] } });
  });
  const code = fixture.make('input'); fixture.node('[data-join-form]').elements.code = code;
  fixture.run(source); await settle();
  const list = fixture.node('[data-discovery-list]'); assert.equal(list.children.length, 1);
  await list.children[0].children[1].emit('click');
  assert.equal(code.value, 'ROY-ABCDEFG2'); assert.equal(calls.length, 1); assert.equal(calls[0].options.method, undefined);
  fail = true; await fixture.node('[data-discovery-refresh]').emit('click');
  assert.equal(list.children.length, 0); assert.match(fixture.node('[data-discovery-status]').textContent, /could not be loaded/);
});
test('empty public discovery is an honest empty state with no invented players', async () => {
  const fixture = clientFixture(async () => json({ ok: true, discovery: { rooms: [] } }));
  fixture.run(source); await settle();
  assert.match(fixture.node('[data-discovery-status]').textContent, /No public waiting rooms/);
  assert.equal(fixture.node('[data-discovery-list]').children.length, 0);
});
