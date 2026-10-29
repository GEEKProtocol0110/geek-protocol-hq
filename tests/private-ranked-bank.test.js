import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadRankedSource, rankedSourceMode, resetRankedSourceCache } from '../server/question-source.js';
import { isExposedQuestion, loadQuestionBank, loadRankedBank, questionById, selectRoundQuestionIds } from '../server/questions.js';

const KEYS = ['GEEK_PRIVATE_QUESTION_DIR', 'GEEK_PRIVATE_QUESTION_URL', 'GEEK_PRIVATE_QUESTION_TOKEN', 'GEEK_RANKED_QUESTION_SOURCE', 'GEEK_RANKED_ALLOW_EXPOSED', 'VERCEL_ENV', 'NODE_ENV'];
const withEnv = async (values, run) => {
  const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));
  KEYS.forEach((key) => delete process.env[key]);
  Object.assign(process.env, values);
  resetRankedSourceCache();
  try { return await run(); } finally {
    KEYS.forEach((key) => { if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key]; });
    resetRankedSourceCache();
  }
};

const privateQuestion = (id, difficulty, index) => ({
  id, category: 'history', subcategory: `Private topic ${index % 5}`, difficulty,
  prompt: `Private prompt ${id}?`, options: ['A', 'B', 'C', 'D'], correctIndex: index % 4
});
const privateDir = (questions) => {
  const dir = mkdtempSync(join(tmpdir(), 'geek-private-bank-'));
  writeFileSync(join(dir, 'history-2026-11.json'), JSON.stringify({ questions }));
  return dir;
};
const tiers = (prefix) => ['easy', 'medium', 'hard'].flatMap((tier) => Array.from({ length: 12 }, (_, i) => privateQuestion(`${prefix}-${tier}-${i}`, tier, i)));

test('ranked source mode fails closed in production without a private source', () => {
  assert.equal(rankedSourceMode({}), 'exposed');
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'production' }), 'unavailable');
  assert.equal(rankedSourceMode({ NODE_ENV: 'production' }), 'unavailable');
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'production', GEEK_RANKED_ALLOW_EXPOSED: 'true' }), 'exposed');
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'production', GEEK_PRIVATE_QUESTION_DIR: '/x' }), 'private');
  assert.equal(rankedSourceMode({ GEEK_PRIVATE_QUESTION_URL: 'https://example.invalid/bank' }), 'private');
  assert.equal(rankedSourceMode({ GEEK_RANKED_QUESTION_SOURCE: 'fixture' }), 'fixture');
  assert.throws(() => rankedSourceMode({ GEEK_RANKED_QUESTION_SOURCE: 'fixture', VERCEL_ENV: 'production' }), /RANKED_SOURCE_INVALID/);
  assert.throws(() => rankedSourceMode({ GEEK_RANKED_QUESTION_SOURCE: 'other' }), /RANKED_SOURCE_INVALID/);
});

test('every committed public question is flagged exposed and not ranked-eligible', () => {
  for (const category of ['kaspa', 'history', 'technology']) {
    const bank = loadQuestionBank(category);
    assert.ok(bank.questions.length > 0);
    assert.ok([...bank.byId.values()].every(isExposedQuestion));
  }
});

test('fixture mode ranks only sample questions while saved public IDs still grade', async () => withEnv({ GEEK_RANKED_QUESTION_SOURCE: 'fixture' }, async () => {
  const savedId = loadQuestionBank('kaspa').questions[0].id;
  const ids = await selectRoundQuestionIds('kaspa', 1, [savedId], '', { ranked: true });
  assert.equal(ids.length, 10);
  assert.ok(ids.every((id) => id.startsWith('SAMPLE-KASPA-E')));
  const sample = await questionById('kaspa', ids[0]);
  assert.equal(sample.options[sample.correctIndex], 'Sample answer');
  const saved = await questionById('kaspa', savedId);
  assert.equal(isExposedQuestion(saved), true);
  assert.ok(Number.isInteger(saved.correctIndex));
  const practice = await selectRoundQuestionIds('kaspa', 1);
  assert.ok(practice.every((id) => !id.startsWith('SAMPLE-')), 'non-ranked modes keep the public pool');
}));

test('the public fixture bank contains no published question IDs or prompts', () => {
  for (const category of ['kaspa', 'history', 'pop-culture']) {
    const fixture = JSON.parse(readFileSync(join(process.cwd(), 'server', 'question-fixtures', 'ranked-sample', `${category}.json`), 'utf8')).questions;
    const bank = loadQuestionBank(category);
    const prompts = new Set([...bank.byId.values()].map((q) => q.prompt));
    assert.ok(fixture.every((q) => !bank.byId.has(q.id) && !prompts.has(q.prompt) && q.options[q.correctIndex] === 'Sample answer'));
  }
});

test('private directory bank feeds ranked play and grades private and retired IDs', async () => {
  const dir = privateDir(tiers('HPRIV'));
  await withEnv({ GEEK_PRIVATE_QUESTION_DIR: dir, VERCEL_ENV: 'production' }, async () => {
    const ids = await selectRoundQuestionIds('history', 5, [], '', { ranked: true });
    assert.ok(ids.every((id) => id.startsWith('HPRIV-medium-')));
    const q = await questionById('history', 'HPRIV-medium-3');
    assert.equal(q.correctIndex, 3);
    assert.equal(isExposedQuestion(q), false);
    const retired = JSON.parse(readFileSync(join(process.cwd(), 'server', 'questions', 'history-retired.json'), 'utf8')).questions[0];
    assert.equal((await questionById('history', retired.id)).correctIndex, retired.correctIndex);
    await assert.rejects(selectRoundQuestionIds('kaspa', 1, [], '', { ranked: true }), /QUESTION_POOL_EXHAUSTED/, 'a category without private rows does not fall back to exposed rows');
  });
});

test('a private ID that collides with a published ID is rejected', async () => {
  const published = loadQuestionBank('history').questions[0].id;
  const dir = privateDir([privateQuestion(published, 'easy', 0)]);
  await withEnv({ GEEK_PRIVATE_QUESTION_DIR: dir }, async () => {
    await assert.rejects(loadRankedBank('history'), /PRIVATE_BANK_ID_COLLISION/);
  });
});

test('production without a private source refuses new ranked rounds but keeps grading saved games', async () => withEnv({ VERCEL_ENV: 'production' }, async () => {
  await assert.rejects(selectRoundQuestionIds('history', 1, [], '', { ranked: true }), /RANKED_BANK_UNAVAILABLE/);
  const id = loadQuestionBank('history').questions[0].id;
  assert.equal((await questionById('history', id)).id, id);
}));

test('private URL source is fetched with a bearer token and validated', async () => {
  let seen;
  const fetch = async (url, init) => { seen = { url, init }; return { ok: true, json: async () => ({ banks: { history: tiers('HURL') } }) }; };
  const env = { GEEK_PRIVATE_QUESTION_URL: 'https://storage.invalid/bank.json', GEEK_PRIVATE_QUESTION_TOKEN: 'test-token' };
  resetRankedSourceCache();
  const source = await loadRankedSource(env, { fetch });
  assert.equal(seen.init.headers.authorization, 'Bearer test-token');
  assert.equal(source.banks.history.length, 36);
  resetRankedSourceCache();
  await assert.rejects(loadRankedSource({ GEEK_PRIVATE_QUESTION_URL: 'http://insecure.invalid' }), /PRIVATE_BANK_URL_INVALID/);
  resetRankedSourceCache();
  const bad = async () => ({ ok: true, json: async () => ({ banks: { history: [{ id: 'x', prompt: 'p', options: ['a'], correctIndex: 9, difficulty: 'easy' }] } }) });
  await assert.rejects(loadRankedSource(env, { fetch: bad }), /PRIVATE_BANK_INVALID/);
  resetRankedSourceCache();
});

test('issued ranked questions never carry the answer key', () => {
  const source = readFileSync(join(process.cwd(), 'api', 'ranked.js'), 'utf8');
  const publicQuestion = source.slice(source.indexOf('const publicQuestion'), source.indexOf('const issueQuestion'));
  assert.ok(publicQuestion.length > 0);
  assert.doesNotMatch(publicQuestion, /correctIndex|question\.answer\b/);
  assert.match(source, /selectRoundQuestionIds\([^)]*\{ ranked: true \}\)/);
});
