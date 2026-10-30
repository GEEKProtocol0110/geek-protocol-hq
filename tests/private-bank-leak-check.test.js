import assert from 'node:assert/strict';
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
  assert.deepEqual(scanText('docs/kaspa-retired.json', JSON.stringify([{ id: 'PRK-KAS-202611-0001', retiredAt: '2026-11-15', answerKeyHash: h }])), []);
  assert.deepEqual(scanText('docs/manifest.json', JSON.stringify({ version: `sha256:${h}`, bankVersion: `sha256:${h}` })), []);
  assert.deepEqual(scanText('docs/x.json', JSON.stringify({ files: [{ name: 'a', sha256: h }] })), [], 'file hashes are not per-question answer hashes');
});

test('with a private index, verbatim ids, prompts and answer-derived hashes are caught anywhere scanned', () => {
  const dir = mkdtempSync(join(tmpdir(), 'leak-'));
  try {
    writeFileSync(join(dir, 'kaspa.json'), JSON.stringify({ questions: [TEMPLATE_ROW] }));
    writeFileSync(join(dir, 'kaspa-retired.json'), JSON.stringify({ questions: [{ ...retired, id: 'PRK-KAS-202611-0099', prompt: 'EXAMPLE — retired prompt that may be public' }] }));
    const privateIndex = loadPrivateIndex(dir);
    for (const leak of [TEMPLATE_ROW.prompt, ...answerHashes(TEMPLATE_ROW)]) assert.match(scanText('public/data/x.txt', `x ${leak} y`, { privateIndex }).join(), /contains/);
    assert.deepEqual(scanText('public/data/x.txt', 'EXAMPLE — retired prompt that may be public PRK-KAS-202611-0099'.replace(/PRK.*/, ''), { privateIndex }), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('scope: JSON files and served assets, never the fake template', () => {
  assert.equal(isScanned('server/questions/kaspa-questions.json'), true);
  assert.equal(isScanned('public/play/assets/game.js'), true);
  assert.equal(isScanned('private-bank-template/bank/kaspa.json'), false);
  assert.equal(isScanned('tests/api.test.js'), false);
});
