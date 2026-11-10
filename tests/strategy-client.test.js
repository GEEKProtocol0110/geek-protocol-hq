import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
import {GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel} from '../public/games/strategy/engine.js';
import {renderStrategy} from '../public/games/strategy/render.js';
function ui(game){
 const f=clientFixture(()=>{throw new Error('Local strategy must not fetch or create sessions');},{GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel,renderStrategy,structuredClone});
 f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');f.document.body.dataset.game=game;f.document.body.classList={add(){},remove(){},toggle(){}};f.node('#starting-hole').value='0';f.run(readFileSync('public/games/strategy/strategy.js','utf8').replace(/^import .*\n/gm,''));return f;
}
test('all nine local clients require Start and reach a usable board without network or storage',async()=>{
 for(const game of Object.keys(GAME_META)){
  const f=ui(game);assert.equal(f.node('#board').children.length,0);await f.node('#start').emit('click');assert.equal(f.node('#setup').hidden,true);
  if(game==='battle-geek')await f.node('#ready').emit('click');assert.ok(f.node('#board').children.length>0,game);await f.node('#exit').emit('click');assert.equal(f.node('#setup').hidden,false);
 }
});
test('local tic tac toe moves, announces winner and undo restores an ongoing board',async()=>{
 const f=ui('tic-tac-toe');await f.node('#start').emit('click');for(const cell of [0,3,1,4,2])await f.node('#board').children[0].children[cell].emit('click');assert.match(f.node('#status').textContent,/Gold wins/);await f.node('#undo').emit('click');assert.match(f.node('#status').textContent,/Gold to move/);
});
test('Peg Quest jumps and undo restore peg count',async()=>{
 const f=ui('peg-quest');await f.node('#start').emit('click');await f.node('#board').children[2].children[0].emit('click');await f.node('#board').children[0].children[0].emit('click');assert.match(f.node('#status').textContent,/13 pegs remaining/);await f.node('#undo').emit('click');assert.match(f.node('#status').textContent,/14 pegs remaining/);
});
test('Battle Geek clears the DOM for handoff between deployments and scans',async()=>{
 const f=ui('battle-geek');await f.node('#start').emit('click');assert.equal(f.node('#handoff').hidden,false);assert.equal(f.node('#board').children.length,0);
 for(let i=0;i<2;i++){await f.node('#ready').emit('click');const deploy=f.node('#board').children[1].children.find(b=>b.textContent==='Deploy fleet');assert.ok(deploy);await deploy.emit('click');assert.equal(f.node('#board').children.length,0);assert.equal(f.node('#handoff').hidden,false);}
 await f.node('#ready').emit('click');const enemy=f.node('#board').children[0].children[1].children[1];assert.equal(enemy.children.length,36);assert.equal(enemy.children.every(b=>b.getAttribute('aria-label').includes('unknown')),true);await enemy.children[0].emit('click');assert.equal(f.node('#board').children.length,0);assert.match(f.node('#ready').textContent,/Cyan/);
});
test('code guess controls reject invalid digits and record one feedback row',async()=>{
 const f=ui('codebreaker');await f.node('#start').emit('click');let form=f.node('#board').children[0];f.node('#code-guess').value='7777';await form.emit('submit');assert.match(f.node('#feedback').textContent,/exactly four/);f.node('#code-guess').value='1234';await form.emit('submit');assert.match(f.node('#status').textContent,/1\/10 guesses/);assert.equal(f.node('#board').children[1].children.length,1);
});
