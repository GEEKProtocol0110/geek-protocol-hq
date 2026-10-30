#!/usr/bin/env node
// Fails if the PUBLIC repository carries live/future ranked questions.
// Allowed in public: retired rows (in *-retired.json files, each with retiredAt)
// and whole-bank version hashes ("sha256:<64 hex>" in version/bankVersion fields).
// Not allowed: active private IDs (PRK-*), or per-question answer-derived hashes
// for anything except retired or already-public (exposed) bank rows.
//
//   node scripts/private-bank-leak-check.mjs [--private <private-repo>/bank] [--root <repo>]
// Also fails on: tracked files under private/, GitHub token literals, Bearer
// literals, URLs to a private bank repo, loader env vars (GEEK_PRIVATE_QUESTION_*,
// GEEK_RANKED_*) assigned literal values, and answer fields on private/ranked rows.
// With --private, every active private ID, prompt and answer-derived hash is
// also searched for verbatim across tracked public files.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const TEMPLATE_DIR = 'private-bank-template/';
const ANSWER_FIELDS = ['correctIndex', 'answer', 'correct', 'correctAnswer', 'answerIndex'];
export const isRankedFlagged = (node) => node.ranked === true || node.rankedOnly === true || node.pool === 'ranked' || node.bank === 'private';

// Env var names the loader reads (server/question-source.js). Assigning any of
// them a literal value in a tracked file leaks config (host, token, ref, mode).
const LOADER_VARS = /\b(GEEK_PRIVATE_QUESTION_(?:URL|TOKEN|DIR|REF)|GEEK_RANKED_[A-Z0-9_]+)\b/;
const PLACEHOLDER = /^(?:|<[^>]*>|\$\{?[A-Z0-9_]+\}?|changeme|replace-me|your[-_].*|x+|\.\.\.)$/i;
const ASSIGNMENT = new RegExp(String.raw`["']?${LOADER_VARS.source}["']?\s*(?::(?!:)|(?<![=!<>])=(?!=))\s*(?!process\.env|env\.)(["'\x60]?)([^\s"'\x60,;})#]*)\2`, 'g');
const TOKEN_LITERALS = [/\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}/];
const BEARER = /\bBearer\s+(?!\$\{)([A-Za-z0-9._~+/-]{16,}=*)/;
const PRIVATE_REPO_URL = /\b(?:api\.github\.com\/repos|raw\.githubusercontent\.com)\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]*(?:private|ranked|bank|answer)[A-Za-z0-9_.-]*)/i;
// Test fixtures legitimately assign env vars and synthetic bearer values.
const isTestFixture = (path) => path.startsWith('tests/');

export const secretViolations = (path, text) => {
  const out = [];
  if (/^private\//i.test(path)) out.push(`${path}: tracked file under private/`);
  for (const re of TOKEN_LITERALS) if (re.test(text)) out.push(`${path}: GitHub token literal (${re.source.slice(2, 12)}…)`);
  if (isTestFixture(path)) return out;
  if (BEARER.test(text)) out.push(`${path}: Bearer token literal`);
  const repo = text.match(PRIVATE_REPO_URL);
  if (repo && !repo[1].startsWith('<') && !repo[2].startsWith('<')) out.push(`${path}: URL to private bank repo ${repo[1]}/${repo[2]}`);
  const envExample = /(^|\/)\.env\.example$/.test(path);
  for (const m of text.matchAll(ASSIGNMENT)) {
    const value = m[3];
    if (PLACEHOLDER.test(value) || (envExample && !/^https?:|^[a-f0-9]{40}$|^(true|private|exposed|fixture)$/i.test(value))) continue;
    out.push(`${path}: ${m[1]} assigned a literal value`);
  }
  return out;
};

export const answerHashes = (q) => {
  const h = (v) => createHash('sha256').update(v).digest('hex');
  const answer = q.options?.[q.correctIndex];
  return [h(JSON.stringify([q.prompt, q.options, q.correctIndex])), h(String(answer)), h(`${q.id}:${answer}`), h(`${q.id}:${q.correctIndex}`)];
};

const listFiles = (root) => {
  try {
    return execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  } catch {
    const out = [];
    const walk = (d) => { for (const e of readdirSync(join(root, d), { withFileTypes: true })) {
      if (['.git', 'node_modules'].includes(e.name)) continue;
      const p = d ? `${d}/${e.name}` : e.name;
      if (e.isDirectory()) walk(p); else out.push(p);
    } };
    walk('');
    return out;
  }
};

// Every tracked text file except the fake template is scanned (JSON structure + text).
export const isTextScanned = (path) => !path.startsWith(TEMPLATE_DIR) && !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp[34]|wasm|zip|gz|br|pdf)$/i.test(path);

const walkJson = (node, visit) => {
  if (Array.isArray(node)) { for (const v of node) walkJson(v, visit); return; }
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const v of Object.values(node)) walkJson(v, visit);
};

// Format-insensitive private ID: any case, with '-', '_', '.', ' ' or no separators.
export const PRIVATE_ID_LOOSE = /(?<![a-z0-9])prk[-_ .]?[a-z]{2,6}[-_ .]?\d{6}[-_ .]?\d{4}(?![0-9])/gi;
const canonicalId = (value) => String(value).toUpperCase().replace(/[^A-Z0-9]/g, '');
const isPrivateId = (value) => typeof value === 'string' && new RegExp(`^${PRIVATE_ID_LOOSE.source}$`, 'i').test(value.trim());
const rowId = (node) => [node.id, node.questionId, node.qid, node.question_id].find((v) => typeof v === 'string');
// Hash-like keys and values that could be per-question answer fingerprints.
const HASH_KEY = /hash$|hash[_-]|checksum|digest|fingerprint|^sha(?:1|256|384|512)?$|^md5$|signature$/i;
const HASH_VALUE = /^(?:(?:sha(?:1|256|384|512)|md5|blake2b?):)?(?:[a-f0-9]{8,}|[A-Za-z0-9+/_-]{16,}={0,2})$/i;
const looksLikeQuestion = (node) => ['prompt', 'options', 'question', 'correctIndex', 'answer', 'category'].some((k) => Object.hasOwn(node, k)) || Object.hasOwn(node, 'questionId');
const BANK_VERSION_KEYS = new Set(['version', 'bankVersion']);
export const validRetiredAt = (value, now = new Date()) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T[\d:.]+Z)?$/.test(value)) return false;
  const t = Date.parse(value);
  return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value.slice(0, 10) && t <= now.getTime();
};

export const scanText = (path, text, { publicIds = new Set(), privateIndex = null, now = new Date() } = {}) => {
  const violations = [];
  const retiredFile = /-retired\.json$/i.test(path);
  const allowedRetiredIds = new Set();
  let json = null;
  if (/\.json$/i.test(path)) { try { json = JSON.parse(text); } catch { /* text checks below still run */ } }
  if (json) {
    walkJson(json, (node) => {
      const id = rowId(node);
      const ranked = isRankedFlagged(node);
      const isPrivate = isPrivateId(id) || ranked;
      const retiredRow = retiredFile && Object.hasOwn(node, 'retiredAt') && validRetiredAt(node.retiredAt, now);
      if (retiredFile && Object.hasOwn(node, 'retiredAt') && !retiredRow) violations.push(`${path}: retiredAt ${JSON.stringify(node.retiredAt)} on ${id ?? '(no id)'} is not a valid past ISO date`);
      if (retiredRow && isPrivateId(id)) { allowedRetiredIds.add(canonicalId(id)); return; }
      if (retiredRow) return;
      if (isPrivate && id !== undefined) violations.push(`${path}: active private ranked id ${id}`);
      // Answer fields on private / ranked-flagged rows (public practice rows keep correctIndex).
      if (isPrivate) for (const key of ANSWER_FIELDS) if (Object.hasOwn(node, key)) violations.push(`${path}: answer field "${key}" on private/ranked question ${id ?? '(no id)'}`);
      if (id === undefined && !isPrivate) return; // file/manifest-level hashes are not per-question
      for (const [key, value] of Object.entries(node)) {
        if (typeof value !== 'string' || !HASH_KEY.test(key) || !HASH_VALUE.test(value)) continue;
        if (BANK_VERSION_KEYS.has(key)) continue; // one whole-bank version hash
        if (isPrivate) violations.push(`${path}: per-question hash "${key}" for private/ranked id ${id ?? '(no id)'}`);
        else if (looksLikeQuestion(node) && !publicIds.has(id)) violations.push(`${path}: per-question hash "${key}" for unknown id ${id}`);
      }
    });
  }
  // Text search always runs (notes fields, strings, non-JSON files, invalid JSON).
  for (const m of text.matchAll(PRIVATE_ID_LOOSE)) if (!allowedRetiredIds.has(canonicalId(m[0]))) violations.push(`${path}: private ranked id ${m[0]} outside the template`);
  violations.push(...secretViolations(path, text));
  if (privateIndex) {
    const lower = text.toLowerCase();
    for (const [needle, label] of privateIndex) if (lower.includes(needle)) violations.push(`${path}: contains ${label}`);
  }
  return [...new Set(violations)];
};

export const loadPrivateIndex = (dir) => {
  const index = new Map();
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json') || name.endsWith('-retired.json')) continue;
    for (const q of JSON.parse(readFileSync(join(dir, name), 'utf8')).questions || []) {
      index.set(q.id.toLowerCase(), `active private id ${q.id}`);
      if (q.prompt?.length >= 24) index.set(q.prompt.toLowerCase(), `prompt of active private question ${q.id}`);
      for (const h of answerHashes(q)) index.set(h, `answer-derived hash of active private question ${q.id}`);
    }
  }
  return index;
};

export const scanRepo = async (root, { privateDir } = {}) => {
  const { categoryFiles } = await import('../server/question-categories.js');
  const { loadQuestionBank } = await import('../server/questions.js');
  const publicIds = new Set(Object.keys(categoryFiles).flatMap((c) => [...loadQuestionBank(c).byId.keys()]));
  const privateIndex = privateDir ? loadPrivateIndex(resolve(privateDir)) : null;
  const violations = [];
  let files = 0;
  for (const path of listFiles(root)) {
    if (!isTextScanned(path)) continue;
    const abs = join(root, path);
    let st; try { st = statSync(abs); } catch { continue; }
    if (!st.isFile() || st.size > 32 * 1024 * 1024) continue;
    files += 1;
    const text = readFileSync(abs, 'utf8');
    violations.push(...scanText(path, text, { publicIds, privateIndex }));
  }
  return { files, violations };
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const usage = 'Usage: node scripts/private-bank-leak-check.mjs [--private <private-repo>/bank] [--root <repo>]';
  const i = process.argv.indexOf('--private');
  const r0 = process.argv.indexOf('--root');
  for (const flag of [i, r0]) if (flag > 0 && (!process.argv[flag + 1] || process.argv[flag + 1].startsWith('--'))) { console.error(usage); process.exit(2); }
  if (i > 0 && !existsSync(process.argv[i + 1])) { console.error(`--private directory not found: ${process.argv[i + 1]}\n${usage}`); process.exit(2); }
  const r = process.argv.indexOf('--root');
  const root = r > 0 ? resolve(process.argv[r + 1]) : resolve(new URL('..', import.meta.url).pathname);
  const { files, violations } = await scanRepo(root, { privateDir: i > 0 ? process.argv[i + 1] : undefined });
  if (violations.length) { console.error(violations.join('\n')); process.exitCode = 1; }
  else console.log(`Private bank leak check passed (${files} tracked files; ${i > 0 ? 'with private index' : 'pattern mode'}).`);
}
