import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadQuestionBank } from '../server/questions.js';
import { studyBank } from '../server/study-curriculum.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const bank = read('server/questions/kaspa-expansion-2026-10-15.json');
const register = read('docs/kaspa-250-review-2026-10-15.json');
const nextBank = read('server/questions/kaspa-500-2026-10-15.json');
const nextRegister = read('docs/kaspa-500-review-2026-10-15.json');

test('Kaspa expansion review evidence stays attached to the exact published items', () => {
  assert.equal(register.questionCount, bank.questions.length);
  assert.equal(register.items.length, bank.questions.length);
  assert.equal(register.independentReview, false);
  const concepts = new Set();
  for (const item of register.items) {
    const q = bank.questions.find(q => q.id === item.id);
    assert.ok(q, item.id);
    assert.equal(createHash('sha256').update(JSON.stringify(q)).digest('hex'), item.questionSha256, item.id);
    assert.equal(q.source, item.source);
    assert.equal(q.reviewedAt, register.reviewedAt);
    const source = new URL(item.source);
    assert.equal(source.hostname, 'github.com');
    assert.ok(source.pathname.startsWith(`/kaspanet/rusty-kaspa/blob/${register.sourceSnapshot}/`));
    assert.match(source.hash, /^#L[1-9]\d*$/);
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(item.evidenceSymbol);
    assert.equal(concepts.has(item.concept), false, item.id);
    concepts.add(item.concept);
  }
});

test('the 500 milestone preserves item-level pinned evidence for all 250 additions', () => {
  assert.equal(nextBank.questions.length, 250);
  assert.equal(nextRegister.questionCount, 250);
  assert.equal(nextRegister.items.length, 250);
  assert.equal(nextRegister.independentReview, false);
  assert.equal(nextRegister.sourceSnapshot, register.sourceSnapshot);
  const seen = new Set();
  for (const item of nextRegister.items) {
    const q = nextBank.questions.find(q => q.id === item.id);
    assert.ok(q, item.id);
    assert.equal(createHash('sha256').update(JSON.stringify(q)).digest('hex'), item.questionSha256, item.id);
    assert.equal(q.source, item.source);
    assert.equal(q.reviewedAt, nextRegister.reviewedAt);
    const source = new URL(item.source);
    assert.equal(source.hostname, 'github.com');
    assert.ok(source.pathname.startsWith(`/kaspanet/rusty-kaspa/blob/${nextRegister.sourceSnapshot}/`));
    assert.match(source.hash, /^#L[1-9]\d*$/);
    assert.match(item.sourceSha256, /^[a-f0-9]{64}$/);
    assert.ok(item.evidenceSymbol);
    assert.equal(seen.has(item.concept), false, item.concept);
    seen.add(item.concept);
  }
});

test('every new 500-milestone question enters game and Study selection with balanced answer positions', () => {
  const active = loadQuestionBank('kaspa');
  assert.ok(active.questions.length >= 500);
  const study = new Set(studyBank().map(q => q.id));
  const positions = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const q of nextBank.questions) {
    assert.equal(active.byId.get(q.id).conceptId, q.id);
    assert.ok(study.has(q.id), q.id);
    positions[q.correctIndex]++;
  }
  assert.deepEqual(positions, { 0: 63, 1: 63, 2: 62, 3: 62 });
  assert.deepEqual(nextBank.metadata.correctIndexDistribution, positions);
});

test('the complete Kaspa milestone is usable by games and the introductory Study curriculum', () => {
  const active = loadQuestionBank('kaspa');
  assert.ok(active.questions.length >= 250);
  const study = new Set(studyBank().map(q => q.id));
  for (const q of bank.questions) {
    assert.equal(active.byId.get(q.id).conceptId, q.id);
    assert.ok(study.has(q.id), q.id);
  }
  assert.deepEqual(bank.metadata.correctIndexDistribution, { 0: 14, 1: 14, 2: 14, 3: 14 });
});
