// Local vector artwork; the accessible piece name stays on its square button.
export function createChessPiece(document,type,color){
 const glyphs={p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'};
 const wrap=document.createElement('span');wrap.className='geek-chess-piece';wrap.setAttribute('aria-hidden','true');
 const image=document.createElement('img');image.src=`/games/assets/pieces/${color==='w'?'gold':'cyan'}-${type}.svg`;image.alt='';image.width=64;image.height=72;image.draggable=false;
 const fallback=document.createElement('span');fallback.className='piece-fallback';fallback.textContent=glyphs[type];fallback.hidden=true;
 image.addEventListener('error',()=>{image.hidden=true;fallback.hidden=false;});wrap.append(image,fallback);return wrap;
}
