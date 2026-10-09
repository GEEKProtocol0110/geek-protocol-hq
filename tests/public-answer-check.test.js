import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { brotliCompressSync, gzipSync } from 'node:zlib';
import { configuredPublicOutput, scanPublicAnswers } from '../scripts/public-answer-check.mjs';

const privateQuestion = { id: 'PRIVATE-N-123456abcdef', prompt: 'Which synthetic answer belongs to this private question?', options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correctIndex: 1 };
const retiredQuestion = { ...privateQuestion, id: 'OLD-0001', prompt: 'Which synthetic answer belongs to this retired question?' };
const fixture = async operation => {
  const root = await mkdtemp(join(tmpdir(), 'geek-public-answers-'));
  const outputDirectory = join(root, 'output'), questionDirectory = join(root, 'private');
  await mkdir(outputDirectory); await mkdir(questionDirectory);
  await writeFile(join(questionDirectory, 'synthetic-questions.json'), JSON.stringify({ questions: [privateQuestion] }));
  await writeFile(join(questionDirectory, 'synthetic-retired.json'), JSON.stringify({ questions: [retiredQuestion] }));
  try { return await operation({ root, outputDirectory, questionDirectory,
    write: (name, text) => writeFile(join(outputDirectory, name), text),
    scan: () => scanPublicAnswers({ outputDirectory, questionDirectory }) }); }
  finally { await rm(root, { recursive: true, force: true }); }
};

test('the actual configured public artifact contains no known private answer-bank records', async () => {
  const result = await scanPublicAnswers({ outputDirectory: await configuredPublicOutput(), questionDirectory: resolve('server/questions') });
  assert.ok(result.assets > 0); assert.ok(result.privateQuestions >= 7786); assert.deepEqual(result.violations, []);
});

test('renaming, minifying and escaping a known private bank cannot make it pass the public check', async t => {
  const stripped = { ...privateQuestion }; delete stripped.id;
  const json = JSON.stringify({ questions: [privateQuestion] });
  const cases = [
    ['renamed.data', json, 'PRIVATE_QUESTION_ID'],
    ['minified.js', `window.pack=${json};`, 'PRIVATE_GRADED_RECORD'],
    ['stripped.js', `window.pack=[${JSON.stringify(stripped)}];`, 'PRIVATE_GRADED_RECORD'],
    ['unquoted.js', `window.pack=[{prompt:'${stripped.prompt}',options:['Alpha','Beta','Gamma','Delta'],correctIndex:1}];`, 'PRIVATE_GRADED_RECORD'],
    ['escaped.js', JSON.stringify(privateQuestion).replace('PRIVATE', '\\u0050RIVATE'), 'PRIVATE_QUESTION_ID'],
    ['source.map', JSON.stringify({ version: 3, sources: ['private.js'], sourcesContent: [`const pack=${JSON.stringify(stripped)};`] }), 'PRIVATE_GRADED_RECORD'],
    ['wrapped.js', `JSON.parse(${JSON.stringify(JSON.stringify(stripped))});`, 'PRIVATE_GRADED_RECORD'],
    ['old.data', JSON.stringify(retiredQuestion), 'PRIVATE_QUESTION_ID'],
    ['synthetic-retired.json', '{}', 'PRIVATE_BANK_FILENAME'],
    ['path.js', 'import bank from "./server/questions/hidden.json";', 'PRIVATE_BANK_PATH']
  ];
  for (const [name, text, code] of cases) await t.test(name, () => fixture(async f => {
    await f.write(name, text); const result = await f.scan();
    assert.ok(result.violations.some(issue => issue.code === code), JSON.stringify(result));
    assert.ok(result.violations.every(issue => !('answer' in issue) && !('prompt' in issue)));
  }));
});

test('gzip, Brotli and gzip bytes under another extension are inspected after decompression', async t => {
  const json = Buffer.from(JSON.stringify(privateQuestion));
  for (const [name, bytes] of [['bundle.js.gz', gzipSync(json)], ['bundle.js.br', brotliCompressSync(json)], ['renamed.bin', gzipSync(json)]]) {
    await t.test(name, () => fixture(async f => {
      await f.write(name, bytes);
      assert.ok((await f.scan()).violations.some(issue => issue.code === 'PRIVATE_QUESTION_ID'));
    }));
  }
  await t.test('broken compressed asset', () => fixture(async f => {
    await f.write('broken.js.gz', 'not a gzip stream');
    assert.ok((await f.scan()).violations.some(issue => issue.code === 'PUBLIC_ASSET_UNREADABLE'));
  }));
});

test('public teaching checks, answer options and answer words without a graded private bank remain allowed', () => fixture(async f => {
  await f.write('quest.js', `const story={id:'public-teaching',prompt:'${privateQuestion.prompt}',choices:['Alpha','Beta','Gamma','Delta'],correctIndex:1};`);
  await f.write('question.json', JSON.stringify({ prompt: privateQuestion.prompt, options: privateQuestion.options }));
  await f.write('lesson.html', '<p>Beta is the answer in this synthetic example.</p>');
  assert.deepEqual((await f.scan()).violations, []);
}));

test('symlinked, empty or missing output cannot be reported as a passing artifact', () => fixture(async f => {
  await assert.rejects(f.scan, /PUBLIC_OUTPUT_EMPTY/);
  await assert.rejects(scanPublicAnswers({ outputDirectory: join(f.root, 'missing'), questionDirectory: f.questionDirectory }));
  await symlink(join(f.questionDirectory, 'synthetic-questions.json'), join(f.outputDirectory, 'alias.json'));
  await f.write('index.html', '<p>Teaching.</p>');
  assert.ok((await f.scan()).violations.some(issue => issue.code === 'PUBLIC_SYMLINK'));
  await symlink(f.outputDirectory, join(f.root, 'alias-output'));
  await assert.rejects(scanPublicAnswers({ outputDirectory: join(f.root, 'alias-output'), questionDirectory: f.questionDirectory }), /PUBLIC_OUTPUT_INVALID/);
}));

test('the scan follows configured output and rejects an output path outside the project', () => fixture(async f => {
  await writeFile(join(f.root, 'vercel.json'), JSON.stringify({ outputDirectory: 'output' }));
  assert.equal(await configuredPublicOutput(f.root), f.outputDirectory);
  await writeFile(join(f.root, 'vercel.json'), JSON.stringify({ outputDirectory: '../other-output' }));
  await assert.rejects(configuredPublicOutput(f.root), /PUBLIC_OUTPUT_INVALID/);
}));
