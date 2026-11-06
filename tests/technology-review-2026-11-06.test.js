import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gradingHash } from '../scripts/audit-question-banks.mjs';
import { loadQuestionBank, selectRoundQuestionIds } from '../server/questions.js';
import { cceReadiness } from '../server/question-bank-readiness.js';

const ledger = JSON.parse(readFileSync('server/question-audit/technology-2026-11-06.json', 'utf8'));
const bank = loadQuestionBank('technology');
test('six-item review binds retained grades and preserves draft/independent review boundaries', () => {
  assert.equal(ledger.independentReview, false);
  assert.equal(ledger.retained.length, 3); assert.equal(ledger.replacements.length, 3);
  assert.equal(ledger.retirements.length, 3);
  for (const item of [...ledger.retained, ...ledger.replacements]) {
    const q = bank.byId.get(item.id);
    assert.equal(gradingHash(q), item.gradingHash);
    assert.equal(q.source, item.source); assert.equal(item.distractorReview.length, 4);
    assert.ok(q.funFact.length > 20); assert.equal(q.license, 'CC BY-SA 4.0');
  }
  for (const item of ledger.retained) {
    const q = bank.byId.get(item.id);
    assert.equal(q.reviewStatus, 'source-checked'); assert.equal(q.reviewedAt, ledger.reviewedAt);
  }
  for (const item of ledger.replacements) {
    const q = bank.byId.get(item.id);
    assert.equal(q.practiceOnly, true); assert.equal(q.reviewStatus, 'draft-needs-human-review');
  }
  for (const item of ledger.retirements) {
    const old = bank.byId.get(item.id), replacement = bank.byId.get(item.canonicalId);
    assert.ok(old.retiredReason); assert.equal(gradingHash(old), item.gradingHash);
    assert.equal(old.conceptId, replacement.id);
    assert.ok(!bank.questions.some(q => q.id === old.id));
  }
  assert.equal(cceReadiness().submissionsEnabled, false);
  assert.equal(cceReadiness().publishingEnabled, false);
});

test('all three corrected concepts stay excluded by historical IDs after simulated later eligibility', async () => {
  for (const item of ledger.retirements) {
    const replacement = bank.byId.get(item.canonicalId);
    const pool = bank.questions.filter(q => !q.practiceOnly && q.difficulty === replacement.difficulty && q.id !== replacement.id).slice(0, 9);
    const allowed = new Set([replacement.id, ...pool.map(q => q.id)]);
    const excluded = bank.questions.filter(q => q.difficulty === replacement.difficulty && !allowed.has(q.id)).map(q => q.id);
    const round = replacement.difficulty === 'easy' ? 1 : replacement.difficulty === 'medium' ? 4 : 8;
    await assert.rejects(selectRoundQuestionIds('technology', round, excluded), /QUESTION_POOL_EXHAUSTED/);
    replacement.practiceOnly = false;
    try {
      assert.ok((await selectRoundQuestionIds('technology', round, excluded)).includes(replacement.id));
      await assert.rejects(selectRoundQuestionIds('technology', round, [...excluded, item.id]), /QUESTION_POOL_EXHAUSTED/);
    } finally { replacement.practiceOnly = true; }
  }
});
