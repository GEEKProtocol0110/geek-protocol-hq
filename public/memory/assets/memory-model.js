// Public teaching cards for an unranked game. These are not private quiz answers.
export const memoryPairs = Object.freeze([
  { id: 'kas', term: 'KAS', meaning: 'Kaspa’s native coin', explanation: 'KAS is the native coin of Kaspa. Application tokens such as GEEK are separate assets.', topic: 'origins', source: 'https://github.com/kaspanet/rusty-kaspa' },
  { id: 'sompi', term: 'Sompi', meaning: 'One hundred-millionth of a KAS', explanation: 'One KAS contains 100,000,000 sompi. The smaller unit lets amounts use whole numbers.', topic: 'emission', source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/constants.rs' },
  { id: 'blockdag', term: 'BlockDAG', meaning: 'A graph of blocks with directed links and no directed cycles', explanation: 'Blocks link to predecessors. Parallel blocks can coexist in the graph; consensus still needs to order their transactions.', topic: 'blockdag', source: 'https://eprint.iacr.org/2018/104' },
  { id: 'ghostdag', term: 'GHOSTDAG', meaning: 'Kaspa’s consensus ordering protocol', explanation: 'GHOSTDAG derives an agreed ordering from the block graph. Keeping parallel blocks does not mean accepting conflicting spends.', topic: 'blockdag', source: 'https://eprint.iacr.org/2018/104' },
  { id: 'pow', term: 'Proof of Work', meaning: 'Computation that miners perform to produce valid blocks', explanation: 'Kaspa uses proof of work. Hashing work and transaction volume measure different things.', topic: 'mining', source: 'https://github.com/kaspanet/rusty-kaspa' },
  { id: 'utxo', term: 'UTXO', meaning: 'An unspent transaction output', explanation: 'A transaction spends existing outputs and creates new ones. A UTXO has not yet been spent by another transaction.', topic: 'wallets', source: 'https://github.com/kaspanet/rusty-kaspa' },
  { id: 'node', term: 'Full node', meaning: 'Software that independently checks network consensus rules', explanation: 'A full node validates the network’s rules. Reading an explorer page serves a different purpose.', topic: 'ecosystem', source: 'https://github.com/kaspanet/rusty-kaspa' },
  { id: 'testnet', term: 'Testnet', meaning: 'A separate network for experiments with test coins', explanation: 'Testnet lets developers experiment. Its coins and addresses belong to a different network from mainnet.', topic: 'ecosystem', source: 'https://github.com/kaspanet/rusty-kaspa' }
].map(pair => Object.freeze(pair)));

const shuffle = (values, random) => {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

export const createMemoryGame = (count, random = Math.random) => {
  if (![4, 6, 8].includes(count)) throw new RangeError('Choose four, six, or eight pairs.');
  const pairs = shuffle(memoryPairs, random).slice(0, count);
  const cards = shuffle(pairs.flatMap(pair => [
    { pairId: pair.id, kind: 'word', text: pair.term },
    { pairId: pair.id, kind: 'meaning', text: pair.meaning }
  ]), random).map((card, i) => ({ ...card, id: i }));
  return { cards, revealed: [], matched: [], moves: 0, phase: 'playing' };
};

export const flipMemoryCard = (state, id) => {
  if (state.phase !== 'playing' || !state.cards.some(card => card.id === id) || state.revealed.includes(id) || state.matched.includes(id)) return state;
  const revealed = [...state.revealed, id];
  if (revealed.length === 1) return { ...state, revealed };
  const [a, b] = revealed.map(id => state.cards.find(card => card.id === id));
  const moves = state.moves + 1;
  if (a.pairId !== b.pairId) return { ...state, revealed, moves, phase: 'compare' };
  const matched = [...state.matched, ...revealed];
  return { ...state, revealed: [], matched, moves, phase: matched.length === state.cards.length ? 'complete' : 'playing' };
};

export const closeMemoryComparison = state => state.phase === 'compare' ? { ...state, revealed: [], phase: 'playing' } : state;
