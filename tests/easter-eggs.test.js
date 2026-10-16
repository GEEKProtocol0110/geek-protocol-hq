import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/assets/easter-eggs.js', import.meta.url), 'utf8').replace('export const', 'const');
const setup = (pathname = '/') => {
  const fixture = clientFixture(() => { throw new Error('Discovery must not make requests'); }, { location: { pathname } });
  fixture.node('footer', 'footer');
  fixture.run(source);
  return fixture;
};

test('discovery is optional, closed initially, unique and absent on account/owner pages', () => {
  const f = setup();
  assert.equal(f.document.querySelectorAll('[data-grid-discovery]').length, 1);
  assert.equal(f.node('[data-grid-discovery]').open, undefined);
  f.run(source.replaceAll('initGridDiscovery', 'initGridDiscoveryAgain'));
  assert.equal(f.document.querySelectorAll('[data-grid-discovery]').length, 1);
  for (const path of ['/ops/', '/sign-in/', '/rewards/', '/mint/']) {
    assert.equal(setup(path).document.querySelectorAll('[data-grid-discovery]').length, 0);
  }
  assert.equal(f.window.events.size, 0, 'No global keyboard or gameplay hooks');
});

test('tap shortcuts decode the binary and cycle cosmic pings without player state', async () => {
  const f = setup('/study/');
  const output = f.node('[data-grid-output]');
  assert.equal(output.getAttribute('role'), 'status');
  await f.node('[data-grid-shortcut="decode"]').emit('click');
  assert.match(output.textContent, /→ K A S/);
  const results = [];
  for (let i = 0; i < 4; i++) {
    await f.node('[data-grid-shortcut="ping"]').emit('click');
    results.push(output.textContent);
  }
  assert.equal(new Set(results).size, 3);
  assert.equal(results[0], results[3]);
});

test('typed commands normalize safely, clear input and handle unknown markup as text', async () => {
  const f = setup();
  const input = f.node('[data-grid-command]');
  const form = f.node('form');
  const output = f.node('[data-grid-output]');
  assert.equal(input.maxLength, 64);
  assert.equal(f.node('label').getAttribute('for'), input.id);
  for (const [command, expected] of [[' /HoPe ', /ALL HOPE, NO HYPE/], ['giga', /GIGA left a note/], ['ace', /A.C.E. left a note/], ['help', /Commands:/], ['clear', /Signal cleared/], ['<img src=x onerror=alert(1)>', /Unknown signal/], ['__proto__', /Unknown signal/]]) {
    input.value = command;
    let prevented = false;
    await form.emit('submit', { preventDefault() { prevented = true; } });
    assert.equal(prevented, true);
    assert.match(output.textContent, expected);
    assert.equal(input.value, '');
    assert.equal(output.innerHTML, '');
  }
});
