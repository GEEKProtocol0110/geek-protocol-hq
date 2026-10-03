(() => {
 'use strict';
 const $ = s => document.querySelector(s), items = [...document.querySelectorAll('[data-item]')];
 let state = null, busy = false, clock = 0, timer = null, submittedTimeout = '';
 const tracked = new Set();
 const track = (name, key, data) => { if (tracked.has(key)) return; tracked.add(key); window.GeekAnalytics?.track(name,data); };
 const savedId = () => { try { return sessionStorage.getItem('geek-assisted-run') || ''; } catch { return ''; } };
 const saveId = id => { try { if (id) sessionStorage.setItem('geek-assisted-run',id); else sessionStorage.removeItem('geek-assisted-run'); } catch {} };
 const request = async (path,body) => {
  const controller = new AbortController(), timeout = setTimeout(()=>controller.abort(),15000);
  try { const response = await fetch(path,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal}); const payload=await response.json(); if (!response.ok || !payload.ok) throw Error(payload.error || 'Practice is unavailable. Please retry.'); return payload; }
  finally { clearTimeout(timeout); }
 };
 const controls = () => {
  $('[data-start]').disabled=busy; $('[data-next]').disabled=busy; $('[data-restart]').disabled=busy; $('[data-reload]').disabled=busy;
  for (const button of items) { const used=state?.used[button.dataset.item]; button.disabled=busy || !state?.question || used || performance.now()>=clock; button.textContent=(button.dataset.item==='fifty-fifty'?'50/50':'Extra Time +10s')+(used?' · used':' · 1 left'); }
  document.querySelectorAll('[data-choice]').forEach(button=>{button.disabled=busy || !state?.question || state.question.removed.includes(Number(button.dataset.choice));});
 };
 const tick = () => {
  if (!state?.question) return;
  const seconds=Math.max(0,Math.ceil((clock-performance.now())/1000)); $('[data-timer]').textContent=String(seconds);
  controls();
  if (!seconds && !busy && submittedTimeout!==state.question.token) { submittedTimeout=state.question.token; act({action:'answer',questionToken:state.question.token,selectedIndex:-1}); }
 };
 const render = () => {
  clearInterval(timer); const q=state?.question;
  $('[data-start-panel]').hidden=Boolean(state); $('[data-question-panel]').hidden=!q; $('[data-feedback-panel]').hidden=!state || Boolean(q);
  if (q) {
   clock=performance.now()+Math.max(0,q.expiresAt-q.serverNow); $('[data-progress]').textContent=`Question ${q.number} of 10`; $('[data-prompt]').textContent=q.prompt;
   const answers=q.options.map((text,index)=>{const b=document.createElement('button');b.type='button';b.className='practice-answer'+(q.removed.includes(index)?' removed':'');b.dataset.choice=String(index);b.textContent=q.removed.includes(index)?'Removed by 50/50':`${index+1}. ${text}`;b.addEventListener('click',()=>act({action:'answer',questionToken:q.token,selectedIndex:index}));return b;}); $('[data-answers]').replaceChildren(...answers);
   $('[data-lifeline-note]').textContent=q.removed.length?'50/50 removed two wrong choices. Choose from the remaining answers.':state.used['extra-time']?'Extra Time has been used in this session.':'Use a lifeline before answering.';
   timer=setInterval(tick,150); tick(); $('[data-prompt]').focus({preventScroll:true});
  } else if (state) {
   const f=state.feedback; window.GeekGiga?.update('practice', { phase: state.finished ? 'finished' : f.correct ? 'correct' : f.selectedIndex === -1 ? 'timeout' : 'missed' }); $('[data-feedback-title]').textContent=f.correct?'Correct · keep learning':f.selectedIndex===-1?'Time ended · learn from the answer':'A chance to learn'; $('[data-answer]').textContent=f.answer; $('[data-explanation]').textContent=f.explanation || 'Read the source and try the concept again.';
   const source=$('[data-source]'); let url; try { url=new URL(f.source); } catch {} source.hidden=!url || url.protocol!=='https:';if (!source.hidden) source.href=url.href;
   $('[data-summary]').textContent=state.finished?`Practice complete: ${state.correct} of 10 correct. These assisted results do not award XP, credits, or tokens.`:`${state.answered} of 10 answered · ${state.correct} correct. Take your time with the explanation.`;
   $('[data-next]').hidden=state.finished; $('[data-restart]').hidden=!state.finished;
  }
  controls();
 };
 const act = async body => {
  if (busy) return;busy=true;controls();$('[data-error]').hidden=true;
  try {
   if (!state && body.action==='start') await request('/api/session/',{});
   const payload=await request('/api/ranked/?service=practice',{...body,...(body.runId?{}:state?{runId:state.id}:{})}); state=payload.practice;saveId(state.id);render();
   if (body.action==='start') track('Practice started',`start:${state.id}`,{mode:'assisted'});
   if (body.action==='answer' && state.finished) track('Practice completed',`finish:${state.id}`,{mode:'assisted'});
   if (body.action==='lifeline' && state.used[body.item]) track('Free lifeline used',`${state.id}:${body.item}`,{item:body.item});
  } catch (error) { $('[data-error]').hidden=false; $('[data-error-message]').textContent=error.name==='AbortError'?'The request timed out. Reload the current question before trying again.':error.message; $('[data-reload]').hidden=!state && !savedId(); }
  finally { busy=false;controls(); }
 };
 $('[data-start]').addEventListener('click',()=>act({action:'start'}));
 $('[data-restart]').addEventListener('click',()=>act({action:'start'}));
 $('[data-next]').addEventListener('click',()=>act({action:'next',questionToken:state.feedback.token}));
 for (const button of items) button.addEventListener('click',()=>act({action:'lifeline',questionToken:state.question.token,item:button.dataset.item}));
 $('[data-reload]').addEventListener('click',()=>act({action:'view',runId:state?.id || savedId()}));
 if (savedId()) act({action:'view',runId:savedId()});
})();
