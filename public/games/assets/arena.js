import {ArcadeBook,ARCADE_GAMES} from './arcade-book.js';
let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
const book=new ArcadeBook(storage),$=id=>document.getElementById(id);
function el(tag,cls,text){const node=document.createElement(tag);node.className=cls;node.textContent=text;return node;}
function render(){
 const results=book.summary(),saves=ARCADE_GAMES.map(g=>book.load(g.id)),earned=book.milestones(),finished=new Set(earned.played);
 $('stat-finished').textContent=String(results.length);$('stat-wins').textContent=String(results.filter(r=>r.result==='win').length);$('stat-variety').textContent=`${finished.size} / 7`;$('stat-saved').textContent=String(saves.filter(Boolean).length);
 const latest=saves.filter(Boolean).sort((a,b)=>b.at-a.at)[0];$('arena-primary').href=latest?`/games/${latest.game}/?resume=1`:'/games/chess/';$('arena-primary').textContent=latest?`Resume ${ARCADE_GAMES.find(g=>g.id===latest.game).name} →`:'Challenge A.C.E. →';
 if(!book.available)$('arena-storage').textContent='Saving is unavailable in this browser. You can still play, but keep the game tab open to continue.';
 $('arena-grid').replaceChildren();ARCADE_GAMES.forEach((game,index)=>{
  const save=saves[index],rows=results.filter(r=>r.game===game.id),card=el('article','arena-card','');
  const top=el('div','arena-card-top',''),icon=el('span',`arena-game-icon arena-icon-${game.id}`,game.icon);icon.setAttribute('aria-hidden','true');
  top.append(icon,el('span',save?'arena-tag arena-tag-saved':'arena-tag',save?'SAVED GAME':'YOU vs A.C.E.'));
  card.append(top,el('h3','',game.name),el('p','arena-card-tip',game.tip));
  card.append(el('p','arena-card-record',rows.length?`${rows.filter(r=>r.result==='win').length} wins · ${rows.filter(r=>r.result==='loss').length} losses · ${rows.filter(r=>r.result==='draw').length} draws`:'A fresh board. A new possibility.'));
  const link=el('a',save?'arena-button':'arena-card-link',save?'Resume game →':'Play against A.C.E. →');link.href=`/games/${game.id}/${save?'?resume=1':''}`;card.append(link);
  if(save){card.append(el('p','arena-save-detail',`${save.level==='steady'?'Steady':'Relaxed'} · ${save.actions.length} actions played`));const fresh=el('a','arena-fresh','Start a new game');fresh.href=`/games/${game.id}/`;card.append(fresh);}
  $('arena-grid').append(card);
 });
 const milestones=[['First finish','Finish one game against A.C.E.',Number(earned.firstFinish),1],['A win of your own','Win a game on either difficulty.',Number(earned.firstWin),1],['Change your perspective','Finish three different board games.',Math.min(finished.size,3),3],['Across the Arena','Finish a game on all seven boards.',finished.size,7]];
 $('arena-milestones').replaceChildren();for(const [name,tip,value,max] of milestones){const card=el('article',`arena-milestone ${value>=max?'is-earned':''}`,'');card.append(el('span','arena-milestone-mark',value>=max?'✓':'◇'),el('h3','',name),el('p','',tip));const progress=el('progress','','');progress.max=max;progress.value=value;progress.setAttribute('aria-label',`${name}: ${value} of ${max}`);card.append(progress,el('span','arena-progress-label',value>=max?'Complete':`${value} / ${max}`));$('arena-milestones').append(card);}
 $('arena-history').replaceChildren();for(const row of [...results].reverse().slice(0,8)){const li=el('li','arena-result',''),info=el('div','','');info.append(el('strong','',ARCADE_GAMES.find(g=>g.id===row.game).name),el('span','',`${row.level==='steady'?'Steady':'Relaxed'} · ${new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(row.at)}`));li.append(info,el('span',`arena-result-${row.result}`,row.result==='win'?'You won':row.result==='loss'?'A.C.E. won':'Draw'));$('arena-history').append(li);}
 if(!results.length)$('arena-history').append(el('li','arena-empty','Your first finish starts the story. Pick a board above.'));
 $('arena-clear').disabled=!results.length&&!saves.some(Boolean);
}
$('arena-clear').addEventListener('click',()=>{if(confirm('Clear all seven saved A.C.E. games and this browser’s practice record?')){if(!book.clear())$('arena-storage').textContent='This browser could not clear its practice data.';render();}});
window.addEventListener('pageshow',render);window.addEventListener('storage',render);render();
