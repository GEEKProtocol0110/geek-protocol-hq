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
 },{Chess,legalCheckers,setInterval(fn){poll=fn;},location:{search:'',pathname:'/games/online/',origin:'https://example.test'}});
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
