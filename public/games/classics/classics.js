import {newCheckers,legalCheckers,moveCheckers} from './checkers-engine.js';
import {newSolitaire,drawSolitaire,moveSolitaire,solitaireWon} from './solitaire-engine.js';
const $=id=>document.getElementById(id), game=document.body.dataset.game;
let state=null,selected=null,history=[];
function button(text,label,fn){const b=document.createElement('button');b.type='button';b.textContent=text;b.setAttribute('aria-label',label);b.addEventListener('click',()=>{fn();if(!b.isConnected)$('status').focus();});return b;}
function say(text){$('status').textContent=text;}
function remember(){history.push(structuredClone(state));if(history.length>200)history.shift();}
function commit(next){if(!next)return false;remember();state=next;selected=game==='checkers'?state.forced:null;render();return true;}
const square=i=>String.fromCharCode(97+i%8)+(8-Math.floor(i/8));
function renderCheckers(){
 const moves=legalCheckers(state);$('board').replaceChildren();
 for(let i=0;i<64;i++){
  const p=state.board[i],playable=(Math.floor(i/8)+i%8)%2===1;
  const dest=selected!==null&&moves.some(m=>m.from===selected&&m.to===i);
  const label=`${square(i)}: ${p?`${p.side} ${p.king?'king':'piece'}`:'empty'}${dest?', legal destination':''}`;
  const b=button(p?(p.side==='gold'?'G':'C')+(p.king?'♛':''):dest?'•':'',label,()=>{
   if(state.winner)return;
   if(selected!==null&&commit(moveCheckers(state,selected,i)))return;
   if(moves.some(m=>m.from===i)){selected=i;renderCheckers();say(`${state.turn} selected ${square(i)}. Choose a marked destination.`);}
   else say(state.forced!==null?'Continue jumping with the selected piece.':moves.some(m=>m.capture!==null)?'A capture is available and required. Select a piece that can jump.':'Select one of your pieces, then a marked destination.');
  });
  b.className=`square ${playable?'dark':'light'} ${p?.side||''} ${dest?'destination':''}`;
  b.disabled=!playable;b.setAttribute('aria-pressed',String(selected===i));$('board').append(b);
 }
 say(state.winner==='draw'?'Draw agreed. Undo to continue, or exit to start again.':state.winner?`${state.winner} wins! The other player has no legal move.`:`${state.turn} to move.${state.forced!==null?' Continue the jump with the same piece.':moves.some(m=>m.capture!==null)?' A capture is required.':' Select a piece to see its moves.'}`);
 $('draw').disabled=!!state.winner;
}
const glyph={spades:'♠',hearts:'♥',clubs:'♣',diamonds:'♦'};
const rank=n=>({1:'A',11:'J',12:'Q',13:'K'}[n]||n);
const cardName=c=>`${rank(c.rank)} of ${c.suit}`;
function card(c,ref){
 const b=button(c.up?`${rank(c.rank)}${glyph[c.suit]}`:'GEEK',c.up?cardName(c):'Face-down card',()=>choose(ref));
 b.className=`playing-card ${c.up?'face':'back'} ${['hearts','diamonds'].includes(c.suit)?'red-card':''}`;
 b.disabled=!c.up;
 b.setAttribute('aria-pressed',String(selected&&selected.kind===ref.kind&&selected.pile===ref.pile&&selected.index===ref.index));return b;
}
function choose(ref){
 if(selected){
  if(selected.kind===ref.kind&&selected.pile===ref.pile&&selected.index===ref.index){selected=null;renderSolitaire();say('Selection cleared.');return;}
  if(commit(moveSolitaire(state,selected,ref)))return;
 }
 const p=ref.kind==='waste'?state.waste:state[ref.kind]?.[ref.pile];
 if(p?.[ref.index]?.up){selected=ref;renderSolitaire();say(`${cardName(p[ref.index])} selected. Choose a column or foundation. Click it again to cancel.`);}
 else say('That move does not fit. Build columns down in alternating colors; foundations up by suit. Empty columns need a king.');
}
function renderSolitaire(){
 $('stock').textContent=state.stock.length?`Draw · ${state.stock.length}`:state.waste.length?'Recycle waste':'Stock empty';
 $('waste').replaceChildren();if(state.waste.length)$('waste').append(card(state.waste.at(-1),{kind:'waste',index:state.waste.length-1}));else $('waste').textContent='Waste empty';
 $('foundations').replaceChildren();
 state.foundations.forEach((p,i)=>{
  const wrap=document.createElement('div');wrap.className='foundation';
  wrap.append(button(`Home ${i+1}`,`Move selected card to foundation ${i+1}`,()=>{if(selected){if(!commit(moveSolitaire(state,selected,{kind:'foundations',pile:i})))say('Foundations start with an ace and build up in the same suit.');}else say('Select a card first.');}));
  if(p.length)wrap.append(card(p.at(-1),{kind:'foundations',pile:i,index:p.length-1}));else{const empty=document.createElement('span');empty.textContent='Ace → King';wrap.append(empty);}$('foundations').append(wrap);
 });
 $('tableau').replaceChildren();state.tableau.forEach((p,i)=>{
  const col=document.createElement('div');col.className='tableau-column';
  col.append(button(`${i+1}`,`Move selection to column ${i+1}`,()=>choose({kind:'tableau',pile:i,index:p.length-1})));
  p.forEach((c,index)=>col.append(card(c,{kind:'tableau',pile:i,index})));$('tableau').append(col);
 });
 const count=state.foundations.reduce((a,p)=>a+p.length,0);
 say(solitaireWon(state)?'You solved it! All 52 cards are home.':`${count}/52 cards home · ${state.moves} moves. Select a face-up card or run, then a column or foundation.`);
}
function render(){if(game==='checkers')renderCheckers();else renderSolitaire();$('undo').disabled=history.length===0;}
$('start').addEventListener('click',()=>{state=game==='checkers'?newCheckers():newSolitaire();selected=null;history=[];$('setup').hidden=true;$('play').hidden=false;document.body.classList.toggle('is-playing',true);render();$('status').focus();});
$('undo').addEventListener('click',()=>{if(history.length){state=history.pop();selected=game==='checkers'?state.forced:null;render();$('status').focus();}});
$('exit').addEventListener('click',()=>{state=null;selected=null;history=[];$('play').hidden=true;$('setup').hidden=false;document.body.classList.toggle('is-playing',false);$('start').focus();});
if(game==='solitaire')$('stock').addEventListener('click',()=>{if(!commit(drawSolitaire(state)))say('The stock and waste are empty. Try a board move, undo, or start a new deal.');});
if(game==='checkers')$('draw').addEventListener('click',()=>{if(!state.winner&&confirm('Do both players agree to a draw?')){remember();state.winner='draw';render();say('Draw agreed. Undo to continue, or exit to start again.');}});
$('loading').hidden=true;$('setup').hidden=false;
