// Native modal supplies focus containment and Escape dismissal. No sound or network work.
let dialog=null,lastKey=null;
document.addEventListener('geek-game-state',event=>{
 const {finished,title,detail='',key=title,online=false,celebrate=true}=event.detail;
 if(!finished){lastKey=null;if(dialog?.open)dialog.close();return;}
 if(lastKey===key)return;lastKey=key;
 if(dialog){dialog.close();dialog.remove();}
 dialog=document.createElement('dialog');dialog.className='geek-finish';dialog.setAttribute('aria-labelledby','finish-title');dialog.setAttribute('aria-describedby','finish-detail');
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;n.textContent=text;return n;};
 const art=el('div','finish-fireworks','');art.setAttribute('aria-hidden','true');
 if(celebrate)for(let i=0;i<30;i++){const spark=el('i','finish-spark','');spark.style.setProperty('--angle',`${i*137.5}deg`);spark.style.setProperty('--distance',`${65+i%5*22}px`);spark.style.setProperty('--delay',`${i%6*.1}s`);art.append(spark);}
 const medal=el('div','finish-medal',celebrate?'✦':'◇');medal.setAttribute('aria-hidden','true');
 const heading=el('h2','','');heading.id='finish-title';heading.textContent=title;
 const detailNode=el('p','',detail||'Game complete. Ready for another round?');detailNode.id='finish-detail';
 const actions=el('div','finish-actions',''),replay=el('button','finish-replay',online?'Play again · new lobby':'Play again');replay.type='button';
 replay.addEventListener('click',()=>{dialog.close();lastKey=null;document.getElementById(online?'back':'start')?.click();});
 const exit=el('a','finish-exit','Exit to games');exit.href='/games/';
 const review=el('button','finish-review','Review board');review.type='button';review.addEventListener('click',()=>dialog.close());
 actions.append(replay,exit,review);dialog.append(art,medal,el('p','finish-kicker','GEEK // GAME COMPLETE'),heading,detailNode,actions);document.body.append(dialog);dialog.showModal();replay.focus();
});
