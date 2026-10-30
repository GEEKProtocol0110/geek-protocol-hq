import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { answerHashes, isScanned, loadPrivateIndex, scanRepo, scanText } from '../scripts/private-bank-leak-check.mjs';

const TEMPLATE_ROW = JSON.parse(readFileSync(new URL('../private-bank-template/bank/kaspa.json', import.meta.url), 'utf8')).questions[0];
const retired = { ...TEMPLATE_ROW, retiredReason: 'rotation', retiredAt: '2026-11-15' };

test('the public repo passes the leak check', async () => {
  const { files, violations } = await scanRepo(new URL('..', import.meta.url).pathname);
  assert.ok(files > 50);
  assert.deepEqual(violations, []);
});

test('active private ids in public question files fail; retired rows may be public', () => {
  assert.match(scanText('server/questions/x.json', JSON.stringify({ questions: [TEMPLATE_ROW] })).join(), /active private ranked id/);
  assert.match(scanText('public/play/assets/app.js', `const q = "${TEMPLATE_ROW.id}";`).join(), /outside the template/);
  assert.deepEqual(scanText('server/questions/kaspa-retired.json', JSON.stringify({ questions: [retired] })), []);
  // retiredAt outside a *-retired.json file is not enough
  assert.match(scanText('server/questions/kaspa.json', JSON.stringify({ questions: [retired] })).join(), /active private ranked id/);
});

test('per-question answer hashes fail unless retired or already public; one whole-bank version hash is allowed', () => {
  const h = 'a'.repeat(64);
  assert.match(scanText('docs/x.json', JSON.stringify([{ id: 'NEW-1', answerKeyHash: h }])).join(), /per-question hash "answerKeyHash" for unknown id NEW-1/);
  assert.deepEqual(scanText('docs/x.json', JSON.stringify([{ id: 'KAS-1', answerKeyHash: h }]), { publicIds: new Set(['KAS-1']) }), []);
  assert.deepEqual(scanText('docs/kaspa-retired.json', JSON.stringify([{ id: ['PRK', 'KAS', '202611', '0001'].join('-'), retiredAt: '2026-11-15', answerKeyHash: h }])), []);
  assert.deepEqual(scanText('docs/manifest.json', JSON.stringify({ version: `sha256:${h}`, bankVersion: `sha256:${h}` })), []);
  assert.deepEqual(scanText('docs/x.json', JSON.stringify({ files: [{ name: 'a', sha256: h }] })), [], 'file hashes are not per-question answer hashes');
});

test('with a private index, verbatim ids, prompts and answer-derived hashes are caught anywhere scanned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'leak-'));
  try {
    writeFileSync(join(dir, 'kaspa.json'), JSON.stringify({ questions: [TEMPLATE_ROW] }));
    writeFileSync(join(dir, 'kaspa-retired.json'), JSON.stringify({ questions: [{ ...retired, id: ['PRK', 'KAS', '202611', '0099'].join('-'), prompt: 'EXAMPLE — retired prompt that may be public' }] }));
    const privateIndex = loadPrivateIndex(dir);
    for (const leak of [TEMPLATE_ROW.prompt, ...answerHashes(TEMPLATE_ROW)]) assert.match(scanText('public/data/x.txt', `x ${leak} y`, { privateIndex }).join(), /contains/);
    assert.deepEqual(scanText('public/data/x.txt', 'EXAMPLE — retired prompt that may be public', { privateIndex }), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scope: JSON files and served assets, never the fake template', () => {
  assert.equal(isScanned('server/questions/kaspa-questions.json'), true);
  assert.equal(isScanned('public/play/assets/game.js'), true);
  assert.equal(isScanned('private-bank-template/bank/kaspa.json'), false);
  assert.equal(isScanned('tests/api.test.js'), false);
});

// Secret-looking literals are assembled at runtime so this file never contains them.
const PAT = ['github', 'pat', 'A'.repeat(30)].join('_');
const GHP = 'gh' + 'p_' + 'b'.repeat(36);
const PRK = ['prk', 'kas', '202611', '0007'].join('-');

test('tracked files under private/ fail', () => {
  assert.match(scanText('private/bank/kaspa.json', '{}').join(), /under private\//);
  assert.match(scanText('Private/notes.md', 'hello').join(), /under private\//);
});

test('token, Bearer and private-repo URL literals fail in any file type', () => {
  for (const path of ['server/x.js', 'docs/x.md', 'deploy/x.yaml', 'public/x.html', 'tests/fixture.js']) {
    assert.match(scanText(path, `const t = "${PAT}";`).join(), /GitHub token literal/, path);
    assert.match(scanText(path, `token: ${GHP}`).join(), /GitHub token literal/, path);
  }
  assert.match(scanText('server/x.js', "headers: { authorization: 'Bearer abcdEFGH12345678ijkl' }").join(), /Bearer token literal/);
  assert.deepEqual(scanText('server/x.js', 'headers: { authorization: `Bearer ${token}` }'), []);
  assert.deepEqual(scanText('public/security/index.html', '<p>without exposing bearer credentials</p>'), []);
  assert.match(scanText('docs/x.md', 'fetch https://api.github.com/repos/acme/ranked-bank/contents/bank.json').join(), /private bank repo acme\/ranked-bank/);
  assert.match(scanText('deploy/x.yaml', 'url: https://raw.githubusercontent.com/acme/Private-Questions/main/b.json').join(), /private bank repo/);
  assert.deepEqual(scanText('docs/x.md', 'https://api.github.com/repos/GEEKProtocol0110/<private-repo>/contents/bank.json'), []);
  assert.deepEqual(scanText('server/widget-download.js', 'https://api.github.com/repos/${repository}/releases/latest'), []);
});

test('loader env vars assigned literal values fail; naming them or placeholders does not', () => {
  for (const [path, text] of [
    ['vercel.json', '{"env":{"GEEK_RANKED_ALLOW_EXPOSED":"true"}}'],
    ['deploy/env.yaml', 'GEEK_RANKED_QUESTION_SOURCE: exposed'],
    ['scripts/x.sh', 'export GEEK_PRIVATE_QUESTION_URL=https://example.com/b.json'],
    ['server/x.js', "const env = { GEEK_PRIVATE_QUESTION_REF: 'abc123' };"],
    ['docs/x.md', '```\nGEEK_RANKED_ALLOW_EXPOSED=true\n```'],
    ['.env.example', 'GEEK_RANKED_ALLOW_EXPOSED=true']
  ]) assert.match(scanText(path, text).join(), /assigned a literal value/, path);
  for (const [path, text] of [
    ['docs/x.md', 'Never set `GEEK_RANKED_ALLOW_EXPOSED` in production.'],
    ['server/q.js', "if (env.GEEK_RANKED_ALLOW_EXPOSED === 'true') x(); const v = process.env.GEEK_PRIVATE_QUESTION_URL;"],
    ['.env.example', 'GEEK_PRIVATE_QUESTION_URL=\nGEEK_PRIVATE_QUESTION_TOKEN=<fine-grained-pat>\nGEEK_RANKED_QUESTION_SOURCE='],
    ['tests/x.test.js', "process.env.GEEK_RANKED_QUESTION_SOURCE = 'fixture';"]
  ]) assert.deepEqual(scanText(path, text), [], path);
});

test('answer fields on private or ranked-flagged rows fail; public practice rows keep correctIndex', () => {
  const row = { ...TEMPLATE_ROW, id: PRK.toUpperCase() };
  const msgs = scanText('server/questions/x.json', JSON.stringify({ questions: [row, { id: 'R1', ranked: true, prompt: 'p', answer: 'A' }, { id: 'R2', pool: 'ranked', correct: 2 }] })).join('\n');
  assert.match(msgs, /answer field "correctIndex" on private\/ranked question PRK/);
  assert.match(msgs, /answer field "answer" on private\/ranked question R1/);
  assert.match(msgs, /answer field "correct" on private\/ranked question R2/);
  assert.match(scanText('server/questions/x.json', JSON.stringify([{ id: PRK, correctIndex: 1 }])).join(), /answer field "correctIndex".*prk-/i, 'lowercase id');
  assert.deepEqual(scanText('server/questions/kaspa-questions.json', JSON.stringify({ questions: [{ id: 'KAS-1', prompt: 'p', options: ['a', 'b', 'c', 'd'], correctIndex: 0 }] })), []);
  assert.deepEqual(scanText('server/questions/kaspa-retired.json', JSON.stringify({ questions: [retired] })), [], 'retired private rows may stay public');
});

test('lowercase prk- ids in non-JSON files are caught', () => {
  for (const path of ['server/x.js', 'docs/x.md', 'deploy/x.yaml']) assert.match(scanText(path, `id: ${PRK}`).join(), /private ranked id prk-/, path);
});

test('the CLI exits non-zero on a violation and zero on a clean tree', () => {
  const root = mkdtempSync(join(tmpdir(), 'leak-cli-'));
  const cli = new URL('../scripts/private-bank-leak-check.mjs', import.meta.url).pathname;
  try {
    mkdirSync(join(root, 'docs'));
    writeFileSync(join(root, 'docs/ok.md'), 'nothing to see');
    assert.equal(spawnSync(process.execPath, [cli, '--root', root]).status, 0);
    mkdirSync(join(root, 'private'));
    writeFileSync(join(root, 'private/bank.json'), '{}');
    const bad = spawnSync(process.execPath, [cli, '--root', root], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /under private\//);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
