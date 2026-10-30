import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryFiles } from '../server/question-categories.js';
import { studyCatalog, studyBank, pickStudyQuestions } from '../server/study-curriculum.js';

const read = name => JSON.parse(readFileSync(new URL(`../server/questions/${name}`, import.meta.url)));
test('reviewed Kaspa banks contain canonical distinct items with individual source dates', () => {
  const kaspa = categoryFiles.kaspa.flatMap(file => read(file).questions);
  const report = JSON.parse(readFileSync(new URL('../docs/question-maintenance.json', import.meta.url)));
  assert.equal(kaspa.length, report.categories.kaspa.after);
  const ids = new Set();
  const concepts = new Map();
  for (const q of kaspa) {
    assert.equal(ids.has(q.id), false, `Duplicate ID: ${q.id}`); ids.add(q.id);
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options.map(s => s.trim().toLowerCase())).size, 4, q.id);
    assert.ok(q.options.every(s => typeof s === 'string' && s.trim()));
    assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4, q.id);
    assert.ok(q.prompt.trim() && q.funFact.trim(), q.id);
    assert.equal(new URL(q.source).protocol, 'https:', q.id);
    // Practice-only drafts are unranked and must not claim a source check.
    assert.equal(q.reviewStatus, q.practiceOnly ? 'draft-needs-human-review' : 'source-checked', q.id);
    assert.match(q.reviewedAt, /^\d{4}-\d{2}-\d{2}$/, q.id);
    assert.ok(q.reviewedAt <= report.maintainedAt, `${q.id}: future review date`);
    assert.ok(q.conceptId, q.id);
  }
  for (const q of kaspa) {
    const previous = concepts.get(q.conceptId);
    assert.equal(previous, undefined, q.id);
    concepts.set(q.conceptId, q);
  }
  assert.equal(concepts.size, kaspa.length);
  for (const q of concepts.values()) assert.equal(q.id, q.conceptId);
});

test('guided lessons have objectives, examples, reflections, and usable levels for every topic', () => {
  const catalog = studyCatalog();
  for (const topic of catalog.topics) {
    assert.ok(topic.objective && topic.example && topic.reflection, topic.id);
    assert.equal(topic.steps.length, 3, topic.id);
    assert.ok(topic.steps.every(step => step.title && step.text.length > 80), topic.id);
    for (const level of catalog.levels) {
      const selected = pickStudyQuestions(topic.id, level.id);
      const available = studyBank().filter(q => q.topic === topic.category && (!level.tier || q.difficulty === level.tier));
      assert.equal(selected.length, Math.min(5, available.length));
      assert.ok(selected.length > 0, `${topic.id}/${level.id}`);
      assert.equal(new Set(selected).size, selected.length);
    }
  }
});


test('practical technology lessons use only their original source-checked question bank', () => {
  const added = read('technology-current-questions.json').questions;
  const catalog = studyCatalog();
  assert.equal(catalog.topics.length, 11);
  assert.equal(added.length, 15);
  for (const id of ['web-status', 'browser-privacy', 'exact-values']) {
    const topic = catalog.topics.find(t => t.id === id);
    assert.equal(topic.bank, 'technology');
    assert.equal(topic.count, 5);
    assert.ok(topic.sources.every(url => new URL(url).hostname === 'developer.mozilla.org'));
    for (const questionId of pickStudyQuestions(id)) {
      const q = added.find(q => q.id === questionId);
      assert.ok(q, questionId);
      assert.equal(q.reviewStatus, 'source-checked');
      assert.equal(q.reviewedAt, '2026-10-14');
      assert.equal(new URL(q.source).hostname, 'developer.mozilla.org');
      assert.equal(q.id, q.conceptId);
    }
  }
  assert.equal(studyBank().filter(q => added.some(a => a.id === q.id)).length, 15);
});
