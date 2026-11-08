import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setup, question, grade, advance, MODES, LEVELS } from '../public/games/brain/engine.js';
import { clientFixture } from './helpers/client-fixture.js';

test('recall preserves leading zeros and rejects duplicate or premature scoring', () => {
  let s = setup('sequence', 'easy'); const q = question(s, () => 0);
  assert.equal(q.answer, '000'); assert.equal(grade(s, q, '000'), null);
  s.phase = 'answer'; assert.equal(grade(s,q,'0').lastCorrect,false);
  s = grade(s,q,'000'); assert.equal(s.correct,1); assert.equal(grade(s,q,'000'),null);
  assert.equal(advance(s).round,1);
  assert.equal(question({...s,round:8,level:'stretch'},()=>.9).length,9);
});

test('all arithmetic levels generate exact nonnegative integer tasks and accept numeric equivalence', () => {
  for (const level of LEVELS) for (let round=0;round<10;round++) for (const random of [()=>0,()=>.999,Math.random]) {
    const s={...setup('math',level),round,phase:'answer'}, q=question(s,random);
    const [a,op,b]=q.prompt.split(' '); const expected=op==='+'?+a + +b:op==='−'?+a - +b:+a * +b;
    assert.equal(+q.answer,expected); assert.ok(expected>=0);
    assert.equal(grade(s,q,'0'+q.answer).lastCorrect,true);
    assert.equal(grade(s,q,'-1'),null); assert.equal(grade(s,q,'3.5'),null);
    assert.equal(grade(s,q,String(expected+1)).lastCorrect,false);
  }
});

test('rule changes alter the correct answer and ten rounds terminate without score inflation', () => {
  let s=setup('switch','easy');
  for(let i=0;i<10;i++) {
    const q=question(s,()=>.5); // number 6 is even and greater than five
    assert.equal(q.answer,'yes'); assert.equal(q.rule.includes('even'),i%2===0);
    s.phase='answer';s=grade(s,q,'yes');s=advance(s);
  }
  assert.equal(s.phase,'complete');assert.equal(s.correct,10);assert.equal(advance(s),s);
  const s2={...setup('switch','easy'),round:1};assert.equal(question(s2,()=>.4).answer,'no'); // five
});

function fixture(stored='{}',blocked=false) {
  const memory = new Map([['geek-brain-v1',stored],['unrelated','keep']]);
  const f=clientFixture(undefined,{ setup,question,grade,advance,MODES,LEVELS,localStorage:{
    getItem(k){if(blocked)throw Error('blocked');return memory.get(k)||null;},
    setItem(k,v){if(blocked)throw Error('blocked');memory.set(k,v);},
    removeItem(k){if(blocked)throw Error('blocked');memory.delete(k);}
  }});
  f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');
  f.node('#mode').value='sequence';f.node('#level').value='easy';
  f.run(readFileSync('public/games/brain/brain.js','utf8').replace(/^import .*\n/,''));
  return {...f,memory};
}

test('shipped client requires start and hide, accepts recall, prevents double credit and saves only completion', async()=>{
  const f=fixture(); assert.equal(f.node('#setup').hidden,false);
  await f.node('#start').emit('click'); const digits=f.node('#prompt').textContent;
  assert.equal(f.node('#answers').hidden,true); assert.equal(f.memory.get('geek-brain-v1'),'{}');
  for(let i=0;i<10;i++) {
    const answer=f.node('#prompt').textContent;
    await f.node('#memorized').emit('click');assert.equal(f.node('#prompt').textContent,'Recall the signal');
    f.node('#answer').value=answer;
    await f.node('#number-form').emit('submit');await f.node('#number-form').emit('submit');
    if(i<9)assert.equal(f.memory.get('geek-brain-v1'),'{}');
    await f.node('#next').emit('click');
  }
  assert.equal(f.node('#results').hidden,false);assert.match(f.node('#result').textContent,/10\/10/);
  assert.equal(JSON.parse(f.memory.get('geek-brain-v1'))['sequence:easy'],10);
  await f.node('#clear').emit('click');assert.equal(f.memory.has('geek-brain-v1'),false);assert.equal(f.memory.get('unrelated'),'keep');
});

test('storage failures and malformed scores do not block play; exit discards incomplete sessions', async()=>{
  for(const f of [fixture('{broken'),fixture('{}',true),fixture('{"math:easy":999,"sequence:easy":4}')]) {
    await f.node('#start').emit('click');await f.node('#exit').emit('click');
    assert.equal(f.node('#setup').hidden,false);assert.equal(f.node('#session').hidden,true);
    f.node('#mode').value='math';await f.node('#mode').emit('change');assert.doesNotMatch(f.node('#best').textContent,/999/);
    await f.node('#start').emit('click');assert.equal(f.node('#number-form').hidden,false);
  }
});

test('shipped switch controls grade current rule and advance only after feedback', async()=>{
  const f=fixture();f.node('#mode').value='switch';await f.node('#start').emit('click');
  assert.equal(f.node('#binary').hidden,false);const prompt=f.node('#prompt').textContent;
  await f.node('#next').emit('click');assert.equal(f.node('#prompt').textContent,prompt);
  const n=Number(prompt);await f.node(n%2===0?'#yes':'#no').emit('click');assert.match(f.node('#feedback').textContent,/Correct/);
  await f.node('#next').emit('click');assert.match(f.node('#rule').textContent,/greater than 5/);
});
