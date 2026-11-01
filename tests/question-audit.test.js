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
test('a contextual time-wording decision is visible, bound to grading evidence and invalidated by edits',()=>{
  const q=row('time','Which field records the latest measured connection delay?');
  const d={id:q.id,reason:'time-scope-review',gradingHash:gradingHash(q),disposition:'retained-nonvolatile'};
  const report=auditQuestionBanks({network:[q]},[],[d]);
  assert.equal(report.signals.items,1);assert.equal(report.signals.unresolvedItems,0);
  assert.equal(report.itemSignals[0].dispositions['time-scope-review'],'retained-nonvolatile');
  assert.throws(()=>auditQuestionBanks({network:[{...q,prompt:'Which field records a connection delay?'}]},[],[d]),/Stale item/);
  assert.equal(auditQuestionBanks({network:[q]}).signals.unresolvedItems,1);
});
test('scope follow-up preserves earlier decisions and binds all replacements and retirements',async()=>{
  const old=JSON.parse(readFileSync('server/question-audit/decisions-2026-10-27.json'));
  const next=JSON.parse(readFileSync('server/question-audit/scope-2026-10-28.json'));
  const pending=old.pairs.filter(p=>['needs-scope-review','cross-category-review'].includes(p.disposition));
  assert.equal(pending.length,8);assert.equal(next.pairs.length,8);assert.equal(next.itemDecisions.length,4);
  assert.equal(next.retirements.length,17);assert.equal(next.replacements.length,8);
  for(const d of next.pairs){
    const previous=pending.find(p=>p.ids.join('|')===d.ids.join('|'));assert.ok(previous);
    assert.deepEqual(d.gradingHashes,previous.gradingHashes);assert.equal(d.disposition,'resolved');
  }
  for(const item of next.replacements){
    const q=loadQuestionBank(item.category).questions.find(q=>q.id===item.id);
    assert.ok(q);assert.equal(gradingHash(q),item.gradingHash);assert.equal(q.reviewStatus,'source-checked');
    assert.equal(q.source,item.source);assert.equal(q.license,'CC BY-SA 4.0');assert.ok(q.funFact.length>=8);
  }
  for(const item of next.retirements){
    const bank=loadQuestionBank(item.category),old=bank.byId.get(item.id);
    assert.equal(gradingHash(old),item.gradingHash);assert.ok(old.retiredReason);assert.ok(!bank.questions.some(q=>q.id===old.id));
    if(item.canonicalId){
      const q=loadQuestionBank(item.canonicalCategory).questions.find(q=>q.id===item.canonicalId);assert.ok(q);
      assert.equal(old.conceptId,q.conceptId);
      if(item.category===item.canonicalCategory){
        const round=q.difficulty==='easy'?1:q.difficulty==='medium'?4:8;
        assert.ok(!(await selectRoundQuestionIds(item.category,round,[old.id])).includes(q.id));
      }
    }
  }
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

test('Technology corrections keep issued grading, licensed provenance and deterministic later-round exclusions',async()=>{
  const ledger=JSON.parse(readFileSync('server/question-audit/technology-2026-10-28.json','utf8'));
  const bank=loadQuestionBank('technology');
  assert.equal(ledger.independentReview,false);
  assert.equal(ledger.retirements.length,12);assert.equal(ledger.replacements.length,4);
  for(const item of ledger.retirements){
    const old=bank.byId.get(item.id);
    assert.ok(old.retiredReason);assert.equal(gradingHash(old),item.gradingHash);
    assert.equal(old.reviewStatus,'draft-needs-human-review');
    assert.ok(!bank.questions.some(q=>q.id===item.id));
  }
  for(const item of ledger.replacements){
    const q=bank.questions.find(q=>q.id===item.id);assert.ok(q);
    assert.equal(gradingHash(q),item.gradingHash);assert.equal(q.reviewStatus,'source-checked');
    assert.equal(q.source,item.source);assert.equal(q.license,'CC BY-SA 4.0');
    assert.equal(q.originalSource,'https://github.com/uberspot/OpenTriviaQA');
    assert.equal(q.reviewedAt,ledger.reviewedAt);assert.equal(item.distractorReview.length,4);
    const old=bank.byId.get(item.fromIds[0]);assert.equal(old.conceptId,q.id);
    // Leave exactly ten tier candidates including this correction. Excluding the
    // saved old ID must remove its corrected concept, making a round impossible.
    // A random ten-question sample could pass without exercising the alias.
    const controls=bank.questions.filter(other=>other.difficulty===q.difficulty&&other.id!==q.id).slice(0,9);
    const allowed=new Set([q.id,...controls.map(other=>other.id)]);
    const excluded=bank.questions.filter(other=>other.difficulty===q.difficulty&&!allowed.has(other.id)).map(other=>other.id);
    const round=q.difficulty==='easy'?1:q.difficulty==='medium'?4:8;
    assert.ok((await selectRoundQuestionIds('technology',round,excluded)).includes(q.id));
    await assert.rejects(selectRoundQuestionIds('technology',round,[...excluded,old.id]),/QUESTION_POOL_EXHAUSTED/);
  }
});

test('retired overlapping Joker objective keeps saved grading and excludes its replacement after later eligibility',async()=>{
  const bank=loadQuestionBank('comics');
  const old=bank.byId.get('COM-N-e1f0ac201acf');
  const canonical=bank.questions.find(q=>q.id==='COM-ST-005');
  assert.equal(gradingHash(old),'cd938866517ed7d35de867bce3e411ee24e3feb00b91d5828521642836a02b92');
  assert.ok(old.retiredReason && canonical);
  assert.ok(!bank.questions.some(q=>q.id===old.id));
  assert.equal(old.conceptId,canonical.conceptId);
  assert.equal(canonical.practiceOnly,true);
  assert.equal(canonical.reviewStatus,'draft-needs-human-review');
  // Simulate a future eligibility decision in this isolated in-memory fixture.
  // Exactly ten candidates prove that the historical ID removes the alias;
  // a random ten-question sample could otherwise pass without exercising it.
  canonical.practiceOnly=false;
  try {
    const controls=bank.questions.filter(q=>!q.practiceOnly&&q.difficulty===canonical.difficulty&&q.id!==canonical.id).slice(0,9);
    const allowed=new Set([canonical.id,...controls.map(q=>q.id)]);
    const excluded=bank.questions.filter(q=>q.difficulty===canonical.difficulty&&!allowed.has(q.id)).map(q=>q.id);
    const round=canonical.difficulty==='easy'?1:canonical.difficulty==='medium'?4:8;
    assert.ok((await selectRoundQuestionIds('comics',round,excluded)).includes(canonical.id));
    await assert.rejects(selectRoundQuestionIds('comics',round,[...excluded,old.id]),/QUESTION_POOL_EXHAUSTED/);
  } finally {
    canonical.practiceOnly=true;
  }
});
