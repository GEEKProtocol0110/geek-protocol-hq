import {ArcadeBook} from './arcade-book.js';
let storage;try{storage=window.localStorage;}catch{storage={getItem(){throw Error();},setItem(){throw Error();}};}
const book=new ArcadeBook(storage),game=document.body.dataset.game||'chess';
let id=null,last='',active=false;
const note=document.getElementById('arcade-save-note'),resume=document.getElementById('arcade-resume');
function refresh(){if(resume)resume.hidden=!book.load(game);}
function status(ok){if(note)note.textContent=ok?'Saved on this browser · return anytime.':'Saving is unavailable in this browser. Keep this tab open to continue.';}
document.addEventListener('geek-arcade-start',event=>{if(event.detail.game!==game)return;id=crypto.randomUUID();active=true;last='';});
document.addEventListener('geek-arcade-snapshot',event=>{
 const d=event.detail;if(!active||!id||d.game!==game)return;
 const encoded=JSON.stringify([d.actions,d.options]);if(encoded===last)return;
 try{const ok=book.save(game,id,d.level,d.actions,d.options);if(ok)last=encoded;status(ok);refresh();}catch{status(false);}
});
resume?.addEventListener('click',()=>{
 const save=book.load(game);if(!save){refresh();return;}id=save.id;active=true;last='';
 document.dispatchEvent(new CustomEvent('geek-arcade-restore',{detail:save}));
});
document.addEventListener('geek-arcade-exit',()=>{active=false;if(note)note.textContent='';refresh();});
window.addEventListener('pageshow',refresh);window.addEventListener('storage',refresh);refresh();
if(new URLSearchParams(location.search).get('resume')==='1')window.addEventListener('load',()=>resume?.click(),{once:true});
