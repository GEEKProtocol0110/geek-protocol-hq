import { loadQuestionBank, shuffleOptions } from './questions.js';
import { guidedLessons } from './study-lessons.js';

export const studyLevels = [
  { id: 'foundations', name: 'Foundations', tier: 'easy', description: 'Start with names, terms, and basic safety.' },
  { id: 'connections', name: 'Connections', tier: 'medium', description: 'Connect mechanisms, units, and practical decisions.' },
  { id: 'mixed', name: 'Mixed challenge', tier: null, description: 'Explore the whole topic, including technical concepts.' }
];

export const studyTopics = [
  { id: 'origins', name: 'Where Kaspa began', category: 'Kaspa Origins', lesson: 'Kaspa grew from research into ordering parallel blocks. Its mainnet launched through public proof-of-work mining in 2021. Native KAS and the GEEK token are different assets.', sources: ['https://kaspa.org/lore/', 'https://eprint.iacr.org/2018/104'], next: 'blockdag' },
  { id: 'blockdag', name: 'Blocks, graphs & agreement', category: 'GHOSTDAG & BlockDAG', lesson: 'A blockDAG connects blocks through parent references. Parallel blocks can coexist; consensus still needs an agreed ordering to resolve conflicting spends. Blue and red are structural classifications, not labels proving a miner is honest or dishonest.', sources: ['https://eprint.iacr.org/2018/104'], next: 'mining' },
  { id: 'mining', name: 'Mining & network security', category: 'Mining & Consensus', lesson: 'Proof of work requires miners to perform computation. Kaspa uses kHeavyHash. Crescendo raised the target block rate to 10 per second; individual block arrivals vary rather than following an exact 100-millisecond clock.', sources: ['https://github.com/kaspanet/rusty-kaspa#the-crescendo-hardfork', 'https://github.com/kaspanet/kips/blob/master/kip-0014.md'], next: 'emission' },
  { id: 'emission', name: 'KAS & the emission schedule', category: 'Tokenomics', lesson: 'KAS has eight decimal places: one KAS is 100 million sompi. Kaspa had no premine. Its chromatic schedule reduces issuance each month, combining into an annual halving. About 28.7 billion KAS is the commonly quoted total supply.', sources: ['https://wiki.kaspa.org/en/tokenomics'], next: 'wallets' },
  { id: 'wallets', name: 'Wallets & safe signatures', category: 'Wallets & Addresses', lesson: 'A Kaspa balance is made from unspent transaction outputs. A public address can receive funds; a seed phrase or private key must stay private. A checksum catches many typing errors, but cannot tell you whether you chose the right recipient. Check a signature message just as carefully as a transaction request.', sources: ['https://docs.kaspa.org/integrate', 'https://github.com/kaspanet/kips/blob/master/kip-0005.md'], next: 'tokens' },
  { id: 'tokens', name: 'Tokens & indexers', category: 'KRC-20 & Smart Contracts', lesson: 'KRC-20 is an application token protocol on Kaspa. Deploy establishes token parameters; mint creates units according to those parameters; transfer moves units. An indexer interprets those operations. Token state is distinct from native KAS, and an indexer outage does not mean Kaspa stopped producing blocks.', sources: ['https://github.com/kasplex/sdk-kiwi'], next: 'ecosystem' },
  { id: 'ecosystem', name: 'Nodes & builder tools', category: 'Kaspa Ecosystem', lesson: 'A full node checks consensus rules independently. Applications use RPC to communicate with nodes. Testnet is for experimentation with test coins. Kaspa Improvement Proposals document changes in public; a proposed upgrade must not be described as already active.', sources: ['https://docs.kaspa.org/integrate', 'https://github.com/kaspanet/kips'], next: 'fundamentals' },
  { id: 'fundamentals', name: 'Keys, fees & finality', category: 'Crypto Fundamentals', lesson: 'Private keys authorize signatures; public keys support verification. Consensus resolves double spends. Proof-of-work finality becomes stronger with accumulated work; it is not a promise of zero reversal risk. Self-custody means keeping control of your own keys.', sources: ['https://eprint.iacr.org/2018/104', 'https://docs.kaspa.org/integrate'], next: 'origins' }
];

export const studyBank = () => {
  const unique = new Map();
  for (const q of loadQuestionBank('kaspa').questions) {
    if (q.reviewStatus === 'source-checked' && studyTopics.some(t => t.category === q.topic) && !unique.has(q.conceptId)) unique.set(q.conceptId, q);
  }
  return [...unique.values()];
};

export const studyCatalog = () => ({
  reviewedAt: '2026-10-02',
  reviewNote: 'Internally checked against primary sources. Independent editorial review is still required before monetary rewards.',
  levels: studyLevels,
  topics: studyTopics.map(t => {
    const pool = studyBank().filter(q => q.topic === t.category);
    return { ...t, ...guidedLessons[t.id], count: pool.length, levels: studyLevels.map(level => ({ id: level.id, count: pool.filter(q => !level.tier || q.difficulty === level.tier).length })) };
  })
});

export const pickStudyQuestions = (topicId, levelId = 'mixed', records = {}, review = false) => {
  const topic = studyTopics.find(t => t.id === topicId);
  const level = studyLevels.find(l => l.id === levelId);
  if (!topic || !level) throw new Error('INVALID_REQUEST');
  const pool = studyBank().filter(q => q.topic === topic.category && (review || !level.tier || q.difficulty === level.tier));
  if (review) return pool.filter(q => records[q.conceptId]?.lastCorrect === false).sort((a, b) => records[a.conceptId].lastAnsweredAt - records[b.conceptId].lastAnsweredAt).slice(0, 5).map(q => q.id);
  // Cover unseen concepts first, then revisit mistakes, then rotate practiced ones.
  const priority = q => !records[q.conceptId] ? 0 : records[q.conceptId].lastCorrect === false ? 1 : 2;
  return shuffleOptions(pool).sort((a, b) => priority(a) - priority(b)).slice(0, 5).map(q => q.id);
};

export const studyQuestionById = id => {
  const q = studyBank().find(q => q.id === id);
  if (!q) throw new Error('STUDY_NOT_FOUND');
  return q;
};
