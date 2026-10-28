import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditQuestionBanks, gradingHash } from '../scripts/audit-question-banks.mjs';
import { loadQuestionBank, selectRoundQuestionIds } from '../server/questions.js';

const row = (id,prompt,answer='Mira') => ({id,prompt,options:[answer,'Cato','Juno','Tavi'],correctIndex:0,reviewStatus:'draft-needs-human-review',funFact:''});
test('audit surfaces paraphrases below the blocking similarity threshold without changing banks',()=>{
  const banks={fiction:[row('a','Who piloted the first rescue ship in the story?'),row('b','The story describes a first rescue ship. Name its pilot.')]};
  const before=JSON.stringify(banks), report=auditQuestionBanks(banks);
  assert.equal(report.signals.withinCategoryPairs,1);assert.equal(report.pairs[0].disposition,'unreviewed-candidate');
  assert.equal(report.automaticRetirement,false);assert.equal(JSON.stringify(banks),before);
  assert.ok(!JSON.stringify(report).includes('Mira'));assert.ok(!JSON.stringify(report).includes('correctIndex'));
});
test('same answer and related words can describe distinct facts and require an explicit decision',()=>{
  const a=row('a','Which planet of the solar system has the red storm?','Jupiter');
  const b=row('b','Which planet of the solar system has the moon Leto?','Jupiter');
  const decisions=[{ids:['a','b'],gradingHashes:[gradingHash(a),gradingHash(b)],disposition:'retained-distinct'}];
  assert.equal(auditQuestionBanks({science:[a,b]},decisions).pairs[0].disposition,'retained-distinct');
  assert.throws(()=>auditQuestionBanks({science:[a,{...b,prompt:b.prompt+' First observed in 2001.'}]},decisions),/Stale/);
  assert.equal(auditQuestionBanks({science:[a,row('c','Who designed the harbor bridge?','Jupiter')]}).pairs.length,0);
});
test('cross-category overlap and normalized conflicting keys are review signals',()=>{
  const a=row('a','Who designed the harbor bridge?');
  const b=row('b','WHO designed the harbor bridge!','Cato');
  const report=auditQuestionBanks({history:[a],engineering:[b]});
  assert.equal(report.signals.crossCategoryPairs,1);assert.ok(report.pairs[0].reasons.includes('same-prompt-different-key'));
});
test('encoding, absent media and time wording are queued without rejecting valid soundtrack or Unicode questions',()=>{
  const report=auditQuestionBanks({movies:[row('a','Which director made the filmâ€™s sequel?'),row('b','Identify the instrument shown below.'),row('c','Who holds the latest edition of the award?'),row('d','Who wrote the soundtrack for the film Élan?')]});
  assert.deepEqual(report.itemSignals.map(s=>s.id),['a','b','c']);
  assert.equal(report.signals.byReason['suspected-encoding-damage'],1);
});
test('coverage includes checked rows and all drafts, with no blanket promotion from screening',()=>{
  const report=auditQuestionBanks({alpha:[{...row('a','Who designed the first bridge?'),reviewStatus:'source-checked',funFact:'An existing explanation.'}],beta:[row('b','Where was the second harbor built?')]});
  assert.equal(report.active,2);assert.equal(report.recordedSourceChecks,1);assert.equal(report.needsFactualReview,1);
  assert.equal(report.categories[1].missingExplanation,1);assert.equal(report.independentReview,false);
});
test('audit refuses retired, duplicate or malformed records rather than hiding coverage gaps',()=>{
  const q=row('a','Who designed the first bridge?');
  for(const qs of [[q,q],[{...q,correctIndex:9}],[{...q,retiredReason:'duplicate'}]])assert.throws(()=>auditQuestionBanks({fiction:qs}));
});
test('audited duplicate retirements retain grading and exclude their surviving concept from later rounds',async()=>{
  const ledger=JSON.parse(readFileSync('server/question-audit/decisions-2026-10-27.json','utf8'));
  for(const d of ledger.pairs.filter(d=>d.disposition==='retire-duplicate')){
    const category=d.categories[d.ids.indexOf(d.retiredId)], bank=loadQuestionBank(category);
    const old=bank.byId.get(d.retiredId), canonical=bank.questions.find(q=>q.id===d.canonicalId);
    assert.ok(old.retiredReason && canonical);assert.equal(old.conceptId,canonical.conceptId);
    assert.equal(gradingHash(old),d.gradingHashes[d.ids.indexOf(old.id)]);
    assert.equal(canonical.reviewStatus,'draft-needs-human-review');
    assert.ok(!bank.questions.some(q=>q.id===old.id));
    const round=canonical.difficulty==='easy'?1:canonical.difficulty==='medium'?4:8;
    const selected=await selectRoundQuestionIds(category,round,[old.id]);
    assert.equal(selected.length,10);assert.ok(!selected.includes(canonical.id));
  }
});
