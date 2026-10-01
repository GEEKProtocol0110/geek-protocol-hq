import { readFileSync, writeFileSync } from 'node:fs';

const reviewedAt = '2026-10-01';
const bankPath = 'server/questions/kaspa-questions.json';
const bank = JSON.parse(readFileSync(bankPath, 'utf8'));
const paper = 'https://eprint.iacr.org/2018/104';
const tokenomics = 'https://wiki.kaspa.org/en/tokenomics';
const kips = 'https://github.com/kaspanet/kips';
const sdk = 'https://github.com/kasplex/sdk-kiwi';
const patches = {
  l2: { source: 'https://ethereum.org/developers/docs/scaling/', funFact: 'Layer 2 systems move execution off a base chain while relying on it for settlement or security. Designs have different trust assumptions; an application token protocol alone is not automatically a Layer 2.' },
  sompi: { source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/constants.rs' },
  decimals: { source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/core/src/constants.rs' },
  prefix: { source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/crypto/addresses/src/lib.rs' },
  'test-prefix': { source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/crypto/addresses/src/lib.rs' },
  founder: { prompt: "Which researcher co-authored PHANTOM/GHOSTDAG and helped create Kaspa?", source: paper, funFact: 'Yonatan Sompolinsky co-authored the research with Shai Wyborski and Aviv Zohar. Kaspa grew from a research and open-source community effort.' },
  ghost: { source: 'https://eprint.iacr.org/2013/881', funFact: 'GHOST means Greedy Heaviest-Observed Sub-Tree. It is earlier research by Sompolinsky and Zohar; GHOST and GHOSTDAG are different protocols.' },
  blue: { prompt: "Under GHOSTDAG's security assumptions, what do blue blocks aim to identify?", source: paper, funFact: 'Blue membership is determined by the bounded anticone rule. It is a structural classification, not a guarantee that every blue miner is honest.' },
  red: { source: paper, funFact: 'A red block lies outside the selected blue cluster. Red does not mean that the block vanishes from the DAG, or that every transaction in it is automatically invalid.' },
  parallel: { source: paper, funFact: 'Parallel blocks can be ordered in one graph. Transaction validity and conflicting spends are still checked; including a block does not mean accepting every transaction in it.' },
  'bps-now': { source: `${kips}/blob/master/kip-0014.md`, funFact: 'Crescendo moved Kaspa mainnet from 1 to 10 target blocks per second. A target block rate is not a fixed timetable for each individual block.' },
  interval: { source: `${kips}/blob/master/kip-0014.md`, funFact: 'One second divided by ten blocks is 100 milliseconds on average. Actual proof-of-work block arrivals vary.' },
  supply: { source: tokenomics, funFact: 'The commonly quoted total supply is about 28.7 billion KAS. Emission rounding and network behavior affect the exact total; this is an approximate figure.' },
  sign: { source: `${kips}/blob/master/kip-0005.md`, funFact: 'A valid signature proves control of a key for that particular message. Signing a message is different from approving a transaction, and the message should still be checked.' },
  checksum: { funFact: 'A checksum detects many transcription errors. A valid checksum does not prove that an address belongs to the intended recipient.' },
  fees: { prompt: 'In a conventional proof-of-work blockchain, who generally receives transaction fees?', source: 'https://github.com/kaspanet/rusty-kaspa/blob/master/consensus/src/processes/coinbase.rs', funFact: 'Fees contribute to miner revenue. Kaspa uses DAG-specific coinbase rules, including blue and red mergeset reward handling; its exact rules differ from a simple linear-chain example.' },
  finality: { source: paper, funFact: 'Proof-of-work finality is probabilistic: confidence strengthens with accumulated work. Confirmation does not mean a transaction has mathematically zero reversal risk.' },
  '51': { source: paper, funFact: 'Majority hash power can threaten recent transaction ordering and enable double-spend attempts. It does not reveal other users\' private keys.' },
  immutability: { source: paper, funFact: 'Settled proof-of-work history is costly to rewrite under the protocol\'s assumptions. Immutability here is a security property, not a promise of absolute impossibility.' },
  dagknight: { source: `${kips}/blob/master/kip-0002.md`, funFact: 'DAGKnight is a proposed consensus upgrade. KIP-2 is marked Proposed; a research paper does not by itself establish mainnet activation.' }
};

const concepts = new Map();
for (const q of bank.questions) {
  const identity = `${q.subcategory}|${q.tags.filter(tag => tag !== 'kaspa').join('|')}`;
  if (!concepts.has(identity)) concepts.set(identity, { id: q.id, prompt: q.prompt });
  const concept = concepts.get(identity);
  q.conceptId = concept.id;
  const patch = patches[q.tags.find(tag => Object.hasOwn(patches, tag))];
  if (patch) {
    if (patch.prompt) {
      const old = concept.prompt;
      const start = q.prompt.toLowerCase().indexOf(old.toLowerCase());
      if (start < 0) throw new Error(`Cannot identify canonical prompt: ${q.id}`);
      q.prompt = q.prompt.slice(0, start) + patch.prompt;
    }
    if (patch.source) q.source = patch.source;
    if (patch.funFact) q.funFact = patch.funFact;
  }
  if (q.subcategory === 'KRC-20 & Smart Contracts' && !q.tags.includes('l2')) q.source = sdk;
  q.reviewedAt = reviewedAt;
  q.reviewStatus = 'source-checked';
}
bank.metadata.version = '1.1.0-source-checked';
bank.metadata.reviewedAt = reviewedAt;
bank.metadata.conceptCount = concepts.size;
bank.metadata.reviewNotice = '80 underlying concepts checked against primary sources on 2026-10-01. The 1,000 entries are practice variants, not 1,000 distinct concepts. This internal source review is not independent editorial approval or authorization for monetary rewards. Re-review time-sensitive facts before reward-enabled launch.';
writeFileSync(bankPath, `${JSON.stringify(bank, null, 2)}\n`);

const currentPath = 'server/questions/kaspa-current-questions.json';
const current = JSON.parse(readFileSync(currentPath, 'utf8'));
current.reviewedAt = reviewedAt;
current.reviewStandard = 'Internal primary-source check; no independent editorial approval';
for (const q of current.questions) {
  q.conceptId = q.id;
  q.reviewedAt = reviewedAt;
  q.reviewStatus = 'source-checked';
  if (['KCUR-0001', 'KCUR-0002', 'KCUR-0019'].includes(q.id)) q.source = 'https://github.com/kaspanet/rusty-kaspa#the-crescendo-hardfork';
  if (['KCUR-0003', 'KCUR-0004'].includes(q.id)) q.source = 'https://kaspa.org/lore/';
  if (q.id === 'KCUR-0016') q.source = 'https://docs.kaspa.org/toccata/silverscript';
  if (q.id === 'KCUR-0008') q.source = `${kips}/blob/master/kip-0014.md`;
  if (q.id === 'KCUR-0030') {
    q.prompt = 'How should DAGKnight be described as of October 1, 2026?';
    q.source = `${kips}/blob/master/kip-0002.md`;
  }
  if (q.id === 'KCUR-0032') {
    q.source = `${kips}/blob/master/kip-0002.md`;
    q.funFact = 'KIP-2 is still marked Proposed at this review. Do not invent a fixed activation date; check current release and activation evidence before making a mainnet claim.';
  }
}
writeFileSync(currentPath, `${JSON.stringify(current, null, 2)}\n`);
console.log(`Source review recorded for ${concepts.size} core concepts, 1,000 variants, and ${current.questions.length} current items.`);
