import { readFileSync } from 'node:fs';
import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { publishedCommunityQuestionById, publishedCommunityQuestions } from './cce.js';

const categoryFiles = {
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
  }).map((question) => ({
    id: question.id,
    category: question.category,
    topic: question.subcategory || question.category,
    difficulty: question.difficulty,
    prompt: question.prompt,
    options: question.options,
    correctIndex: question.correctIndex,
    funFact: question.funFact || '',
    source: question.source || '',
    volatile: Boolean(question.volatile),
    priority: Boolean(question.priority),
    tags: Array.isArray(question.tags) ? question.tags : []
  }));
  const byId = new Map(questions.map((question) => [question.id, question]));
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
  const communityPool = secureShuffle((await publishedCommunityQuestions(category, tier)).filter((question) => !excluded.has(question.id)));
  const pool = secureShuffle([
    ...communityPool,
    ...loadQuestionBank(category).questions.filter((question) => question.difficulty === tier && !excluded.has(question.id))
  ]);
  const focusTerms = focus === 'ghostdag'
    ? ['ghostdag', 'consensus', 'blockdag']
    : focus === 'builders'
      ? ['toccata', 'programmability', 'developer', 'covenant', 'toolchain']
      : [];
  const selected = [];
  const addUnique = (question) => {
    if (question && !selected.some((item) => item.id === question.id)) selected.push(question);
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
