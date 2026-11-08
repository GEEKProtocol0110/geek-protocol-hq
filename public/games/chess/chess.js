import { Chess } from './vendor/chess.js';
const $=id=>document.getElementById(id);
const names={p:'pawn',r:'rook',n:'knight',b:'bishop',q:'queen',k:'king'};
const glyphs={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'};
let game=null,selected=null,flipped=false,pending=null;
function render(){
 const board=$('board');board.replaceChildren();
 const legal=selected&&!pending?game.moves({square:selected,verbose:true}):[];
 const files=flipped?'hgfedcba':'abcdefgh',ranks=flipped?'12345678':'87654321';
 for(const rank of ranks)for(const file of files){
  const square=file+rank,piece=game.get(square),button=document.createElement('button');
  button.type='button';button.className='chess-square '+((file.charCodeAt(0)+Number(rank))%2?'light':'dark');
  button.dataset.square=square;button.setAttribute('aria-label',`${square}: ${piece?`${piece.color==='w'?'White':'Black'} ${names[piece.type]}`:'empty'}${legal.some(m=>m.to===square)?', legal destination':''}`);
  button.setAttribute('aria-pressed',String(selected===square));
  if(piece){button.classList.add(piece.color==='w'?'white-piece':'black-piece');const icon=document.createElement('span');icon.textContent=glyphs[piece.type];icon.setAttribute('aria-hidden','true');button.append(icon);}
  const label=document.createElement('small');label.textContent=square;label.setAttribute('aria-hidden','true');button.append(label);
  if(legal.some(m=>m.to===square))button.classList.add('legal');
  button.disabled=!!pending||game.isGameOver();button.addEventListener('click',()=>choose(square));board.append(button);
 }
 const turn=game.turn()==='w'?'White':'Black';
 $('status').textContent=game.isCheckmate()?`Checkmate — ${turn==='White'?'Black':'White'} wins.`:game.isStalemate()?'Draw — stalemate.':game.isThreefoldRepetition()?'Draw — threefold repetition.':game.isDrawByFiftyMoves()?'Draw — fifty moves without a pawn move or capture.':game.isInsufficientMaterial()?'Draw — insufficient material.':`${turn} to move${game.isCheck()?' — check!':'.'}${pending?' Choose a promotion piece.':''}`;
 $('undo').disabled=!game.history().length||!!pending;$('promotion').hidden=!pending;
 const moves=game.history();$('moves').textContent=moves.length?moves.map((m,i)=>`${i%2===0?`${Math.floor(i/2)+1}. `:''}${m}`).join(' '):'No moves yet.';
}
function move(m){game.move(m);selected=null;pending=null;render();$('status').focus();}
function choose(square){
 if(!game||pending||game.isGameOver())return;
 const possibilities=selected?game.moves({square:selected,verbose:true}).filter(m=>m.to===square):[];
 if(possibilities.length){if(possibilities[0].promotion){pending={from:selected,to:square};render();document.querySelector('[data-promotion]').focus();}else move({from:selected,to:square});return;}
 const p=game.get(square);selected=p&&p.color===game.turn()&&selected!==square?square:null;render();
 document.querySelector(`[data-square="${square}"]`).focus();
}
$('start').addEventListener('click',()=>{game=new Chess();selected=null;pending=null;flipped=false;$('setup').hidden=true;$('play').hidden=false;render();$('status').focus();});
$('undo').addEventListener('click',()=>{if(!pending){game.undo();selected=null;render();$('status').focus();}});
$('flip').addEventListener('click',()=>{flipped=!flipped;render();});
$('exit').addEventListener('click',()=>{if(game.history().length&&!confirm('End this game and return to setup?'))return;game=null;selected=null;pending=null;$('play').hidden=true;$('setup').hidden=false;$('start').focus();});
for(const b of document.querySelectorAll('[data-promotion]'))b.addEventListener('click',()=>{if(pending)move({...pending,promotion:b.dataset.promotion});});
$('cancel-promotion').addEventListener('click',()=>{pending=null;selected=null;render();$('status').focus();});
