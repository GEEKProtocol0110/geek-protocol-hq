#!/usr/bin/env node
// Private ranked bank tooling. Runs against a checkout of the SEPARATE private
// bank repository. In this public repository it only ever runs against
// private-bank-template/, which holds obviously fake EXAMPLE rows.
//
//   node scripts/private-bank.mjs check    <dir> [--template]
//   node scripts/private-bank.mjs manifest <dir> [--write] [--commit <sha>]
//   node scripts/private-bank.mjs build    <dir> --out <file>
//
// <dir>/bank/<category>.json          active, selectable rows   { "questions": [...] }
// <dir>/bank/<category>-retired.json  lookup-only rows (grade saved runs, never selected)
// <dir>/manifest.json                 immutable version manifest (content hash [+ commit])
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { categoryFiles } from '../server/question-categories.js';

export const CATEGORIES = Object.keys(categoryFiles);
export const DIFFICULTIES = ['easy', 'medium', 'hard'];
const ID_PATTERN = /^PRK-[A-Z]{2,6}-\d{6}-\d{4}$/;
const SHA_PATTERN = /^[a-f0-9]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
export const EXAMPLE_PREFIX = 'EXAMPLE —';

const normalizePrompt = (text) => String(text).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim();

export const fileCategory = (name) => {
  const base = name.replace(/-retired\.json$/, '').replace(/\.json$/, '');
  return CATEGORIES.includes(base) ? base : null;
};

export const readBankDir = (dir) => {
  const bankDir = join(dir, 'bank');
  assert.ok(existsSync(bankDir), `Missing ${bankDir}`);
  const files = [];
  for (const name of readdirSync(bankDir).sort()) {
    if (!name.endsWith('.json')) continue;
    const category = fileCategory(name);
    assert.ok(category, `Unknown bank file name: ${name} (use <category>.json or <category>-retired.json)`);
    const text = readFileSync(join(bankDir, name), 'utf8');
    const parsed = JSON.parse(text);
    assert.ok(Array.isArray(parsed.questions), `${name}: expected { "questions": [...] }`);
    files.push({ name, category, retired: name.endsWith('-retired.json'), text, questions: parsed.questions });
  }
  return files;
};

// Schema for one row. Returns a list of error strings.
export const schemaErrors = (q, { category, retired, template }) => {
  const errors = [];
  const id = q?.id;
  const at = (msg) => errors.push(`${id || '(no id)'}: ${msg}`);
  if (!q || typeof q !== 'object') return ['row is not an object'];
  if (typeof id !== 'string' || !ID_PATTERN.test(id)) at('id must match PRK-<CAT>-<YYYYMM>-<NNNN>');
  if (q.category !== undefined && q.category !== category) at(`category must be ${category}`);
  if (typeof q.prompt !== 'string' || q.prompt.trim().length < 12) at('prompt must be a string of 12+ characters');
  if (!Array.isArray(q.options) || q.options.length !== 4 || q.options.some((o) => typeof o !== 'string' || !o.trim())) at('options must be 4 non-empty strings');
  else if (new Set(q.options.map((o) => o.trim().toLowerCase())).size !== 4) at('options must be distinct');
  if (!Number.isInteger(q.correctIndex) || q.correctIndex < 0 || q.correctIndex > 3) at('correctIndex must be an integer 0-3');
  if (!DIFFICULTIES.includes(q.difficulty)) at('difficulty must be easy|medium|hard');
  if (typeof q.source !== 'string' || !/^https:\/\//.test(q.source)) at('source must be an https URL');
  if (typeof q.funFact !== 'string' || q.funFact.trim().length < 8) at('funFact (explanation) required');
  if (!ISO_DATE.test(String(q.reviewedAt || ''))) at('reviewedAt must be YYYY-MM-DD');
  if (q.reviewStatus !== 'source-checked') at('reviewStatus must be source-checked for ranked rows');
  if (retired && (typeof q.retiredReason !== 'string' || !ISO_DATE.test(String(q.retiredAt || '')))) at('retired rows need retiredReason and retiredAt');
  if (!retired && (q.retiredReason || q.retiredAt)) at('active rows must not carry retiredReason/retiredAt (move them to <category>-retired.json)');
  if (template && (q.example !== true || !String(q.prompt).startsWith(EXAMPLE_PREFIX))) at(`template rows must have "example": true and a prompt starting "${EXAMPLE_PREFIX}"`);
  if (!template && q.example === true) at('example rows are not allowed in a real private bank');
  return errors;
};

// Duplicate checks across the whole bank (active + retired) and, optionally,
// against IDs/prompts that were ever public (passed in as publicRows).
export const duplicateErrors = (files, publicRows = []) => {
  const errors = [];
  const ids = new Map(), prompts = new Map(), concepts = new Map();
  for (const file of files) for (const q of file.questions) {
    if (ids.has(q.id)) errors.push(`${q.id}: duplicate id (${ids.get(q.id)} and ${file.name})`);
    ids.set(q.id, file.name);
    const prompt = normalizePrompt(q.prompt);
    if (!file.retired) {
      if (prompts.has(prompt)) errors.push(`${q.id}: duplicate prompt with ${prompts.get(prompt)}`);
      prompts.set(prompt, q.id);
      const concept = q.conceptId || q.id;
      if (concepts.has(concept)) errors.push(`${q.id}: duplicate conceptId ${concept} with ${concepts.get(concept)}`);
      concepts.set(concept, q.id);
    }
  }
  const publicIds = new Set(publicRows.map((q) => q.id));
  const publicPrompts = new Set(publicRows.map((q) => normalizePrompt(q.prompt)));
  for (const file of files) for (const q of file.questions) {
    if (publicIds.has(q.id)) errors.push(`${q.id}: id was published in the public repo`);
    if (!file.retired && publicPrompts.has(normalizePrompt(q.prompt))) errors.push(`${q.id}: prompt was published in the public repo (exposed)`);
  }
  return errors;
};

export const checkBank = (dir, { template = false, publicRows = [] } = {}) => {
  const files = readBankDir(dir);
  const errors = [];
  for (const file of files) for (const q of file.questions) errors.push(...schemaErrors(q, { category: file.category, retired: file.retired, template }).map((e) => `${file.name} ${e}`));
  errors.push(...duplicateErrors(files, publicRows));
  return { files, errors };
};

// Immutable version: SHA-256 over sorted file names + bytes. A commit SHA can be
// recorded alongside; the server pins GEEK_PRIVATE_QUESTION_REF to that commit.
export const contentHash = (files) => {
  const hash = createHash('sha256');
  for (const file of [...files].sort((a, b) => a.name.localeCompare(b.name))) hash.update(file.name).update('\0').update(file.text).update('\0');
  return hash.digest('hex');
};

export const buildManifest = (files, commit = '') => {
  if (commit) assert.ok(SHA_PATTERN.test(commit), 'commit must be a 40-hex SHA');
  const counts = {};
  for (const file of files) {
    const entry = (counts[file.category] ||= { active: { easy: 0, medium: 0, hard: 0 }, retired: 0 });
    if (file.retired) entry.retired += file.questions.length;
    else for (const q of file.questions) entry.active[q.difficulty] += 1;
  }
  return {
    schema: 1,
    version: `sha256:${contentHash(files)}`,
    ...(commit ? { commit } : {}),
    files: files.map((f) => ({ name: `bank/${f.name}`, sha256: createHash('sha256').update(f.text).digest('hex'), rows: f.questions.length, lookupOnly: f.retired })),
    counts
  };
};

export const verifyManifest = (files, manifest) => {
  const expected = buildManifest(files, manifest.commit || '');
  assert.deepEqual(manifest, expected, 'manifest.json does not match bank contents: a published version is immutable; regenerate with a NEW version instead of editing rows in place');
};

// Document consumed by server/question-source.js (GEEK_PRIVATE_QUESTION_URL).
export const buildDocument = (files, manifest) => {
  const banks = {}, retired = {};
  for (const file of files) (file.retired ? retired : banks)[file.category] = [...((file.retired ? retired : banks)[file.category] || []), ...file.questions];
  return { schema: 1, version: manifest.version, ...(manifest.commit ? { commit: manifest.commit } : {}), banks, retired };
};

const main = async () => {
  const [command, dirArg, ...rest] = process.argv.slice(2);
  assert.ok(['check', 'manifest', 'build'].includes(command) && dirArg, 'Usage: private-bank.mjs check|manifest|build <dir> [--template] [--write] [--commit <sha>] [--out <file>]');
  const dir = resolve(dirArg);
  const template = rest.includes('--template') || existsSync(join(dir, 'TEMPLATE'));
  let publicRows = [];
  if (!template) {
    const { loadQuestionBank } = await import('../server/questions.js');
    publicRows = CATEGORIES.flatMap((c) => [...loadQuestionBank(c).byId.values()]);
  }
  const { files, errors } = checkBank(dir, { template, publicRows });
  if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
  const manifestPath = join(dir, 'manifest.json');
  if (command === 'check') {
    verifyManifest(files, JSON.parse(readFileSync(manifestPath, 'utf8')));
    console.log(`Private bank OK (${template ? 'template, fake rows only' : 'real'}): ${files.reduce((n, f) => n + f.questions.length, 0)} rows, manifest current.`);
  } else if (command === 'manifest') {
    const commitIndex = rest.indexOf('--commit');
    const manifest = buildManifest(files, commitIndex >= 0 ? rest[commitIndex + 1] : '');
    const text = JSON.stringify(manifest, null, 2) + '\n';
    if (rest.includes('--write')) writeFileSync(manifestPath, text); else process.stdout.write(text);
  } else {
    const outIndex = rest.indexOf('--out');
    assert.ok(outIndex >= 0 && rest[outIndex + 1], 'build needs --out <file>');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    verifyManifest(files, manifest);
    writeFileSync(resolve(rest[outIndex + 1]), JSON.stringify(buildDocument(files, manifest)) + '\n');
  }
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch((error) => { console.error(error.message); process.exit(1); });
