import test from 'node:test';
import assert from 'node:assert/strict';
import { careerCatalog, careerSeries, careerChallengeState } from '../server/career-challenges.js';
import { defaultProfile, parseProfile } from '../server/profile.js';
import { buildJourneyProfile, deriveAchievements, recordRoundJourney } from '../server/progression.js';

test('the catalog has a bounded five-tier ladder for every path and preserves issued reward IDs',()=>{
  assert.equal(careerSeries.length,18);assert.equal(careerCatalog.length,90);assert.equal(new Set(careerCatalog.map(t=>t.id)).size,90);
  for(const path of careerSeries){const tiers=careerCatalog.filter(t=>t.seriesId===path.id);assert.deepEqual(tiers.map(t=>t.tierName),['Bronze','Silver','Gold','Platinum','Diamond']);for(let i=1;i<5;i++){assert.ok(tiers[i].target>tiers[i-1].target);assert.equal(tiers[i].prerequisite,tiers[i-1].id);}}
  assert.equal(careerCatalog.find(t=>t.id==='first-scored-round').xp,50);assert.equal(careerCatalog.find(t=>t.id==='kaspa-25-correct').xp,75);
  assert.equal(careerCatalog.reduce((s,t)=>s+t.xp,0),11975);
});
test('new players get only three reachable next goals; earned achievements and claimed XP stay distinct',()=>{
  const p=defaultProfile(),fresh=careerChallengeState(p);assert.equal(fresh.recommended.length,3);assert.equal(fresh.completed,0);assert.equal(fresh.ready,0);
  p.categoryStats.kaspa={rounds:10,correct:100};p.totalCorrect=100;
  const state=careerChallengeState(p),silver=state.tasks.find(t=>t.id==='career-rounds-10');assert.equal(silver.complete,true);assert.equal(silver.locked,true);assert.equal(silver.eligible,false);
  p.challengeClaims['first-scored-round']={xp:50,at:1};assert.equal(careerChallengeState(p).tasks.find(t=>t.id===silver.id).eligible,true);
  assert.ok(deriveAchievements(p).find(a=>a.id===silver.id).unlocked);assert.equal(deriveAchievements(p).length,102);
});
test('eight category paths use their own verified counters, not balance, client XP or another category',()=>{
  const p=defaultProfile();p.xp=999999;p.balance=999999;p.categoryStats.kaspa={rounds:1,correct:1000};
  const state=careerChallengeState(p);assert.equal(state.masteries.find(m=>m.id==='world-kaspa').unlocked,true);assert.equal(state.masteries.find(m=>m.id==='world-movies').unlocked,false);assert.equal(state.tasks.find(t=>t.id==='career-world-movies-25').progress,0);
  assert.ok(state.tasks.filter(t=>t.group==='Categories').length===40);
});
test('new counters distinguish a full perfect round from an early Speed finish or incorrect answer',()=>{
  const p=defaultProfile();let n=0;
  const round=(mode,answered,correct)=>recordRoundJourney(p,{runId:`test-${n++}`,round:1,mode,category:'kaspa',answered,correct,xpEarned:0,reward:0,maxStreak:correct});
  round('daily',5,5);round('speed',5,5);round('speed',10,9);round('gauntlet',10,10);round('practice',10,10);
  assert.deepEqual(p.careerCounters,{dailyRounds:1,speedRounds:2,perfectRounds:2});
  const legacy=parseProfile(JSON.stringify({xp:100,totalRuns:100,totalCorrect:1000}));assert.deepEqual(legacy.careerCounters,{dailyRounds:0,speedRounds:0,perfectRounds:0});
  assert.equal(careerChallengeState(legacy).tasks.find(t=>t.seriesId==='perfect').progress,0);
});
test('tracking advances to the next tier and both profile/claim views share the same unlock state',()=>{
  const p=defaultProfile();p.challengeTracks=['rounds'];p.categoryStats.kaspa={rounds:10,correct:20};
  assert.equal(careerChallengeState(p).tracked[0].id,'first-scored-round');p.challengeClaims['first-scored-round']={xp:50,at:1};
  const state=careerChallengeState(p);assert.equal(state.tracked[0].id,'career-rounds-10');
  const profile=buildJourneyProfile(p);assert.equal(profile.challengeCareer.tracked[0].id,state.tracked[0].id);assert.equal(profile.achievements.find(a=>a.id==='career-rounds-10').unlocked,true);
});
test('counter and tracker corruption fail closed while a full catalog of receipts remains valid',()=>{
  for(const patch of [{challengeTracks:['a','a']},{challengeTracks:['a','b','c','d']},{careerCounters:{dailyRounds:-1,speedRounds:0,perfectRounds:0}}])assert.throws(()=>parseProfile(JSON.stringify(patch)),/PROFILE_STATE_INVALID/);
  const p=defaultProfile();for(const t of careerCatalog)p.challengeClaims[t.id]={xp:t.xp,at:123};assert.equal(Object.keys(parseProfile(JSON.stringify(p)).challengeClaims).length,90);
});
