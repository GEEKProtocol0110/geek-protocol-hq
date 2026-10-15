import test from 'node:test';
import assert from 'node:assert/strict';
import { cceReadiness, evaluateBankReadiness, questionBankReadiness } from '../server/question-bank-readiness.js';
import { categoryFiles } from '../server/question-categories.js';
import { createContribution, reviseContribution, moderateContribution, publishedCommunityQuestions, recordCommunityQuestionUse } from '../server/cce.js';
import contentHandler from '../api/content.js';
import { readFileSync } from 'node:fs';

const banks = () => Object.fromEntries(Object.keys(categoryFiles).map(id => [id, Array.from({ length:1000 }, (_, n) => ({ id:`${id}-${n}`, conceptId:`${id}-${n}`, prompt:`Which synthetic fact belongs to ${id} item ${n}?`, options:['Alpha','Beta','Gamma','Delta'],correctIndex:0,difficulty:n % 10 < 3 ? 'easy' : n % 10 < 7 ? 'medium' : 'hard',source:'https://example.org/synthetic-evidence',reviewStatus:'source-checked',reviewedAt:'2026-10-14',funFact:'An explicitly synthetic explanation for testing.' }))]));
test('all eight categories need 1000 reviewed unique questions and enough reviewed questions in each Gauntlet tier', () => {
  const input=banks();assert.equal(evaluateBankReadiness(input,'2026-10-15').bankReady,true);
  input.comics[0].reviewStatus='draft-needs-human-review';const result=evaluateBankReadiness(input,'2026-10-15');assert.equal(result.bankReady,false);assert.equal(result.categories.find(c=>c.id==='comics').remaining,1);
  for(const q of input.history)q.difficulty='easy';assert.equal(evaluateBankReadiness(input,'2026-10-15').categories.find(c=>c.id==='history').ready,false);
});
test('drafts, malformed reviews, future dates, retired variants and bad answer/explanation records never count', () => {
  const input=banks(),changes=[{reviewedAt:'2099-01-01'},{reviewedAt:'2026-02-30'},{source:'javascript:bad'},{source:'https://user:secret@example.org/x'},{funFact:''},{correctIndex:4},{options:['Same','Same','C','D']},{derivedVariant:true},{retiredReason:'repeat'}];
  changes.forEach((change,n)=>Object.assign(input.kaspa[n],change));assert.equal(evaluateBankReadiness(input,'2026-10-15').categories[0].reviewed,1000-changes.length);
  input.comics[1].conceptId=input.comics[0].conceptId;assert.throws(()=>evaluateBankReadiness(input),/QUESTION_READINESS_UNAVAILABLE/);
  delete input.comics;assert.throws(()=>evaluateBankReadiness(input),/QUESTION_READINESS_UNAVAILABLE/);
});
test('the shipped readiness report contains only aggregates and cannot imply approved creator economics', () => {
  const actual=questionBankReadiness(),published=JSON.parse(readFileSync(new URL('../public/play/assets/bank-readiness.json',import.meta.url)));
  assert.deepEqual(published,actual);assert.equal(actual.targetPerCategory,1000);assert.equal(actual.requiredCategories,8);assert.equal(actual.bankReady,false);
  const text=JSON.stringify(actual);for(const key of ['prompt','correctIndex','options','funFact','source','playerId'])assert.ok(!text.includes(`"${key}"`));
  actual.categories[0].reviewed=99999;assert.notEqual(questionBankReadiness().categories[0].reviewed,99999);
  process.env.CCE_REWARD_AMOUNT='1';process.env.CCE_ENABLED='true';
  try{const c=cceReadiness();assert.equal(c.economyApproved,false);assert.equal(c.rewardAmount,null);assert.equal(c.submissionsEnabled,false);assert.equal(c.publishingEnabled,false);assert.equal(c.newCreditsEnabled,false);}finally{delete process.env.CCE_REWARD_AMOUNT;delete process.env.CCE_ENABLED;}
});
test('CCE mutations, fresh selection and first-use credits stay closed without touching Redis', async () => {
  const previous=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;throw Error('No Redis operation allowed');};
  try {
    await assert.rejects(createContribution({},{}),/CCE_BANK_AND_ECONOMY_HOLD/);await assert.rejects(reviseContribution({},{}),/CCE_BANK_AND_ECONOMY_HOLD/);await assert.rejects(moderateContribution({action:'publish'}),/CCE_BANK_AND_ECONOMY_HOLD/);
    assert.deepEqual(await publishedCommunityQuestions('kaspa'),[]);assert.equal(await recordCommunityQuestionUse({community:true,contributorSessionId:'x'},'run'),false);
    const result={headers:{},setHeader(k,v){this.headers[k]=v;},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
    await contentHandler({method:'GET',query:{view:'readiness'},headers:{}},result);assert.equal(result.code,200);assert.equal(result.body.readiness.submissionsEnabled,false);
    await contentHandler({method:'POST',body:{action:'submit'},headers:{}},result);assert.equal(result.code,409);assert.equal(requests,0);
  } finally { globalThis.fetch=previous; }
});
