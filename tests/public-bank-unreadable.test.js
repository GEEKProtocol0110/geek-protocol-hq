import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadQuestionBank, categoryFiles } from '../server/questions.js';
import { handleApiError } from '../server/http.js';

// Synthetic only: temp dirs with fake files; never touches the real bank.
const repo = process.cwd();
const category = Object.keys(categoryFiles).find(c => c !== 'practice') || Object.keys(categoryFiles)[0];
const inDir = (dir, fn) => { process.chdir(dir); try { return fn(); } finally { process.chdir(repo); } };
const tempBank = (write) => {
  const dir = mkdtempSync(join(tmpdir(), 'geek-bank-')); const q = join(dir, 'server', 'questions'); mkdirSync(q, { recursive: true });
  write(q); return dir;
};
const fakeRow = id => ({ id, category, question: 'Fake?', choices: ['a', 'b', 'c', 'd'], answer: 0 });
const writeValid = q => {
  for (const f of categoryFiles[category]) writeFileSync(join(q, f), JSON.stringify({ questions: [fakeRow(`fake-${f}`)] }));
  writeFileSync(join(q, `${category}-retired.json`), JSON.stringify({ questions: [] }));
};
const response = () => ({ statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, end() {} });
const expected = { ok: false, code: 'QUESTIONS_UNAVAILABLE', error: 'Questions are temporarily unavailable. Please try again shortly.' };
const fails = () => assert.throws(() => loadQuestionBank(category), e => e.message === 'QUESTIONS_UNAVAILABLE' && !/\/|ENOENT|JSON/.test(e.message));

test('missing public bank files fail closed as QUESTIONS_UNAVAILABLE', () => {
  inDir(mkdtempSync(join(tmpdir(), 'geek-nobank-')), fails);
});

test('malformed public bank JSON fails closed as QUESTIONS_UNAVAILABLE', () => {
  inDir(tempBank(q => { writeValid(q); writeFileSync(join(q, categoryFiles[category][0]), '{not json'); }), fails);
});

test('unreadable public bank file fails closed as QUESTIONS_UNAVAILABLE', { skip: process.getuid?.() === 0 && 'root ignores file permissions' }, () => {
  inDir(tempBank(q => { writeValid(q); chmodSync(join(q, categoryFiles[category][0]), 0o000); }), fails);
});

test('a failure is not cached: the bank loads once the files are readable again', () => {
  const dir = tempBank(q => { writeValid(q); writeFileSync(join(q, `${category}-retired.json`), '{broken'); });
  inDir(dir, fails);
  writeFileSync(join(dir, 'server', 'questions', `${category}-retired.json`), JSON.stringify({ questions: [] }));
  const bank = inDir(dir, () => loadQuestionBank(category));
  assert.ok(bank.questions.length > 0);
});

test('normal public bank still loads (a category the fake-dir tests never cached)', () => {
  const other = Object.keys(categoryFiles).find(c => c !== category);
  const realIds = categoryFiles[other].flatMap(f => JSON.parse(readFileSync(join(repo, 'server', 'questions', f), 'utf8')).questions.map(q => q.id));
  const bank = loadQuestionBank(other);
  assert.deepEqual(bank.questions.map(q => q.id), realIds);
});

test('QUESTIONS_UNAVAILABLE maps to a 503 with a general message and code-only log', () => {
  const logged = []; const original = console.error; console.error = (...a) => logged.push(a);
  try { const res = response(); handleApiError(res, new Error('QUESTIONS_UNAVAILABLE')); assert.equal(res.statusCode, 503); assert.deepEqual(res.body, expected); }
  finally { console.error = original; }
  assert.deepEqual(logged, [['Geek API error code', 'QUESTIONS_UNAVAILABLE']]);
});
