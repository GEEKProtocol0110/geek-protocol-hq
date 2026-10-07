import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { studyCatalog, studyBank, pickStudyQuestions } from '../server/study-curriculum.js';

const read = name => JSON.parse(readFileSync(new URL(`../server/questions/${name}`, import.meta.url)));
test('reviewed Kaspa banks contain canonical distinct items with individual source dates', () => {
  const core = read('kaspa-questions.json');
  const current = read('kaspa-current-questions.json');
  const report = readFileSync(new URL('../docs/question-maintenance.json', import.meta.url));
  assert.equal(core.questions.length + current.questions.length, JSON.parse(report).categories.kaspa.cleaned * 2);
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
    assert.match(q.reviewedAt, /^2026-10-(01|07)$/, q.id);
    assert.ok(q.conceptId, q.id);
  }
  for (const q of core.questions) {
    const previous = concepts.get(q.conceptId);
    assert.equal(previous, undefined, q.id);
    concepts.set(q.conceptId, q);
  }
  assert.equal(concepts.size, core.questions.length);
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
