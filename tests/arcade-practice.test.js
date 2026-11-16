import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArcadeBook,ARCADE_GAMES,replayPractice} from '../public/games/assets/arcade-book.js';
import {Chess} from '../public/games/chess/vendor/chess.js';
import {chessMove,checkersMove,strategyMove} from '../public/games/assets/ace-moves.js';
import {newCheckers,legalCheckers,moveCheckers} from '../public/games/classics/checkers-engine.js';
import {newSolitaire,drawSolitaire,moveSolitaire,solitaireWon} from '../public/games/classics/solitaire-engine.js';
import {GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel} from '../public/games/strategy/engine.js';
import {renderStrategy} from '../public/games/strategy/render.js';
import {clientFixture} from './helpers/client-fixture.js';
const memory=()=>{const rows=new Map();return {rows,getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value)};};
const win=[0,3,1,4,2].map((cell,i)=>({side:i%2,move:{cell}}));

test('replay preserves chess castling, turn and repetition rather than trusting a stored board',()=>{
 const moves=['e4','e5','Nf3','Nc6','Bc4','Nf6','O-O'],r=replayPractice('chess',moves);assert.equal(r.chess.get('g1').type,'k');assert.equal(r.chess.get('f1').type,'r');assert.equal(r.chess.turn(),'b');assert.deepEqual(r.chess.history(),moves);
 const repeated=replayPractice('chess',['Nf3','Nf6','Ng1','Ng8','Nf3','Nf6','Ng1','Ng8']);assert.ok(repeated.chess.isThreefoldRepetition());assert.equal(repeated.result,'draw');
 assert.throws(()=>replayPractice('chess',['e5']));assert.throws(()=>replayPractice('chess',Array(1201).fill('e4')));assert.throws(()=>replayPractice('unknown',[]));
});
test('practice records count first finish once, remove its save, retain milestones and bound recent history',()=>{
 const store=memory(),book=new ArcadeBook(store);book.save('tic-tac-toe','same','relaxed',win.slice(0,2));assert.ok(book.load('tic-tac-toe'));book.save('tic-tac-toe','same','relaxed',win);assert.equal(book.load('tic-tac-toe'),null);book.save('tic-tac-toe','same','relaxed',win);assert.equal(book.summary().length,1);
 book.save('tic-tac-toe','same','relaxed',win.slice(0,2));book.save('tic-tac-toe','same','relaxed',win);assert.equal(book.summary().length,1,'Undo and refinish must not add a result');
 book.save('chess','first-chess','steady',['f3','e5','g4','Qh4#']);for(let i=0;i<201;i++)book.save('tic-tac-toe','new-'+i,'relaxed',win);assert.equal(book.summary().length,200);assert.deepEqual(new Set(book.milestones().played),new Set(['chess','tic-tac-toe']));assert.ok(book.milestones().firstWin);
 store.setItem('unrelated-account','keep');book.clear();assert.equal(book.summary().length,0);assert.equal(store.getItem('unrelated-account'),'keep');assert.deepEqual(book.milestones().played,[]);
});
test('invalid or blocked storage never restores illegal games or crashes a playable client',()=>{
 const store=memory(),book=new ArcadeBook(store);store.setItem('geek.arcade.v1','bad JSON');assert.equal(book.load('chess'),null);assert.deepEqual(book.summary(),[]);
 store.setItem('geek.arcade.v1',JSON.stringify({version:1,saves:{chess:{id:'bad',game:'chess',level:'steady',actions:['e5']}},results:[null,{game:'chess',id:'bad-date',level:'steady',result:'win',at:1e99}]}));assert.equal(book.load('chess'),null);assert.deepEqual(book.summary(),[]);assert.doesNotThrow(()=>book.save('chess','fixed','steady',['e4']));
 const blocked=new ArcadeBook({getItem(){throw Error('blocked');},setItem(){throw Error('quota');}});assert.equal(blocked.save('chess','valid','steady',['e4']),false);assert.equal(blocked.available,false);assert.equal(blocked.load('chess'),null);
 assert.throws(()=>book.save('tic-tac-toe','terminal','steady',[...win,{side:1,move:{cell:8}}]));
});

let ids=0;
const buttons=root=>root.children.flatMap(n=>[...(n.tagName==='BUTTON'?[n]:[]),...buttons(n)]);
function client(game,storage){
 let job=null;const fakeAce=class {play(payload,ok,fail){job={payload,ok,fail};}cancel(){job=null;}};
 const f=clientFixture(()=>{throw Error('Practice must not fetch');},{ArcadeBook,AcePlayer:fakeAce,Chess,createChessPiece:()=>f.make('span'),newCheckers,legalCheckers,moveCheckers,newSolitaire,drawSolitaire,moveSolitaire,solitaireWon,GAME_META,newStrategy,moveStrategy,strategyView,randomFleet,newSolo,moveSolo,pegMoves,pegLabel,renderStrategy,structuredClone,crypto:{randomUUID:()=>`test-match-${++ids}`}});
 f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');f.document.body.dataset.game=game;f.document.body.classList={add(){},remove(){},toggle(){}};f.window.localStorage=storage;
 f.document.createElement=tag=>{const e=f.make(tag);e.classList.add=()=>{};return e;};const events=new Map();f.document.addEventListener=(name,fn)=>{const list=events.get(name)||[];list.push(fn);events.set(name,list);};f.document.dispatchEvent=event=>{for(const fn of events.get(event.type)||[])fn(event);};
 f.node('#opponent').value='ace';f.node('#ace-level').value='steady';f.node('#dots-size').value='4';const file=game==='chess'?'chess/chess.js':['checkers','solitaire'].includes(game)?'classics/classics.js':'strategy/strategy.js';
 const run=file=>f.run('{'+readFileSync('public/games/'+file,'utf8').replace(/^import .*\n/gm,'')+'}');run(file);run('assets/arcade-session.js');
 return {...f,job:()=>job,reply(){const j=job;job=null;const p=j.payload;j.ok(p.game==='chess'?chessMove(p.state,'relaxed',()=>.42):p.game==='checkers'?checkersMove(p.state,'relaxed',()=>.42):strategyMove(p.state,'relaxed',()=>.42));},button(label){return buttons(f.node('#board')).find(b=>b.getAttribute('aria-label')===label&&!b.disabled);}};
}
for(const {id:game} of ARCADE_GAMES)test(`${game}: real client saves, reloads a pending computer turn, replies, then undoes to the player`,async()=>{
 const storage=memory(),book=new ArcadeBook(storage),f=client(game,storage);await f.node('#start').emit('click');
 if(game==='chess'){const square=n=>f.node('#board').children.find(b=>b.dataset.square===n);await square('e2').emit('click');await square('e4').emit('click');}
 else if(game==='checkers'){await f.node('#board').children[40].emit('click');await f.node('#board').children[33].emit('click');}
 else if(game==='battle-geek'){f.reply();await f.button('Deploy your fleet').emit('click');await f.button('A1: unknown').emit('click');}
 else await f.button(game==='tic-tac-toe'?'A1: empty':game==='connect-four'?'Drop in column 1':game==='dots'?'Horizontal edge 1 unclaimed':'D3: legal destination').emit('click');
 assert.ok(f.job(),game+' computer turn is pending');const saved=book.load(game);assert.ok(saved,game+' has a legal save');const before=JSON.stringify(saved.actions);
 const fresh=client(game,storage);assert.equal(fresh.node('#arcade-resume').hidden,false);await fresh.node('#arcade-resume').emit('click');assert.ok(fresh.job(),game+' resumes the computer turn');assert.equal(JSON.stringify(book.load(game).actions),before);fresh.reply();assert.match(fresh.node('#status').textContent,/Your turn/);assert.ok(book.load(game).actions.length>saved.actions.length);
 await fresh.node('#undo').emit('click');assert.equal(fresh.job(),null);assert.match(fresh.node('#status').textContent,/Your turn|Deploy your fleet/);assert.ok(book.load(game).actions.length<saved.actions.length);await fresh.node('#exit').emit('click');assert.ok(book.load(game),'Exit keeps the save');
});
test('friend mode and Solitaire do not enter the A.C.E. practice record',async()=>{
 const storage=memory();for(const game of ['chess','checkers','tic-tac-toe','solitaire']){const f=client(game,storage);f.node('#opponent').value='friend';await f.node('#start').emit('click');assert.equal(new ArcadeBook(storage).load(game),null);assert.equal(new ArcadeBook(storage).summary().length,0);}
});
