// Ranked question source resolution.
//
// Every bank committed under server/questions/ has been public in this
// repository together with its correctIndex, so those questions are treated as
// EXPOSED: they stay available for practice, study, lobby/duel/royale play and
// for grading previously issued runs, but they are never selected for a new
// ranked run once a private bank is configured.
//
// Future ranked questions and answers live outside the public repository:
//   GEEK_PRIVATE_QUESTION_DIR   absolute path to a directory of private bank
//                               files (<category>.json or <category>-*.json),
//                               e.g. a checkout of a private repo or a build
//                               artifact copied in at deploy time.
//   GEEK_PRIVATE_QUESTION_URL   HTTPS URL returning one JSON document
//                               { "banks": { "<category>": [questions...] } }
//                               (private GitHub contents API, private blob, ...)
//   GEEK_PRIVATE_QUESTION_TOKEN optional bearer token for the URL.
//   GEEK_PRIVATE_QUESTION_REF   40-hex commit SHA pinning the bank version
//                               (required for URL sources in production).
//   GEEK_RANKED_QUESTION_SOURCE "private" | "fixture" | "exposed"
//                               Overrides the automatic choice. "fixture" uses
//                               the public sample bank (no real answers) for
//                               development and tests.
//   GEEK_RANKED_ALLOW_EXPOSED   "true" lets production keep ranking from the
//                               exposed public banks during a rollout window.
//
// Production (VERCEL_ENV=production or NODE_ENV=production) fails closed with
// RANKED_BANK_UNAVAILABLE when no private source is configured.
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { categoryFiles } from './question-categories.js';

export const FIXTURE_DIR = join(process.cwd(), 'server', 'question-fixtures', 'ranked-sample');

const isProduction = (env) => env.VERCEL_ENV === 'production' || env.NODE_ENV === 'production';

export const rankedSourceMode = (env = process.env) => {
  const explicit = String(env.GEEK_RANKED_QUESTION_SOURCE || '').trim().toLowerCase();
  if (explicit) {
    if (!['private', 'fixture', 'exposed'].includes(explicit)) throw new Error('RANKED_SOURCE_INVALID');
    if (explicit === 'fixture' && isProduction(env)) throw new Error('RANKED_SOURCE_INVALID');
    if (explicit === 'exposed' && isProduction(env) && env.GEEK_RANKED_ALLOW_EXPOSED !== 'true') return 'unavailable';
    return explicit;
  }
  if (env.GEEK_PRIVATE_QUESTION_DIR || env.GEEK_PRIVATE_QUESTION_URL) return 'private';
  if (isProduction(env)) return env.GEEK_RANKED_ALLOW_EXPOSED === 'true' ? 'exposed' : 'unavailable';
  // Local development and the existing test suite keep the legacy pool.
  return 'exposed';
};

const validateQuestion = (question, category) => {
  if (!question || typeof question.id !== 'string' || !question.id
    || typeof question.prompt !== 'string' || !Array.isArray(question.options) || question.options.length !== 4
    || new Set(question.options).size !== 4 || !Number.isInteger(question.correctIndex)
    || question.correctIndex < 0 || question.correctIndex > 3
    || !['easy', 'medium', 'hard'].includes(question.difficulty)) throw new Error('PRIVATE_BANK_INVALID');
  return { ...question, category: question.category || category };
};

export const MAX_PRIVATE_BANK_BYTES = 8 * 1024 * 1024;
export const PRIVATE_BANK_FETCH_TIMEOUT_MS = 8_000;
const SHA_PATTERN = /^[a-f0-9]{40}$/;

// A private bank is { banks: { <category>: [rows] }, retired: { <category>: [rows] } }.
// Retired rows are lookup-only: they grade saved runs but never enter selection.
const categoryForFile = (filename) => Object.keys(categoryFiles)
  .sort((a, b) => b.length - a.length)
  .find((name) => filename === `${name}.json` || filename.startsWith(`${name}-`));

export const readDirectoryBanks = (directory) => {
  const banks = {}, retired = {};
  const hash = createHash('sha256');
  for (const filename of readdirSync(directory).sort()) {
    if (!filename.endsWith('.json')) continue;
    const category = categoryForFile(filename);
    if (!category) continue;
    const text = readFileSync(join(directory, filename), 'utf8');
    if (Buffer.byteLength(text) > MAX_PRIVATE_BANK_BYTES) throw new Error('PRIVATE_BANK_TOO_LARGE');
    hash.update(filename).update('\0').update(text).update('\0');
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed.questions)) throw new Error('PRIVATE_BANK_INVALID');
    const target = filename.endsWith('-retired.json') ? retired : banks;
    (target[category] ||= []).push(...parsed.questions);
  }
  return { banks, retired, contentHash: hash.digest('hex') };
};

// Reads at most maxBytes from a fetch Response body; rejects anything larger.
const readBounded = async (response, maxBytes) => {
  const declared = Number(response.headers?.get?.('content-length') || 0);
  if (declared > maxBytes) throw new Error('PRIVATE_BANK_TOO_LARGE');
  if (!response.body?.getReader) {
    const text = await response.text();
    if (Buffer.byteLength(text) > maxBytes) throw new Error('PRIVATE_BANK_TOO_LARGE');
    return text;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel().catch(() => {}); throw new Error('PRIVATE_BANK_TOO_LARGE'); }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString('utf8');
};

// Accepts either the raw bank document (Accept: application/vnd.github.raw) or
// the GitHub Contents API JSON wrapper { type: "file", encoding: "base64", content }.
export const decodeBankDocument = (text, maxBytes = MAX_PRIVATE_BANK_BYTES) => {
  let parsed;
  try { parsed = JSON.parse(text); } catch { throw new Error('PRIVATE_BANK_INVALID'); }
  if (parsed && typeof parsed.content === 'string' && parsed.encoding === 'base64' && !parsed.banks) {
    const decoded = Buffer.from(parsed.content.replace(/\s+/g, ''), 'base64');
    if (decoded.byteLength > maxBytes) throw new Error('PRIVATE_BANK_TOO_LARGE');
    try { parsed = JSON.parse(decoded.toString('utf8')); } catch { throw new Error('PRIVATE_BANK_INVALID'); }
  } else if (parsed && parsed.encoding === 'none') {
    // Contents API omits content for files over 1 MB unless the raw media type is requested.
    throw new Error('PRIVATE_BANK_TOO_LARGE');
  }
  if (!parsed || typeof parsed.banks !== 'object' || Array.isArray(parsed.banks)) throw new Error('PRIVATE_BANK_INVALID');
  if (parsed.retired !== undefined && (typeof parsed.retired !== 'object' || Array.isArray(parsed.retired))) throw new Error('PRIVATE_BANK_INVALID');
  return { banks: parsed.banks, retired: parsed.retired || {} };
};

// Pin the GitHub Contents API to an immutable commit: ?ref=<sha>.
export const pinnedUrl = (url, ref) => {
  if (!ref) return url;
  const target = new URL(url);
  if (target.hostname === 'api.github.com' && /\/contents\//.test(target.pathname)) target.searchParams.set('ref', ref);
  return target.toString();
};

export const readUrlBanks = async (url, token, { fetch: fetchImpl = globalThis.fetch, ref = '', timeoutMs = PRIVATE_BANK_FETCH_TIMEOUT_MS, maxBytes = MAX_PRIVATE_BANK_BYTES } = {}) => {
  if (!/^https:\/\//.test(url)) throw new Error('PRIVATE_BANK_URL_INVALID');
  let response;
  try {
    response = await fetchImpl(pinnedUrl(url, ref), {
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        accept: 'application/vnd.github.raw, application/json;q=0.9',
        'x-github-api-version': '2022-11-28',
        ...(token ? { authorization: `Bearer ${token}` } : {})
      }
    });
  } catch (error) {
    if (error?.name === 'TimeoutError' || error?.name === 'AbortError') throw new Error('PRIVATE_BANK_TIMEOUT');
    throw new Error('PRIVATE_BANK_UNREACHABLE');
  }
  if (!response.ok) throw new Error('PRIVATE_BANK_UNREACHABLE');
  const text = await readBounded(response, maxBytes);
  const document = decodeBankDocument(text, maxBytes);
  return { ...document, contentHash: createHash('sha256').update(text).digest('hex') };
};

// Immutable bank versions loaded by this instance. A version never changes once
// cached, so a run bound to a version keeps grading against the same keys even
// after the configured version moves on.
const versions = new Map();
let current = null;
export const resetRankedSourceCache = () => { versions.clear(); current = null; };
export const cachedBankVersions = () => [...versions.keys()];

const validateBanks = (raw) => Object.fromEntries(Object.entries(raw || {})
  .filter(([category]) => categoryFiles[category])
  .map(([category, questions]) => {
    if (!Array.isArray(questions)) throw new Error('PRIVATE_BANK_INVALID');
    return [category, questions.map((question) => validateQuestion(question, category))];
  }));

const buildVersion = (mode, raw, pin) => {
  const version = pin ? `git:${pin}` : `sha256:${raw.contentHash}`;
  if (versions.has(version)) return versions.get(version);
  const value = Object.freeze({ mode, version, banks: validateBanks(raw.banks), retired: validateBanks(raw.retired) });
  versions.set(version, value);
  return value;
};

const pinFor = (env) => {
  const pin = String(env.GEEK_PRIVATE_QUESTION_REF || '').trim().toLowerCase();
  if (pin && !SHA_PATTERN.test(pin)) throw new Error('PRIVATE_BANK_REF_INVALID');
  return pin;
};

// Returns { mode, version, banks, retired }. The configured source is read once
// per instance and cached; nothing is fetched per answer.
export const loadRankedSource = async (env = process.env, options = {}) => {
  const mode = rankedSourceMode(env);
  const pin = mode === 'private' ? pinFor(env) : '';
  const key = `${mode}|${env.GEEK_PRIVATE_QUESTION_DIR || ''}|${env.GEEK_PRIVATE_QUESTION_URL || ''}|${pin}`;
  if (current?.key === key) return current.value;
  if (mode === 'private' && env.GEEK_PRIVATE_QUESTION_URL && !env.GEEK_PRIVATE_QUESTION_DIR && isProduction(env) && !pin) throw new Error('PRIVATE_BANK_REF_REQUIRED');
  let value;
  if (mode === 'fixture') value = buildVersion(mode, readDirectoryBanks(FIXTURE_DIR), '');
  else if (mode === 'private') {
    if (env.GEEK_PRIVATE_QUESTION_DIR) value = buildVersion(mode, readDirectoryBanks(env.GEEK_PRIVATE_QUESTION_DIR), pin);
    else if (env.GEEK_PRIVATE_QUESTION_URL) {
      if (pin && versions.has(`git:${pin}`)) value = versions.get(`git:${pin}`);
      else value = buildVersion(mode, await readUrlBanks(env.GEEK_PRIVATE_QUESTION_URL, env.GEEK_PRIVATE_QUESTION_TOKEN, { ...options, ref: pin }), pin);
    } else throw new Error('RANKED_BANK_UNAVAILABLE');
  } else value = Object.freeze({ mode, version: mode === 'exposed' ? 'public' : '', banks: {}, retired: {} });
  current = { key, value };
  return value;
};

// Historical versions: a run bound to an older pinned commit can be graded by
// reading that exact commit once (immutable, then cached). Content-hash
// versions cannot be refetched; such runs rely on the key snapshot stored with
// the run at issue time.
export const loadRankedSourceVersion = async (version, env = process.env, options = {}) => {
  if (!versions.has(version)) { try { await loadRankedSource(env, options); } catch { /* fall through */ } }
  if (versions.has(version)) return versions.get(version);
  const match = /^git:([a-f0-9]{40})$/.exec(String(version || ''));
  if (!match || !env.GEEK_PRIVATE_QUESTION_URL || env.GEEK_PRIVATE_QUESTION_DIR) return null;
  return buildVersion('private', await readUrlBanks(env.GEEK_PRIVATE_QUESTION_URL, env.GEEK_PRIVATE_QUESTION_TOKEN, { ...options, ref: match[1] }), match[1]);
};
