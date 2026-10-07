// Ignore display wrappers, punctuation, whitespace, and option order when
// comparing prompts. Semantic rewordings must also share a reviewed conceptId.
export const promptIdentity = (prompt) => String(prompt || '')
  .replace(/^(?:Proof-of-Learning challenge:\s*|Which answer correctly completes this [^:]+ knowledge check:\s*)/i, '')
  .normalize('NFKD').replace(/\p{M}/gu, '')
  .toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

const stopWords = new Set('the a an what which who when where why how in on at of to for is was are were does do did has have had its his her their with and or from following according named called name'.split(' '));
export const promptTerms = (prompt) => new Set(promptIdentity(prompt).split(' ').filter(word => !stopWords.has(word)).map(word => word.replace(/s$/, '')));

const comparisonCache = new WeakMap();
const comparison = (question) => {
  if (!comparisonCache.has(question)) comparisonCache.set(question, {
    prompt: promptIdentity(question.prompt), terms: promptTerms(question.prompt),
    answer: promptIdentity(question.options[question.correctIndex]),
    options: question.options.map(promptIdentity).sort().join('|')
  });
  return comparisonCache.get(question);
};
export const similarQuestion = (a, b) => {
  const first = comparison(a), second = comparison(b);
  let overlap = 0;
  for (const term of first.terms) if (second.terms.has(term)) overlap++;
  const similarity = overlap / Math.max(1, first.terms.size + second.terms.size - overlap);
  return first.prompt === second.prompt
    || (first.answer === second.answer && similarity >= 0.58)
    || (first.options === second.options && similarity >= 0.4)
    || similarity >= 0.85;
};
