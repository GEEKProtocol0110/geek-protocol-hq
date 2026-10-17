import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import ranked from '../api/ranked.js';
import { claimChallenge, claimReadyChallenges, trackCareerChallenge } from '../server/rewarded-challenges.js';
import { careerCatalog, careerChallengeState } from '../server/career-challenges.js';
import { prestigeKeyFor } from '../server/prestige-state.js';
import { defaultProfile, loadProfile, parseProfile, profileKeyFor, PROFILE_AUDIT_CAS_LUA } from '../server/profile.js';
import { commitRankedState } from '../server/ranked-state.js';
import { enterPrestige } from '../server/prestige.js';
import { readFileSync } from 'node:fs';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.discovery.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-discovery-token';
let loseReply = false;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.discovery.test'));
  const args = JSON.parse(options.body);
  const result = String(url).endsWith('/pipeline') ? (await fixture.commands(args)).map(result => ({ result })) : { result: await fixture.command(...args) };
  if (loseReply && args[0] === 'EVAL' && args[1] === PROFILE_AUDIT_CAS_LUA && result.result === 1) { loseReply = false; throw Error('Synthetic lost commit reply'); }
  return Response.json(result);
};
beforeEach(async () => { await fixture.command('FLUSHDB'); loseReply = false; });
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const player = 'a'.repeat(32), other = 'b'.repeat(32), recovered = 'c'.repeat(32);
const session = async (id = player, playerId = id) => { await fixture.command('SET', `geek:session:${id}`, JSON.stringify({ id, playerId, name: 'Explorer', identityVersion: 0 })); return `geek_session=${id}`; };
const call = async (body, cookie = '', method = 'POST', headers = {}) => {
  const res = { headers: {}, setHeader(k,v) { this.headers[k]=v; }, status(n) { this.statusCode=n; return this; }, json(body) { this.body=body; }, end() {} };
  await ranked({ method, body, query: { service: 'discoveries' }, headers: { cookie, 'user-agent': 'synthetic-discovery', ...headers } }, res); return res;
};
test('challenge status requires a session, stays private, and does not reveal unclaimed words', async () => {
  assert.equal((await call({ action: 'status' })).statusCode, 401);
  assert.equal((await call({}, '', 'GET')).statusCode, 405);
  const cookie = await session(), status = await call({ action: 'status' }, cookie);
  assert.equal(status.statusCode, 200); assert.match(status.headers['Cache-Control'], /no-store/);
  assert.equal(status.body.words.length, 5); assert.equal(status.body.tasks.length, 90);
  assert.ok(status.body.words.every(w => !Object.hasOwn(w, 'word')));
  assert.equal(status.body.earnedXp, 0); assert.equal(await fixture.command('EXISTS', profileKeyFor(player)), 0);
  assert.equal((await call({ action: 'word', word: 'hope' }, cookie, 'POST', { 'sec-fetch-site': 'cross-site' })).statusCode, 403);
});
test('invalid words, forged XP/player/task claims and malformed bodies cannot grant rewards', async () => {
  const cookie = await session();
  for (const body of [{ action: 'word', word: 'notaword' }, { action: 'word', word: '<img>' }, { action: 'word', word: 'a'.repeat(33) }, { action: 'word', word: null }, { action: 'word', word: 'hope', xp: 999 }, { action: 'claim', id: 'first-scored-round', playerId: other }, { action: 'claim', id: 'grid-five-bonus' }, { action: 'status', xp: 1 }, 'null', '[]']) assert.equal((await call(body, cookie)).statusCode, 400);
  assert.equal((await call({ action: 'claim', id: 'first-scored-round' }, cookie)).statusCode, 409);
  assert.equal((await loadProfile(player)).xp, 0);
});
test('five words and the automatic final bonus grant exactly 200 XP once, including concurrent retries', async () => {
  const cookie = await session();
  const first = await Promise.all(Array.from({ length: 12 }, () => call({ action: 'word', word: ' CURIOSITY ' }, cookie)));
  assert.ok(first.every(r => r.statusCode === 200)); assert.equal(first.filter(r => r.body.awards.length).length, 1);
  for (const word of ['verify','blockdag','connect']) await call({ action: 'word', word }, cookie);
  const finals = await Promise.all(Array.from({ length: 10 }, () => claimChallenge(player, { action: 'word', word: 'hope' })));
  assert.equal(finals.filter(r => r.awards.length === 2).length, 1);
  const p = await loadProfile(player); assert.equal(p.xp, 200); assert.equal(p.balance, 0); assert.equal(Object.keys(p.challengeClaims).length, 6);
  assert.equal(p.totalQuestions, 0); assert.equal(p.totalCorrect, 0); assert.deepEqual(p.categoryStats, {});
  assert.deepEqual(p.stickerInventory, defaultProfile().stickerInventory);
  assert.equal(await fixture.command('ZCARD','geek:audit:index'), 5);
  const records = await fixture.command('KEYS','geek:*'); assert.ok(!records.some(k => /leaderboard|economy|payout/.test(k)));
});
test('a lost commit response is safe to retry and claims survive journey pruning', async () => {
  await session(); loseReply = true;
  await assert.rejects(claimChallenge(player, { action: 'word', word: 'hope' }), /REDIS_UNAVAILABLE/);
  const p = await loadProfile(player); assert.equal(p.xp,25); p.journey=[];
  await fixture.command('SET', profileKeyFor(player), JSON.stringify(p));
  const result = await claimChallenge(player, { action: 'word', word: 'hope' });
  assert.equal(result.alreadyClaimed,true); assert.equal(result.progression.xp,25);
});
test('all five page discoveries can be redeemed and prestige cannot reopen a claimed reward', async () => {
  await session();
  const found=[];
  for (const path of ['index.html','study/index.html','kaspa/index.html','tools/index.html','thanks/index.html']) {
    const html=readFileSync(new URL(`../public/${path}`,import.meta.url),'utf8');
    const word=html.match(/Recovered word: <strong>([A-Z]+)<\/strong>/)?.[1];assert.ok(word,path);found.push(word);
    assert.match(html,/href="\/challenges\/#rewarded-challenges"/);
    await claimChallenge(player,{action:'word',word});
  }
  assert.equal(new Set(found).size,5);const p=await loadProfile(player);assert.equal(p.xp,200);
  p.xp=12250;await fixture.command('SET',profileKeyFor(player),JSON.stringify(p));
  await enterPrestige(player,0);
  const retry=await claimChallenge(player,{action:'word',word:found[0]});assert.equal(retry.alreadyClaimed,true);assert.equal(retry.progression.prestige,1);assert.equal(retry.progression.xp,12250);
});
test('recovered sessions resolve the same claims; a separate player has a separate list', async () => {
  const cookie = await session(); await call({ action: 'word', word: 'hope' },cookie);
  const nextCookie = await session(recovered,player);
  assert.equal((await call({ action:'status' }, nextCookie)).body.found,1);
  assert.equal((await call({ action:'word', word:'hope' },nextCookie)).body.alreadyClaimed,true);
  assert.equal((await call({ action:'status' },await session(other))).body.found,0);
});
test('saved scored-round tasks are checked by server and concurrent claims preserve gameplay and prestige', async () => {
  await session(); const p = defaultProfile(); p.xp=1000; p.balance=123; p.categoryStats={ kaspa:{ rounds:3,correct:25,questions:30 } };
  await fixture.command('SET',profileKeyFor(player),JSON.stringify(p));
  const stale = await loadProfile(player), prestigeBefore=stale.prestigeState;
  const results=await Promise.all([claimChallenge(player,{action:'claim',id:'first-scored-round'}),claimChallenge(player,{action:'claim',id:'kaspa-25-correct'})]);
  assert.equal(results.reduce((sum,r)=>sum+r.awards[0].xp,0),125);
  stale.xp+=99;
  await assert.rejects(commitRankedState({playerId:player,run:{id:'d'.repeat(40)},profile:stale}),/RANKED_STATE_CHANGED/);
  const saved=await loadProfile(player); assert.equal(saved.xp,1125); assert.equal(saved.balance,123); assert.deepEqual(saved.categoryStats,p.categoryStats); assert.deepEqual(saved.prestigeState,prestigeBefore);
});
test('malformed claim receipts and unsafe XP fail closed without resetting saved data', async () => {
  for (const challengeClaims of [null,[],{ 'grid-word-1':{xp:-1,at:123} },{ 'grid-word-1':{xp:25,at:0} }]) assert.throws(()=>parseProfile(JSON.stringify({xp:9,challengeClaims})),/PROFILE_STATE_INVALID/);
  const raw=JSON.stringify({xp:Number.MAX_SAFE_INTEGER});await fixture.command('SET',profileKeyFor(player),raw);
  await assert.rejects(claimChallenge(player,{action:'word',word:'hope'}),/PROFILE_STATE_INVALID/);assert.equal(await fixture.command('GET',profileKeyFor(player)),raw);
});
test('word guesses are bounded by player and IP rate limits', async () => {
  const cookie=await session();
  for(let i=0;i<60;i++) assert.equal((await call({action:'word',word:'wrong'},cookie)).statusCode,400);
  assert.equal((await call({action:'word',word:'hope'},cookie)).statusCode,429);
  assert.equal((await loadProfile(player)).xp,0);
});

test('earned upper tiers cannot skip claim prerequisites and legacy first rewards cannot pay again',async()=>{
  const p=defaultProfile();p.categoryStats.kaspa={rounds:10,correct:25};await fixture.command('SET',profileKeyFor(player),JSON.stringify(p));
  await assert.rejects(claimChallenge(player,{action:'claim',id:'career-rounds-10'}),/CHALLENGE_NOT_READY/);
  await Promise.all(Array.from({length:8},()=>claimChallenge(player,{action:'claim',id:'first-scored-round'})));
  await claimChallenge(player,{action:'claim',id:'career-rounds-10'});
  assert.equal((await loadProfile(player)).xp,125);assert.equal((await claimChallenge(player,{action:'claim',id:'first-scored-round'})).awards.length,0);
});
test('bounded multi-claim is atomic, rejects locked/forged sets and retries the same IDs after a lost reply',async()=>{
  const cookie=await session(),p=defaultProfile();p.categoryStats.kaspa={rounds:10,correct:25};await fixture.command('SET',profileKeyFor(player),JSON.stringify(p));
  await assert.rejects(claimReadyChallenges(player,['first-scored-round','career-rounds-10']),/CHALLENGE_NOT_READY/);assert.equal((await loadProfile(player)).xp,0);
  for(const ids of [[],['unknown'],Array(9).fill('first-scored-round'),['first-scored-round','first-scored-round']])await assert.rejects(claimReadyChallenges(player,ids),/INVALID_REQUEST/);
  assert.equal((await call({action:'claim-ready',ids:['first-scored-round'],xp:999},cookie)).statusCode,400);
  const ids=['first-scored-round','kaspa-25-correct'];loseReply=true;await assert.rejects(claimReadyChallenges(player,ids),/REDIS_UNAVAILABLE/);
  const retry=await claimReadyChallenges(player,ids);assert.equal(retry.awards.length,0);assert.equal(retry.progression.xp,125);assert.equal(Object.keys((await loadProfile(player)).challengeClaims).length,2);
});
test('three tracked paths persist for the player, retry safely, and cannot create XP',async()=>{
  await trackCareerChallenge(player,'rounds',true);await trackCareerChallenge(player,'correct',true);await trackCareerChallenge(player,'streak',true);
  await assert.rejects(trackCareerChallenge(player,'worlds',true),/CHALLENGE_TRACK_LIMIT/);
  await trackCareerChallenge(player,'rounds',false);loseReply=true;await assert.rejects(trackCareerChallenge(player,'worlds',true),/REDIS_UNAVAILABLE/);
  await trackCareerChallenge(player,'worlds',true);const saved=await loadProfile(player);assert.deepEqual(saved.challengeTracks,['correct','streak','worlds']);assert.equal(saved.xp,0);assert.deepEqual(saved.challengeClaims,{});
  const cookie=await session(recovered,player);assert.deepEqual((await call({action:'status'},cookie)).body.career.trackedSeries,saved.challengeTracks);
  assert.equal((await call({action:'track',id:'rounds',tracked:true,xp:500},cookie)).statusCode,400);
});
test('all ninety career receipts survive pruning without a capacity reset or extra reward',async()=>{
  const p=defaultProfile();p.totalCorrect=10000;p.longestStreak=25;p.bestRound=10;p.gauntletsCompleted=100;
  p.careerCounters={dailyRounds:365,speedRounds:1000,perfectRounds:500};
  for(const id of ['kaspa','video-games','science-fiction','technology','movies','history','comics','pop-culture'])p.categoryStats[id]={rounds:1000,correct:1000};
  await fixture.command('SET',profileKeyFor(player),JSON.stringify(p));await fixture.command('SET',prestigeKeyFor(player),JSON.stringify({version:1,prestige:25,xpBaseline:0,history:[]}));
  for(const t of careerCatalog)await claimChallenge(player,{action:'claim',id:t.id});
  const saved=await loadProfile(player);assert.equal(saved.xp,11975);assert.equal(Object.keys(saved.challengeClaims).length,90);assert.equal(saved.journey.length,80);assert.equal(careerChallengeState(saved).mastered,18);assert.equal(saved.balance,0);
  assert.equal((await claimChallenge(player,{action:'claim',id:'first-scored-round'})).alreadyClaimed,true);assert.equal((await loadProfile(player)).xp,11975);
});
