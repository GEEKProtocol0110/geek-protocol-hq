import test from 'node:test';
import assert from 'node:assert/strict';
import rankedHandler from '../api/ranked.js';
import { decodePractice, practiceCasScript, practiceRules, practiceView, transitionPractice } from '../server/assisted-practice.js';
import { loadQuestionBank } from '../server/questions.js';
const store=new Map(), a='a'.repeat(32), b='b'.repeat(32), recovered='c'.repeat(32), player='d'.repeat(32);
const savedFetch=globalThis.fetch;let loseResponse=false, conflicts=0;
process.env.UPSTASH_REDIS_REST_URL='https://practice-redis.test';process.env.UPSTASH_REDIS_REST_TOKEN='practice-test';
const execute=([op,...args])=>{
 if(op==='GET')return store.get(args[0])??null;
 if(op==='SET'){if(args.includes('NX')&&store.has(args[0]))return null;store.set(args[0],String(args[1]));return 'OK';}
 if(op==='INCR'){const n=Number(store.get(args[0])||0)+1;store.set(args[0],String(n));return n;}
 if(op==='EXPIRE')return 1;
 if(op==='EVAL'){assert.equal(args[0],practiceCasScript);assert.equal(args[1],1);const [,,key,old,next,ttl]=args;assert.equal(ttl,7200);if(conflicts>0){conflicts--;return 0;}if((store.get(key)??'')!==old)return 0;store.set(key,next);if(loseResponse){loseResponse=false;throw Error('Lost response');}return 1;}
 throw Error('Unexpected command '+op);
};
globalThis.fetch=async(url,options)=>{assert.ok(String(url).startsWith('https://practice-redis.test'));const body=JSON.parse(options.body),payload=String(url).endsWith('/pipeline')?body.map(c=>({result:execute(c)})):({result:execute(body)});return {ok:true,json:async()=>payload};};
test.after(()=>{globalThis.fetch=savedFetch;});
const reset=()=>{store.clear();conflicts=0;loseResponse=false;for(const [id,playerId] of [[a,player],[b,b],[recovered,player]])store.set('geek:session:'+id,JSON.stringify({id,playerId,name:'Practice Geek'}));};
const call=async(body,cookie=a,method='POST')=>{const result={status:200,headers:{}};const res={setHeader(k,v){result.headers[k]=v;},status(n){result.status=n;return this;},json(body){result.body=body;return this;},end(){return this;}};await rankedHandler({method,query:{service:'practice'},headers:cookie?{cookie:'geek_session='+cookie}:{},body},res);return result;};
const start=async()=>{const r=await call({action:'start'});assert.equal(r.status,200);return r.body.practice;};
const stateFor=id=>decodePractice(store.get('geek:assisted:run:'+id));
const answerFor=s=>{const q=loadQuestionBank('kaspa').byId.get(s.ids[s.index]);return s.current.options.indexOf(q.options[q.correctIndex]);};

test('free rules, private questions and lifelines require a player session without monetary writes',async()=>{
 reset();const publicRules=await call({},null,'GET');assert.equal(publicRules.status,200);assert.equal(publicRules.body.rules.rewardsEnabled,false);assert.equal((await call({action:'start'},null)).status,401);
 store.set('geek:profile:'+player,'untouched-profile');store.set('geek:economy:v1:'+player,'untouched-journal');
 const p=await start();assert.equal(p.rules,practiceRules);assert.equal(p.question.options.length,4);assert.equal(p.question.number,1);assert.ok(!('correctIndex' in p.question));assert.deepEqual(p.used,{'fifty-fifty':false,'extra-time':false});
 assert.equal(store.get('geek:profile:'+player),'untouched-profile');assert.equal(store.get('geek:economy:v1:'+player),'untouched-journal');assert.ok(![...store.keys()].some(k=>k.startsWith('geek:run:')||k.startsWith('geek:leaderboard:')));
 assert.equal((await call({action:'view',runId:p.id,playerId:player},b)).status,404);assert.equal((await call({action:'view',runId:p.id},recovered)).status,200);
});
test('50/50 removes exactly two wrong answers, preserves indices and cannot be spent twice',async()=>{
 reset();const p=await start(), state=stateFor(p.id), correct=answerFor(state), body={action:'lifeline',runId:p.id,questionToken:p.question.token,item:'fifty-fifty'};
 const r=await call(body);assert.equal(r.status,200);const q=r.body.practice.question;assert.equal(q.removed.length,2);assert.ok(!q.removed.includes(correct));assert.deepEqual(q.options,p.question.options);
 const repeated=await call(body);assert.deepEqual(repeated.body.practice.question.removed,q.removed);
 assert.equal((await call({action:'answer',runId:p.id,questionToken:q.token,selectedIndex:q.removed[0]})).status,400);
 const answer=await call({action:'answer',runId:p.id,questionToken:q.token,selectedIndex:correct});assert.equal(answer.body.practice.correct,1);assert.equal(answer.body.practice.question,null);assert.equal(answer.body.practice.feedback.answer,q.options[correct]);
 const next=await call({action:'next',runId:p.id,questionToken:q.token});assert.deepEqual(next.body.practice.question.removed,[]);assert.equal(next.body.practice.used['fifty-fifty'],true);
 await call({...body,questionToken:next.body.practice.question.token});assert.deepEqual(stateFor(p.id).current.removed,[]);
});
test('Extra Time adds exactly ten seconds once, remains used, and cannot revive expired questions',async()=>{
 reset();const p=await start(), s=stateFor(p.id), body={action:'lifeline',questionToken:p.question.token,item:'extra-time'};
 const boosted=transitionPractice(s,body,s.current.deadline-1);assert.equal(boosted.current.deadline,s.current.deadline+10000);assert.equal(transitionPractice(boosted,body,s.current.deadline).current.deadline,boosted.current.deadline);
 assert.throws(()=>transitionPractice(s,body,s.current.deadline),/TIME_CLOSED/);assert.equal(s.used['extra-time'],false);
 const answered=transitionPractice(boosted,{action:'answer',questionToken:p.question.token,selectedIndex:answerFor(boosted)},boosted.current.deadline+351);assert.equal(answered.history[0].selectedIndex,-1);assert.equal(answered.history[0].correct,false);
 const next=transitionPractice(answered,{action:'next',questionToken:p.question.token},100000);assert.equal(next.current.deadline,115000);assert.equal(next.used['extra-time'],true);
});
test('answer and Next retries preserve a single result and never restart the clock',async()=>{
 reset();const p=await start(), s=stateFor(p.id), body={action:'answer',runId:p.id,questionToken:p.question.token,selectedIndex:answerFor(s)};
 const r=await call(body);assert.equal(r.body.practice.answered,1);assert.equal(r.body.practice.question,null);assert.equal(r.body.practice.finished,false);
 const repeated=await call(body);assert.equal(repeated.body.practice.answered,1);
 const nextBody={action:'next',runId:p.id,questionToken:p.question.token};const n=await call(nextBody), deadline=n.body.practice.question.expiresAt;
 const again=await call(nextBody);assert.equal(again.body.practice.question.expiresAt,deadline);assert.equal(again.body.practice.question.token,n.body.practice.question.token);
 assert.equal((await call({...body,questionToken:'f'.repeat(32)})).status,409);
});
test('concurrent clicks and lost commit replies cannot duplicate use or results',async()=>{
 reset();const p=await start(), body={action:'lifeline',runId:p.id,questionToken:p.question.token,item:'extra-time'}, deadline=p.question.expiresAt;
 const r=await Promise.all([call(body),call(body),call(body)]);assert.ok(r.every(x=>x.status===200));assert.equal(stateFor(p.id).current.deadline,deadline+10000);
 loseResponse=true;const answer={action:'answer',runId:p.id,questionToken:p.question.token,selectedIndex:answerFor(stateFor(p.id))};assert.equal((await call(answer)).status,500);
 const retry=await call(answer);assert.equal(retry.status,200);assert.equal(retry.body.practice.answered,1);assert.equal(stateFor(p.id).history.length,1);
});
test('answer and lifeline race settles one authoritative state',async()=>{
 reset();const p=await start(), answer={action:'answer',runId:p.id,questionToken:p.question.token,selectedIndex:answerFor(stateFor(p.id))}, boost={action:'lifeline',runId:p.id,questionToken:p.question.token,item:'extra-time'};
 const r=await Promise.all([call(answer),call(boost)]);assert.equal(r[0].status,200);assert.ok([200,409].includes(r[1].status));const state=stateFor(p.id);assert.equal(state.history.length,1);assert.equal(state.current,null);
});
test('ten questions complete a free session and fresh sessions replenish only practice uses',async()=>{
 reset();const p=await start();for(let i=0;i<10;i++){const s=stateFor(p.id);const r=await call({action:'answer',runId:p.id,questionToken:s.current.token,selectedIndex:answerFor(s)});assert.equal(r.status,200);assert.equal(r.body.practice.answered,i+1);if(i<9)await call({action:'next',runId:p.id,questionToken:s.current.token});else {assert.equal(r.body.practice.finished,true);assert.equal(r.body.practice.correct,10);assert.equal(r.body.practice.history.length,10);assert.equal(r.body.practice.question,null);}}
 const fresh=await start();assert.notEqual(fresh.id,p.id);assert.equal(fresh.answered,0);assert.deepEqual(fresh.used,{'fifty-fifty':false,'extra-time':false});
});
test('invalid states and bounded CAS failures preserve records',async()=>{
 reset();const p=await start(), s=stateFor(p.id);const broken={...s,current:{...s.current,removed:[answerFor(s),0]}};assert.throws(()=>decodePractice(JSON.stringify(broken)),/STATE_INVALID/);
 conflicts=8;const raw=store.get('geek:assisted:run:'+p.id);assert.equal((await call({action:'lifeline',runId:p.id,questionToken:p.question.token,item:'extra-time'})).status,409);assert.equal(store.get('geek:assisted:run:'+p.id),raw);
 store.set('geek:assisted:run:'+p.id,'invalid');assert.equal((await call({action:'view',runId:p.id})).status,503);assert.equal(store.get('geek:assisted:run:'+p.id),'invalid');
});
