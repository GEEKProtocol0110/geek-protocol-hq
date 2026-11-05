(() => {
  const form=document.querySelector('#board-filters'); if(!form)return;
  const source=form.elements.source,mode=form.elements.mode,category=form.elements.category,focus=form.elements.focus;
  const rows=document.querySelector('#board-rows'),status=document.querySelector('#board-status'),stats=document.querySelector('#board-stats');
  let request=0,controller=null;
  const initial=new URLSearchParams(location.search);if(initial.get('source')==='mini')source.value='mini';
  if(['daily','speed','gauntlet'].includes(initial.get('mode')))mode.value=initial.get('mode');
  const sync=()=>{const mini=source.value==='mini';mode.querySelector('[value="gauntlet"]').disabled=mini;if(mini&&mode.value==='gauntlet')mode.value='daily';document.querySelector('#category-filter').hidden=mini;document.querySelector('#focus-filter').hidden=!mini||mode.value!=='speed';document.querySelector('#board-source').textContent=mini?'GEEK MINI':'GEEK PROTOCOL HQ';document.querySelector('#board-caption').textContent=mini?'Geek Mini standings':'Geek Protocol HQ standings';};
  async function load(){
    sync();const serial=++request;controller?.abort();controller=new AbortController();const ownController=controller;const timer=setTimeout(()=>ownController.abort(),12000);
    rows.replaceChildren();stats.hidden=true;status.textContent='Loading public standings…';
    const mini=source.value==='mini';const params=new URLSearchParams({mode:mode.value,...(mini?{focus:focus.value}:{category:category.value,limit:'50'})});
    try{
      const response=await fetch(`${mini?'/api/mini':'/api/leaderboard'}?${params}`,{signal:ownController.signal,credentials:'omit',cache:'no-store'});const data=await response.json();if(serial!==request)return;if(!response.ok||!data.ok||!Array.isArray(data.entries))throw new Error('unavailable');
      document.querySelector('#board-note').textContent=mini?`${mode.value==='daily'?`${data.day} UTC · one public attempt per Mini identity`:`Best Speed score · ${focus.selectedOptions[0].textContent}`} · Server-graded public practice. HQ scores are separate.`:'Best recorded HQ scores within this game and category. Mini scores are shown on their own board.';
      data.entries.forEach(entry=>{const tr=document.createElement('tr');const values=[entry.rank,entry.name,mini?`${entry.score} / ${entry.total}`:entry.score,mini?`${entry.answered} answered`:(entry.level===null?'Career unavailable':`Level ${entry.level} · Prestige ${entry.prestige}`)];values.forEach(v=>{const td=document.createElement('td');td.textContent=String(v??'—');tr.append(td);});rows.append(tr);});
      status.textContent=data.entries.length?`${data.entries.length} leaders shown. Equal scores share a rank.`:'No scores on this board yet. Be the first to play.';
      if(mini){stats.hidden=false;stats.textContent=`${data.players} players on this Mini board · ${data.entries[0]?`Best score ${data.entries[0].score}/${data.entries[0].total}`:'A new challenge awaits'}`;}
      const url=new URL(location.href);url.search=new URLSearchParams({source:source.value,mode:mode.value});history.replaceState(null,'',url);
    }catch{if(serial===request)status.textContent='Standings are temporarily unavailable. Use Refresh standings to try again.';}finally{clearTimeout(timer);}
  }
  form.addEventListener('submit',e=>{e.preventDefault();load();});source.addEventListener('change',load);mode.addEventListener('change',load);category.addEventListener('change',load);focus.addEventListener('change',load);load();
})();
