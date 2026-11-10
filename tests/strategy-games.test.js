import test from 'node:test';
import assert from 'node:assert/strict';
import {GAME_META,newStrategy,moveStrategy,strategyView,validateFleet,randomFleet,reversiLegal,newSolo,moveSolo,codeFeedback,pegMoves} from '../public/games/strategy/engine.js';
const step=(s,cell)=>moveStrategy(s,s.turn,{cell});
test('all nine games have named rules; tic tac toe enforces turns, occupied cells and terminal lines',()=>{
 assert.equal(Object.keys(GAME_META).length,9);for(const g of Object.values(GAME_META))assert.ok(g.name&&g.rules&&g.skill);
 let s=newStrategy('tic-tac-toe');const original=structuredClone(s);assert.throws(()=>moveStrategy(s,1,{cell:0}),/ONLINE_TURN/);
 s=step(s,0);assert.deepEqual(original.board,Array(9).fill(null));assert.throws(()=>step(s,0),/ONLINE_ILLEGAL/);
 for(const n of [3,1,4,2])s=step(s,n);assert.equal(s.winner,0);assert.throws(()=>step(s,8),/ONLINE_ILLEGAL/);
 s=newStrategy('tic-tac-toe');for(const n of [0,1,2,4,3,5,7,6,8])s=step(s,n);assert.equal(s.winner,'draw');
});
test('connect four uses gravity, rejects full columns and detects diagonal and vertical wins',()=>{
 let s=newStrategy('connect-four');s=step(s,3);assert.equal(s.board[38],0);for(let i=0;i<5;i++)s=step(s,3);assert.throws(()=>step(s,3),/ONLINE_ILLEGAL/);
 s=newStrategy('connect-four');for(const n of [0,1,0,1,0,1,0])s=step(s,n);assert.equal(s.winner,0);
 s=newStrategy('connect-four');for(const n of [0,1,1,2,4,2,2,3,4,3,5,3,3])s=step(s,n);assert.equal(s.winner,0);
});
test('dots closes boxes, grants an extra turn and scores two adjacent boxes in one edge',()=>{
 let s=newStrategy('dots');for(const n of [0,3,12])s=step(s,n);const side=s.turn;s=step(s,13);assert.equal(s.boxes[0],side);assert.equal(s.turn,side);assert.equal(s.scores[side],1);assert.throws(()=>step(s,13),/ONLINE_ILLEGAL/);
 s=newStrategy('dots');for(const n of [0,1,3,4,12,14])s=step(s,n);const owner=s.turn;s=step(s,13);assert.deepEqual(s.boxes.slice(0,2),[owner,owner]);assert.equal(s.scores[owner],2);
 s=newStrategy('dots');for(let n=0;n<24;n++)s=step(s,n);assert.equal(s.boxes.filter(v=>v!==null).length,9);assert.ok(s.winner!==null);
});
test('reversi flips bracketed discs, forces a pass and scores when neither side can move',()=>{
 let s=newStrategy('reversi');assert.deepEqual(reversiLegal(s.board,0),[19,26,37,44]);assert.throws(()=>step(s,0),/ONLINE_ILLEGAL/);s=step(s,19);assert.equal(s.board[27],0);assert.equal(s.turn,1);
 s=newStrategy('reversi');s.board=Array(64).fill(0);s.board[1]=1;s.board[2]=null;s.board[10]=1;s.board[18]=null;s=step(s,2);assert.equal(s.turn,0);assert.equal(s.winner,null);s=step(s,18);assert.equal(s.winner,0);
});
const fleets=[[[0,1,2],[6,7],[12,13]],[[18,19,20],[24,25],[30,31]]];
test('Battle Geek validates placement, keeps opponent fleet cells out of views and ends after seven hits',()=>{
 let s=newStrategy('battle-geek');assert.ok(validateFleet(fleets[0]));assert.equal(validateFleet([[4,5,6],[8,9],[10,11]]),false);assert.equal(validateFleet([[0,1,2],[1,7],[12,13]]),false);assert.equal(validateFleet([[0,0,0],[1,2],[3,4]]),false);
 for(let i=0;i<100;i++)assert.ok(validateFleet(randomFleet()));
 s=moveStrategy(s,1,{kind:'deploy',fleet:fleets[1]});const view=strategyView(s,0);assert.deepEqual(view.ownFleet,[]);assert.equal(view.fleets,undefined);assert.equal(view.target.every(x=>x==='unknown'),true);assert.throws(()=>moveStrategy(s,1,{kind:'deploy',fleet:fleets[1]}),/ONLINE_ILLEGAL/);
 s=moveStrategy(s,0,{kind:'deploy',fleet:fleets[0]});assert.equal(s.phase,'play');assert.throws(()=>moveStrategy(s,1,{kind:'scan',cell:0}),/ONLINE_TURN/);
 let miss=35;for(const cell of fleets[1].flat()){s=moveStrategy(s,0,{kind:'scan',cell});if(s.winner===null)s=moveStrategy(s,1,{kind:'scan',cell:miss--});}
 assert.equal(s.winner,0);assert.equal(strategyView(s,0).sunk.length,3);assert.equal(strategyView(s,1).target.filter(x=>x==='unknown').length,30);
});
test('Battle Geek rejects repeated scans and refuses scans before both fleets deploy',()=>{
 let s=newStrategy('battle-geek');assert.throws(()=>moveStrategy(s,0,{kind:'scan',cell:0}),/ONLINE_ILLEGAL/);for(const side of [0,1])s=moveStrategy(s,side,{kind:'deploy',fleet:fleets[side]});s=moveStrategy(s,0,{kind:'scan',cell:35});s=moveStrategy(s,1,{kind:'scan',cell:35});assert.throws(()=>moveStrategy(s,0,{kind:'scan',cell:35}),/ONLINE_ILLEGAL/);
});
test('peg solitaire has legal triangular jumps and a complete one-peg solution from the corner',()=>{
 const start=newSolo('peg-quest');assert.equal(start.board.filter(Boolean).length,14);assert.equal(pegMoves(start.board).length,2);assert.throws(()=>moveSolo(start,{from:1,to:0}),/ONLINE_ILLEGAL/);
 const seen=new Set();function solve(s){if(s.done)return s;const key=s.board.map(Number).join('');if(seen.has(key))return null;seen.add(key);for(const m of pegMoves(s.board)){const end=solve(moveSolo(s,m));if(end)return end;}return null;}
 const end=solve(start);assert.ok(end);assert.equal(end.moves,13);assert.equal(end.board.filter(Boolean).length,1);assert.equal(start.board.filter(Boolean).length,14);
});
test('Hanoi enforces top-disc size and solves four discs in fifteen moves',()=>{
 let s=newSolo('hanoi');s=moveSolo(s,{from:0,to:1});assert.throws(()=>moveSolo(s,{from:0,to:1}),/ONLINE_ILLEGAL/);s=newSolo('hanoi');function solve(n,from,to,spare){if(!n)return;solve(n-1,from,spare,to);s=moveSolo(s,{from,to});solve(n-1,spare,to,from);}solve(4,0,2,1);assert.equal(s.done,true);assert.equal(s.moves,15);
});
test('Codebreaker counts repeats once and enforces guess limit and winning termination',()=>{
 assert.deepEqual(codeFeedback([1,1,2,2],[1,2,1,1]),{exact:1,elsewhere:2});let s=newSolo('codebreaker',0,()=>0);assert.deepEqual(s.secret,[1,1,1,1]);assert.throws(()=>moveSolo(s,{guess:[7,2,3,4]}),/ONLINE_ILLEGAL/);for(let i=0;i<10;i++)s=moveSolo(s,{guess:[2,2,2,2]});assert.equal(s.done,true);assert.equal(s.won,false);assert.throws(()=>moveSolo(s,{guess:[1,1,1,1]}),/ONLINE_ILLEGAL/);s=moveSolo(newSolo('codebreaker',0,()=>0),{guess:[1,1,1,1]});assert.equal(s.won,true);
});
test('Sudoku transformations retain valid rows/columns/boxes and solve without altering clues',()=>{
 for(let n=0;n<4;n++){
  let s=newSolo('sudoku');for(let r=0;r<9;r++){assert.equal(new Set(s.solution.slice(r*9,r*9+9)).size,9);assert.equal(new Set(Array.from({length:9},(_,c)=>s.solution[c*9+r])).size,9);}
  for(let br=0;br<3;br++)for(let bc=0;bc<3;bc++)assert.equal(new Set(Array.from({length:9},(_,i)=>s.solution[(br*3+Math.floor(i/3))*9+bc*3+i%3])).size,9);
  const given=s.given.findIndex(Boolean);assert.throws(()=>moveSolo(s,{cell:given,value:0}),/ONLINE_ILLEGAL/);for(let i=0;i<81;i++)if(!s.given[i])s=moveSolo(s,{cell:i,value:s.solution[i]});assert.equal(s.done,true);
 }
});
test('Sudoku template has one solution rather than ambiguous completion targets',()=>{
 const s=newSolo('sudoku',0,()=>.25),board=[...s.given];let found=0;
 function search(){if(found>1)return;let cell=-1,choices=null;for(let i=0;i<81;i++)if(!board[i]){const row=Math.floor(i/9),col=i%9;const options=[1,2,3,4,5,6,7,8,9].filter(n=>!board.some((v,j)=>v===n&&(Math.floor(j/9)===row||j%9===col||Math.floor(Math.floor(j/9)/3)===Math.floor(row/3)&&Math.floor(j%9/3)===Math.floor(col/3))));if(!options.length)return;if(!choices||options.length<choices.length){cell=i;choices=options;}}if(cell<0){found++;return;}for(const n of choices){board[cell]=n;search();board[cell]=0;}}
 search();assert.equal(found,1);
});
