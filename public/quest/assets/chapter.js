// Public teaching content, separate from private ranked question banks.
// Story dialogue is authored fiction; learning notes cite primary sources.
export const firstSignal = {
  id: 'first-signal', version: 1, number: 1, title: 'First Signal', heading: ['First', 'Signal.'], subtitle: 'A Kaspa origins adventure',
  entrance: { title: 'Step into the archive.', story: 'GIGA is waiting at the entrance. Together, you will explore where Kaspa began, why parallel blocks need an order, and how KAS differs from GEEK.' },
  completedTitle: 'Your first signal is connected.',
  objective: 'Explain Kaspa’s research roots, public launch, and the distinction between KAS and GEEK.',
  reviewedAt: '2026-10-05',
  badge: { id: 'first-signal', name: 'First Signal Explorer', description: 'Completed all three stops and six learning checks in the Kaspa origins chapter.' },
  scenes: [
    {
      id: 'research-desk', name: 'The Research Desk', location: 'ARCHIVE 01',
      story: 'A quiet archive flickers awake as your Geek steps into the Grid. GIGA places two glowing blocks side by side. “Two signals arrived together. Let’s discover how a network can give them an order.”',
      giga: 'Welcome, explorer. You do not need to know all the terms yet. Start with one idea: parallel blocks still need an agreed order.',
      objective: 'Connect parallel block production with the need for consensus ordering.',
      notes: [
        'The PHANTOM and GHOSTDAG research explores proof-of-work consensus using a graph of blocks, rather than only one chain.',
        'Blocks can be created concurrently. Consensus still needs a consistent ordering so conflicting transactions do not both become accepted payments.',
        'GHOSTDAG is an efficient greedy approach developed from PHANTOM’s research framework. A graph alone does not replace consensus rules.'
      ],
      example: 'Imagine two miners creating blocks before either hears about the other. Keeping both in the graph leaves the network the task of deciding transaction order.',
      source: { label: 'PHANTOM / GHOSTDAG research paper', url: 'https://eprint.iacr.org/2018/104' },
      checkpoints: [
        { id: 'parallel-order', prompt: 'Two blocks arrive in parallel. What does consensus still need to establish?', choices: ['Which miner has the most followers', 'A consistent order for transactions', 'That every transaction is a GEEK reward', 'That both blocks must be discarded'], correctIndex: 1, explanation: 'Parallel blocks do not remove the need for an agreed transaction order. Ordering lets the network resolve conflicting spends.' },
        { id: 'research-link', prompt: 'How is GHOSTDAG connected to PHANTOM?', choices: ['It is a wallet seed backup service', 'It replaces mining with a popularity vote', 'It is an efficient greedy approach from the same research framework', 'It is the name of Kaspa’s native coin'], correctIndex: 2, explanation: 'The paper presents GHOSTDAG as an efficient greedy algorithm that carries forward PHANTOM’s approach to ordering a blockDAG.' }
      ]
    },
    {
      id: 'genesis-beacon', name: 'The Genesis Beacon', location: 'ARCHIVE 02',
      story: 'The next room holds a beacon marked 2021. GIGA brushes dust from its glass. “Now the research becomes a live network. Follow the trail from an idea to public mining.”',
      giga: 'You found the launch beacon. Look at how the coins began entering circulation, not just the name on the display.',
      objective: 'Recognize the year and distribution boundary of Kaspa’s mainnet launch.',
      notes: [
        'Kaspa mainnet launched in November 2021 as a public proof-of-work network.',
        'The launch had no premine or presale. Native KAS entered circulation through mining from genesis.',
        'Fair launch describes the initial distribution. It does not guarantee a price, an investment outcome, or equal holdings today.'
      ],
      example: 'A premine allocates coins before public mining begins. Kaspa’s launch instead began distributing KAS through public proof-of-work mining.',
      source: { label: 'Kaspa’s official history', url: 'https://www.kaspa.org/lore' },
      checkpoints: [
        { id: 'launch-year', prompt: 'In which year did Kaspa mainnet launch?', choices: ['2009', '2015', '2024', '2021'], correctIndex: 3, explanation: 'Kaspa’s official history places the mainnet launch in November 2021.' },
        { id: 'launch-distribution', prompt: 'Which description matches Kaspa’s initial coin distribution?', choices: ['Public proof-of-work mining, without a premine or presale', 'All KAS was allocated to an app before mining', 'KAS was issued whenever someone answered a quiz', 'Only people buying a founder presale could mine'], correctIndex: 0, explanation: 'Kaspa launched without a premine or presale. KAS entered circulation through proof-of-work mining.' }
      ]
    },
    {
      id: 'signal-crossroads', name: 'The Signal Crossroads', location: 'ARCHIVE 03',
      story: 'Two signs illuminate the final doorway: KAS and GEEK. A.C.E. opens a comparison panel while GIGA waits beside your Geek. “Same ecosystem,” says GIGA, “but the labels matter. Let’s keep their roles clear.”',
      giga: 'You are almost through the archive. Read the asset name and its role before treating two balances as the same thing.',
      objective: 'Distinguish the native coin from an application token.',
      notes: [
        'KAS is the native coin of the Kaspa network. GEEK is an application token using the KRC-20 protocol.',
        'KRC-20 operations are interpreted by an application indexer. An application token’s state is distinct from native KAS consensus.',
        'A GEEK balance and a KAS balance describe different assets. Completing this chapter does not transfer either one.'
      ],
      example: 'A player reads a KAS wallet amount and a GEEK token page. Those are separate balances, even though both relate to the Kaspa ecosystem.',
      source: { label: 'Kasplex wallet integration SDK', url: 'https://github.com/kasplex/sdk-kiwi' },
      additionalSource: { label: 'Geek Protocol token and mint specification', url: '/litepaper/#economy' },
      checkpoints: [
        { id: 'native-coin', prompt: 'Which asset is Kaspa’s native coin?', choices: ['The First Signal badge', 'GEEK', 'KAS', 'A profile sticker'], correctIndex: 2, explanation: 'KAS is the native Kaspa coin. GEEK is a separate application token; the chapter badge is only a profile cosmetic.' },
        { id: 'asset-distinction', prompt: 'A screen shows both KAS and GEEK amounts. What should you remember?', choices: ['They are always one interchangeable balance', 'They are different assets with different roles', 'Completing a lesson automatically transfers both', 'A profile badge proves ownership of either asset'], correctIndex: 1, explanation: 'KAS and GEEK have different roles and balances. This chapter records learning activity and grants an off-chain completion badge, not asset ownership.' }
      ]
    }
  ],
  finish: 'The archive lights connect into one signal. Your Geek has visited every stop. GIGA gives you a small explorer seal: “Keep asking questions. The next idea is waiting.”',
  next: { name: 'Inside the blockDAG', href: '/quest/?chapter=inside-blockdag' }
};

export const insideBlockdag = {
  prerequisite: 'first-signal',
  id: 'inside-blockdag', version: 1, number: 2, title: 'Inside the blockDAG', heading: ['Inside the', 'blockDAG.'], subtitle: 'Follow the links. Find the order.',
  entrance: { title: 'Enter the Signal Foundry.', story: 'Beyond the archive, your Geek discovers a room of suspended blocks. GIGA offers a lantern while A.C.E. brings the connections into view. Follow the links and discover how a graph becomes an ordered ledger.' },
  completedTitle: 'The foundry lights are connected.',
  objective: 'Read parent links, recognize parallel blocks, and explain why a blockDAG still needs consensus ordering.',
  reviewedAt: '2026-10-05',
  badge: { id: 'inside-blockdag', name: 'BlockDAG Pathfinder', description: 'Completed all three stops and six learning checks in the blockDAG chapter.' },
  scenes: [
    {
      id: 'parent-gallery', name: 'The Parent Gallery', location: 'FOUNDRY 01',
      story: 'Your Geek raises GIGA’s lantern. A new block glows above two older blocks, with arrows pointing back to them. “These are references,” GIGA says. A.C.E. labels the older blocks as parents. The foundry has its first clue.',
      giga: 'Follow the arrow from the new block to the blocks it references. Those are its parents.',
      objective: 'Read the direction of a parent reference.',
      notes: ['A block can reference several earlier blocks as parents.', 'Parent links point from a block to the blocks it references.', 'Following parent links takes you into that block’s past.'],
      example: 'C references A and B. A and B are parents of C; C is their child.',
      diagram: 'parents',
      source: { label: 'Michael Sutton: the blockDAG paradigm', url: 'https://michaelsutton.github.io/2022-04-23-kaspa-101-part1/' },
      checkpoints: [
        { id: 'read-parents', prompt: 'C references A and B. Which blocks are C’s parents?', choices: ['Only C', 'A and B', 'Whichever block has a brighter color', 'All future blocks'], correctIndex: 1, explanation: 'Parents are the blocks C directly references: A and B.' },
        { id: 'link-direction', prompt: 'Where does a parent-link arrow from C point?', choices: ['To a future block', 'To a player profile', 'To a referenced earlier block', 'Back to C itself'], correctIndex: 2, explanation: 'A parent link points from C to a block C references in its past.' }
      ]
    },
    {
      id: 'parallel-bridge', name: 'The Parallel Bridge', location: 'FOUNDRY 02',
      story: 'Two platforms light up together. Your Geek finds A on one side and B on the other. Both point back to Genesis. GIGA stretches a bridge between the platforms: “Neither platform is behind the other along a parent path.” A.C.E. names this relationship parallel.',
      giga: 'Two blocks can share a parent without either being in the other’s past.',
      objective: 'Recognize parallel blocks using parent paths.',
      notes: ['Parallel blocks have no parent path from one to the other.', 'A common parent does not order those two blocks relative to each other.', 'A later block can reference both branches.'],
      example: 'A and B both reference Genesis. Neither references the other, even indirectly: they are parallel.',
      diagram: 'parallel',
      source: { label: 'Michael Sutton: parallel blocks and ordering', url: 'https://michaelsutton.github.io/2022-04-23-kaspa-101-part1/' },
      checkpoints: [
        { id: 'parallel-paths', prompt: 'A and B share a parent, with no parent path between them. How are they related?', choices: ['They are the same block', 'They must be invalid', 'One must be the other’s parent', 'They are parallel'], correctIndex: 3, explanation: 'Neither block is in the other’s past or future: they are parallel.' },
        { id: 'merge-references', prompt: 'A later block C references both parallel blocks A and B. What do those links show?', choices: ['C knows about both branches', 'A and B become one identical block', 'Every payment is now guaranteed', 'Parent links point to the future'], correctIndex: 0, explanation: 'The references reveal that C was built with knowledge of A and B.' }
      ]
    },
    {
      id: 'ordering-beacon', name: 'The Ordering Beacon', location: 'FOUNDRY 03',
      story: 'At the center of the foundry, your Geek sees two payment signals claiming the same coin. GIGA pauses at the controls. A.C.E. displays a beacon marked consensus. “The links reveal relationships,” GIGA says. “The network still needs rules for an agreed order.”',
      giga: 'A graph connects the blocks. Consensus gives the ledger an agreed order; validation still decides which transactions are accepted.',
      objective: 'Separate graph structure from consensus ordering and transaction acceptance.',
      notes: ['Kaspa uses proof of work and GHOSTDAG to reach agreement on block ordering.', 'Keeping parallel blocks in a graph does not make every included transaction valid.', 'An agreed order lets nodes resolve conflicting spends. A block’s first appearance is not a promise of irreversible confirmation.'],
      example: 'Two transactions try to spend the same coin. The ledger cannot accept both; nodes apply ordering and validation rules.',
      source: { label: 'PHANTOM / GHOSTDAG consensus research', url: 'https://eprint.iacr.org/2018/104' },
      checkpoints: [
        { id: 'consensus-order', prompt: 'What does GHOSTDAG contribute beyond the graph’s parent links?', choices: ['A guaranteed investment return', 'Free tokens for every block', 'Consensus ordering of blocks', 'A replacement for transaction validation'], correctIndex: 2, explanation: 'GHOSTDAG supplies consensus ordering. Graph links alone do not decide the full ledger order.' },
        { id: 'conflicting-spends', prompt: 'Two transactions in parallel blocks spend the same coin. What should the ledger do?', choices: ['Accept both because both blocks exist', 'Use consensus ordering and validation to resolve the conflict', 'Choose the transaction with the longest name', 'Treat a profile badge as payment proof'], correctIndex: 1, explanation: 'Parallel inclusion does not permit double spending. Ordering and validation determine acceptance; both conflicting spends cannot be accepted.' }
      ]
    }
  ],
  finish: 'Your Geek’s lantern joins the ordering beacon. The foundry is connected: parents, parallel branches, and a shared ledger order. GIGA hands you a Pathfinder seal. “You followed the links. Keep looking for the rules behind the picture.”',
  next: { name: 'Practice blocks, graphs & agreement', href: '/study/?topic=blockdag&level=foundations' }
};

// Ordered public catalog. Server-verified completion unlocks the next chapter.
export const questChapters = [firstSignal, insideBlockdag];
export const getChapter = id => questChapters.find(chapter => chapter.id === id);
export const checksFor = chapter => chapter.scenes.flatMap((scene, sceneIndex) => scene.checkpoints.map(check => ({ ...check, sceneIndex, source: scene.source })));
export const questChecks = checksFor(firstSignal);
