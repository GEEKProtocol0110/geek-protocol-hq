import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chessMove,checkersMove,strategyMove,strategyMoves} from '../public/games/assets/ace-moves.js';
import {AcePlayer} from '../public/games/assets/ace-player.js';
import {Chess} from '../public/games/chess/vendor/chess.js';
import {newCheckers,legalCheckers,moveCheckers} from '../public/games/classics/checkers-engine.js';
import {newSolitaire,drawSolitaire,moveSolitaire,solitaireWon} from '../public/games/classics/solitaire-engine.js';
import {GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel} from '../public/games/strategy/engine.js';
import {renderStrategy} from '../public/games/strategy/render.js';
import {clientFixture} from './helpers/client-fixture.js';
const random=()=>.42;

test('chess chooses legal replies, finds mate, takes a hanging queen and promotes',()=>{
 const c=new Chess();c.move('e4');const reply=chessMove(c.fen(),'steady',random);assert.doesNotThrow(()=>c.move(reply));assert.equal(c.turn(),'w');
 const mate=new Chess('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1');mate.move(chessMove(mate.fen(),'steady',random));assert.ok(mate.isCheckmate());assert.equal(chessMove(mate.fen()),null);
 const capture=new Chess('2r4k/8/8/8/2Q5/8/8/K7 b - - 0 1');const take=chessMove(capture.fen(),'steady',random);assert.equal(take.to,'c4');capture.move(take);
 const promote=new Chess('7k/P7/8/8/8/8/8/7K w - - 0 1');const m=chessMove(promote.fen(),'steady',random);assert.equal(m.promotion,'q');promote.move(m);
});
test('checkers honors forced jumps and returns control only after the chain',()=>{
 let s={board:Array(64).fill(null),turn:'cyan',forced:null,winner:null};for(const i of [17,3])s.board[i]={side:'cyan',king:false};for(const i of [26,44,62])s.board[i]={side:'gold',king:false};
 const first=checkersMove(s,'steady',random);assert.deepEqual([first.from,first.to],[17,35]);s=moveCheckers(s,first.from,first.to);assert.equal(s.turn,'cyan');assert.equal(s.forced,35);
 const second=checkersMove(s,'steady',random);assert.deepEqual([second.from,second.to],[35,53]);s=moveCheckers(s,second.from,second.to);assert.equal(s.turn,'gold');
});
test('Tac Toe blocks a loss, Connect Four wins, Dots claims its bonus turn',()=>{
 let s=newStrategy('tic-tac-toe');for(const cell of [0,4,1])s=moveStrategy(s,s.turn,{cell});assert.equal(strategyMove(s,'steady',random).cell,2);
 s=newStrategy('connect-four');for(const cell of [0,1,0,1,2,1,2])s=moveStrategy(s,s.turn,{cell});assert.equal(strategyMove(s,'steady',random).cell,1);s=moveStrategy(s,1,{cell:1});assert.equal(s.winner,1);
 s=newStrategy('dots',{dotsSize:4});for(const cell of [0,3,12])s=moveStrategy(s,s.turn,{cell});const m=strategyMove(s,'steady',random);assert.equal(m.cell,13);s=moveStrategy(s,1,m);assert.equal(s.turn,1);assert.equal(s.scores[1],1);
});
test('all strategy opponents produce legal actions through complete games, including passes and bonus turns',()=>{
 for(const game of ['tic-tac-toe','connect-four','dots','reversi','battle-geek']){
  let s=newStrategy(game,{dotsSize:4});
  if(game==='battle-geek')for(const side of [0,1])s=moveStrategy(s,side,strategyMove(strategyView(s,side),'relaxed',random));
  let turns=0;while(s.winner===null&&turns++<220){const side=s.turn,view=strategyView(s,side),before=structuredClone(s),m=strategyMove(view,'relaxed',random);assert.ok(m,game);s=moveStrategy(s,side,m);assert.deepEqual(before.moves+1,s.moves);assert.equal(before.winner,null);}
  assert.notEqual(s.winner,null,game+' must finish');
 }
 const s=newStrategy('reversi');const m=strategyMove(s,'steady',random);assert.ok(strategyMoves(s).some(x=>x.cell===m.cell));
});
test('Battle Geek targeting sees only the masked view and hunts known hits without inspecting hidden ships',()=>{
 let s=newStrategy('battle-geek');for(const side of [0,1])s=moveStrategy(s,side,{kind:'deploy',fleet:randomFleet(random)});
 const view=strategyView(s,1);assert.equal('fleets' in view,false);assert.equal('shots' in view,false);assert.equal(view.target.filter(x=>x==='unknown').length,100);
 const first=strategyMove(view,'steady',random);s.fleets[0]=randomFleet(()=>.9);assert.deepEqual(strategyMove(strategyView(s,1),'steady',random),first,'Unhit enemy layout cannot influence a move');
 view.target[44]='hit';const hunt=strategyMove(view,'steady',random);assert.ok([34,54,43,45].includes(hunt.cell));assert.equal(view.target[hunt.cell],'unknown');
});
test('opponent worker cancellation rejects late and duplicate replies; errors remain recoverable',async()=>{
 const workers=[],moves=[];const ace=new AcePlayer(()=>{const w={postMessage(x){this.sent=x;},terminate(){this.stopped=true;}};workers.push(w);return w;});
 ace.play({game:'chess',state:'fake'},m=>moves.push(m),()=>assert.fail());const old=workers[0];ace.cancel();old.onmessage({data:{id:old.sent.id,move:{from:'e7',to:'e5'}}});
 ace.play({game:'chess',state:'new'},m=>moves.push(m),()=>assert.fail());const w=workers[1];w.onmessage({data:{id:w.sent.id,move:{from:'d7',to:'d5'}}});w.onmessage({data:{id:w.sent.id,move:{from:'a7',to:'a5'}}});
 await new Promise(resolve=>setTimeout(resolve,300));assert.deepEqual(moves,[{from:'d7',to:'d5'}]);let errors=0;ace.play({},()=>assert.fail(),()=>errors++);workers[2].onerror();assert.equal(errors,1);assert.ok(workers[2].stopped);
});

const buttons=root=>root.children.flatMap(n=>[...(n.tagName==='BUTTON'?[n]:[]),...buttons(n)]);
function ui(game){
 let job=null;const fakeAce=class {play(payload,ok,fail){job={payload,ok,fail};}cancel(){job=null;}};
 const f=clientFixture(()=>{throw Error('Local computer games cannot fetch');},{AcePlayer:fakeAce,Chess,createChessPiece:()=>f.make('span'),newCheckers,legalCheckers,moveCheckers,newSolitaire,drawSolitaire,moveSolitaire,solitaireWon,GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel,renderStrategy,structuredClone});
 f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');f.document.body.dataset.game=game;f.document.body.classList={add(){},remove(){},toggle(){}};
 f.document.createElement=tag=>{const e=f.make(tag);e.classList.add=()=>{};return e;};f.node('#opponent').value='ace';f.node('#ace-level').value='steady';f.node('#dots-size').value='4';
 const file=game==='chess'?'chess/chess.js':game==='checkers'?'classics/classics.js':'strategy/strategy.js';f.run(readFileSync('public/games/'+file,'utf8').replace(/^import .*\n/gm,''));
 return {...f,job:()=>job,reply(){const j=job;job=null;const p=j.payload;j.ok(p.game==='chess'?chessMove(p.state,'relaxed',random):p.game==='checkers'?checkersMove(p.state,'relaxed',random):strategyMove(p.state,'relaxed',random));}};
}
test('chess computer client owns Black, locks the board while thinking, and undo takes back both moves',async()=>{
 const f=ui('chess');await f.node('#start').emit('click');const square=name=>f.node('#board').children.find(b=>b.dataset.square===name);
 await square('e2').emit('click');await square('e4').emit('click');assert.match(f.node('#status').textContent,/A.C.E. is thinking/);assert.ok(f.node('#board').children.every(b=>b.disabled));assert.equal(new Chess(f.job().payload.state).turn(),'b');
 const fen=f.job().payload.state;await square('d7').emit('click');assert.equal(f.job().payload.state,fen);f.reply();assert.match(f.node('#status').textContent,/Your turn/);assert.ok(!square('e4').disabled);
 await f.node('#undo').emit('click');assert.equal(f.node('#moves').textContent,'No moves yet.');assert.equal(f.job(),null);
 await square('e2').emit('click');await square('e4').emit('click');await f.node('#exit').emit('click');assert.equal(f.job(),null);assert.equal(f.node('#setup').hidden,false);
});
test('checkers computer client owns Cyan, replies and undoes back to the player',async()=>{
 const f=ui('checkers');await f.node('#start').emit('click');await f.node('#board').children[40].emit('click');await f.node('#board').children[33].emit('click');assert.match(f.node('#status').textContent,/A.C.E. is thinking/);assert.equal(f.job().payload.state.turn,'cyan');f.reply();assert.match(f.node('#status').textContent,/Your turn/);await f.node('#undo').emit('click');assert.equal(f.job(),null);assert.match(f.node('#status').textContent,/Your turn/);
});
test('all five strategy clients keep the player on Gold and dispatch masked computer turns',async()=>{
 for(const game of ['tic-tac-toe','connect-four','dots','reversi','battle-geek']){
  const f=ui(game);await f.node('#start').emit('click');
  if(game==='battle-geek'){
   assert.ok(f.node('#handoff').hidden,'Computer play must not require passing the device');assert.equal('fleets' in f.job().payload.state,false);f.reply();
   const deploy=buttons(f.node('#board')).find(b=>b.getAttribute('aria-label')==='Deploy your fleet');await deploy.emit('click');
   const scan=buttons(f.node('#board')).find(n=>n.getAttribute('aria-label')==='A1: unknown'&&!n.disabled);await scan.emit('click');
  }else{
   const label=game==='tic-tac-toe'?'A1: empty':game==='connect-four'?'Drop in column 1':game==='dots'?'Horizontal edge 1 unclaimed':'D3: legal destination';
   const control=buttons(f.node('#board')).find(n=>n.getAttribute('aria-label')===label);assert.ok(control,game);await control.emit('click');
  }
  assert.ok(f.job(),game+' queues A.C.E.');assert.equal(f.job().payload.state.turn,1);f.reply();
  assert.match(f.node('#status').textContent,/Your turn|A.C.E. is thinking/);await f.node('#undo').emit('click');assert.equal(f.job(),null,game);assert.match(f.node('#status').textContent,/Your turn|Deploy your fleet/);await f.node('#exit').emit('click');assert.equal(f.job(),null);
 }
});
test('worker failure shows Retry without giving the player control of the computer side',async()=>{
 const f=ui('chess');await f.node('#start').emit('click');const square=n=>f.node('#board').children.find(b=>b.dataset.square===n);await square('e2').emit('click');await square('e4').emit('click');f.job().fail();assert.equal(f.node('#ace-retry').hidden,false);assert.ok(f.node('#board').children.every(b=>b.disabled));await f.node('#ace-retry').emit('click');assert.ok(f.job());f.reply();assert.equal(f.node('#ace-retry').hidden,true);
});
