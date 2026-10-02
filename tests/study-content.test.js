import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyCatalog, studyBank, pickStudyQuestions } from '../server/study-curriculum.js';

const read = name => JSON.parse(readFileSync(new URL(`../server/questions/${name}`, import.meta.url)));
test('reviewed Kaspa banks have valid unique items and consistent concept variants', () => {
  const core = read('kaspa-questions.json');
  const current = read('kaspa-current-questions.json');
  assert.equal(core.questions.length, 1000);
  assert.equal(current.questions.length, 32);
  const ids = new Set();
  const concepts = new Map();
  for (const q of [...core.questions, ...current.questions]) {
    assert.equal(ids.has(q.id), false, `Duplicate ID: ${q.id}`); ids.add(q.id);
    assert.equal(q.options.length, 4, q.id);
    assert.equal(new Set(q.options.map(s => s.trim().toLowerCase())).size, 4, q.id);
    assert.ok(q.options.every(s => typeof s === 'string' && s.trim()));
    assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4, q.id);
    assert.ok(q.prompt.trim() && q.funFact.trim(), q.id);
    assert.equal(new URL(q.source).protocol, 'https:', q.id);
    assert.equal(q.reviewStatus, 'source-checked', q.id);
    assert.equal(q.reviewedAt, '2026-10-01', q.id);
    assert.ok(q.conceptId, q.id);
  }
  for (const q of core.questions) {
    const previous = concepts.get(q.conceptId);
    if (previous) {
      assert.deepEqual([...q.options].sort(), [...previous.options].sort(), q.id);
      assert.equal(q.options[q.correctIndex], previous.options[previous.correctIndex], q.id);
      assert.equal(q.subcategory, previous.subcategory, q.id);
      assert.equal(q.funFact, previous.funFact, q.id);
    } else concepts.set(q.conceptId, q);
  }
  assert.equal(concepts.size, 80);
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
