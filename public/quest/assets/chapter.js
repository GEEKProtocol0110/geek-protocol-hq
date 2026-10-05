// Public teaching content, separate from private ranked question banks.
// Story dialogue is authored fiction; learning notes cite primary sources.
export const firstSignal = {
  id: 'first-signal', version: 1, title: 'First Signal', subtitle: 'A Kaspa origins adventure',
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
  next: { name: 'Blocks, graphs & agreement', href: '/study/?topic=blockdag&level=foundations' }
};
export const questChecks = firstSignal.scenes.flatMap((scene, sceneIndex) => scene.checkpoints.map(check => ({ ...check, sceneIndex, source: scene.source })));
