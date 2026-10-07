import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { publishedCommunityQuestionById, publishedCommunityQuestions } from './cce.js';
import { promptIdentity, similarQuestion } from './question-identity.js';

export const categoryFiles = {
  kaspa: ['kaspa-questions.json', 'kaspa-current-questions.json'],
  'video-games': ['video-games-questions.json'],
  'science-fiction': ['science-fiction-questions.json'],
  technology: ['technology-questions.json'],
  movies: ['movies-questions.json'],
  history: ['history-questions.json'],
  comics: ['comics-questions.json'],
  'pop-culture': ['pop-culture-questions.json']
};

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
  tags: Array.isArray(question.tags) ? question.tags : []
});

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
  }).map(normalizeQuestion);
  // Retired rows are lookup-only: saved games keep their original answer keys.
  // They never enter the pool used for a new ranked, lobby, duel, or practice run.
  const retired = JSON.parse(readFileSync(join(process.cwd(), 'server', 'questions', `${category}-retired.json`), 'utf8')).questions.map(normalizeQuestion);
  const byId = new Map([...retired, ...questions].map((question) => [question.id, question]));
  const bank = { questions, byId };
  bankCache.set(category, bank);
  return bank;
};

export const questionById = async (category, id) => {
  if (String(id || '').startsWith('cce_')) {
    const question = await publishedCommunityQuestionById(id);
    if (question.category !== category) throw new Error('QUESTION_NOT_FOUND');
    return question;
  }
  const question = loadQuestionBank(category).byId.get(id);
  if (!question) throw new Error('QUESTION_NOT_FOUND');
  return question;
};

export const selectRoundQuestionIds = async (category, round, excludedIds = [], focus = '') => {
  const tier = round <= 3 ? 'easy' : round <= 7 ? 'medium' : 'hard';
  const excluded = new Set(excludedIds);
  const bank = loadQuestionBank(category);
  const previous = await Promise.all(excludedIds.map(async (id) => {
    if (!String(id).startsWith('cce_')) return bank.byId.get(id);
    return questionById(category, id);
  }));
  const excludedConcepts = new Set(previous.filter(Boolean).map(q => q.conceptId || q.id));
  const excludedPrompts = new Set(previous.filter(Boolean).map(q => promptIdentity(q.prompt)));
  const previousCommunity = previous.filter(q => q?.community);
  const available = q => !excluded.has(q.id) && !excludedConcepts.has(q.conceptId || q.id)
    && !excludedPrompts.has(promptIdentity(q.prompt)) && !previousCommunity.some(old => similarQuestion(old, q));
  const communityPool = secureShuffle((await publishedCommunityQuestions(category, tier))
    .filter(q => available(q) && !previous.filter(Boolean).some(old => similarQuestion(old, q))));
  const pool = secureShuffle([
    ...communityPool,
    ...bank.questions.filter((question) => question.difficulty === tier && available(question))
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
