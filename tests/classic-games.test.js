import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {newCheckers,legalCheckers,moveCheckers} from '../public/games/classics/checkers-engine.js';
import {newSolitaire,drawSolitaire,moveSolitaire,solitaireWon,SUITS} from '../public/games/classics/solitaire-engine.js';
import {clientFixture} from './helpers/client-fixture.js';
const man=side=>({side,king:false});
const empty=()=>({board:Array(64).fill(null),turn:'gold',forced:null,winner:null});
const c=(rank,suit='spades',up=true)=>({rank,suit,up});
const deal=()=>({tableau:[[],[],[],[],[],[],[]],stock:[],waste:[],foundations:[[],[],[],[]],moves:0});

test('checkers starts with twelve pieces each, only legal forward moves and immutable transitions',()=>{
 const s=newCheckers();assert.equal(s.board.filter(p=>p?.side==='gold').length,12);assert.equal(s.board.filter(p=>p?.side==='cyan').length,12);
 const moves=legalCheckers(s);assert.equal(moves.length,7);assert.ok(moves.every(m=>m.to<m.from&&m.capture===null));
 const n=moveCheckers(s,moves[0].from,moves[0].to);assert.equal(n.turn,'cyan');assert.deepEqual(s,newCheckers());assert.equal(moveCheckers(s,0,1),null);
});
test('checkers requires captures and completes forced multi-jumps before changing turns',()=>{
 const s=empty();s.board[42]=man('gold');s.board[33]=man('cyan');s.board[17]=man('cyan');s.board[56]=man('gold');s.board[1]=man('cyan');
 assert.deepEqual(legalCheckers(s),[{from:42,to:24,capture:33}]);assert.equal(moveCheckers(s,56,49),null);
 const n=moveCheckers(s,42,24);assert.equal(n.turn,'gold');assert.equal(n.forced,24);assert.equal(n.board[33],null);
 assert.equal(moveCheckers(n,56,49),null);const done=moveCheckers(n,24,10);assert.equal(done.turn,'cyan');assert.equal(done.forced,null);assert.equal(done.board[17],null);
});
test('crowning ends capture turn and kings move backwards; blocked opponent loses',()=>{
 const s=empty();s.board[17]=man('gold');s.board[10]=man('cyan');s.board[12]=man('cyan');
 const n=moveCheckers(s,17,3);assert.equal(n.board[3].king,true);assert.equal(n.turn,'cyan');assert.equal(n.forced,null);
 const k=empty();k.board[26]={side:'gold',king:true};assert.ok(legalCheckers(k).some(m=>m.to===35));
 const win=empty();win.board[17]=man('gold');win.board[10]=man('cyan');assert.equal(moveCheckers(win,17,3).winner,'gold');
});
test('solitaire shuffles a unique deck and deals 28 tableau cards with seven exposed',()=>{
 const s=newSolitaire(()=>.4);assert.equal(s.stock.length,24);assert.deepEqual(s.tableau.map(p=>p.length),[1,2,3,4,5,6,7]);
 const cards=[...s.stock,...s.tableau.flat()];assert.equal(new Set(cards.map(c=>c.suit+c.rank)).size,52);assert.equal(cards.filter(c=>c.up).length,7);
 const drawn=drawSolitaire(s);assert.equal(drawn.waste.length,1);assert.equal(drawn.waste[0].up,true);assert.equal(s.stock.length,24);
 let n=s;for(let i=0;i<24;i++)n=drawSolitaire(n);const first=n.waste[0];n=drawSolitaire(n);assert.equal(n.stock.length,24);assert.equal(n.waste.length,0);assert.deepEqual(drawSolitaire(n).waste[0],first);
});
test('tableau enforces alternating descending runs, kings in empty columns and automatic reveal',()=>{
 const s=deal();s.tableau[0]=[c(7,'clubs',false),c(6,'hearts'),c(5)];s.tableau[1]=[c(7,'clubs')];
 const from={kind:'tableau',pile:0,index:1},to={kind:'tableau',pile:1};
 const n=moveSolitaire(s,from,to);assert.equal(n.tableau[1].length,3);assert.equal(n.tableau[0][0].up,true);assert.equal(s.tableau[0][0].up,false);
 assert.equal(moveSolitaire(s,from,{kind:'tableau',pile:2}),null);s.tableau[1]=[c(7,'diamonds')];assert.equal(moveSolitaire(s,from,to),null);
 s.tableau[0]=[c(13),c(12,'hearts')];assert.ok(moveSolitaire(s,{...from,index:0},{kind:'tableau',pile:2}));
 s.tableau[0]=[c(13),c(11,'hearts')];assert.equal(moveSolitaire(s,{...from,index:0},{kind:'tableau',pile:2}),null);
});
test('foundations require ace then same suit; only exposed single cards leave waste and foundations',()=>{
 const s=deal();s.waste=[c(1),c(2)];const target={kind:'foundations',pile:0};
 assert.equal(moveSolitaire(s,{kind:'waste',index:0},target),null);assert.equal(moveSolitaire(s,{kind:'waste',index:1},target),null);
 s.waste=[c(1)];let n=moveSolitaire(s,{kind:'waste',index:0},target);assert.equal(n.foundations[0].length,1);
 n.waste=[c(2,'hearts')];assert.equal(moveSolitaire(n,{kind:'waste',index:0},target),null);
 n.tableau[0]=[c(2,'hearts')];assert.ok(moveSolitaire(n,{kind:'foundations',pile:0,index:0},{kind:'tableau',pile:0}));
 n.foundations=SUITS.map(suit=>Array.from({length:13},(_,i)=>c(i+1,suit)));assert.equal(solitaireWon(n),true);assert.equal(drawSolitaire(n),null);
});
function ui(game){
 const f=clientFixture(undefined,{structuredClone,newCheckers,legalCheckers,moveCheckers,newSolitaire,drawSolitaire,moveSolitaire,solitaireWon});
 f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');f.document.body.dataset.game=game;
 f.run(readFileSync('public/games/classics/classics.js','utf8').replace(/^import .*\n/gm,''));return f;
}
test('shipped checkers client waits for start, shows destinations, moves, undoes and exits',async()=>{
 const f=ui('checkers');assert.equal(f.node('#setup').hidden,false);assert.equal(f.node('#board').children.length,0);
 await f.node('#start').emit('click');assert.equal(f.node('#board').children.length,64);
 await f.node('#board').children[40].emit('click');assert.equal(f.node('#board').children[33].textContent,'•');
 await f.node('#board').children[33].emit('click');assert.match(f.node('#status').textContent,/cyan to move/);
 await f.node('#undo').emit('click');assert.match(f.node('#status').textContent,/gold to move/);
 await f.node('#exit').emit('click');assert.equal(f.node('#setup').hidden,false);
});
test('shipped solitaire client deals, draws, undoes and resets without storage or network',async()=>{
 const f=ui('solitaire');await f.node('#start').emit('click');assert.match(f.node('#stock').textContent,/24/);assert.equal(f.node('#tableau').children.length,7);
 await f.node('#stock').emit('click');assert.match(f.node('#stock').textContent,/23/);assert.equal(f.node('#waste').children.length,1);
 await f.node('#undo').emit('click');assert.match(f.node('#stock').textContent,/24/);assert.equal(f.node('#waste').children.length,0);
 await f.node('#exit').emit('click');await f.node('#start').emit('click');assert.match(f.node('#status').textContent,/0 moves/);
});
