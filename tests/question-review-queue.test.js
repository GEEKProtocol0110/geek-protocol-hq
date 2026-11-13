import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewQueue, reviewSignals } from '../scripts/question-review-queue.mjs';

test('review signals flag scope risks without declaring a factual result', () => {
  assert.ok(reviewSignals({ prompt: 'Which treatment is best?', funFact: '' }).includes('clinical-scope-review'));
  assert.ok(reviewSignals({ prompt: 'How many ounces in a quart?', funFact: 'Explanation' }).includes('unit-system-review'));
  assert.deepEqual(reviewSignals({ prompt: 'A neutral prompt?', funFact: 'Explanation', reviewStatus: 'source-checked' }), []);
});
test('review queue preserves content and distinguishes tags, readiness and practice-only rows', () => {
  const rows = [{ id:'fake-1', prompt:'Which treatment?', options:['a','b','c','d'], correctIndex:0 },
    { id:'fake-2', prompt:'A neutral prompt?', reviewStatus:'source-checked' },
    { id:'fake-3', prompt:'An old question?', practiceOnly:true, reviewStatus:'source-checked' }];
  const before = JSON.stringify(rows);
  const report = buildReviewQueue({ fake: rows }, { active:3, practiceOnly:1, reviewed:1, remaining:999,
    categories:[{ id:'fake', name:'Fake', active:3, practiceOnly:1, reviewed:1, remaining:999 }] });
  assert.equal(JSON.stringify(rows),before);
  assert.equal(report.totals.rawSourceCheckTags,2); assert.equal(report.totals.readinessQualified,1);
  assert.equal(report.totals.selectableDraftRows,1);
  assert.deepEqual(report.categories[0].nextBatch.map(x=>x.id),['fake-1']);
  assert.equal(report.factualAuditComplete,false); assert.equal(report.automaticApproval,false);
  assert.equal(JSON.stringify(report).includes('correctIndex'),false);
});
test('review batches are bounded and prioritize explicit scope risks over unflagged drafts', () => {
  const rows = Array.from({length:40},(_,i)=>({id:`fake-${i}`,prompt:'Neutral draft?'}));
  rows.push({id:'fake-priority',prompt:'Which antibiotic treatment?'});
  const report = buildReviewQueue({fake:rows},{active:41,practiceOnly:0,reviewed:0,remaining:1000,categories:[{id:'fake',name:'Fake',active:41,practiceOnly:0,reviewed:0,remaining:1000}]});
  assert.equal(report.categories[0].nextBatch.length,25); assert.equal(report.categories[0].nextBatch[0].id,'fake-priority');
});
