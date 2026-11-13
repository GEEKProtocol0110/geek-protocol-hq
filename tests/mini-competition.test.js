import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { redisFixture } from './helpers/redis-fixture.js';
import { startMini, playMini, listMini, forgetMini, miniQuestions, miniBankVersion } from '../server/mini/competition.js';
import handler from '../api/mini.js';

const bank=JSON.parse(readFileSync(new URL('../server/mini/public-practice-bank.json',import.meta.url)));
const answer=q=>bank.find(v=>v.id===q.id).answer;
const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(s){this.statusCode=s;return this;},json(b){this.body=b;},end(){}});

test('Mini public scoring uses real Redis for grading, concurrency, expiry and removal',async t=>{
 const fixture=await redisFixture(), original=globalThis.fetch, old=[process.env.UPSTASH_REDIS_REST_URL,process.env.UPSTASH_REDIS_REST_TOKEN];
 process.env.UPSTASH_REDIS_REST_URL='https://mini-test.invalid';process.env.UPSTASH_REDIS_REST_TOKEN='test-only-mini';
 globalThis.fetch=async(url,options)=>{assert.ok(String(url).startsWith('https://mini-test.invalid'));const body=JSON.parse(options.body);const many=String(url).endsWith('/pipeline')||String(url).endsWith('/multi-exec');const results=await fixture.commands(many?body:[body]);return new Response(JSON.stringify(many?results.map(result=>({result})):{result:results[0]}));};
 let now=Date.parse('2026-11-05T18:00:00Z');t.mock.method(Date,'now',()=>now);
 t.after(async()=>{globalThis.fetch=original;for(const [i,k]of['UPSTASH_REDIS_REST_URL','UPSTASH_REDIS_REST_TOKEN'].entries()){if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];}await fixture.close();});
 const fresh=async(mode='daily',focus='mixed')=>startMini('',mode,focus);
 const finish=async(r)=>{let s=r.state;while(!s.finished)s=await playMini(r.token,s.id,'answer',s.index,answer(s.question));return s;};
 await t.test('Daily is shared, active payload has no answer, and an exact retry returns the same attempt',async()=>{
  await fixture.command('FLUSHDB');const a=await fresh(),b=await fresh();assert.equal(a.state.question.id,b.state.question.id);assert.deepEqual(Object.keys(a.state.question).sort(),['choices','id','question','topic']);assert.equal(a.state.feedback,null);
  const ids=await Promise.all([startMini(a.token,'daily'),startMini(a.token,'daily')]);assert.ok(ids.every(r=>r.state.id===a.state.id));assert.equal(a.state.total,5);
  const out=await finish(a);assert.equal(out.score,5);assert.equal(out.review.length,5);assert.equal((await startMini(a.token,'daily')).state.finished,true);assert.equal((await listMini('daily')).players,1);
 });
 await t.test('racing identical answers score once; changed and out-of-order answers cannot overwrite',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh();const good=answer(r.state.question),bad=(good+1)%4;
  const out=await Promise.all([playMini(r.token,r.state.id,'answer',0,bad),playMini(r.token,r.state.id,'answer',0,bad)]);assert.ok(out.every(s=>s.index===1&&s.score===0));
  await assert.rejects(()=>playMini(r.token,r.state.id,'answer',0,good),/MINI_ANSWER_LOCKED/);await assert.rejects(()=>playMini(r.token,r.state.id,'answer',3,0),/MINI_ANSWER_ORDER/);
  const raw=JSON.parse(await fixture.command('GET',`geek:mini:v1:round:${r.state.id}`));assert.equal(raw.answers.length,1);
 });
 await t.test('another identity cannot read or answer a round; missing identities fail closed',async()=>{
  await fixture.command('FLUSHDB');const a=await fresh(),b=await fresh();await assert.rejects(()=>playMini(b.token,a.state.id,'state'),/MINI_ROUND_INVALID/);await assert.rejects(()=>startMini('a'.repeat(64),'speed'),/MINI_ID_REQUIRED/);await assert.rejects(()=>playMini('',a.state.id,'answer',0,0),/MINI_ID_REQUIRED/);
 });
 await t.test('late Speed answers are not graded; refresh/resume closes and publishes exactly once',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh('speed');let s=await playMini(r.token,r.state.id,'answer',0,answer(r.state.question));now+=30001;
  s=await playMini(r.token,r.state.id,'answer',1,answer(s.question));assert.equal(s.finished,true);assert.equal(s.index,1);assert.equal(s.score,1);assert.equal((await listMini('speed')).players,1);
  const retry=await playMini(r.token,r.state.id,'finish');assert.equal(retry.score,1);await assert.rejects(()=>startMini(r.token,'speed'),/MINI_COOLDOWN/);
  now+=30001;assert.notEqual((await startMini(r.token,'speed')).state.id,r.state.id);
 });
 await t.test('Daily and Speed are independent; Speed topics stay separate and cannot bypass cooldown',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh();await finish(r);const s=await startMini(r.token,'speed','wallets');assert.equal(s.state.mode,'speed');assert.equal(s.state.focus,'wallets');const out=await finish(s);assert.equal(out.score,10);assert.equal((await listMini('speed','wallets')).players,1);assert.equal((await listMini('speed','mixed')).players,0);await assert.rejects(()=>startMini(r.token,'speed','builders'),/MINI_COOLDOWN/);
 });
 await t.test('ties share competition rank and repeated publication does not increase player counts',async()=>{
  await fixture.command('FLUSHDB');const a=await fresh(),b=await fresh(),c=await fresh();await finish(a);await finish(b);await playMini(c.token,c.state.id,'finish');const board=await listMini('daily');assert.equal(board.players,3);assert.deepEqual(board.entries.map(e=>e.rank),[1,1,3]);assert.ok(board.entries.every(e=>!('token'in e)&&!('player'in e)));await playMini(a.token,a.state.id,'finish');assert.equal((await listMini('daily')).players,3);
 });
 await t.test('Daily boundaries and bank version isolate boards',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh();await finish(r);now+=86400000;assert.equal((await listMini('daily')).players,0);const next=await startMini(r.token,'daily');assert.notEqual(next.state.id,r.state.id);assert.notEqual(next.state.day,r.state.day);const key=`geek:mini:v1:round:${next.state.id}`;const s=JSON.parse(await fixture.command('GET',key));s.bankVersion='other';await fixture.command('SET',key,JSON.stringify(s));await assert.rejects(()=>playMini(r.token,next.state.id,'state'),/MINI_BANK_CHANGED/);
 });
 await t.test('self-removal wins against delayed scoring and leaves no public entry',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh();await finish(r);await forgetMini(r.token);assert.equal((await listMini('daily')).players,0);await assert.rejects(()=>playMini(r.token,r.state.id,'finish'),/MINI_ID_REQUIRED/);
  for(let i=0;i<5;i++){const a=await fresh();await Promise.allSettled([playMini(a.token,a.state.id,'finish'),forgetMini(a.token)]);const id=createHash('sha256').update(a.token).digest('hex');assert.equal(await fixture.command('GET',`geek:mini:v1:player:${id}`),null);const board=await listMini('daily');assert.ok(!board.entries.some(e=>e.name===a.state.name));}
 });
 await t.test('API ignores forged scores and returns safe errors and public reads without an HQ session',async()=>{
  await fixture.command('FLUSHDB');const res=response();await handler({method:'GET',query:{mode:'daily'},headers:{}},res);assert.equal(res.statusCode,200);assert.equal(res.body.source,'mini');
  const r=await fresh();const bad=response();await handler({method:'POST',headers:{authorization:`Bearer ${r.token}`},body:{action:'answer',id:r.state.id,index:0,choice:(answer(r.state.question)+1)%4,score:999999}},bad);assert.equal(bad.statusCode,200);assert.equal(bad.body.state.score,0);assert.doesNotMatch(JSON.stringify(bad.body),new RegExp(r.token));
  const no=response();await handler({method:'POST',headers:{},body:{action:'answer',id:r.state.id,index:1,choice:0}},no);assert.equal(no.statusCode,401);assert.doesNotMatch(JSON.stringify(no.body),/redis|Bearer|test-only|mini-test/);
 });
 await t.test('board and run retention are bounded',async()=>{
  await fixture.command('FLUSHDB');const r=await fresh();assert.ok(await fixture.command('TTL',`geek:mini:v1:round:${r.state.id}`)<=3600);await finish(r);const key=`geek:mini:v1:board:${miniBankVersion}:daily:${r.state.day}`;assert.ok(await fixture.command('TTL',key)<=35*86400);assert.equal(miniQuestions('speed',r.state.day,'wallets').length,10);
  const id=createHash('sha256').update(r.token).digest('hex');const registry=`geek:mini:v1:boards:${id}`;await fixture.command('SADD',registry,'geek:mini:v1:expired-board');const speed=await startMini(r.token,'speed');await finish(speed);assert.equal(await fixture.command('SISMEMBER',registry,'geek:mini:v1:expired-board'),0);
 });
});
