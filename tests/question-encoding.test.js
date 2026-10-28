import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {repairEncodingText,hasRepairableEncoding,encodingDraftCorrection} from '../scripts/question-encoding.mjs';
import {gradingHash} from '../scripts/audit-question-banks.mjs';
import {loadQuestionBank,selectRoundQuestionIds} from '../server/questions.js';

test('encoding repair handles Western and control-byte decoding while preserving valid Unicode',()=>{
  assert.equal(repairEncodingText('Earthâ€™s and â€œmoonâ€\u009d; NiÃ±a, RÃ¶ntgen, WojtyÅ‚a, 8Â½, Â£150.'),'Earth’s and “moon”; Niña, Röntgen, Wojtyła, 8½, £150.');
  assert.equal(repairEncodingText('â\u0080\u009cwordâ\u0080\u009d'),'“word”');
  const proper='SÃO PAULO, ACÂCIO, Édith, naïve, 日本語, ½, £, →';
  assert.equal(repairEncodingText(proper),proper);assert.equal(hasRepairableEncoding(proper),false);
});
test('source-grounded correction restores a lost nonbreaking byte without promoting factual review',()=>{
  const q={id:'fixture',conceptId:'fixture',prompt:'What is DÃ©jÃ Vu?',options:['A','B','C','D'],correctIndex:1,reviewStatus:'draft-needs-human-review',license:'CC BY-SA 4.0',reviewedAt:''};
  const n=encodingDraftCorrection(q,'What is DÃ©jÃ\u00a0 Vu?',q.options);
  assert.equal(n.prompt,'What is Déjà Vu?');assert.match(n.id,/^fixture-E[a-f0-9]{10}$/);
  assert.equal(n.correctIndex,q.correctIndex);assert.equal(n.reviewStatus,q.reviewStatus);assert.equal(n.reviewedAt,'');assert.equal(n.license,q.license);
  assert.equal(q.prompt,'What is DÃ©jÃ Vu?');
  for(const bad of [()=>encodingDraftCorrection({...q,reviewStatus:'source-checked'},q.prompt,q.options),()=>encodingDraftCorrection(q,'A different question',q.options),()=>encodingDraftCorrection(q,q.prompt,['A','B','C','wrong'])])assert.throws(bad);
});
test('all reviewed encoding replacements preserve old keys, draft status, provenance and later-round exclusions',async()=>{
  const ledger=JSON.parse(readFileSync('server/question-audit/encoding-2026-10-28.json','utf8'));
  assert.equal(ledger.items.length,77);
  for(const item of ledger.items){
    const bank=loadQuestionBank(item.category),old=bank.byId.get(item.oldId),q=bank.questions.find(q=>q.id===item.newId);
    assert.ok(q && old.retiredReason);assert.equal(gradingHash(old),item.oldGradingHash);assert.equal(gradingHash(q),item.newGradingHash);
    assert.equal(old.conceptId,q.conceptId);assert.equal(q.reviewStatus,'draft-needs-human-review');assert.equal(q.reviewedAt,old.reviewedAt||'');
    assert.equal(q.source,old.source);assert.equal(q.license,old.license);assert.equal(q.correctIndex,old.correctIndex);
    assert.ok(![q.prompt,...q.options].some(hasRepairableEncoding));assert.ok(!bank.questions.some(q=>q.id===old.id));
    const round=q.difficulty==='easy'?1:q.difficulty==='medium'?4:8;
    const selected=await selectRoundQuestionIds(item.category,round,[old.id]);assert.equal(selected.length,10);assert.ok(!selected.includes(q.id));
  }
  for(const d of ledger.additionalDuplicateRetirements){
    const bank=loadQuestionBank(d.category),old=bank.byId.get(d.retiredId),q=bank.questions.find(q=>q.id===d.canonicalId);
    assert.equal(gradingHash(old),d.oldGradingHash);assert.equal(gradingHash(q),d.canonicalGradingHash);assert.equal(old.conceptId,q.conceptId);
    assert.ok(!bank.questions.some(q=>q.id===old.id));
    const round=q.difficulty==='easy'?1:q.difficulty==='medium'?4:8;
    assert.ok(!(await selectRoundQuestionIds(d.category,round,[old.id])).includes(q.id));
  }
});
