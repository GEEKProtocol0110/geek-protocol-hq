import { GAME_META, isStrategy, randomFleet } from '../strategy/engine.js';
import { renderStrategy } from '../strategy/render.js';
import { createChessPiece } from '../assets/pieces.js';
import { Chess } from '../chess/vendor/chess.js';
import { legalCheckers } from '../classics/checkers-engine.js';
const $=id=>document.getElementById(id), endpoint='/api/lobbies?service=classic';
let room=null,code='',connected=false,busy=false,polling=false,selected=null,flipped=false,epoch=0;
let draftFleet=randomFleet();
const gameName=g=>GAME_META[g]?.name||(g==='chess'?'Geek Chess':'Geek Checkers');
const incoming=new URLSearchParams(location.search).get('room');
const requestedGame=new URLSearchParams(location.search).get('game');
if(requestedGame&&(isStrategy(requestedGame)||['chess','checkers'].includes(requestedGame)))$('game-type').value=requestedGame;
const valid=v=>/^PLAY-[A-F0-9]{12}$/.test(v);
function say(s){$('notice').textContent=s;}
function expiredSession(){connected=false;room=null;selected=null;document.body.classList.toggle('is-playing',false);$('game-panel').hidden=true;$('board').replaceChildren();$('room-actions').replaceChildren();$('requests').replaceChildren();$('lounge').hidden=true;$('connect-panel').hidden=false;}
function btn(text,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.disabled=busy;b.addEventListener('click',fn);return b;}
async function api(body,roomCode){
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),10000);
 try{const response=await fetch(body?endpoint:roomCode?`${endpoint}&code=${encodeURIComponent(roomCode)}`:endpoint,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json'}:{},...(body?{body:JSON.stringify(body)}:{}),signal:control.signal});const data=await response.json();if(!response.ok||!data.ok){if(response.status===401)expiredSession();const e=new Error(response.status===401?'Your player session ended. Reload and enter the lounge again.':data.error||'The game could not be updated.');e.status=response.status;throw e;}return data;
 }finally{clearTimeout(timer);}
}
async function act(action,extra={}){
 if(busy)return;busy=true;const previous=code;const generation=epoch;
 document.querySelectorAll('#room-actions button,#requests button').forEach(b=>b.disabled=true);
 try{const data=await api({action,code,...extra});if(generation!==epoch)return;room=data.room;code=room.code;history.replaceState(null,'',`?room=${code}`);selected=null;say('');$('browse').hidden=true;$('room-panel').hidden=false;render();}
 catch(e){say(e.name==='AbortError'?'Connection timed out. Refresh before trying that move again.':e.message);if(previous&&generation===epoch)await refresh();}
 finally{busy=false;if(room)render();}
}
async function refresh(){
 if(polling||!connected)return;polling=true;const at=epoch,target=code;
 try{const data=await api(null,target);if(at!==epoch||target!==code)return;
  if(target){if(!room||data.room.revision!==room.revision||data.room.role!==room.role){room=data.room;selected=null;render();}}
  else{const list=$('rooms');list.replaceChildren();if(!data.rooms.length)list.textContent='No open lobbies yet. Create one and invite a friend.';
   for(const r of data.rooms){const row=document.createElement('div');row.className='online-row';const p=document.createElement('p');p.textContent=`${gameName(r.game)} · ${r.hostName}`;row.append(p,btn('View lobby',()=>open(r.code)));list.append(row);}}
 }catch(e){say(e.name==='AbortError'?'Connection is slow. Your game is kept on the server; refresh to reconnect.':e.message);if(e.status===401)connected=false;}
 finally{polling=false;}
}
async function open(value){if(!valid(value)){say('Enter a valid PLAY- room code.');return;}epoch++;code=value;room=null;selected=null;flipped=false;draftFleet=randomFleet();$('browse').hidden=true;$('room-panel').hidden=false;$('room-title').textContent='Opening room…';$('game-panel').hidden=true;$('room-actions').replaceChildren();$('requests').replaceChildren();history.replaceState(null,'',`?room=${value}`);await refresh();}
const names={p:'pawn',r:'rook',n:'knight',b:'bishop',q:'queen',k:'king'};
function drawBoard(){
 if(isStrategy(room.game)){
  const side=room.role==='host'?0:1,p=room.position;
  const mine=room.state==='playing'&&(p.game==='battle-geek'&&p.phase==='deploy'?!p.ready[side]:p.turn===side);
  $('promote').parentElement.hidden=true;$('flip').hidden=true;
  renderStrategy(document,$('board'),p,{side,enabled:mine&&!busy,draftFleet,onShuffle:()=>{draftFleet=randomFleet();drawBoard();},onMove:move=>act('move',{...move,revision:room.revision})});
  $('history').textContent=room.history.join(' · ')||'No moves yet.';
  $('status').textContent=room.state==='finished'?room.result:p.game==='battle-geek'&&p.phase==='deploy'?(p.ready[side]?'Fleet deployed. Waiting for opponent.':'Deploy your hidden fleet.'):`${room.hostName} vs ${room.guestName} · ${mine?'Your turn':`${p.turn===0?room.hostName:room.guestName} to move`}`;
  $('move-help').textContent=GAME_META[room.game].rules;return;
 }
 $('board').className='chessboard';$('flip').hidden=false;
 $('move-help').textContent='Tap your piece, then a marked destination. Moves are checked by the server. No takebacks in online games.';
 const chess=room.game==='chess', c=chess?new Chess(room.position):null,host=room.role==='host';
 const turn=chess?(c.turn()==='w'?'host':'guest'):(room.position.turn==='gold'?'host':'guest'),mine=room.role===turn&&room.state==='playing';
 const moves=chess?(selected?c.moves({square:selected,verbose:true}):[]):legalCheckers(room.position);
 const reverse=(room.role==='guest')!==flipped,order=Array.from({length:64},(_,i)=>reverse?63-i:i),board=$('board');board.replaceChildren();
 for(const i of order){const square=String.fromCharCode(97+i%8)+(8-Math.floor(i/8)),ref=chess?square:i,p=chess?c.get(square):room.position.board[i],legal=selected!==null&&moves.some(m=>m.from===selected&&m.to===ref);
  const white=p&&(chess?p.color==='w':p.side==='gold'),piece=p?(chess?names[p.type]:p.king?'king':'piece'):'';
  const b=btn('',()=>{if(!mine||busy)return;if(legal){act('move',{from:selected,to:ref,revision:room.revision,...(chess&&moves.some(m=>m.from===selected&&m.to===ref&&m.promotion)?{promotion:$('promote').value}:{})});return;}if(p&&(white===host)){selected=selected===ref?null:ref;drawBoard();const target=[...board.children].find(n=>n.dataset.square===square);target?.focus();}});
  b.dataset.square=square;b.className=`chess-square ${(Math.floor(i/8)+i%8)%2?'dark':'light'} ${p?white?'white-piece':'black-piece':''} ${legal?'legal':''}`;b.disabled=!mine||busy;b.setAttribute('aria-label',`${square}: ${p?`${white?(chess?'White':'Gold'):(chess?'Black':'Cyan')} ${piece}`:'empty'}${legal?', legal destination':''}`);b.setAttribute('aria-pressed',String(selected===ref));
  if(p){const span=document.createElement('span');span.setAttribute('aria-hidden','true');if(chess){span.append(createChessPiece(document,p.type,p.color));span.className='online-piece-wrap';}else{span.className='online-checker';span.textContent=(white?'G':'C')+(p.king?'♛':'');}b.append(span);}const small=document.createElement('small');small.textContent=square;small.setAttribute('aria-hidden','true');b.append(small);board.append(b);
 }
 $('promote').parentElement.hidden=!chess;
 $('history').textContent=room.history.join(' · ')||'No moves yet.';
 $('status').textContent=room.state==='finished'?room.result:`${room.hostName} vs ${room.guestName} · ${mine?'Your turn':`${turn==='host'?room.hostName:room.guestName} to move`}${chess&&c.isCheck()?' · Check!':''}${!chess&&room.position.forced!==null?' · Continue the capture':''}`;
}
function render(){
 if(!room)return;const host=room.role==='host',member=host||room.role==='guest';
 $('room-title').textContent=`${gameName(room.game)}`;
 $('room-detail').textContent=`${room.code}${room.game==='dots'?` · ${room.options?.dotsSize||4}×${room.options?.dotsSize||4} dots`:''} · ${room.visibility==='private'?'Invite only':'Public lobby'} · ${host?'You host':`Hosted by ${room.hostName}`} · ${member?(host?'You play '+(room.game==='chess'?'White':'Gold'):'You play '+(room.game==='chess'?'Black':'Cyan')):'Request a seat'}`;
 const actions=$('room-actions'),requests=$('requests');actions.replaceChildren();requests.replaceChildren();$('game-panel').hidden=!member||!room.position;
 document.body.classList.toggle('is-playing',member&&room.state==='playing');
 if(room.state==='waiting'){
  $('status').textContent=host?'Share the invitation or accept a game request below.':room.requested?'Game requested. Waiting for the host to accept.':'Ask the host for a game.';
  actions.append(host?btn('Close lobby',()=>act('cancel')):room.requested?btn('Cancel request',()=>act('cancel-request')):btn('Request game',()=>act('request')));
  if(host){if(!room.requests.length)requests.textContent='No game requests yet.';for(const r of room.requests){const row=document.createElement('div');row.className='online-row';const p=document.createElement('p');p.textContent=`${r.name} requests a game`;row.append(p,btn('Accept',()=>act('accept',{requestId:r.id})),btn('Decline',()=>act('decline',{requestId:r.id})),btn('Block',()=>{if(confirm(`Block ${r.name} from requesting this lobby again?`))act('block',{requestId:r.id});}));requests.append(row);}}
 }else if(room.position&&member){
  drawBoard();document.dispatchEvent?.(new CustomEvent('geek-game-state',{detail:{finished:room.state==='finished',key:room.code,title:room.result||'Game complete',detail:'Start a new lobby and invite your opponent for another round.',online:true}}));if(room.state==='playing'){actions.append(btn('Resign',()=>{if(confirm('Resign this game?'))act('resign');}));
   if(!room.drawOffer)actions.append(btn('Offer draw',()=>act('offer-draw')));else if(room.drawOffer!==room.role){actions.append(btn('Accept draw',()=>act('accept-draw')),btn('Decline draw',()=>act('decline-draw')));}else{const p=document.createElement('p');p.textContent='Draw offered. Waiting for your opponent.';actions.append(p);}}
 }else $('status').textContent=room.state==='finished'?'This room is closed. Start a new lobby for another game.':'This game already has two players.';
}
$('connect').addEventListener('click',async()=>{if(busy)return;busy=true;$('connect').disabled=true;say('Connecting your Geek player…');try{
 const control=new AbortController(),timer=setTimeout(()=>control.abort(),10000);let response,data;try{response=await fetch('/api/session',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:'{}',signal:control.signal});data=await response.json();}finally{clearTimeout(timer);}if(!response.ok||!data.ok)throw new Error('Could not start a player session. Try again shortly.');connected=true;$('connect-panel').hidden=true;$('lounge').hidden=false;say(`Connected as ${data.player.name}.`);if(incoming&&valid(incoming))await open(incoming);else await refresh();
 }catch(e){say(e.message);}finally{busy=false;$('connect').disabled=false;if(room)render();else if(connected)refresh();}});
$('create-form').addEventListener('submit',e=>{e.preventDefault();epoch++;act('create',{game:$('game-type').value,visibility:$('visibility').value,dotsSize:Number($('dots-size')?.value||6)});});
$('join-form').addEventListener('submit',e=>{e.preventDefault();open($('room-code').value.trim().toUpperCase());});
$('refresh').addEventListener('click',()=>refresh());
$('back').addEventListener('click',()=>{if(busy)return;epoch++;code='';room=null;selected=null;document.body.classList.remove('is-playing');$('browse').hidden=false;$('room-panel').hidden=true;history.replaceState(null,'',location.pathname);refresh();});
$('flip').addEventListener('click',()=>{flipped=!flipped;drawBoard();});
$('copy').addEventListener('click',async()=>{const link=new URL(location.pathname,location.origin);link.searchParams.set('room',code);try{await navigator.clipboard.writeText(link.href);say('Invite link copied.');}catch{say(`Share this invite: ${link.href}`);}});
setInterval(()=>{if(connected&&!document.hidden&&!busy)refresh();},4000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!busy)refresh();});
import('/assets/kaspa-planet.js').catch(()=>{});
