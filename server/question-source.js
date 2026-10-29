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
//   GEEK_RANKED_QUESTION_SOURCE "private" | "fixture" | "exposed"
//                               Overrides the automatic choice. "fixture" uses
//                               the public sample bank (no real answers) for
//                               development and tests.
//   GEEK_RANKED_ALLOW_EXPOSED   "true" lets production keep ranking from the
//                               exposed public banks during a rollout window.
//
// Production (VERCEL_ENV=production or NODE_ENV=production) fails closed with
// RANKED_BANK_UNAVAILABLE when no private source is configured.
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

const readDirectoryBanks = (directory) => {
  const banks = {};
  for (const filename of readdirSync(directory).sort()) {
    if (!filename.endsWith('.json')) continue;
    const category = Object.keys(categoryFiles).find((name) => filename === `${name}.json` || filename.startsWith(`${name}-`));
    if (!category) continue;
    const parsed = JSON.parse(readFileSync(join(directory, filename), 'utf8'));
    if (!Array.isArray(parsed.questions)) throw new Error('PRIVATE_BANK_INVALID');
    (banks[category] ||= []).push(...parsed.questions);
  }
  return banks;
};

const readUrlBanks = async (url, token, fetchImpl = globalThis.fetch) => {
  if (!/^https:\/\//.test(url)) throw new Error('PRIVATE_BANK_URL_INVALID');
  const response = await fetchImpl(url, { headers: { accept: 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) } });
  if (!response.ok) throw new Error('PRIVATE_BANK_UNREACHABLE');
  const parsed = await response.json();
  if (!parsed || typeof parsed.banks !== 'object') throw new Error('PRIVATE_BANK_INVALID');
  return parsed.banks;
};

let cached = null;
export const resetRankedSourceCache = () => { cached = null; };

// Returns { mode, banks: { category: [validated questions] } }.
export const loadRankedSource = async (env = process.env, options = {}) => {
  const mode = rankedSourceMode(env);
  const key = `${mode}|${env.GEEK_PRIVATE_QUESTION_DIR || ''}|${env.GEEK_PRIVATE_QUESTION_URL || ''}`;
  if (cached?.key === key) return cached.value;
  let raw = {};
  if (mode === 'fixture') raw = readDirectoryBanks(FIXTURE_DIR);
  if (mode === 'private') {
    if (env.GEEK_PRIVATE_QUESTION_DIR) raw = readDirectoryBanks(env.GEEK_PRIVATE_QUESTION_DIR);
    else if (env.GEEK_PRIVATE_QUESTION_URL) raw = await readUrlBanks(env.GEEK_PRIVATE_QUESTION_URL, env.GEEK_PRIVATE_QUESTION_TOKEN, options.fetch);
    else throw new Error('RANKED_BANK_UNAVAILABLE');
  }
  const banks = Object.fromEntries(Object.entries(raw)
    .filter(([category]) => categoryFiles[category])
    .map(([category, questions]) => [category, questions.map((question) => validateQuestion(question, category))]));
  const value = { mode, banks };
  cached = { key, value };
  return value;
};
