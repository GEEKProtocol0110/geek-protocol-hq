import {GAME_META,isStrategy,randomFleet} from '../public/games/strategy/engine.js';
import {renderStrategy} from '../public/games/strategy/render.js';
import {createChessPiece} from '../public/games/assets/pieces.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {clientFixture} from './helpers/client-fixture.js';
import {Chess} from '../public/games/chess/vendor/chess.js';
import {legalCheckers} from '../public/games/classics/checkers-engine.js';
import {newOnlineRoom,onlineView,transitionOnline} from '../server/classic-online.js';
const tick=()=>new Promise(r=>setImmediate(r));
function client(){
 let stored=null,poll,calls=[];
 const f=clientFixture(async(url,options={})=>{
  calls.push({url,body:options.body});
  if(url==='/api/session')return Response.json({ok:true,player:{name:'Host Geek'}});
  if(options.method==='POST'){
   const b=JSON.parse(options.body);if(b.action==='create')stored=newOnlineRoom({code:'PLAY-0123456789AB',game:b.game,visibility:b.visibility,player:{id:'host',name:'Host Geek'}});else stored=transitionOnline(stored,'host',b.action,b);
   return Response.json({ok:true,room:onlineView(stored,'host')});
  }
  return Response.json(stored?{ok:true,room:onlineView(stored,'host')}:{ok:true,rooms:[]});
 },{Chess,legalCheckers,createChessPiece,GAME_META,isStrategy,randomFleet,renderStrategy,setInterval(fn){poll=fn;},location:{search:'',pathname:'/games/online/',origin:'https://example.test'}});
 f.document.getElementById=id=>f.node('#'+id);f.document.body=f.make('body');f.node('#promote').parentElement=f.make('label');f.node('#promote').value='q';
 f.run(readFileSync('public/games/online/online.js','utf8').replace(/^import .*\n/gm,''));
 return {...f,calls,getStored:()=>stored,guest(action,b={}){stored=transitionOnline(stored,'guest',action,{name:'Guest Geek',...b});},poll:async()=>{poll();await tick();await tick();}};
}
test('online client starts only after Enter, creates a lobby, accepts a request and sends a versioned legal chess move',async()=>{
 const f=client();assert.equal(f.calls.length,0);await f.node('#connect').emit('click');await tick();f.node('#game-type').value='chess';f.node('#visibility').value='private';await f.node('#create-form').emit('submit');await tick();
 assert.equal(f.getStored().state,'waiting');f.guest('request');await f.poll();
 const row=f.node('#requests').children[0];assert.match(row.children[0].textContent,/Guest Geek/);await row.children.find(b=>b.textContent==='Accept').emit('click');await tick();
 assert.equal(f.getStored().state,'playing');const square=s=>f.node('#board').children.find(b=>b.dataset.square===s);
 await square('e2').emit('click');assert.match(square('e4').getAttribute('aria-label'),/legal destination/);await square('e4').emit('click');await tick();assert.equal(f.getStored().history[0],'e4');assert.equal(square('e7').disabled,true);
 f.guest('move',{from:'e7',to:'e5',revision:f.getStored().revision});await f.poll();assert.match(f.node('#status').textContent,/Your turn/);assert.equal(square('g1').disabled,false);
});
test('online client sends checkers indices and request revision while preserving server state',async()=>{
 const f=client();await f.node('#connect').emit('click');await tick();f.node('#game-type').value='checkers';f.node('#visibility').value='public';await f.node('#create-form').emit('submit');await tick();f.guest('request');await f.poll();await f.node('#requests').children[0].children.find(b=>b.textContent==='Accept').emit('click');await tick();
 const square=s=>f.node('#board').children.find(b=>b.dataset.square===s);await square('a3').emit('click');await square('b4').emit('click');await tick();assert.equal(f.getStored().ply,1);assert.equal(f.getStored().position.turn,'cyan');const move=JSON.parse(f.calls.findLast(c=>c.body&&JSON.parse(c.body).action==='move').body);assert.equal(move.from,40);assert.equal(move.to,33);assert.ok(Number.isInteger(move.revision));
});
test('online strategy renderer sends tic tac toe cells with revisions and receives opponent turns',async()=>{
 const f=client();await f.node('#connect').emit('click');await tick();f.node('#game-type').value='tic-tac-toe';f.node('#visibility').value='private';await f.node('#create-form').emit('submit');await tick();f.guest('request');await f.poll();await f.node('#requests').children[0].children.find(b=>b.textContent==='Accept').emit('click');await tick();
 const grid=()=>f.node('#board').children[0];assert.equal(grid().children.length,9);await grid().children[0].emit('click');await tick();assert.equal(f.getStored().position.board[0],0);assert.match(f.node('#status').textContent,/Guest Geek to move/);f.guest('move',{cell:3,revision:f.getStored().revision});await f.poll();assert.match(f.node('#status').textContent,/Your turn/);
});
test('online Battle Geek deploys through controls and never renders an unscanned enemy ship',async()=>{
 const f=client();await f.node('#connect').emit('click');await tick();f.node('#game-type').value='battle-geek';f.node('#visibility').value='private';await f.node('#create-form').emit('submit');await tick();f.guest('request');await f.poll();await f.node('#requests').children[0].children.find(b=>b.textContent==='Accept').emit('click');await tick();
 await f.node('#board').children[1].children.find(b=>b.textContent==='Deploy fleet').emit('click');await tick();assert.equal(f.getStored().position.ready[0],true);
 f.guest('move',{kind:'deploy',fleet:[[0,1,2,3,4],[10,11,12,13],[20,21,22],[30,31,32],[40,41]],revision:f.getStored().revision});await f.poll();
 const enemy=f.node('#board').children[0].children[1].children[1];assert.equal(enemy.children.length,100);assert.equal(enemy.children.every(b=>b.getAttribute('aria-label').endsWith('unknown')),true);await enemy.children[0].emit('click');await tick();assert.equal(f.getStored().position.shots[0][0],true);assert.equal(f.getStored().position.turn,1);
});
test('turn alerts require opt-in and deduplicate moves rather than draw-offer revisions',async()=>{
 const f=client(),notices=[];const notifications={permission:'granted',requestPermission:async()=> 'granted'};f.window.Notification=notifications;f.context.Notification=notifications;
 f.context.navigator.serviceWorker={register:async()=>({}),getRegistration:async()=>({showNotification:async(title,body)=>notices.push({title,body})})};
 const game={code:'PLAY-0123456789AB',game:'chess',opponent:'Guest',state:'playing',expiresAt:Date.now()+86400000,yourTurn:false,turnToken:0,revision:2};
 f.run(`drawMyGames(${JSON.stringify([game])})`);await f.node('#turn-alerts').emit('click');game.yourTurn=true;game.turnToken=1;
 f.run(`drawMyGames(${JSON.stringify([game])})`);await tick();assert.equal(notices.length,1);assert.match(f.node('#turn-count').textContent,/1 your turn/);
 game.revision=99;f.run(`drawMyGames(${JSON.stringify([game])})`);await tick();assert.equal(notices.length,1);
 notifications.permission='denied';game.turnToken=3;f.run(`drawMyGames(${JSON.stringify([game])})`);await tick();assert.equal(notices.length,1);
});
