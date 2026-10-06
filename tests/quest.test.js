import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import { firstSignal, questChecks, insideBlockdag, questChapters, checksFor, getChapter } from '../public/quest/assets/chapter.js';
import { decodeQuest, questKey, mutateQuest } from '../server/quest.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) { if (process.env.QUEST_REQUIRE_REDIS === '1' || process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error; }
const run = fixture ? test : (name, fn) => test(name, { skip: 'Install redis-server; required in CI for Quest transactions.' }, fn);
const originalFetch = globalThis.fetch;
if (fixture) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.quest.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/redis\.quest\.test/);
    const values = JSON.parse(options.body);
    const payload = String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
    return new Response(JSON.stringify(payload));
  };
}
after(async () => { globalThis.fetch = originalFetch; if (fixture) await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end() {} });
const request = (method, body, cookie, query = {}) => ({ method, body, headers: { cookie, 'x-forwarded-for': '127.0.0.1', 'user-agent': 'quest-fixture' }, query });
const session = async name => { const r = response(); await sessionHandler(request('POST', { displayName: name }, ''), r); assert.equal(r.statusCode, 200); return r.headers['Set-Cookie'].split(';')[0]; };
const id = cookie => cookie.split('=')[1];
const call = async (cookie, body, query = {}) => { const r = response(); await rankedHandler(request(body ? 'POST' : 'GET', body, cookie, { service: 'quest', ...query }), r); return r; };
const key = (cookie, chapter = firstSignal) => questKey(id(cookie), chapter.id);
const current = async (cookie, chapter = firstSignal) => { const r = await call(cookie, undefined, { chapter: chapter.id }); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body.quest; };
const actionFor = (q, action, extra = {}) => ({ action, revision: q.revision, ...(action !== 'begin' ? { attemptId: q.attempt.id, stepToken: q.attempt.token } : {}), ...extra });
const act = async (cookie, action, extra = {}, chapter = firstSignal) => {
  const q = await current(cookie, chapter), r = await call(cookie, actionFor(q, action, { ...(chapter.id !== firstSignal.id ? { chapterId: chapter.id } : {}), ...extra }), { chapter: chapter.id }); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body.quest;
};
const fresh = async () => { await fixture.command('FLUSHDB'); return session('Explorer'); };
const answer = async (cookie, correct = true, chapter = firstSignal) => {
  const state = JSON.parse(await fixture.command('GET', key(cookie, chapter))), q = checksFor(chapter)[state.run.index];
  const choice = correct ? q.correctIndex : (q.correctIndex + 1) % 4;
  return act(cookie, 'answer', { selectedIndex: state.run.orders[state.run.index].indexOf(choice) }, chapter);
};
const complete = async (cookie, wrongAt = [0, 4], chapter = firstSignal) => {
  if (!(await current(cookie, chapter)).attempt) await act(cookie, 'begin', {}, chapter);
  for (let i = 0; i < 25; i++) {
    const q = await current(cookie, chapter); if (q.attempt.status === 'complete') return q;
    if (q.attempt.status === 'question') await answer(cookie, !wrongAt.includes(q.attempt.index), chapter);
    else await act(cookie, 'continue', {}, chapter);
  }
  throw new Error('Chapter did not complete within its fixed transition count');
};

const legacyFirst = () => {
  const attemptId='a'.repeat(32), stepToken='f'.repeat(32);
  const command={action:'continue',revision:15,attemptId,stepToken};
  const answers=questChecks.map(q=>({checkpointId:q.id,selectedChoice:q.correctIndex,correct:true,answeredAt:1700000000001}));
  const legacy={version:1,contentVersion:1,revision:16,createdAt:1700000000000,updatedAt:1700000000002,
    run:{id:attemptId,token:'b'.repeat(32),startedAt:1700000000000,status:'complete',index:5,orders:questChecks.map(()=>[0,1,2,3]),answers},
    badge:{id:'first-signal',awardedAt:1700000000002,attemptId},lastCompleted:{attemptId,completedAt:1700000000002,answers},
    lastMutation:createHash('sha256').update(JSON.stringify(['continue',15,attemptId,stepToken,null])).digest('hex')};
  return { raw: JSON.stringify(legacy), command };
};
const seedPrerequisite = async cookie => { const {raw}=legacyFirst(); await fixture.command('SET',key(cookie),raw); return raw; };

test('First Signal has three sourced scenes, six distinct checks, and no ranked question IDs', () => {
  assert.equal(firstSignal.scenes.length, 3); assert.equal(questChecks.length, 6);
  assert.equal(new Set(questChecks.map(q => q.id)).size, 6);
  for (const scene of firstSignal.scenes) {
    assert.ok(scene.story && scene.giga && scene.objective && scene.example); assert.equal(scene.notes.length, 3);
    assert.equal(scene.checkpoints.length, 2); assert.equal(new URL(scene.source.url).protocol, 'https:');
    for (const q of scene.checkpoints) { assert.equal(new Set(q.choices).size, 4); assert.ok(q.choices[q.correctIndex] && q.explanation); }
  }
  const source = readFileSync(new URL('../public/quest/assets/chapter.js', import.meta.url), 'utf8');
  assert.equal(/kaspa-questions|ranked|questionToken/.test(source.replace('// Public teaching content, separate from private ranked question banks.', '')), false);
});
run('reading Quest is private and write-free until explicit begin; completed steps resume', async () => {
  const cookie = await fresh(), other = await session('Other');
  assert.equal((await call('', undefined)).statusCode, 401);
  const q = await current(cookie); assert.equal(q.attempt, null); assert.equal(q.revision, 0); assert.equal(await fixture.command('EXISTS', key(cookie)), 0);
  const start = await act(cookie, 'begin'); assert.equal(start.attempt.status, 'lesson'); assert.equal(start.attempt.answered, 0);
  await act(cookie, 'continue'); const feedback = await answer(cookie, false);
  assert.equal(feedback.attempt.status, 'feedback'); assert.equal(feedback.review.length, 1); assert.equal(feedback.feedback.correct, false);
  assert.deepEqual(await current(cookie), feedback);
  const privateView = await call(other, undefined, { playerId: id(cookie), attemptId: feedback.attempt.id });
  assert.equal(privateView.body.quest.attempt, null);
  const serialized = JSON.stringify(feedback); assert.equal(serialized.includes(id(cookie)), false); assert.equal(serialized.includes('orders'), false);
});
run('skips, forged badge/score fields, wrong tokens and premature replay cannot advance progress', async () => {
  const cookie = await fresh(); let q = await current(cookie);
  assert.equal((await call(cookie, { ...actionFor(q, 'begin'), badge: { id: 'first-signal' } })).statusCode, 400);
  q = await act(cookie, 'begin'); const before = await fixture.command('GET', key(cookie));
  assert.equal((await call(cookie, actionFor(q, 'answer', { selectedIndex: 0 }))).statusCode, 409);
  assert.equal((await call(cookie, actionFor(q, 'replay'))).statusCode, 409);
  assert.equal((await call(cookie, { ...actionFor(q, 'continue'), stepToken: 'a'.repeat(32) })).statusCode, 409);
  assert.equal((await call(cookie, { ...actionFor(q, 'continue'), index: 5, complete: true })).statusCode, 400);
  assert.equal(await fixture.command('GET', key(cookie)), before);
  q = await act(cookie, 'continue');
  for (const selectedIndex of [-1, 4, 0.5, '0']) assert.equal((await call(cookie, actionFor(q, 'answer', { selectedIndex }))).statusCode, 400);
});
run('concurrent different answers accept only one; exact retries are idempotent', async () => {
  const cookie = await fresh(); await act(cookie, 'begin'); await act(cookie, 'continue');
  let q = await current(cookie), one = actionFor(q, 'answer', { selectedIndex: 0 }), two = actionFor(q, 'answer', { selectedIndex: 1 });
  const results = await Promise.all([call(cookie, one), call(cookie, two)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  q = results.find(r => r.statusCode === 200).body.quest;
  const accepted = results[0].statusCode === 200 ? one : two;
  const before = await fixture.command('GET', key(cookie));
  assert.deepEqual((await call(cookie, accepted)).body.quest, q); assert.equal(await fixture.command('GET', key(cookie)), before);
  const next = actionFor(q, 'continue'); const advances = await Promise.all([call(cookie, next), call(cookie, next)]);
  assert.deepEqual(advances.map(r => r.statusCode), [200, 200]); assert.equal(advances[0].body.quest.revision, q.revision + 1);
  assert.equal((await call(cookie, accepted)).statusCode, 409);
  assert.equal((await current(cookie)).attempt.answered, 1);
});
run('chapter completion and one-time badge are atomic, server-timed, and independent of accuracy', async () => {
  const cookie = await fresh(); await act(cookie, 'begin');
  for (let i = 0; i < 25; i++) {
    const q = await current(cookie);
    if (q.attempt.status === 'feedback' && q.attempt.index === 5) break;
    if (q.attempt.status === 'question') await answer(cookie, false); else await act(cookie, 'continue');
  }
  const before = await current(cookie); assert.equal(before.badge, null); assert.equal(before.lastCompleted, null); assert.equal(before.attempt.answered, 6);
  const finish = actionFor(before, 'continue'), results = await Promise.all([call(cookie, finish), call(cookie, finish)]);
  assert.deepEqual(results.map(r => r.statusCode), [200, 200]);
  const q = results[0].body.quest;
  assert.equal(q.attempt.status, 'complete'); assert.equal(q.attempt.correct, 0); assert.equal(q.review.length, 6);
  assert.equal(q.badge.id, 'first-signal'); assert.equal(q.badge.awardedAt, q.lastCompleted.completedAt);
  assert.equal(q.badge.attemptId, q.attempt.id); assert.equal(q.badge.transferable, false);
  assert.equal(await fixture.command('TTL', key(cookie)), -1);
});
run('replays preserve the original badge and completed review while new progress is saved', async () => {
  const cookie = await fresh(), first = await complete(cookie), badge = first.badge;
  const replay = await act(cookie, 'replay'); assert.equal(replay.attempt.status, 'lesson'); assert.notEqual(replay.attempt.id, first.attempt.id);
  assert.deepEqual(replay.badge, badge); assert.equal(replay.review.length, 2); assert.deepEqual(replay.lastCompleted, first.lastCompleted);
  assert.equal((await call(cookie, actionFor(first, 'continue'))).statusCode, 409);
  const second = await complete(cookie, []); assert.deepEqual(second.badge, badge); assert.equal(second.review.length, 0); assert.equal(second.attempt.correct, 6);
});
run('Quest never changes ranked XP, prestige, balances, collectibles or Study records', async () => {
  const cookie = await fresh(), playerId = id(cookie);
  const values = { [`geek:profile:${playerId}`]: '{"xp":900,"balance":50,"avatarId":"giga-builder","stickerInventory":{"giga-core":3}}', [`geek:prestige:${playerId}`]: '{"version":1,"prestige":1,"xpBaseline":500,"history":[]}', [`geek:study-progress:${playerId}`]: 'saved-study-fixture' };
  for (const [k, v] of Object.entries(values)) await fixture.command('SET', k, v);
  await complete(cookie); await complete(cookie, [], insideBlockdag);
  for (const [k, v] of Object.entries(values)) assert.equal(await fixture.command('GET', k), v);
  const q = await current(cookie); assert.equal(q.xpEnabled, false); assert.equal(q.creditsEnabled, false); assert.equal(q.tokensEnabled, false); assert.equal(q.ranked, false);
});
run('durable identity recovery resumes the same chapter and badge in a new session', async () => {
  const cookie = await fresh(), done = await complete(cookie), second = await complete(cookie, [], insideBlockdag), recovered = await session('Recovered');
  const k = `geek:session:${id(recovered)}`, record = JSON.parse(await fixture.command('GET', k)); record.playerId = id(cookie); await fixture.command('SET', k, JSON.stringify(record));
  assert.deepEqual((await current(recovered, insideBlockdag)).badge, second.badge);
  assert.deepEqual((await current(recovered)).badge, done.badge); assert.equal((await current(recovered)).attempt.id, done.attempt.id);
  await act(recovered, 'replay'); assert.equal((await current(cookie)).attempt.status, 'lesson');
});
run('corrupt chapter records fail closed without replacing progress or granting a badge', async () => {
  const cookie = await fresh(); await act(cookie, 'begin');
  const good = await fixture.command('GET', key(cookie));
  for (const change of [s => { s.version = 2; }, s => { s.run.answers = 12; }, s => { s.run.answers = [null]; }, s => { s.run.orders[0] = ['0','1','2','3']; }, s => { s.run.index = 5; }, s => { s.badge = {id:'fake'}; }, s => { delete s.lastCompleted; }]) {
    const s = JSON.parse(good); change(s); const corrupt = JSON.stringify(s); await fixture.command('SET', key(cookie), corrupt);
    const result = await call(cookie); assert.equal(result.statusCode, 503, JSON.stringify(result.body)); assert.equal(result.body.code, 'QUEST_STATE_INVALID');
    assert.equal(await fixture.command('GET', key(cookie)), corrupt);
    assert.throws(() => decodeQuest(corrupt), /QUEST_STATE_INVALID/);
  }
});


test('campaign content has two distinct three-stop chapters and no invented chapter fallback', () => {
  assert.deepEqual(questChapters.map(c => c.id), ['first-signal', 'inside-blockdag']);
  const allChecks = questChapters.flatMap(checksFor);
  assert.equal(new Set(allChecks.map(q => q.id)).size, 12);
  for (const chapter of questChapters) {
    assert.equal(chapter.scenes.length, 3); assert.equal(checksFor(chapter).length, 6);
    for (const scene of chapter.scenes) {
      assert.equal(scene.checkpoints.length, 2); assert.ok(scene.objective && scene.example && scene.giga && scene.story);
      assert.equal(new URL(scene.source.url).protocol, 'https:');
      for (const check of scene.checkpoints) { assert.equal(new Set(check.choices).size, 4); assert.ok(check.choices[check.correctIndex] && check.explanation); }
    }
  }
  assert.equal(getChapter('__proto__'), undefined); assert.equal(getChapter('unfinished'), undefined);
});
run('campaign reads are private, write-free and bounded; unknown or mismatched selectors are rejected', async () => {
  const cookie = await fresh();
  assert.equal((await call('', undefined, { campaign: '1' })).statusCode, 401);
  const r = await call(cookie, undefined, { campaign: '1' }); assert.equal(r.statusCode, 200);
  assert.equal(r.body.campaign.chapters.length, 2);
  assert.equal(r.body.campaign.chapters[0].status,'unstarted'); assert.equal(r.body.campaign.chapters[1].locked,true); assert.equal(r.body.campaign.chapters[1].prerequisite.id,firstSignal.id);
  assert.equal((await fixture.command('KEYS', 'geek:quest:*')).length, 0);
  for (const query of [{chapter:'unknown'}, {chapter:null}, {chapter:''}, {chapter:['first-signal','inside-blockdag']}, {campaign:'2'}, {campaign:'1',chapter:'first-signal'}]) assert.equal((await call(cookie, undefined, query)).statusCode, 400);
  assert.equal((await call(cookie, {action:'begin',revision:0}, {chapter:insideBlockdag.id})).statusCode, 400);
  assert.equal((await call(cookie, {action:'begin',revision:0,chapterId:firstSignal.id}, {chapter:insideBlockdag.id})).statusCode, 400);
  assert.equal((await call(cookie, {action:'begin',revision:0}, {campaign:'1'})).statusCode, 400);
  assert.equal((await fixture.command('KEYS', 'geek:quest:*')).length, 0);
});
run('Inside the blockDAG completes independently and replay preserves its badge and notes', async () => {
  const cookie = await fresh(); await seedPrerequisite(cookie);
  const original = await fixture.command('GET',key(cookie));
  const done = await complete(cookie, [1,3], insideBlockdag);
  assert.equal(done.chapter.id, insideBlockdag.id); assert.equal(done.attempt.correct,4);
  assert.equal(done.badge.id, insideBlockdag.id); assert.equal(done.badge.name,'BlockDAG Pathfinder');
  assert.equal(done.badge.awardedAt,done.lastCompleted.completedAt);
  assert.deepEqual(await current(cookie,insideBlockdag),done);
  assert.equal(await fixture.command('GET',key(cookie)),original);
  const replay = await act(cookie,'replay',{},insideBlockdag);
  assert.deepEqual(replay.badge,done.badge); assert.deepEqual(replay.lastCompleted,done.lastCompleted);
  const second = await complete(cookie,[],insideBlockdag);
  assert.equal(second.attempt.correct,6); assert.deepEqual(second.badge,done.badge);
  assert.equal(await fixture.command('GET',key(cookie)),original);
  assert.equal(await fixture.command('TTL',key(cookie,insideBlockdag)),-1);
  const campaign = (await call(cookie,undefined,{campaign:'1'})).body.campaign;
  assert.equal(campaign.chapters[0].status,'complete'); assert.equal(campaign.chapters[1].status,'complete');
  assert.equal(campaign.chapters[1].badge.id,insideBlockdag.id);
  for (const value of ['attemptId','token','orders','checkpointId',id(cookie)]) assert.equal(JSON.stringify(campaign).includes(value),false);
  const other = await session('Other'); assert.equal((await call(other,undefined,{campaign:'1',playerId:id(cookie)})).body.campaign.chapters[1].locked,true);
});
run('chapter tokens cannot cross records and simultaneous Chapter 2 answers still accept only one', async () => {
  const cookie = await fresh(); await seedPrerequisite(cookie);
  await act(cookie,'replay'); await act(cookie,'continue');
  await act(cookie,'begin',{},insideBlockdag); await act(cookie,'continue',{},insideBlockdag);
  const first = await current(cookie), next = await current(cookie,insideBlockdag);
  const original = await fixture.command('GET',key(cookie));
  const cross = actionFor(first,'answer',{chapterId:insideBlockdag.id,selectedIndex:0});
  assert.equal((await call(cookie,cross,{chapter:insideBlockdag.id})).statusCode,409);
  const mismatch = actionFor(next,'answer',{chapterId:insideBlockdag.id,selectedIndex:0});
  assert.equal((await call(cookie,mismatch,{chapter:firstSignal.id})).statusCode,400);
  const one=actionFor(next,'answer',{chapterId:insideBlockdag.id,selectedIndex:0}),two=actionFor(next,'answer',{chapterId:insideBlockdag.id,selectedIndex:1});
  const results=await Promise.all([call(cookie,one,{chapter:insideBlockdag.id}),call(cookie,two,{chapter:insideBlockdag.id})]);
  assert.deepEqual(results.map(r=>r.statusCode).sort(),[200,409]);
  const accepted=results[0].statusCode===200?one:two, saved=await fixture.command('GET',key(cookie,insideBlockdag));
  assert.equal((await call(cookie,accepted,{chapter:insideBlockdag.id})).statusCode,200);
  assert.equal(await fixture.command('GET',key(cookie,insideBlockdag)),saved);
  assert.equal(await fixture.command('GET',key(cookie)),original);
});
run('pre-campaign First Signal v1 receipts and exact command retries remain compatible without migration', async () => {
  const cookie=await fresh(), {raw,command}=legacyFirst(); await fixture.command('SET',key(cookie),raw);
  const before=await current(cookie); assert.equal(before.badge.name,'First Signal Explorer');
  assert.deepEqual((await call(cookie,command)).body.quest,before);
  await call(cookie,undefined,{campaign:'1'}); await complete(cookie,[],insideBlockdag);
  assert.equal(await fixture.command('GET',key(cookie)),raw);
  const replay=await act(cookie,'replay'); assert.deepEqual(replay.badge,before.badge);
});
run('one corrupt chapter is unavailable in the map without hiding or overwriting the other chapter', async () => {
  const cookie=await fresh(), done=await complete(cookie);
  await act(cookie,'begin',{},insideBlockdag); const good=await fixture.command('GET',key(cookie,insideBlockdag));
  const corrupt=JSON.parse(good); corrupt.chapterId=firstSignal.id;
  await fixture.command('SET',key(cookie,insideBlockdag),JSON.stringify(corrupt));
  const read=await call(cookie,undefined,{chapter:insideBlockdag.id}); assert.equal(read.statusCode,503);
  const map=(await call(cookie,undefined,{campaign:'1'})).body.campaign.chapters;
  assert.equal(map[0].badge.id,done.badge.id); assert.equal(map[0].available,true); assert.equal(map[1].available,false);
  assert.equal(JSON.stringify(map[1]).includes('badge'),false);
  await act(cookie,'replay'); assert.equal(await fixture.command('GET',key(cookie,insideBlockdag)),JSON.stringify(corrupt));
});

run('simultaneous Chapter 2 final continuations grant one badge even with six wrong answers', async () => {
  const cookie=await fresh(), chapter=insideBlockdag; const prerequisite=await seedPrerequisite(cookie);
  await act(cookie,'begin',{},chapter);
  for(let i=0;i<25;i++) {
    const q=await current(cookie,chapter);
    if(q.attempt.status==='feedback'&&q.attempt.index===5)break;
    if(q.attempt.status==='question')await answer(cookie,false,chapter); else await act(cookie,'continue',{},chapter);
  }
  const before=await current(cookie,chapter); assert.equal(before.badge,null); assert.equal(before.lastCompleted,null);
  const command=actionFor(before,'continue',{chapterId:chapter.id});
  const results=await Promise.all([call(cookie,command,{chapter:chapter.id}),call(cookie,command,{chapter:chapter.id})]);
  assert.deepEqual(results.map(r=>r.statusCode),[200,200]);assert.deepEqual(results[0].body.quest,results[1].body.quest);
  const q=results[0].body.quest; assert.equal(q.attempt.status,'complete');assert.equal(q.attempt.correct,0);assert.equal(q.review.length,6);
  assert.equal(q.badge.id,chapter.badge.id);assert.equal(q.badge.awardedAt,q.lastCompleted.completedAt);
  const [seconds,microseconds]=await fixture.command('TIME'),now=Number(seconds)*1000+Math.floor(Number(microseconds)/1000);
  assert.ok(q.badge.awardedAt<=now&&now-q.badge.awardedAt<10000);
  assert.equal(await fixture.command('GET',key(cookie)),prerequisite);
});

run('Chapter 2 read and every mutation require the same player’s verified First Signal completion', async () => {
  const cookie=await fresh(), other=await session('Completed');await seedPrerequisite(other);
  const query={chapter:insideBlockdag.id};
  const read=await call(cookie,undefined,{...query,playerId:id(other)});
  assert.equal(read.statusCode,403);assert.equal(read.body.code,'QUEST_LOCKED');assert.equal(read.body.quest,undefined);
  const commands=[{action:'begin',revision:0,chapterId:insideBlockdag.id},...['answer','continue','replay'].map(action=>({action,revision:1,attemptId:'a'.repeat(32),stepToken:'b'.repeat(32),chapterId:insideBlockdag.id,...(action==='answer'?{selectedIndex:0}:{})}))];
  for(const command of commands)assert.equal((await call(cookie,command,query)).statusCode,403);
  await assert.rejects(mutateQuest({id:id(cookie)},commands[0],insideBlockdag.id),/QUEST_LOCKED/);
  assert.equal(await fixture.command('EXISTS',key(cookie,insideBlockdag)),0);
  const summary=(await call(cookie,undefined,{campaign:'1'})).body.campaign.chapters[1];
  assert.equal(summary.locked,true);assert.equal(summary.available,true);assert.equal(summary.status,undefined);assert.equal(summary.badge,undefined);
  assert.deepEqual(summary.prerequisite,{id:firstSignal.id,title:firstSignal.title,href:'/quest/?chapter=first-signal'});
});
run('the final Chapter 1 continuation unlocks Chapter 2 even with mistakes; replay never relocks it', async () => {
  const cookie=await fresh();await act(cookie,'begin');
  for(let i=0;i<25;i++) {
    const q=await current(cookie);
    assert.equal((await call(cookie,undefined,{chapter:insideBlockdag.id})).statusCode,403);
    if(q.attempt.status==='feedback'&&q.attempt.index===5)break;
    if(q.attempt.status==='question')await answer(cookie,false);else await act(cookie,'continue');
  }
  const before=await current(cookie);assert.equal(before.attempt.answered,6);assert.equal(before.badge,null);
  const finish=actionFor(before,'continue');const done=(await call(cookie,finish)).body.quest;assert.equal(done.attempt.correct,0);
  assert.equal((await call(cookie,undefined,{chapter:insideBlockdag.id})).statusCode,200);
  await call(cookie,finish);await act(cookie,'begin',{},insideBlockdag);await act(cookie,'replay');
  assert.equal((await current(cookie)).attempt.status,'lesson');assert.equal((await current(cookie,insideBlockdag)).attempt.status,'lesson');
  assert.equal((await call(cookie,undefined,{campaign:'1'})).body.campaign.chapters[1].locked,false);
});
run('pre-existing Chapter 2 progress is preserved while locked and resumes after Chapter 1 completion', async () => {
  const cookie=await fresh();const original=await seedPrerequisite(cookie);await act(cookie,'begin',{},insideBlockdag);await act(cookie,'continue',{},insideBlockdag);await answer(cookie,false,insideBlockdag);
  const saved=await fixture.command('GET',key(cookie,insideBlockdag));await fixture.command('DEL',key(cookie));
  assert.equal((await call(cookie,undefined,{chapter:insideBlockdag.id})).statusCode,403);
  const state=decodeQuest(saved,insideBlockdag), command={action:'continue',chapterId:insideBlockdag.id,revision:state.revision,attemptId:state.run.id,stepToken:state.run.token};
  assert.equal((await call(cookie,command,{chapter:insideBlockdag.id})).statusCode,403);
  assert.equal(await fixture.command('GET',key(cookie,insideBlockdag)),saved);
  await fixture.command('SET',key(cookie),original);
  const resumed=await current(cookie,insideBlockdag);assert.equal(resumed.attempt.status,'feedback');assert.equal(resumed.review.length,1);
  assert.equal(await fixture.command('GET',key(cookie,insideBlockdag)),saved);
});
run('corrupt prerequisite receipts fail closed and are not presented as an unlocked chapter', async () => {
  const cookie=await fresh();const raw=await seedPrerequisite(cookie);await act(cookie,'begin',{},insideBlockdag);
  const saved=await fixture.command('GET',key(cookie,insideBlockdag));const corrupt=JSON.parse(raw);corrupt.lastCompleted=null;
  await fixture.command('SET',key(cookie),JSON.stringify(corrupt));
  const read=await call(cookie,undefined,{chapter:insideBlockdag.id});assert.equal(read.statusCode,503);
  const command={action:'continue',chapterId:insideBlockdag.id,revision:1,attemptId:'a'.repeat(32),stepToken:'b'.repeat(32)};
  assert.equal((await call(cookie,command,{chapter:insideBlockdag.id})).statusCode,503);
  const map=(await call(cookie,undefined,{campaign:'1'})).body.campaign.chapters;assert.ok(map.every(c=>c.available===false));
  assert.equal(await fixture.command('GET',key(cookie,insideBlockdag)),saved);
  assert.equal(await fixture.command('GET',key(cookie)),JSON.stringify(corrupt));
});
