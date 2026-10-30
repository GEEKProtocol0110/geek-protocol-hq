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
import { categoryFiles } from '../server/question-categories.js';

const TEMPLATE_DIR = 'private-bank-template/';
const ANSWER_FIELDS = ['correctIndex', 'answer', 'correct', 'correctAnswer', 'answerIndex'];
export const CATEGORY_NAMES = Object.keys(categoryFiles);
export const isRankedFlagged = (node) => node.ranked === true || node.rankedOnly === true || node.pool === 'ranked' || node.bank === 'private';

// Env var names the loader reads (server/question-source.js). Assigning any of
// them a literal value in a tracked file leaks config (host, token, ref, mode).
const LOADER_VARS = /\b(GEEK_PRIVATE_QUESTION_(?:URL|TOKEN|DIR|REF)|GEEK_RANKED_[A-Z0-9_]+)\b/;
const PLACEHOLDER = /^(?:|<[^>]*>|\$\{?[A-Z0-9_]+\}?|changeme|replace-me|your[-_].*|x+|\.\.\.)$/i;
const ASSIGNMENT = new RegExp(String.raw`["']?${LOADER_VARS.source}["']?\s*(?::(?!:)|(?<![=!<>])=(?!=))[ \t]*(?!process\.env|env\.)(["'\x60]?)([^\s"'\x60,;})#]*)\2`, 'g');
const TOKEN_LITERALS = [/\bgithub_pat_[A-Za-z0-9_]{20,}/, /\bgh[pousr]_[A-Za-z0-9]{30,}/, /\bvercel_blob_rw_[A-Za-z0-9_]{16,}/];
const BEARER = /\bBearer\s+(?!\$\{)([A-Za-z0-9._~+/-]{16,}=*)/g;
const PRIVATE_REPO_URL = /\b(?:api\.github\.com\/repos|raw\.githubusercontent\.com)\/([A-Za-z0-9_.<>-]+)\/([A-Za-z0-9_.<>-]*(?:private|ranked|bank|answer)[A-Za-z0-9_.<>-]*)/gi;
const isTestFixture = (path) => path.startsWith('tests/');
// In tests/ only obviously fake values pass: test-/fake- prefixes or .invalid hosts.
export const obviouslyFake = (value) => /(?:^|[/.:@])(?:test|fake)[-_]/i.test(value) || /^(?:https?:\/\/)?[^/\s]*\.invalid(?:[:/]|$)/i.test(value);
// Non-secret mode values the loader accepts (GEEK_RANKED_QUESTION_SOURCE, GEEK_RANKED_ALLOW_EXPOSED).
const ENUM_VALUE = /^(?:true|false|0|1|private|fixture|exposed|unavailable|other)$/i;
export const shannon = (value) => { const counts = {}; for (const c of value) counts[c] = (counts[c] || 0) + 1; return Object.values(counts).reduce((h, n) => h - (n / value.length) * Math.log2(n / value.length), 0); };
export const highEntropy = (value) => value.length >= 20 && shannon(value) >= 3.5;

export const secretViolations = (path, text) => {
  const out = [];
  const test = isTestFixture(path);
  if (/^private\//i.test(path)) out.push(`${path}: tracked file under private/`);
  for (const re of TOKEN_LITERALS) if (re.test(text)) out.push(`${path}: token literal (${re.source.slice(2, 14)}…)`);
  for (const m of text.matchAll(BEARER)) if (!(test && obviouslyFake(m[1]))) { out.push(`${path}: Bearer token literal`); break; }
  for (const m of text.matchAll(PRIVATE_REPO_URL)) {
    if (m[1].includes('<') || m[2].includes('<')) continue; // documented placeholder
    if (test && obviouslyFake(m[1]) && obviouslyFake(m[2])) continue;
    out.push(`${path}: URL to private bank repo ${m[1]}/${m[2]}`);
  }
  const envExample = /(^|\/)\.env\.example$/.test(path);
  for (const m of text.matchAll(ASSIGNMENT)) {
    const value = m[3];
    if (PLACEHOLDER.test(value)) continue;
    if (!m[2] && /\.(?:c|m)?[jt]sx?$/i.test(path)) continue; // unquoted in JS/TS = an identifier, not a literal
    if (highEntropy(value) && !(test && obviouslyFake(value))) { out.push(`${path}: ${m[1]} assigned a high-entropy literal (possible secret)`); continue; }
    if (test ? ENUM_VALUE.test(value) || obviouslyFake(value) : envExample && !/^https?:|^[a-f0-9]{40}$|^(true|private|exposed|fixture)$/i.test(value)) continue;
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
export const isTextScanned = (path) => !path.startsWith(TEMPLATE_DIR) && !/\.(?:png|jpe?g|gif|webp|ico|woff2?|ttf|otf|mp[34]|wasm)$/i.test(path);
// Opaque containers cannot be scanned reliably, so committing one is itself a violation.
export const OPAQUE = /\.(?:gz|tgz|zip|br|pdf|7z|rar|tar|xz|bz2)$/i;
// Reviewed opaque files: { "files": [{ "path", "sha256", "reason" }] }. The hash pins the exact bytes.
export const OPAQUE_ALLOWLIST = 'scripts/private-bank-leak-allowlist.json';
// The single documented example ID. Exact string only: no case, separator or digit variants.
export const FAKE_EXAMPLE_ID = 'PRK-FAKE-000000-0000';
export const MIN_REASON = 10;
// Served/bundled locations: Vercel's outputDirectory (from vercel.json), public/, and api/ (functions).
export const servedDirs = (root) => {
  const dirs = new Set(['public', 'api']);
  try { const out = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')).outputDirectory; if (typeof out === 'string' && out.trim()) dirs.add(out.trim().replace(/^\.?\/+|\/+$/g, '')); } catch {}
  return [...dirs].filter(Boolean);
};
export const isServedPath = (root, path) => servedDirs(root).some((d) => path === d || path.startsWith(`${d}/`));
// Validates every entry; an invalid entry is a violation and is never honoured.
export function readAllowlist(root) {
  const entries = new Map(); const violations = [];
  let json; try { json = JSON.parse(readFileSync(join(root, OPAQUE_ALLOWLIST), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return { entries, violations }; return { entries, violations: [`${OPAQUE_ALLOWLIST}: invalid JSON`] }; }
  const extra = Object.keys(json || {}).filter((k) => k !== 'files');
  if (extra.length) violations.push(`${OPAQUE_ALLOWLIST}: unsupported keys ${extra.join(', ')}`);
  for (const e of Array.isArray(json?.files) ? json.files : []) {
    const path = typeof e?.path === 'string' ? e.path : '';
    const bad = !path || path.startsWith('/') || path.split('/').includes('..') ? 'invalid path'
      : isServedPath(root, path) ? 'served/static path cannot be allowlisted'
      : !/^[0-9a-f]{64}$/.test(e?.sha256 || '') ? 'sha256 must be 64 hex chars'
      : typeof e?.reason !== 'string' || e.reason.trim().length < MIN_REASON ? `reason must be at least ${MIN_REASON} characters`
      : null;
    if (bad) violations.push(`${OPAQUE_ALLOWLIST}: ${path || '(no path)'}: ${bad}`); else entries.set(path, e);
  }
  return { entries, violations };
}
const reviewedOpaque = (root, path, entries) => {
  const entry = entries.get(path);
  return Boolean(entry && !isServedPath(root, path) && createHash('sha256').update(readFileSync(join(root, path))).digest('hex') === entry.sha256);
};
export const MAX_SCAN_BYTES = 32 * 1024 * 1024;

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
  // Retired rows are only exempt in the server-side bank directory, never in served assets.
  const retiredFile = new RegExp(`^server/questions/(?:${CATEGORY_NAMES.join('|')})-retired\\.json$`).test(path);
  const servedPath = /^public\//i.test(path);
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
      const questionRow = isPrivate || looksLikeQuestion(node);
      for (const [key, raw] of Object.entries(node)) {
        const values = Array.isArray(raw) ? raw : [raw];
        const hashKey = HASH_KEY.test(key) || (BANK_VERSION_KEYS.has(key) && questionRow);
        if (!hashKey || !values.some((value) => typeof value === 'string' && HASH_VALUE.test(value))) continue;
        // Whole-bank version hashes are fine on manifests, not as per-row versions on question rows.
        if (BANK_VERSION_KEYS.has(key)) violations.push(`${path}: per-row version hash "${key}" on question ${id ?? '(no id)'}`);
        else if (isPrivate) violations.push(`${path}: per-question hash "${key}" for private/ranked id ${id ?? '(no id)'}`);
        else if (looksLikeQuestion(node) && !publicIds.has(id)) violations.push(`${path}: per-question hash "${key}" for unknown id ${id}`);
      }
    });
  }
  // Text search always runs (notes fields, strings, non-JSON files, invalid JSON).
  for (const m of text.matchAll(PRIVATE_ID_LOOSE)) if ((servedPath || !allowedRetiredIds.has(canonicalId(m[0]))) && !(m[0] === FAKE_EXAMPLE_ID && !servedPath)) violations.push(`${path}: private ranked id ${m[0]} outside the template`);
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
  const allow = readAllowlist(root);
  const violations = [...allow.violations];
  let files = 0;
  for (const path of listFiles(root)) {
    if (!isTextScanned(path)) continue;
    const abs = join(root, path);
    let st; try { st = statSync(abs); } catch { continue; }
    if (!st.isFile()) continue;
    if (OPAQUE.test(path) && !reviewedOpaque(root, path, allow.entries)) { violations.push(`${path}: opaque archive/PDF cannot be scanned; keep it out of the repo`); continue; }
    if (st.size > MAX_SCAN_BYTES) { violations.push(`${path}: larger than 32 MB, cannot be scanned`); continue; }
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
