// Failure modes for the private ranked bank: unavailable storage, expired
// credential, invalid document and version rollback. Ranked play must block
// safely (no exposed/fixture fallback, no secret in errors) and recover.
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRankedSource, loadRankedSourceVersion, resetRankedSourceCache } from '../server/question-source.js';
import { selectRoundQuestionIds } from '../server/questions.js';

const KEYS = ['GEEK_PRIVATE_QUESTION_DIR', 'GEEK_PRIVATE_QUESTION_REF', 'GEEK_PRIVATE_QUESTION_URL', 'GEEK_PRIVATE_QUESTION_TOKEN', 'GEEK_RANKED_QUESTION_SOURCE', 'GEEK_RANKED_ALLOW_EXPOSED', 'VERCEL_ENV', 'NODE_ENV'];
const TOKEN = 'test-resilience-token';
const URL_ = 'https://api.github.com/repos/fake-owner/fake-private-bank/contents/bank.json';
const REF_A = 'a'.repeat(40), REF_B = 'b'.repeat(40);
const row = (id, difficulty, i) => ({ id, category: 'history', difficulty, prompt: `Fake prompt ${id}?`, options: ['A', 'B', 'C', 'D'], correctIndex: i % 4 });
const bank = (prefix) => ({ banks: { history: ['easy', 'medium', 'hard'].flatMap((t) => Array.from({ length: 12 }, (_, i) => row(`${prefix}-${t}-${i}`, t, i))) } });

const withEnv = async (values, fetchImpl, run) => {
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const savedFetch = globalThis.fetch;
  KEYS.forEach((k) => delete process.env[k]);
  Object.assign(process.env, values);
  if (fetchImpl) globalThis.fetch = fetchImpl;
  resetRankedSourceCache();
  try { return await run(); } finally {
    globalThis.fetch = savedFetch;
    KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
    resetRankedSourceCache();
  }
};
const BRANCH_NAME_PIN = 'main'; // a mutable branch name, which must be rejected
const prod = (extra = {}) => ({ VERCEL_ENV: 'preview', GEEK_PRIVATE_QUESTION_URL: URL_, GEEK_PRIVATE_QUESTION_TOKEN: TOKEN, GEEK_PRIVATE_QUESTION_REF: REF_A, ...extra });
const noSecret = (error) => { assert.doesNotMatch(String(error?.message), new RegExp(`${TOKEN}|fake-private-bank`)); return true; };
const ranked = () => selectRoundQuestionIds('history', 1, [], '', { ranked: true });

test('unavailable storage blocks ranked play without falling back, then recovers', async () => {
  let mode = 'down';
  const fetch = async () => {
    if (mode === 'down') throw new TypeError('fetch failed');
    if (mode === '503') return new Response('busy', { status: 503 });
    if (mode === 'timeout') { const e = new Error('t'); e.name = 'TimeoutError'; throw e; }
    return new Response(JSON.stringify(bank('OK')));
  };
  await withEnv(prod(), fetch, async () => {
    await assert.rejects(ranked(), (e) => /PRIVATE_BANK_UNREACHABLE|RANKED_BANK_UNAVAILABLE/.test(e.message) && noSecret(e));
    mode = '503'; await assert.rejects(ranked(), (e) => /UNREACHABLE|UNAVAILABLE/.test(e.message) && noSecret(e));
    mode = 'timeout'; await assert.rejects(ranked(), (e) => /PRIVATE_BANK_TIMEOUT|UNAVAILABLE/.test(e.message) && noSecret(e));
    mode = 'up';
    const ids = await ranked();
    assert.ok(ids.length > 0 && ids.every((id) => id.startsWith('OK-')), 'recovers with private rows only after storage returns');
  });
});

test('an expired or revoked credential (401/403) blocks ranked play and never echoes the token', async () => {
  for (const status of [401, 403]) {
    let seenAuth;
    const fetch = async (_url, init) => { seenAuth = init.headers.authorization; return new Response('{"message":"Bad credentials"}', { status }); };
    await withEnv(prod(), fetch, async () => {
      await assert.rejects(ranked(), (e) => /UNREACHABLE|UNAVAILABLE/.test(e.message) && noSecret(e));
      assert.equal(seenAuth, `Bearer ${TOKEN}`);
    });
  }
});

test('invalid documents are rejected and never partially loaded', async () => {
  const docs = ['not json', '[]', '{"banks":[]}', '{"banks":{"history":{}}}', JSON.stringify({ banks: { history: [{ id: 'x', prompt: 'p', options: ['a', 'a', 'b', 'c'], correctIndex: 0, difficulty: 'easy' }] } }), JSON.stringify({ banks: { history: [row('X', 'easy', 0), { ...row('Y', 'easy', 1), correctIndex: 7 }] } }), JSON.stringify({ banks: {}, retired: [] })];
  for (const text of docs) {
    await withEnv(prod(), async () => new Response(text), async () => {
      await assert.rejects(loadRankedSource(process.env), /PRIVATE_BANK_INVALID|PRIVATE_BANK_TOO_LARGE/, text.slice(0, 40));
      await assert.rejects(ranked(), (e) => noSecret(e));
    });
  }
});

test('version rollback: repinning an older commit serves exactly that version; runs keep their bound version', async () => {
  const requested = [];
  const fetch = async (url) => {
    const ref = new URL(url).searchParams.get('ref'); requested.push(ref);
    return new Response(JSON.stringify(bank(ref === REF_A ? 'VA' : 'VB')));
  };
  await withEnv(prod(), fetch, async () => {
    const a = await loadRankedSource(process.env);
    assert.equal(a.version, `git:${REF_A}`);
    process.env.GEEK_PRIVATE_QUESTION_REF = REF_B;
    const b = await loadRankedSource(process.env);
    assert.equal(b.version, `git:${REF_B}`);
    assert.ok(b.banks.history.every((q) => q.id.startsWith('VB-')));
    // A run issued under A still grades against A while B is current.
    assert.ok((await loadRankedSourceVersion(`git:${REF_A}`, process.env)).banks.history.every((q) => q.id.startsWith('VA-')));
    // Roll back to A: served from the immutable cache, no refetch, same object.
    const fetchesBefore = requested.length;
    process.env.GEEK_PRIVATE_QUESTION_REF = REF_A;
    assert.equal(await loadRankedSource(process.env), a);
    assert.equal(requested.length, fetchesBefore);
    // A malformed or missing pin blocks instead of floating to the latest bank.
    process.env.GEEK_PRIVATE_QUESTION_REF = BRANCH_NAME_PIN;
    await assert.rejects(loadRankedSource(process.env), /PRIVATE_BANK_REF_INVALID/);
    delete process.env.GEEK_PRIVATE_QUESTION_REF;
    await assert.rejects(loadRankedSource(process.env), /PRIVATE_BANK_REF_REQUIRED/);
  });
});
