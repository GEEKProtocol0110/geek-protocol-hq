import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
test('unreadable public bank fails closed as RANKED_BANK_UNAVAILABLE', async () => {
  const cwd = process.cwd();
  const { loadQuestionBank, categoryFiles } = await import('../server/questions.js');
  const category = Object.keys(categoryFiles)[0];
  process.chdir(mkdtempSync(join(tmpdir(), 'nobank-')));
  try { assert.throws(() => loadQuestionBank(category), { message: 'RANKED_BANK_UNAVAILABLE' }); }
  finally { process.chdir(cwd); }
  assert.ok(loadQuestionBank(category).questions.length > 0);
});
