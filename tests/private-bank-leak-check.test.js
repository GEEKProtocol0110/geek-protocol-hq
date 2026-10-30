import assert from 'node:assert/strict';
import { spawnSync, execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, truncateSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import test from 'node:test';
import { readAllowlist, FAKE_EXAMPLE_ID, OPAQUE_ALLOWLIST, answerHashes, highEntropy, isTextScanned, loadPrivateIndex, MAX_SCAN_BYTES, scanRepo, scanText, validRetiredAt } from '../scripts/private-bank-leak-check.mjs';

const TEMPLATE_ROW = JSON.parse(readFileSync(new URL('../private-bank-template/bank/kaspa.json', import.meta.url), 'utf8')).questions[0];
const retired = { ...TEMPLATE_ROW, retiredReason: 'rotation', retiredAt: '2026-10-15' };

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
  assert.match(scanText('docs/x.json', JSON.stringify([{ id: 'NEW-1', prompt: 'p', answerKeyHash: h }])).join(), /per-question hash "answerKeyHash" for unknown id NEW-1/);
  assert.deepEqual(scanText('docs/x.json', JSON.stringify([{ id: 'KAS-1', answerKeyHash: h }]), { publicIds: new Set(['KAS-1']) }), []);
  assert.deepEqual(scanText('server/questions/kaspa-retired.json', JSON.stringify([{ id: ['PRK', 'KAS', '202611', '0001'].join('-'), retiredAt: '2026-10-15', answerKeyHash: h }])), []);
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

test('scope: every tracked text file except binaries and the fake template', () => {
  for (const p of ['server/questions/kaspa-questions.json', 'public/play/assets/game.js', 'tests/api.test.js', 'docs/x.md', 'deploy/x.yaml', 'notes.txt']) assert.equal(isTextScanned(p), true, p);
  assert.equal(isTextScanned('private-bank-template/bank/kaspa.json'), false);
  assert.equal(isTextScanned('public/img/logo.png'), false);
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
    assert.match(scanText(path, `const t = "${PAT}";`).join(), /token literal/, path);
    assert.match(scanText(path, `token: ${GHP}`).join(), /token literal/, path);
  }
  assert.match(scanText('server/x.js', `headers: { authorization: '${'Bear' + 'er'} abcdEFGH12345678ijkl' }`).join(), /Bearer token literal/);
  assert.deepEqual(scanText('server/x.js', 'headers: { authorization: `Bearer ${token}` }'), []);
  assert.deepEqual(scanText('public/security/index.html', '<p>without exposing bearer credentials</p>'), []);
  assert.match(scanText('docs/x.md', `fetch https://api.github.com/repos/acme/${'ranked'}-bank/contents/bank.json`.replace('/repos/', '/re' + 'pos/')).join(), /private bank repo acme\/ranked-bank/);
  assert.match(scanText('deploy/x.yaml', `url: https://raw.githubuser${'content'}.com/acme/Private-Questions/main/b.json`).join(), /private bank repo/);
  assert.deepEqual(scanText('docs/x.md', 'https://api.github.com/repos/GEEKProtocol0110/<private-repo>/contents/bank.json'), []);
  assert.deepEqual(scanText('server/widget-download.js', 'https://api.github.com/repos/${repository}/releases/latest'), []);
});

test('loader env vars assigned literal values fail; naming them or placeholders does not', () => {
  for (const [path, text] of [
    ['vercel.json', '{"env":{"GEEK_RANKED_ALLOW_EXPOSED":"true"}}'],
    ['deploy/env.yaml', 'GEEK_RANKED_QUESTION_SOURCE: exposed'],
    ['scripts/x.sh', 'export GEEK_PRIVATE_QUESTION_URL=https://example.com/b.json'],
    ['server/x.js', `const env = { ${'GEEK_PRIVATE_'}QUESTION_REF: 'abc123' };`],
    ['docs/x.md', '```\nGEEK_RANKED_ALLOW_EXPOSED=true\n```'],
    ['.env.example', 'GEEK_RANKED_ALLOW_EXPOSED=true']
  ]) assert.match(scanText(path, text).join(), /assigned a (literal value|high-entropy)/, path);
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

test('text search still runs after JSON parses: ids in notes, questionId rows, invalid JSON', () => {
  const id = ['PRK', 'KAS', '202611', '0003'].join('-');
  assert.match(scanText('docs/review.json', JSON.stringify({ notes: `see ${id} later` })).join(), /private ranked id/);
  const msgs = scanText('docs/grades.json', JSON.stringify([{ questionId: id, correctIndex: 2 }])).join('\n');
  assert.match(msgs, /active private ranked id/); assert.match(msgs, /answer field "correctIndex"/);
  assert.match(scanText('docs/broken.json', `{ "id": "${id}", `).join(), /private ranked id/);
});

test('private ids are matched case- and separator-insensitively', () => {
  const parts = ['kas', '202611', '0004'];
  for (const variant of [['prk', ...parts].join('-'), ['PRK', ...parts].join('_').toUpperCase(), ['Prk', 'Kas', '202611', '0004'].join('.'), ['prk', ...parts].join(' '), ['PRK', ...parts].join('').toUpperCase()]) {
    assert.match(scanText('docs/x.md', `row ${variant} end`).join(), /private ranked id/, variant);
    assert.match(scanText('server/q.json', JSON.stringify([{ id: variant, prompt: 'p' }])).join(), /active private ranked id/, variant);
  }
  assert.deepEqual(scanText('docs/x.md', 'PRKSOMETHING and prk-kas-2026-01 are not ids'), []);
});

test('hash-like keys and short/base64 hashes on non-retired private or question rows fail', () => {
  const id = ['PRK', 'HIS', '202611', '0005'].join('-');
  for (const [key, value] of [['gradingHash', 'deadbeefcafe'], ['checksum', 'a1b2c3d4'], ['digest', 'q83vEjRWeJA+ZmZmZmZmZg=='], ['answerHash', 'sha1:0123456789abcdef'], ['keyFingerprint', 'Zm9vYmFyYmF6cXV4MTIz']]) {
    assert.match(scanText('docs/x.json', JSON.stringify([{ id, [key]: value }])).join(), new RegExp(`per-question hash "${key}"`), key);
    assert.match(scanText('docs/x.json', JSON.stringify([{ id: 'Q-NEW', prompt: 'p', [key]: value }])).join(), /unknown id Q-NEW/, key);
  }
  assert.deepEqual(scanText('server/questions/history-retired.json', JSON.stringify([{ id, retiredAt: '2026-01-02', gradingHash: 'deadbeefcafe' }])), []);
  assert.deepEqual(scanText('docs/assets.json', JSON.stringify([{ id: 'ARCH-1', path: 'a.png', sha256: 'f'.repeat(64) }])), [], 'non-question records keep file hashes');
});

test('retiredAt must be a valid past ISO date for the retired exemption', () => {
  const now = new Date('2026-10-30T12:00:00Z');
  assert.equal(validRetiredAt('2026-10-01', now), true);
  for (const bad of ['2026-11-15', '2026-02-30', 'yesterday', '', 20261001, '2026-1-1']) assert.equal(validRetiredAt(bad, now), false, String(bad));
  const id = ['PRK', 'KAS', '202611', '0006'].join('-');
  for (const retiredAt of ['2099-01-01', '2026-13-01', 'soon']) {
    const msgs = scanText('server/questions/kaspa-retired.json', JSON.stringify({ questions: [{ id, retiredAt, correctIndex: 1 }] }), { now }).join('\n');
    assert.match(msgs, /not a valid past ISO date/, retiredAt); assert.match(msgs, /answer field "correctIndex"/, retiredAt);
  }
  assert.deepEqual(scanText('server/questions/kaspa-retired.json', JSON.stringify({ questions: [{ id, retiredAt: '2026-10-01', correctIndex: 1 }] }), { now }), []);
});

test('root private/ is gitignored', () => {
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8').split('\n').map((l) => l.trim());
  assert.ok(ignore.includes('/private/'));
});

test('--private / --root without a path is a usage error, not a crash', () => {
  const cli = new URL('../scripts/private-bank-leak-check.mjs', import.meta.url).pathname;
  for (const args of [['--private'], ['--private', '--root'], ['--root'], ['--private', '/nonexistent-dir-xyz']]) {
    const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /Usage:/);
    assert.doesNotMatch(r.stderr, /TypeError|at file:/);
  }
});

test('retired exemption only applies to server/questions/<category>-retired.json; PRK under public/ always fails', () => {
  const doc = JSON.stringify({ questions: [retired] });
  assert.deepEqual(scanText('server/questions/kaspa-retired.json', doc), []);
  for (const path of ['public/data/kaspa-retired.json', 'docs/kaspa-retired.json', 'server/questions/not-a-category-retired.json', 'server/questions/nested/kaspa-retired.json', 'server/questions/kaspa-retired.json.bak']) {
    assert.match(scanText(path, doc).join(), /private ranked id/, path);
  }
  assert.match(scanText('public/play/assets/notes.txt', `retired: ${retired.id}`).join(), /private ranked id/);
});

test('opaque archives/PDFs and oversized files are violations unless hash-pinned in the allowlist', async () => {
  const root = mkdtempSync(join(tmpdir(), 'leak-opaque-'));
  try {
    mkdirSync(join(root, 'docs'));
    for (const name of ['a.gz', 'b.zip', 'c.br', 'd.pdf']) writeFileSync(join(root, 'docs', name), 'x');
    let { violations } = await scanRepo(root);
    for (const name of ['a.gz', 'b.zip', 'c.br', 'd.pdf']) assert.ok(violations.some((v) => v.startsWith(`docs/${name}: opaque`)), name);
    const sha = createHash('sha256').update('x').digest('hex');
    mkdirSync(join(root, 'scripts'));
    writeFileSync(join(root, 'scripts/private-bank-leak-allowlist.json'), JSON.stringify({ files: [{ path: 'docs/d.pdf', sha256: sha, reason: 'reviewed fixture pdf' }, { path: 'docs/a.gz', sha256: '0'.repeat(64), reason: 'stale hash' }] }));
    ({ violations } = await scanRepo(root));
    assert.ok(!violations.some((v) => v.startsWith('docs/d.pdf')), 'pinned file passes');
    assert.ok(violations.some((v) => v.startsWith('docs/a.gz')), 'wrong hash still fails');
    const big = join(root, 'docs/big.json');
    writeFileSync(big, ''); truncateSync(big, MAX_SCAN_BYTES + 1);
    ({ violations } = await scanRepo(root));
    assert.ok(violations.some((v) => v.startsWith('docs/big.json: larger than 32 MB')));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('hashes inside arrays and per-row version hashes on question rows fail', () => {
  const id = ['PRK', 'KAS', '202611', '0008'].join('-');
  assert.match(scanText('docs/x.json', JSON.stringify([{ id, checksums: ['deadbeefcafe', 'x'] }])).join(), /per-question hash "checksums"/);
  assert.match(scanText('docs/x.json', JSON.stringify([{ id: 'Q-2', prompt: 'p', digests: ['q83vEjRWeJA+ZmZmZmZmZg=='] }])).join(), /per-question hash "digests"/);
  assert.match(scanText('docs/x.json', JSON.stringify([{ id: 'KAS-1', prompt: 'p', version: 'sha256:' + 'a'.repeat(64) }]), { publicIds: new Set(['KAS-1']) }).join(), /per-row version hash "version"/);
  assert.match(scanText('docs/x.json', JSON.stringify([{ id, bankVersion: 'deadbeefcafebabe' }])).join(), /per-row version hash "bankVersion"/);
  assert.deepEqual(scanText('docs/manifest.json', JSON.stringify({ version: 'sha256:' + 'a'.repeat(64) })), [], 'a manifest-level bank version is fine');
});

test('in tests/ only obviously fake Bearer, private-repo URL and GEEK_* values pass', () => {
  const B = 'Bear' + 'er', host = 'api.github.com/re' + 'pos';
  assert.deepEqual(scanText('tests/x.test.js', `h('${B} test-token-value-abc')`), []);
  assert.match(scanText('tests/x.test.js', `h('${B} abcdEFGH12345678ijkl')`).join(), /Bearer token literal/);
  assert.deepEqual(scanText('tests/x.test.js', `u('https://${host}/fake-owner/fake-private-bank/contents/b.json')`), []);
  assert.match(scanText('tests/x.test.js', `u('https://${host}/acme/private-bank/contents/b.json')`).join(), /URL to private bank repo/);
  const V = 'GEEK_PRIVATE_' + 'QUESTION_';
  for (const ok of [`${V}URL: 'https://bank.invalid/b.json'`, `${V}TOKEN: 'test-token'`, `${V}DIR: '/tmp/fake-bank'`, "GEEK_RANKED_QUESTION_SOURCE: 'fixture'", `${V}DIR: dir`]) assert.deepEqual(scanText('tests/x.test.js', `({ ${ok} })`), [], ok);
  for (const bad of [`${V}TOKEN: 'tok'`, `${V}URL: 'https://storage.example.com/b.json'`, `${V}DIR: '/srv/bank'`]) assert.match(scanText('tests/x.test.js', `({ ${bad} })`).join(), /assigned a/, bad);
});

test('vercel_blob_rw_ tokens and high-entropy GEEK_* values fail, even in tests', () => {
  const blob = ['vercel', 'blob', 'rw', 'AbC123dEf456GhI789jKl'].join('_');
  for (const path of ['server/x.js', 'tests/x.test.js', 'docs/x.md']) assert.match(scanText(path, `token = "${blob}"`).join(), /token literal/, path);
  const V = 'GEEK_PRIVATE_' + 'QUESTION_TOKEN';
  const secret = 'Zq8Lp3Vx9Rt2Wm7Kc4Nb6Hy1Jd5Fs0Ga';
  assert.ok(highEntropy(secret)); assert.ok(!highEntropy('aaaaaaaaaaaaaaaaaaaaaaaa'));
  assert.match(scanText('tests/x.test.js', `({ ${V}: '${secret}' })`).join(), /high-entropy literal/);
  assert.match(scanText('deploy/x.yaml', `${V}: ${secret}`).join(), /high-entropy literal/);
  assert.match(scanText('.env.example', `${V}=${secret}`).join(), /high-entropy literal/);
  assert.deepEqual(scanText('tests/x.test.js', `({ ${V}: 'test-${secret}' })`), [], 'fake-prefixed values pass in tests');
});

const REPO = new URL('..', import.meta.url).pathname;

test('the allowlist contents are pinned: any change needs a test edit', () => {
  assert.deepEqual(JSON.parse(readFileSync(join(REPO, OPAQUE_ALLOWLIST), 'utf8')).files.map(({ path, sha256 }) => ({ path, sha256 })), [
    { path: 'docs/continuity/founding/phone/trait_rarity_sheet_organized.pdf', sha256: '02cbd63e222f891998b946d07d79c68297fb77d81a16c717b538c89a71f111dc' },
  ]);
  const { violations, entries } = readAllowlist(REPO);
  assert.deepEqual(violations, []);
  for (const path of entries.keys()) assert.ok(existsSync(join(REPO, path)), `allowlisted path exists: ${path}`);
});

test('the allowlist cannot approve served paths, short reasons, bad hashes or extra keys', async () => {
  const root = mkdtempSync(join(tmpdir(), 'leak-allow-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(join(root, 'scripts')); mkdirSync(join(root, 'public')); mkdirSync(join(root, 'site'));
    writeFileSync(join(root, 'vercel.json'), JSON.stringify({ outputDirectory: 'site' }));
    const gz = gzipSync(JSON.stringify({ id: ['PRK', 'KAS', '202611', '0001'].join('-'), correctIndex: 2 }));
    const sha = createHash('sha256').update(gz).digest('hex');
    for (const p of ['public/bank.json.gz', 'site/bank.json.gz', 'docs.gz']) writeFileSync(join(root, p), gz);
    const write = (files, extra = {}) => writeFileSync(join(root, OPAQUE_ALLOWLIST), JSON.stringify({ files, ...extra }));
    write([{ path: 'public/bank.json.gz', sha256: sha, reason: 'reviewed and safe to ship' }, { path: 'site/bank.json.gz', sha256: sha, reason: 'reviewed and safe to ship' }, { path: 'docs.gz', sha256: sha, reason: '   short   ' }, { path: '../x.gz', sha256: sha, reason: 'reviewed and safe' }]);
    execFileSync('git', ['add', '-A'], { cwd: root });
    let v = (await scanRepo(root)).violations.join('\n');
    assert.match(v, /public\/bank\.json\.gz: served\/static path cannot be allowlisted/);
    assert.match(v, /site\/bank\.json\.gz: served\/static path cannot be allowlisted/, 'vercel.json outputDirectory is served');
    assert.match(v, /docs\.gz: reason must be at least 10 characters/);
    assert.match(v, /\.\.\/x\.gz: invalid path/);
    for (const p of ['public/bank.json.gz', 'site/bank.json.gz', 'docs.gz']) assert.match(v, new RegExp(`${p.replace(/\./g, '\\.')}: opaque`));
    write([{ path: 'docs.gz', sha256: 'abc', reason: 'reviewed archive of docs' }], { exampleIds: [] });
    v = (await scanRepo(root)).violations.join('\n');
    assert.match(v, /sha256 must be 64 hex/); assert.match(v, /unsupported keys exampleIds/);
    write([{ path: 'docs.gz', sha256: sha, reason: 'reviewed archive of docs' }]);
    v = (await scanRepo(root)).violations.join('\n');
    assert.doesNotMatch(v, /docs\.gz/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only the exact documented FAKE example id is skipped, never under public/', () => {
  assert.equal(FAKE_EXAMPLE_ID, 'PRK-FAKE-000000-0000');
  assert.deepEqual(scanText('docs/PRIVATE-BANK-REVIEW.md', `"id": "${FAKE_EXAMPLE_ID}"`), []);
  for (const near of [['prk', 'fake', '000000', '0000'], ['PRK', 'FAKE', '000000', '0000', '_'], ['PRK', 'FAKE', '000000', '0001'], ['PRK', 'FAKE', '202611', '0001'], ['PRK', 'KAS', '000000', '0000']].map((p) => p.slice(0, 4).join(p[4] || '-'))) assert.match(scanText('docs/x.md', near).join(), /outside the template/, near);
  assert.match(scanText('public/x.md', FAKE_EXAMPLE_ID).join(), /outside the template/);
  assert.match(scanText('docs/x.json', JSON.stringify({ id: FAKE_EXAMPLE_ID, ranked: true })).join(), /active private ranked id/);
});
