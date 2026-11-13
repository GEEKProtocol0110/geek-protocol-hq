import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred } from './helpers/client-fixture.js';

const source=readFileSync('public/media/assets/media.js','utf8');
const description='Kaspa learning through free lessons, quizzes and community tools.';
function setup(navigator={}) {
  const fixture=clientFixture(()=>{throw new Error('Media copy must not fetch');},{navigator});
  const button=fixture.node('[data-media-copy="short-description"]','button');
  Object.assign(button.dataset,{mediaCopy:'short-description',mediaLabel:'Short description'});button.hidden=true;
  const target=fixture.node('#short-description','textarea');target.value=description;
  let selected=false;target.select=()=>{selected=true;};
  const status=fixture.node('[data-media-copy-status]');
  fixture.node('[data-media-copy-group]').append(button,status);
  fixture.run(source);
  return {fixture,button,target,status,selected:()=>selected};
}

test('media copy writes only the selected text and locks overlapping clicks until the clipboard resolves',async()=>{
  const pending=deferred(),written=[];
  const f=setup({clipboard:{writeText:text=>{written.push(text);return pending.promise;}}});
  assert.equal(f.button.hidden,false);
  const first=f.button.emit('click');
  assert.equal(f.button.disabled,true);assert.equal(f.status.textContent,'');
  await f.button.emit('click');assert.deepEqual(written,[description]);
  pending.resolve();await first;
  assert.equal(f.status.textContent,'Short description copied.');assert.equal(f.button.disabled,false);
});

test('a denied or missing clipboard selects readable text without reporting a successful copy',async()=>{
  for(const navigator of [{},{clipboard:{writeText:async()=>{throw new Error('Denied');}}}]){
    const f=setup(navigator);await f.button.emit('click');
    assert.equal(f.selected(),true);assert.equal(f.fixture.document.activeElement,f.target);
    assert.equal(f.status.textContent,'Text selected. Use your device’s Copy command.');
    assert.equal(f.button.disabled,false);
  }
});
