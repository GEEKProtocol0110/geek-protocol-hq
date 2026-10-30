import { readFileSync } from 'node:fs';
import { SEASON_ZERO, currentSeasonNumber, privateSeason, seasonForRun } from './seasons.js';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { publishedCommunityQuestionById, publishedCommunityQuestions } from './cce.js';
import { promptIdentity, similarQuestion } from './question-identity.js';

import { categoryFiles } from './question-categories.js';
import { loadRankedSource, loadRankedSourceVersion } from './question-source.js';
export { categoryFiles };

const bankCache = new Map();
const normalizeQuestion = (question) => ({
  ...question,
  topic: question.subcategory || question.topic || question.category,
  funFact: question.funFact || '',
  source: question.source || '',
  conceptId: question.conceptId || question.id,
  reviewStatus: question.reviewStatus || 'draft',
  reviewedAt: question.reviewedAt || '',
  volatile: Boolean(question.volatile),
  priority: Boolean(question.priority),
  // Practice-only drafts are unranked: never selected for ranked, daily, lobby, duel or royale runs.
  practiceOnly: Boolean(question.practiceOnly),
  tags: Array.isArray(question.tags) ? question.tags : []
});
// Everything committed under server/questions/ was published with its answer
// key, so it is exposed: practice/study/grading only, never new ranked play
// once a private ranked source is configured (see docs/MIGRATION-private-ranked-bank.md).
// Tracked out-of-band so row objects (and the audit corpus hash) stay unchanged.
const exposedRows = new WeakSet();
const normalizePublicQuestion = (question) => { const row = normalizeQuestion(question); exposedRows.add(row); return row; };
export const isExposedQuestion = (question) => exposedRows.has(question);

const secureShuffle = (values) => {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
};

export const loadQuestionBank = (category) => {
  if (!categoryFiles[category]) throw new Error('INVALID_REQUEST');
  if (bankCache.has(category)) return bankCache.get(category);
  const questions = categoryFiles[category].flatMap((filename) => {
    const path = join(process.cwd(), 'server', 'questions', filename);
    const parsed = JSON.parse(readFileSync(path, 'utf8'));
    return parsed.questions || [];
  }).map(normalizePublicQuestion);
  // Retired rows are lookup-only: saved games keep their original answer keys.
  // They never enter the pool used for a new ranked, lobby, duel, or practice run.
  const retired = JSON.parse(readFileSync(join(process.cwd(), 'server', 'questions', `${category}-retired.json`), 'utf8')).questions.map(normalizePublicQuestion);
  const byId = new Map([...retired, ...questions].map((question) => [question.id, question]));
  const bank = { questions, byId };
  bankCache.set(category, bank);
  return bank;
};

const rankedBankCache = new Map();
// Builds the selectable pool (active private rows only) plus a lookup map that
// also holds private *-retired rows, which are never selectable.
const privateBankFor = (category, source) => {
  const cacheKey = `${category}|${source.version}`;
  if (rankedBankCache.get(cacheKey)?.source === source) return rankedBankCache.get(cacheKey).bank;
  const publicIds = loadQuestionBank(category).byId;
  const questions = (source.banks[category] || []).map((question) => normalizeQuestion(question));
  const retired = (source.retired?.[category] || []).map((question) => normalizeQuestion(question));
  const byId = new Map();
  for (const question of [...questions, ...retired]) {
    // A private ID must never shadow a published one: saved games keyed by the
    // published ID have to keep grading against the answer they were issued.
    if (publicIds.has(question.id) || byId.has(question.id)) throw new Error('PRIVATE_BANK_ID_COLLISION');
    byId.set(question.id, question);
  }
  const bank = { questions, byId, private: true, version: source.version };
  rankedBankCache.set(cacheKey, { source, bank });
  return bank;
};

// Ranked pool for new runs. Private/fixture questions never fall back to the
// exposed public pool; production without a private source fails closed.
export const loadRankedBank = async (category) => {
  if (!categoryFiles[category]) throw new Error('INVALID_REQUEST');
  const source = await loadRankedSource();
  if (source.mode === 'unavailable') throw new Error('RANKED_BANK_UNAVAILABLE');
  if (source.mode === 'exposed') return { ...loadQuestionBank(category), version: source.version };
  return privateBankFor(category, source);
};

// A run keeps drawing later rounds from the bank version it was bound to.
export const rankedBankForVersion = async (category, bankVersion = '') => {
  const current = await loadRankedBank(category);
  if (!bankVersion || current.version === bankVersion) return current;
  const source = bankVersion === 'public' ? null : await loadRankedSourceVersion(bankVersion);
  if (!source) throw new Error('RANKED_BANK_VERSION_CHANGED');
  return privateBankFor(category, source);
};

// Season and bank version are assigned server-side when a ranked run starts.
// Private-bank seasons are numbered monthly (see server/seasons.js).
export const SEASONS = Object.freeze({
  'season-0': SEASON_ZERO,
  'season-1': Object.freeze({ id: 'season-1', label: 'Season 1 — Private-bank', leaderboard: 'season-1' })
});
export const rankedRunBinding = async (now = Date.now()) => {
  const source = await loadRankedSource();
  if (source.mode === 'unavailable') throw new Error('RANKED_BANK_UNAVAILABLE');
  const season = source.mode === 'private' ? privateSeason(currentSeasonNumber(now)) : SEASON_ZERO;
  return { season: season.id, seasonLabel: season.label, ...(season.month ? { seasonMonth: season.month } : {}), bankVersion: source.version };
};
export const seasonFor = (run) => seasonForRun(run);

const rankedLookup = async (category, id, bankVersion) => {
  try {
    if (bankVersion && bankVersion !== 'public') {
      const source = await loadRankedSourceVersion(bankVersion);
      if (source) return privateBankFor(category, source).byId.get(id);
      return undefined;
    }
    const bank = await loadRankedBank(category);
    return bank.private ? bank.byId.get(id) : undefined;
  } catch (error) {
    if (['RANKED_BANK_UNAVAILABLE', 'PRIVATE_BANK_REF_REQUIRED'].includes(error.message)) return undefined;
    throw error;
  }
};

export const questionById = async (category, id, { bankVersion = '' } = {}) => {
  if (String(id || '').startsWith('cce_')) {
    const question = await publishedCommunityQuestionById(id);
    if (question.category !== category) throw new Error('QUESTION_NOT_FOUND');
    return question;
  }
  // Previously issued runs keep their original answer key: published and
  // retired rows stay addressable by ID, and private rows are looked up by ID.
  const question = loadQuestionBank(category).byId.get(id) || await rankedLookup(category, id, bankVersion);
  if (!question) throw new Error('QUESTION_NOT_FOUND');
  return question;
};

export const selectRoundQuestionIds = async (category, round, excludedIds = [], focus = '', { ranked = false, bankVersion = '' } = {}) => {
  const tier = round <= 3 ? 'easy' : round <= 7 ? 'medium' : 'hard';
  const excluded = new Set(excludedIds);
  const bank = ranked ? await rankedBankForVersion(category, bankVersion) : loadQuestionBank(category);
  const previous = await Promise.all(excludedIds.map(async (id) => {
    if (!String(id).startsWith('cce_')) return bank.byId.get(id) || loadQuestionBank(category).byId.get(id);
    return questionById(category, id);
  }));
  const excludedConcepts = new Set(previous.filter(Boolean).map(q => q.conceptId || q.id));
  const excludedPrompts = new Set(previous.filter(Boolean).map(q => promptIdentity(q.prompt)));
  const previousCommunity = previous.filter(q => q?.community);
  const available = q => !excluded.has(q.id) && !excludedConcepts.has(q.conceptId || q.id)
    && !excludedPrompts.has(promptIdentity(q.prompt)) && !previousCommunity.some(old => similarQuestion(old, q));
  const communityPool = bank.private ? [] : secureShuffle((await publishedCommunityQuestions(category, tier))
    .filter(q => available(q) && !previous.filter(Boolean).some(old => similarQuestion(old, q))));
  const pool = secureShuffle([
    ...communityPool,
    ...bank.questions.filter((question) => !question.practiceOnly && question.difficulty === tier && available(question))
  ]);
  const focusTerms = focus === 'ghostdag'
    ? ['ghostdag', 'consensus', 'blockdag']
    : focus === 'builders'
      ? ['toccata', 'programmability', 'developer', 'covenant', 'toolchain']
      : [];
  const selected = [];
  const selectedConcepts = new Set();
  const selectedPrompts = new Set();
  const addUnique = (question) => {
    if (!question || selected.length >= 10) return;
    const concept = question.conceptId || question.id;
    const prompt = promptIdentity(question.prompt);
    if (selectedConcepts.has(concept) || selectedPrompts.has(prompt)
      || selected.some(item => (item.community || question.community) && similarQuestion(item, question))) return;
    selected.push(question);
    selectedConcepts.add(concept);
    selectedPrompts.add(prompt);
  };
  if (communityPool.length) addUnique(communityPool[0]);
  if (focusTerms.length) {
    secureShuffle(pool.filter((question) => focusTerms.some((term) => `${question.topic} ${question.tags.join(' ')}`.toLowerCase().includes(term)))).slice(0, 4).forEach(addUnique);
  }
  secureShuffle(pool.filter((question) => question.priority)).slice(0, 2).forEach(addUnique);
  const byTopic = new Map();
  pool.forEach((question) => {
    if (!byTopic.has(question.topic)) byTopic.set(question.topic, []);
    byTopic.get(question.topic).push(question);
  });
  secureShuffle([...byTopic.values()]).forEach((group) => {
    if (selected.length < 8) addUnique(group[0]);
  });
  pool.forEach((question) => {
    if (selected.length < 10) addUnique(question);
  });
  if (selected.length !== 10) throw new Error('QUESTION_POOL_EXHAUSTED');
  return secureShuffle(selected).map((question) => question.id);
};

export const shuffleOptions = (options) => secureShuffle(options);
