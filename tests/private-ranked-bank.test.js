import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cachedBankVersions, decodeBankDocument, loadRankedSource, loadRankedSourceVersion, pinnedUrl, rankedSourceMode, readUrlBanks, resetRankedSourceCache } from '../server/question-source.js';
import { SEASONS, isExposedQuestion, loadQuestionBank, loadRankedBank, questionById, rankedRunBinding, seasonFor, selectRoundQuestionIds } from '../server/questions.js';
import { leaderboardSeasonLabel } from '../server/seasons.js';

const KEYS = ['GEEK_PRIVATE_QUESTION_DIR', 'GEEK_PRIVATE_QUESTION_REF', 'GEEK_PRIVATE_QUESTION_URL', 'GEEK_PRIVATE_QUESTION_TOKEN', 'GEEK_RANKED_QUESTION_SOURCE', 'GEEK_RANKED_ALLOW_EXPOSED', 'VERCEL_ENV', 'NODE_ENV'];
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
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'production', GEEK_PRIVATE_QUESTION_DIR: '/fake-bank' }), 'private');
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
  const fetch = async (url, init) => { seen = { url, init }; return new Response(JSON.stringify({ banks: { history: tiers('HURL') } })); };
  const env = { GEEK_PRIVATE_QUESTION_URL: 'https://storage.invalid/bank.json', GEEK_PRIVATE_QUESTION_TOKEN: 'test-token' };
  resetRankedSourceCache();
  const source = await loadRankedSource(env, { fetch });
  assert.equal(seen.init.headers.authorization, 'Bearer test-token');
  assert.equal(source.banks.history.length, 36);
  resetRankedSourceCache();
  await assert.rejects(loadRankedSource({ GEEK_PRIVATE_QUESTION_URL: 'http://insecure.invalid' }), /PRIVATE_BANK_URL_INVALID/);
  resetRankedSourceCache();
  const bad = async () => new Response(JSON.stringify({ banks: { history: [{ id: 'x', prompt: 'p', options: ['a'], correctIndex: 9, difficulty: 'easy' }] } }));
  await assert.rejects(loadRankedSource(env, { fetch: bad }), /PRIVATE_BANK_INVALID/);
  resetRankedSourceCache();
});

test('issued ranked questions never carry the answer key', () => {
  const source = readFileSync(join(process.cwd(), 'api', 'ranked.js'), 'utf8');
  const publicQuestion = source.slice(source.indexOf('const publicQuestion'), source.indexOf('const issueQuestion'));
  assert.ok(publicQuestion.length > 0);
  assert.doesNotMatch(publicQuestion, /correctIndex|question\.answer\b/);
  assert.match(source, /selectRoundQuestionIds\([^)]*\{ ranked: true, bankVersion: run\.bankVersion \}\)/);
});

const SHA_A = 'a'.repeat(40), SHA_B = 'b'.repeat(40);
const jsonResponse = (text, { status = 200, headers = {} } = {}) => new Response(text, { status, headers });
const bankDoc = (prefix, correctOffset = 0, retired = []) => JSON.stringify({ banks: { history: tiers(prefix).map((q) => ({ ...q, correctIndex: (q.correctIndex + correctOffset) % 4 })) }, retired: { history: retired } });

test('GitHub Contents API: raw media type and base64 JSON wrapper both load', async () => {
  const raw = bankDoc('HRAW');
  const wrapper = JSON.stringify({ type: 'file', encoding: 'base64', name: 'bank.json', content: Buffer.from(raw).toString('base64').replace(/(.{60})/g, '$1\n') });
  assert.deepEqual(decodeBankDocument(wrapper).banks.history.length, 36);
  assert.deepEqual(decodeBankDocument(raw).banks.history.length, 36);
  assert.throws(() => decodeBankDocument(JSON.stringify({ type: 'file', encoding: 'none', content: '' })), /PRIVATE_BANK_TOO_LARGE/);
  assert.throws(() => decodeBankDocument('not json'), /PRIVATE_BANK_INVALID/);
  let seen;
  const fetch = async (url, init) => { seen = { url, init }; return jsonResponse(wrapper); };
  const loaded = await readUrlBanks('https://api.github.com/repos/fake-owner/fake-private-bank/contents/bank.json', 'test-token', { fetch, ref: SHA_A });
  assert.equal(loaded.banks.history.length, 36);
  assert.match(seen.init.headers.accept, /application\/vnd\.github\.raw/);
  assert.equal(new URL(seen.url).searchParams.get('ref'), SHA_A, 'Contents API is pinned to an immutable commit');
  assert.ok(seen.init.signal instanceof AbortSignal, 'fetch carries a timeout signal');
  assert.equal(pinnedUrl('https://storage.invalid/bank.json', SHA_A), 'https://storage.invalid/bank.json');
});

test('private bank fetches are bounded by size and time', async () => {
  const big = 'x'.repeat(2048);
  await assert.rejects(readUrlBanks('https://storage.invalid/b', '', { fetch: async () => jsonResponse(big), maxBytes: 1024 }), /PRIVATE_BANK_TOO_LARGE/);
  await assert.rejects(readUrlBanks('https://storage.invalid/b', '', { fetch: async () => jsonResponse('{}', { headers: { 'content-length': '999999999' } }) }), /PRIVATE_BANK_TOO_LARGE/);
  const hang = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
  await assert.rejects(readUrlBanks('https://storage.invalid/b', '', { fetch: hang, timeoutMs: 20 }), /PRIVATE_BANK_TIMEOUT/);
  await assert.rejects(readUrlBanks('https://storage.invalid/b', '', { fetch: async () => jsonResponse('nope', { status: 404 }) }), /PRIVATE_BANK_UNREACHABLE/);
});

test('private *-retired.json rows are lookup-only, never selectable', async () => {
  const dir = privateDir(tiers('HACT'));
  const retired = ['easy', 'medium', 'hard'].flatMap((tier) => Array.from({ length: 12 }, (_, i) => privateQuestion(`HRET-${tier}-${i}`, tier, i)));
  writeFileSync(join(dir, 'history-retired.json'), JSON.stringify({ questions: retired }));
  await withEnv({ GEEK_PRIVATE_QUESTION_DIR: dir }, async () => {
    const bank = await loadRankedBank('history');
    assert.equal(bank.questions.length, 36);
    assert.ok(bank.questions.every((q) => q.id.startsWith('HACT-')));
    assert.ok(bank.byId.has('HRET-easy-1'));
    for (let round = 1; round <= 10; round += 1) {
      const ids = await selectRoundQuestionIds('history', round, [], '', { ranked: true });
      assert.ok(ids.every((id) => !id.startsWith('HRET-')), 'retired rows never selected');
    }
    assert.equal((await questionById('history', 'HRET-hard-2')).correctIndex, 2, 'retired rows still grade saved runs');
  });
});

test('runs bind to an immutable pinned bank version; no fetch per answer; history keeps grading', async () => {
  let fetches = 0;
  const docs = { [SHA_A]: bankDoc('HVER', 0), [SHA_B]: bankDoc('HVER', 1) };
  globalThis.__savedFetch = globalThis.fetch;
  globalThis.fetch = async (url) => { fetches += 1; return jsonResponse(docs[new URL(url).searchParams.get('ref')]); };
  const base = { GEEK_PRIVATE_QUESTION_URL: 'https://api.github.com/repos/fake-owner/fake-private-bank/contents/bank.json', GEEK_PRIVATE_QUESTION_TOKEN: 'test-token', VERCEL_ENV: 'production' };
  try {
    await withEnv({ ...base }, async () => {
      await assert.rejects(rankedRunBinding(), /PRIVATE_BANK_REF_REQUIRED/, 'production URL sources must be pinned');
    });
    let bound;
    await withEnv({ ...base, GEEK_PRIVATE_QUESTION_REF: SHA_A }, async () => {
      bound = await rankedRunBinding();
      assert.deepEqual(bound, { season: 'season-1', seasonLabel: 'Season 1 — Private-bank', bankVersion: `git:${SHA_A}` });
      for (let i = 0; i < 25; i += 1) await questionById('history', 'HVER-easy-1', { bankVersion: bound.bankVersion });
      await selectRoundQuestionIds('history', 2, [], '', { ranked: true, bankVersion: bound.bankVersion });
      assert.equal(fetches, 1, 'one cached fetch, no GitHub request per answer');
      assert.equal((await questionById('history', 'HVER-easy-1', { bankVersion: bound.bankVersion })).correctIndex, 1);
    });
    await withEnv({ ...base, GEEK_PRIVATE_QUESTION_REF: SHA_B }, async () => {
      // Same ID, changed key in the new version.
      assert.equal((await questionById('history', 'HVER-easy-1')).correctIndex, 2);
      // A run bound to version A keeps grading and selecting from A.
      assert.equal((await questionById('history', 'HVER-easy-1', { bankVersion: bound.bankVersion })).correctIndex, 1);
      const ids = await selectRoundQuestionIds('history', 2, [], '', { ranked: true, bankVersion: bound.bankVersion });
      assert.equal(ids.length, 10);
      assert.ok(cachedBankVersions().includes(`git:${SHA_A}`) && cachedBankVersions().includes(`git:${SHA_B}`));
      assert.equal((await loadRankedSourceVersion(`git:${SHA_A}`)).version, `git:${SHA_A}`);
      await assert.rejects(selectRoundQuestionIds('history', 2, [], '', { ranked: true, bankVersion: 'public' }), /RANKED_BANK_VERSION_CHANGED/);
    });
  } finally { globalThis.fetch = globalThis.__savedFetch; delete globalThis.__savedFetch; }
});

test('seasons: legacy runs are Season 0 — Public-bank Alpha with a separate private-bank board', async () => {
  assert.equal(seasonFor({}).label, 'Season 0 — Public-bank Alpha');
  assert.equal(seasonFor({}).leaderboard, 'legacy');
  assert.equal(seasonFor({ season: 'season-1' }).leaderboard, 'season-1');
  assert.equal(leaderboardSeasonLabel('legacy'), SEASONS['season-0'].label);
  await withEnv({}, async () => assert.equal((await rankedRunBinding()).season, 'season-0'));
  const leaderboard = readFileSync(join(process.cwd(), 'server', 'leaderboard.js'), 'utf8');
  assert.match(leaderboard, /'legacy' \? 'geek:leaderboard' : `geek:leaderboard:\$\{cleanSeason\(season\)\}`/, 'legacy keys preserved; private season separate');
});

test('ranked answer responses defer correctness until the round locks', () => {
  const source = readFileSync(join(process.cwd(), 'api', 'ranked.js'), 'utf8');
  assert.match(source, /feedback: 'deferred'/);
  assert.match(source, /result: hidden \? \{ feedback: 'deferred', recorded: true, timedOut, locked: false \} : result/);
  const deferredRun = source.slice(source.indexOf('const safeRun'), source.indexOf(") : ({"));
  for (const field of ['correct:', 'streak:', 'roundScore:', 'maxStreak:', 'answeredReview: run.roundAnswers']) assert.equal(deferredRun.includes(field), false, field);
  assert.match(source, /run\.lastResponse = response;/, 'saved/retried responses reuse the masked response');
});


test('Vercel previews fail closed like production (no exposed or fixture fallback)', async () => {
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'preview' }), 'unavailable');
  assert.throws(() => rankedSourceMode({ VERCEL_ENV: 'preview', GEEK_RANKED_QUESTION_SOURCE: 'fixture' }), /RANKED_SOURCE_INVALID/);
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'preview', GEEK_RANKED_QUESTION_SOURCE: 'exposed' }), 'unavailable');
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'preview', GEEK_PRIVATE_QUESTION_DIR: '/fake-bank' }), 'private');
  assert.equal(rankedSourceMode({ VERCEL_ENV: 'development' }), 'exposed');
  await withEnv({ VERCEL_ENV: 'preview' }, async () => {
    await assert.rejects(selectRoundQuestionIds('history', 1, [], '', { ranked: true }), /RANKED_BANK_UNAVAILABLE/);
  });
  await withEnv({ VERCEL_ENV: 'preview', GEEK_PRIVATE_QUESTION_URL: 'https://api.github.com/repos/fake-owner/fake-p/contents/bank.json' }, async () => {
    await assert.rejects(rankedRunBinding(), /PRIVATE_BANK_REF_REQUIRED/);
  });
});

test('token fetch refuses redirects', async () => {
  let init;
  await readUrlBanks('https://storage.invalid/b', 'tok', { fetch: async (url, i) => { init = i; return new Response(bankDoc('HRED')); } });
  assert.equal(init.redirect, 'error');
});

test('runs without a feedback setting default to deferred; per-player start limit exists', () => {
  const source = readFileSync(join(process.cwd(), 'api', 'ranked.js'), 'utf8');
  assert.match(source, /const deferredFeedback = \(run\) => run\.feedback !== 'immediate';/);
  assert.match(source, /const hidden = deferredFeedback\(run\) && !roundResult;/);
  assert.doesNotMatch(source, /run\.feedback === 'deferred'/);
  assert.match(source, /rateLimit\('ranked-start-player', playerId, RANKED_START_PLAYER_LIMIT\.maximum, RANKED_START_PLAYER_LIMIT\.seconds\)/);
});
