import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildDocument, buildManifest, checkBank, readBankDir, verifyManifest, EXAMPLE_PREFIX } from '../scripts/private-bank.mjs';
import { loadQuestionBank } from '../server/questions.js';

const TEMPLATE = new URL('../private-bank-template/', import.meta.url).pathname;
const copy = () => { const dir = mkdtempSync(join(tmpdir(), 'pbank-')); cpSync(TEMPLATE, dir, { recursive: true }); return dir; };
const edit = (dir, name, fn) => { const p = join(dir, 'bank', name); const doc = JSON.parse(readFileSync(p, 'utf8')); fn(doc.questions); writeFileSync(p, JSON.stringify(doc, null, 2)); };

test('template passes schema, duplicate and manifest checks and contains only fake rows', () => {
  const { files, errors } = checkBank(TEMPLATE, { template: true });
  assert.deepEqual(errors, []);
  verifyManifest(files, JSON.parse(readFileSync(join(TEMPLATE, 'manifest.json'), 'utf8')));
  for (const f of files) for (const q of f.questions) { assert.equal(q.example, true); assert.ok(q.prompt.startsWith(EXAMPLE_PREFIX)); }
  assert.ok(files.some((f) => f.retired));
});

test('template rows do not collide with public bank ids or prompts', () => {
  const pub = ['kaspa', 'history'].flatMap((c) => [...loadQuestionBank(c).byId.values()]);
  assert.deepEqual(checkBank(TEMPLATE, { template: true, publicRows: pub }).errors, []);
});

test('schema check rejects malformed rows and real rows in template / example rows in real banks', () => {
  const dir = copy();
  try {
    edit(dir, 'kaspa.json', (qs) => { qs[0].correctIndex = 4; qs[1].options[2] = qs[1].options[0]; qs[2].id = 'bad'; delete qs[3].example; qs[4].retiredAt = '2026-11-02'; });
    edit(dir, 'kaspa-retired.json', (qs) => { delete qs[0].retiredReason; });
    const msgs = checkBank(dir, { template: true }).errors.join('\n');
    for (const needle of ['correctIndex', 'options must be distinct', 'id must match', 'template rows must have', 'active rows must not carry', 'retired rows need']) assert.match(msgs, new RegExp(needle));
    assert.match(checkBank(TEMPLATE).errors.join('\n'), /example rows are not allowed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('duplicate check catches ids (incl. retired), prompts, conceptIds and exposed public prompts', () => {
  const dir = copy();
  try {
    edit(dir, 'kaspa.json', (qs) => { qs[1].prompt = qs[0].prompt.toUpperCase(); qs[2].conceptId = 'c'; qs[3].conceptId = 'c'; });
    edit(dir, 'history-retired.json', (qs) => { qs[0].id = ['PRK', 'HIS', '202611', '0001'].join('-'); });
    const pubRow = [...loadQuestionBank('kaspa').byId.values()][0];
    edit(dir, 'kaspa.json', (qs) => { qs[5].prompt = pubRow.prompt; });
    const msgs = checkBank(dir, { template: true, publicRows: [pubRow] }).errors.join('\n');
    assert.match(msgs, /duplicate prompt/); assert.match(msgs, /duplicate conceptId/); assert.match(msgs, new RegExp(`${['PRK', 'HIS', '202611', '0001'].join('-')}: duplicate id`)); assert.match(msgs, /published in the public repo/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('manifest is content-addressed, records an optional commit SHA, and detects in-place edits', () => {
  const dir = copy();
  try {
    const files = readBankDir(dir);
    const manifest = buildManifest(files);
    assert.match(manifest.version, /^sha256:[a-f0-9]{64}$/);
    assert.deepEqual(buildManifest(readBankDir(dir)), manifest, 'deterministic');
    assert.equal(buildManifest(files, 'a'.repeat(40)).commit, 'a'.repeat(40));
    assert.throws(() => buildManifest(files, 'main'), /40-hex/);
    edit(dir, 'kaspa.json', (qs) => { qs[0].options[0] = 'Example distractor Z'; });
    assert.throws(() => verifyManifest(readBankDir(dir), manifest), /immutable/);
    assert.notEqual(buildManifest(readBankDir(dir)).version, manifest.version);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('built document keeps retired rows lookup-only and matches the server bank shape', () => {
  const files = readBankDir(TEMPLATE);
  const doc = buildDocument(files, buildManifest(files));
  assert.deepEqual(Object.keys(doc.banks).sort(), ['history', 'kaspa']);
  assert.equal(doc.retired.kaspa.length, 1);
  assert.ok(!doc.banks.kaspa.some((q) => q.retiredAt));
  assert.ok(doc.retired.kaspa.every((q) => !doc.banks.kaspa.some((a) => a.id === q.id)));
});

test('no real private-bank rows are committed outside the template', () => {
  const offenders = [];
  const walk = (d) => { for (const e of readdirSync(d, { withFileTypes: true })) {
    if (['node_modules', '.git', 'private-bank-template'].includes(e.name)) continue;
    const p = join(d, e.name);
    if (e.isDirectory()) walk(p); else if (e.name.endsWith('.json') && /"id"\s*:\s*"PRK-[A-Z]+-\d{6}-\d{4}"/.test(readFileSync(p, 'utf8'))) offenders.push(p);
  } };
  walk(new URL('..', import.meta.url).pathname);
  assert.deepEqual(offenders, []);
});
