import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { loadQuestionBank } from '../server/questions.js';
import { studyBank } from '../server/study-curriculum.js';

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const bank = read('server/questions/kaspa-app-design-2026-10-15.json');
const register = read('docs/kaspa-580-review-2026-10-15.json');

test('forty application-design items retain exact reviewed content and pinned guide evidence', () => {
  assert.equal(bank.questions.length, 40);
  assert.equal(register.questionCount, 40);
  assert.equal(register.items.length, 40);
  assert.equal(register.independentReview, false);
  assert.equal(register.sourceRepository, 'kaspanet/docs');
  assert.equal(register.sourceSnapshot, '0ac77d043a802fc8196abfd5812ac2afbd97a2b9');
  const files = new Map(register.sources.map(s => [s.path, s]));
  assert.equal(files.size, 7);
  const concepts = new Set();
  for (const item of register.items) {
    const q = bank.questions.find(q => q.id === item.id);
    assert.ok(q, item.id);
    assert.equal(createHash('sha256').update(JSON.stringify(q)).digest('hex'), item.questionSha256, item.id);
    assert.equal(q.source, item.source);
    assert.equal(q.reviewedAt, register.reviewedAt);
    assert.equal(q.subcategory, 'Toccata Programmability');
    const url = new URL(item.source);
    assert.equal(url.hostname, 'github.com');
    const prefix = `/kaspanet/docs/blob/${register.sourceSnapshot}/`;
    assert.ok(url.pathname.startsWith(prefix));
    assert.match(url.hash, /^#L[1-9]\d*$/);
    const file = files.get(url.pathname.slice(prefix.length));
    assert.ok(file, item.id);
    assert.equal(file.commit, register.sourceSnapshot);
    assert.equal(file.sha256, item.sourceSha256);
    assert.match(file.sha256, /^[a-f0-9]{64}$/);
    assert.match(file.gitBlobSha, /^[a-f0-9]{40}$/);
    assert.ok(item.evidenceSymbol);
    assert.equal(concepts.has(item.concept), false, item.id);
    concepts.add(item.concept);
  }
});

test('application-design items enter games with balanced positions and retain the introductory Study boundary', () => {
  const active = loadQuestionBank('kaspa');
  const study = new Set(studyBank().map(q => q.id));
  const positions = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const difficulty = { easy: 0, medium: 0, hard: 0 };
  for (const q of bank.questions) {
    assert.equal(active.byId.get(q.id).conceptId, q.id);
    assert.equal(study.has(q.id), false, q.id);
    positions[q.correctIndex]++;
    difficulty[q.difficulty]++;
  }
  assert.deepEqual(positions, { 0: 10, 1: 10, 2: 10, 3: 10 });
  assert.deepEqual(bank.metadata.correctIndexDistribution, positions);
  assert.deepEqual(bank.metadata.difficultyDistribution, difficulty);
});
