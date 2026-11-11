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
test('riddles retain their answer until solved, support hints and rotate puzzles',async()=>{
 const f=setup('/games/'),input=f.node('[data-grid-command]'),output=f.node('[data-grid-output]');
 const run=async value=>{input.value=value;await f.node('form').emit('submit');return output.textContent;};
 assert.match(await run('answer keyboard'),/riddle first/);assert.match(await run('riddle'),/keys/);assert.match(await run('answer door'),/Not quite/);assert.match(await run('hint'),/type on/);assert.match(await run('answer A KEYBOARD!'),/Correct/);assert.match(await run('answer keyboard'),/riddle first/);assert.match(await run('riddle'),/wetter/);assert.match(await run('answer towel'),/Correct/);assert.match(await run('riddle'),/corner/);assert.match(await run('answer stamp'),/Correct/);
});
test('new discoveries remain page-local and launch art clears on the next command',async()=>{
 const f=setup('/games/'),input=f.node('[data-grid-command]'),output=f.node('[data-grid-output]');
 const run=async value=>{input.value=value;await f.node('form').emit('submit');return output.textContent;};
 assert.match(await run('scan'),/Arcade beacon/);assert.match(await run('scan'),/Arcade beacon/);assert.match(await run('discoveries'),/1\/8/);assert.match(await run('quack'),/Rubber-duck/);assert.match(await run('42'),/universe/);assert.match(await run('launch'),/orbit/);
 const art=f.document.querySelectorAll('div').find(e=>e.className==='grid-secret-art');assert.equal(art.hidden,false);assert.equal(art.children.length,2);await run('clear');assert.equal(art.hidden,true);assert.equal(art.children.length,0);
 const messages=[];for(let i=0;i<6;i++)messages.push(await run('fortune'));assert.equal(new Set(messages).size,5);assert.equal(messages[0],messages[5]);
 const fresh=setup('/games/');fresh.node('[data-grid-command]').value='discoveries';await fresh.node('form').emit('submit');assert.match(fresh.node('[data-grid-output]').textContent,/0\/8/);
 for(const path of ['/games/','/news/','/kaspa/directory/','/whitepaper/'])assert.equal(setup(path).document.querySelectorAll('[data-grid-discovery]').length,1);
 assert.equal(setup('/games/chess/').document.querySelectorAll('[data-grid-discovery]').length,0);
});
