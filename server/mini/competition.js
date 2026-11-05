import { createHash, randomBytes, randomInt } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { redis, pipeline, rateLimit } from '../redis.js';

// This is Mini's already-public practice bank, never the future private ranked bank.
const bank = JSON.parse(readFileSync(new URL('./public-practice-bank.json', import.meta.url), 'utf8'));
export const miniBankVersion = createHash('sha256').update(JSON.stringify(bank)).digest('hex').slice(0,16);
const topics = { mixed:null, basics:['Kaspa basics','KAS units'], network:['Blocks and consensus','Network history','Network events'], wallets:['Wallet basics','Transactions'], builders:['Builder basics','Node basics','Application data','Programmability','KRC-20'] };
const prefix = 'geek:mini:v1:';
const retention = 90 * 86400;
const fail = code => { throw new Error(code); };
const player = token => /^[a-f0-9]{64}$/.test(token || '') ? createHash('sha256').update(token).digest('hex') : fail('MINI_ID_REQUIRED');
const config = (mode, focus) => ({ mode:mode === 'speed' ? 'speed' : 'daily', focus:mode === 'speed' && Object.hasOwn(topics, focus) ? focus : 'mixed' });
const date = now => new Date(now).toISOString().slice(0,10);
const boardFor = ({mode,focus,day}) => `${prefix}board:${miniBankVersion}:${mode}:${mode === 'daily' ? day : focus}`;
const parse = raw => { try { return JSON.parse(raw); } catch { return null; } };
const shuffle = (items, random) => { const a=[...items]; for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
const seeded = text => { let n=2166136261; for(const c of text)n=Math.imul(n^c.charCodeAt(0),16777619); let state=n>>>0||1; return () => {state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;}; };
export const miniQuestions = (mode, day, focus='mixed') => shuffle(bank.filter(q => mode !== 'speed' || !topics[focus] || topics[focus].includes(q.topic)), mode === 'daily' ? seeded(day) : () => randomInt(0,2**32)/2**32).slice(0,mode === 'daily'?5:10);
const publicState = (s,now=Date.now()) => {
  const review=s.answers.map(a=>{const q=bank.find(q=>q.id===a.id);return {question:q.question,selected:a.choice,correct:q.answer,explain:q.explain,source:q.source};});
  const q=s.finished?null:bank.find(q=>q.id===s.ids[s.answers.length]);
  return {id:s.id,mode:s.mode,focus:s.focus,day:s.day,name:s.name,score:s.score,total:s.ids.length,index:s.answers.length,finished:s.finished,remainingMs:Math.max(0,s.deadline-now),bankVersion:s.bankVersion,question:q?{id:q.id,question:q.question,choices:q.choices,topic:q.topic}:null,feedback:review.at(-1)||null,...(s.finished?{review}:{})};
};

// Atomic creation makes retries/resumes use one round and one Daily attempt.
export const MINI_START_LUA = `-- geek-mini-start-v1
if redis.call('GET',KEYS[5])~=ARGV[6] then return 'IDENTITY' end
local old=nil
if ARGV[5]=='daily' then old=redis.call('GET',KEYS[1]) end
if old then return old end
local active=redis.call('GET',KEYS[2])
if active then
 local raw=redis.call('GET',ARGV[3]..active)
 if raw then local s=cjson.decode(raw); if not s.finished then return active end end
end
local cooldown=tonumber(redis.call('GET',KEYS[3]) or '0')
if ARGV[5]=='speed' and cooldown>tonumber(ARGV[2]) then return 'COOLDOWN' end
redis.call('SET',KEYS[4],ARGV[1],'EX',3600)
redis.call('SET',KEYS[2],ARGV[4],'EX',1800)
if ARGV[5]=='daily' then redis.call('SET',KEYS[1],ARGV[4],'EX',172800) end
return ARGV[4]`;

// CAS and score publication share one transaction. Duplicate delivery cannot score twice.
export const MINI_SAVE_LUA = `-- geek-mini-save-v1
if redis.call('GET',KEYS[6])~=ARGV[8] then return -1 end
local old=redis.call('GET',KEYS[1])
if old~=ARGV[1] then return 0 end
redis.call('SET',KEYS[1],ARGV[2],'EX',3600)
if ARGV[3]=='1' then
 local prev=redis.call('ZSCORE',KEYS[2],ARGV[4])
 if not prev or tonumber(ARGV[5])>tonumber(prev) then
  redis.call('ZADD',KEYS[2],ARGV[5],ARGV[4]);redis.call('HSET',KEYS[3],ARGV[4],ARGV[6])
 end
 redis.call('EXPIRE',KEYS[2],ARGV[7]);redis.call('EXPIRE',KEYS[3],ARGV[7])
 for _,board in ipairs(redis.call('SMEMBERS',KEYS[4])) do
  if redis.call('EXISTS',board)==0 then redis.call('SREM',KEYS[4],board) end
 end
 redis.call('SADD',KEYS[4],KEYS[2]);redis.call('EXPIRE',KEYS[4],ARGV[7])
 redis.call('SET',KEYS[5],ARGV[9],'EX',30)
 local excess=redis.call('ZCARD',KEYS[2])-10000
 if excess>0 then
  local removed=redis.call('ZRANGE',KEYS[2],0,excess-1)
  for _,id in ipairs(removed) do redis.call('HDEL',KEYS[3],id) end
  redis.call('ZREMRANGEBYRANK',KEYS[2],0,excess-1)
 end
end
return 1`;

export async function startMini(token, mode, focus) {
  const now=Date.now(), selected=config(mode,focus);
  let fresh=false;
  if (!token) { await rateLimit('mini-identities', date(now), 10000, 86400); token=randomBytes(32).toString('hex'); fresh=true; }
  const id=player(token);
  await rateLimit('mini-start',id,15,60);
  const name=`Mini Geek ${id.slice(0,12).toUpperCase()}`;
  if(fresh)await redis('SET',`${prefix}player:${id}`,name,'EX',retention,'NX');
  else if(await redis('GET',`${prefix}player:${id}`)!==name)fail('MINI_ID_REQUIRED');
  await redis('EXPIRE',`${prefix}player:${id}`,retention);
  const roundId=randomBytes(16).toString('hex');
  const state={...selected,id:roundId,player:id,name,day:date(now),bankVersion:miniBankVersion,ids:miniQuestions(selected.mode,date(now),selected.focus).map(q=>q.id),answers:[],score:0,finished:false,deadline:now+(selected.mode==='speed'?30000:20*60000)};
  const chosen=await redis('EVAL',MINI_START_LUA,5,`${prefix}daily:${id}:${state.day}`,`${prefix}active:${id}:${selected.mode}`,`${prefix}cooldown:${id}:${selected.mode}`,`${prefix}round:${roundId}`,`${prefix}player:${id}`,JSON.stringify(state),now,`${prefix}round:`,roundId,selected.mode,name);
  if(chosen==='IDENTITY')fail('MINI_ID_REQUIRED');
  if(chosen==='COOLDOWN')fail('MINI_COOLDOWN');
  const raw=await redis('GET',`${prefix}round:${chosen}`), stored=parse(raw);
  if(!stored||stored.player!==id)fail('MINI_DAILY_USED');
  if(stored.bankVersion!==miniBankVersion)fail('MINI_BANK_CHANGED');
  return {token,state:publicState(stored)};
}

export async function playMini(token, roundId, action, index, choice) {
  const id=player(token), now=Date.now();
  if(!/^[a-f0-9]{32}$/.test(roundId||''))fail('INVALID_REQUEST');
  if(await redis('GET',`${prefix}player:${id}`)===null)fail('MINI_ID_REQUIRED');
  await rateLimit('mini-answer',id,90,60);
  for(let attempt=0;attempt<4;attempt++){
    const key=`${prefix}round:${roundId}`, raw=await redis('GET',key), s=parse(raw);
    if(!s||s.player!==id)fail('MINI_ROUND_INVALID');
    if(s.bankVersion!==miniBankVersion)fail('MINI_BANK_CHANGED');
    if(s.finished)return publicState(s);
    if(action==='state'&&now<s.deadline)return publicState(s);
    if(action!=='answer'&&action!=='finish'&&action!=='state')fail('INVALID_REQUEST');
    if(action==='answer'&&now<s.deadline){
      if(!Number.isInteger(index)||!Number.isInteger(choice)||choice<0||choice>3)fail('INVALID_REQUEST');
      if(index<s.answers.length){if(s.answers[index]?.choice!==choice)fail('MINI_ANSWER_LOCKED');return publicState(s);}
      if(index!==s.answers.length)fail('MINI_ANSWER_ORDER');
      const q=bank.find(q=>q.id===s.ids[index]);if(!q)fail('MINI_ROUND_INVALID');
      s.answers.push({id:q.id,choice});s.score+=Number(choice===q.answer);
    }
    s.finished=action==='finish'||now>=s.deadline||s.answers.length===s.ids.length;
    const board=boardFor(s), meta={name:s.name,score:s.score,total:s.ids.length,answered:s.answers.length,updatedAt:now};
    const saved=await redis('EVAL',MINI_SAVE_LUA,6,key,board,`${board}:meta`,`${prefix}boards:${id}`,`${prefix}cooldown:${id}:${s.mode}`,`${prefix}player:${id}`,raw,JSON.stringify(s),s.finished?'1':'0',id,s.score,JSON.stringify(meta),s.mode==='daily'?35*86400:retention,s.name,now+30000);
    if(Number(saved)===-1)fail('MINI_ID_REQUIRED');
    if(Number(saved)===1)return publicState(s);
  }
  fail('MINI_BUSY');
}

export async function listMini(mode, focus) {
  const selected=config(mode,focus), day=date(Date.now()), key=boardFor({...selected,day});
  const [raw,count]=await pipeline([['ZREVRANGE',key,0,49,'WITHSCORES'],['ZCARD',key]]);
  if(!Array.isArray(raw))fail('REDIS_UNAVAILABLE');
  const ids=raw.filter((_,i)=>i%2===0);
  const rows=ids.length?await pipeline(ids.flatMap((id,i)=>[['HGET',`${key}:meta`,id],['ZCOUNT',key,`(${Number(raw[i*2+1])}`,'+inf']])):[];
  return {ok:true,source:'mini',...selected,day,bankVersion:miniBankVersion,players:Number(count),entries:ids.map((id,i)=>{const v=parse(rows[i*2]);if(!v||!/^Mini Geek [A-F0-9]{12}$/.test(v.name))return null;return {...v,rank:Number(rows[i*2+1])+1};}).filter(Boolean)};
}

export const MINI_FORGET_LUA = `-- geek-mini-forget-v1
local boards=redis.call('SMEMBERS',KEYS[2])
if #boards>200 then return 0 end
for _,board in ipairs(boards) do redis.call('ZREM',board,ARGV[1]);redis.call('HDEL',board..':meta',ARGV[1]) end
for i=3,4 do local active=redis.call('GET',KEYS[i]);if active then redis.call('DEL',ARGV[2]..active) end end
redis.call('DEL',unpack(KEYS))
return 1`;
export async function forgetMini(token){
  const id=player(token);
  const ok=await redis('EVAL',MINI_FORGET_LUA,6,`${prefix}player:${id}`,`${prefix}boards:${id}`,`${prefix}active:${id}:daily`,`${prefix}active:${id}:speed`,`${prefix}cooldown:${id}:daily`,`${prefix}cooldown:${id}:speed`,id,`${prefix}round:`);
  if(Number(ok)!==1)fail('MINI_BUSY');
  return {ok:true};
}
