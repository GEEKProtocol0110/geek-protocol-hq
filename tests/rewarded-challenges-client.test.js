import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

const source=readFileSync(new URL('../public/challenges/assets/rewarded.js',import.meta.url),'utf8').replace('export const','const');
const status=()=>({ok:true,found:0,earnedXp:0,progression:{xp:100,level:1,prestige:0},words:[{id:'one',name:'First spark',hint:'Find the start.',href:'/',xp:25,claimed:false}],bonus:{claimed:false},tasks:[{id:'first-scored-round',name:'First move',detail:'Complete a scored round.',href:'/play/',xp:50,progress:0,target:1,eligible:false,claimed:false}]});
const setup=fetch=>{
  const f=clientFixture(fetch),root=f.node('[data-xp-challenges]');
  for(const name of ['hunt-progress','challenge-career','word-clues','hunt-bonus','xp-tasks','xp-status','hunt-form','hunt-word','xp-refresh'])root.append(f.node(`[data-${name}]`,name==='hunt-form'?'form':name==='hunt-word'?'input':name==='xp-refresh'?'button':'div'));
  f.node('[data-hunt-word]').dataset.xpControl='';f.node('[data-hunt-word]').dataset.xpNeedsReady='true';f.node('[data-xp-refresh]').dataset.xpControl='';
  f.run(source+';globalThis.refresh=refreshRewards;');return f;
};
test('the list shows authoritative progress and unavailable task claims stay disabled',async()=>{
  const f=setup(async()=>json(status()));await f.context.refresh();
  assert.match(f.node('[data-hunt-progress]').textContent,/0 \/ 5/);
  const card=f.node('[data-xp-tasks]').children[0],button=card.children.find(x=>x.tagName==='BUTTON');assert.equal(button.disabled,true);
  assert.equal(f.node('[data-hunt-word]').disabled,false);
});
test('word entry sends no XP or player ID and a double submit cannot send two in-flight requests',async()=>{
  const pending=deferred(),requests=[];const f=setup(async(path,options)=>{const body=JSON.parse(options.body);requests.push(body);return body.action==='status'?json(status()):pending.promise;});
  await f.context.refresh();f.node('[data-hunt-word]').value=' CURIOSITY ';
  const first=f.node('[data-hunt-form]').emit('submit');await f.node('[data-hunt-form]').emit('submit');
  assert.equal(requests.length,2);assert.deepEqual(requests[1],{action:'word',word:' CURIOSITY '});assert.equal(f.node('[data-hunt-word]').disabled,true);
  const out=status();out.found=1;out.earnedXp=25;out.awards=[{name:'First spark',xp:25}];pending.resolve(json(out));await first;
  assert.match(f.node('[data-xp-status]').textContent,/\+25 XP/);assert.equal(f.node('[data-hunt-word]').value,'');
});
test('a failed claim retains the word, permits safe status refresh and never invents XP',async()=>{
  let count=0;const f=setup(async()=>++count===2?json({ok:false,error:'Saved-player service unavailable.'},503):json(status()));
  await f.context.refresh();f.node('[data-hunt-word]').value='hope';await f.node('[data-hunt-form]').emit('submit');
  assert.equal(f.node('[data-hunt-word]').value,'hope');assert.match(f.node('[data-xp-status]').textContent,/unavailable/);assert.match(f.node('[data-hunt-progress]').textContent,/0 challenge XP/);
  await f.node('[data-xp-refresh]').emit('click');assert.equal(f.node('[data-hunt-word]').disabled,false);
});
test('duplicate rewards show a no-extra-XP message and safe text handles authored names',async()=>{
  const out=status();out.alreadyClaimed=true;out.awards=[];out.words[0].name='<img src=x>';out.words[0].claimed=true;out.words[0].word='HOPE';
  const f=setup(async(path,options)=>json(JSON.parse(options.body).action==='status'?status():out));await f.context.refresh();
  f.node('[data-hunt-word]').value='hope';await f.node('[data-hunt-form]').emit('submit');
  assert.match(f.node('[data-xp-status]').textContent,/Already claimed/);assert.equal(f.node('[data-word-clues]').children[0].children[0].innerHTML,'');
});
