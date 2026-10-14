import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { validateReviewBatch, questionRevision, correction } from '../server/imported-review.js';
import { stageQuestionReviews } from '../scripts/stage-question-reviews.mjs';

const q = loadQuestionBank('technology').questions[0];
const reference = question => ({ id: question.id, revision: questionRevision(question), reviewVersion: '' });
const edit = { prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty, source: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript', funFact: 'An internally reviewed explanation of this question.' };
const batch = (extra = {}) => ({ category: 'technology', decision: 'correct', sourceChecked: true, note: 'Checked against the source.', items: [reference(q)], correction: edit, ...extra });
const documents = () => Object.fromEntries(Object.entries(categoryFiles).flatMap(([category, files]) => [...files, `${category}-retired.json`].map(file => [file, JSON.parse(readFileSync(`server/questions/${file}`, 'utf8'))])));
const report = () => JSON.parse(readFileSync('docs/question-maintenance.json', 'utf8'));
const editorial = () => JSON.parse(readFileSync('docs/editorial-review.json', 'utf8'));

test('review batches require explicit evidence acknowledgement, valid revisions and bounded unique selections', () => {
  const result = validateReviewBatch(batch(), 'technology'); assert.equal(result.length, 1); assert.equal(result[0].sourceChecked, true);
  for (const bad of [batch({ sourceChecked: false }), batch({ items: [] }), batch({ items: [reference(q), reference(q)], decision: 'retire' }),
    batch({ items: Array(11).fill(reference(q)), decision: 'retire' }), batch({ items: [{ ...reference(q), revision: 'a'.repeat(64) }] }), batch({ note: 'short' }), batch({ decision: 'publish' }), batch({ treasury: true })]) assert.throws(() => validateReviewBatch(bad, 'technology'));
});
test('correction validation rejects invalid evidence URLs, answer keys and ambiguous choices', () => {
  for (const bad of [{ ...edit, source: 'javascript:alert(1)' }, { ...edit, source: 'https://name:password@example.com/' }, { ...edit, correctIndex: 4 },
    { ...edit, options: ['A', 'a', 'B', 'C'] }, { ...edit, funFact: '' }, { ...edit, prompt: 'short' }, { ...edit, options: ['A', 'B', 'C'] }]) assert.throws(() => correction(bad));
});
test('staging a correction preserves the issued answer and creates a new canonical identity', () => {
  const originalDocs = documents(), oldReport = report(), result = stageQuestionReviews(validateReviewBatch(batch(), 'technology'), originalDocs, oldReport, editorial());
  const retired = result.files['technology-retired.json'].questions.find(row => row.id === q.id);
  assert.deepEqual(retired.options, q.options); assert.equal(retired.correctIndex, q.correctIndex);
  assert.ok(!result.files['technology-questions.json'].questions.some(row => row.id === q.id));
  const replacement = result.files['technology-questions.json'].questions.find(row => row.id.startsWith(q.id.slice(0, 45) + '-R'));
  assert.equal(replacement.conceptId, replacement.id); assert.equal(replacement.reviewStatus, 'source-checked');
  assert.equal(result.report.activeQuestions, oldReport.activeQuestions); assert.equal(result.report.retiredRows, oldReport.retiredRows + 1);
  assert.equal(result.report.postReviewAdditions, (oldReport.postReviewAdditions || 0) + 1);
  assert.equal(originalDocs['technology-retired.json'].questions.length, result.files['technology-retired.json'].questions.length - 1);
  const record = result.editorial.retirements.at(-1);
  assert.equal(record.answerKeyHash, createHash('sha256').update(JSON.stringify([q.prompt, q.options, q.correctIndex])).digest('hex'));
  assert.equal(JSON.stringify(result.files).includes('Checked against the source.'), false, 'Private notes stay out of published banks');
});
test('retirement accounting changes active counts without fabricating replacement content', () => {
  const old = report(), result = stageQuestionReviews(validateReviewBatch(batch({ decision: 'retire' }), 'technology'), documents(), old, editorial());
  assert.equal(result.report.activeQuestions, old.activeQuestions - 1); assert.equal(result.report.retiredRows, old.retiredRows + 1);
  assert.equal(result.report.editorialRetiredRows, old.editorialRetiredRows + 1);
});
test('invalid or duplicate proposals fail before output documents are changed', () => {
  const docs = documents(), before = JSON.stringify(docs), p = validateReviewBatch(batch(), 'technology')[0];
  for (const proposals of [[p, p], [{ ...p, questionRevision: 'a'.repeat(64) }], [{ ...p, checkedAt: 'not a date' }], [{ ...p, decision: 'publish' }]]) assert.throws(() => stageQuestionReviews(proposals, docs, report(), editorial()));
  assert.equal(JSON.stringify(docs), before);
});
