import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadQuestionBank } from '../server/questions.js';
import { questionBankReadiness } from '../server/question-bank-readiness.js';

test('Kaspa Basics Gauntlet drafts are practice-only, unranked and never counted as source-checked', () => {
  const set = JSON.parse(readFileSync('server/questions/kaspa-basics-gauntlet.json', 'utf8'));
  assert.equal(set.metadata.practiceOnly, true);
  assert.doesNotMatch(JSON.stringify(set), /payout|GEEKT|token reward/i);
  assert.equal(set.questions.length, 100);
  for (const q of set.questions) {
    assert.equal(q.practiceOnly, true, q.id);
    assert.equal(q.reviewStatus, 'draft-needs-human-review', q.id);
  }
  const kaspa = loadQuestionBank('kaspa').questions;
  assert.equal(kaspa.filter(q => q.practiceOnly).length, 100);
  const readiness = questionBankReadiness().categories.find(c => c.id === 'kaspa');
  assert.equal(readiness.practiceOnly, 100);
  assert.equal(readiness.reviewed, kaspa.filter(q => !q.practiceOnly && q.reviewStatus === 'source-checked').length);
  const catalog = readFileSync('public/play/assets/question-catalog.js', 'utf8');
  assert.match(catalog, /"kaspa": 766/);
  assert.match(readFileSync('public/play/sources/index.html', 'utf8'), /<span data-kaspa-count>766<\/span>/);
});
