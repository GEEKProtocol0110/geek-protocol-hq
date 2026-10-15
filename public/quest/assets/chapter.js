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
  next: { name: 'Keys to the Grid', href: '/quest/?chapter=keys-to-the-grid' }
};

export const keysToTheGrid = {
  prerequisite: 'inside-blockdag',
  id: 'keys-to-the-grid', version: 1, number: 3, title: 'Keys to the Grid', heading: ['Keys to', 'the Grid.'], subtitle: 'Read the request. Protect the key.',
  entrance: { title: 'The Guardian station awaits.', story: 'Your Geek arrives at a station with three doors. GIGA brings the lantern; A.C.E. projects a fictional wallet request. Each door asks you to make a decision. Everything here is a learning example—there is no wallet connection or signing request.' },
  completedTitle: 'The Guardian station is secure.',
  objective: 'Distinguish public addresses from secret recovery material, separate message signing from transactions, and inspect a request before approving it.',
  reviewedAt: '2026-10-06',
  badge: { id: 'keys-to-the-grid', name: 'Grid Guardian', description: 'Visited all three Guardian stops and completed six wallet-safety decisions.' },
  scenes: [
    {
      id: 'key-room', name: 'The Key Room', location: 'GUARDIAN 01',
      story: 'A visitor offers your Geek an explorer seal in exchange for a recovery phrase. GIGA lowers the lantern. “A label on a doorway does not make a request safe.” A.C.E. highlights the difference between an address and a secret.',
      giga: 'Your address can receive a payment. Your recovery phrase can restore control of a wallet. Keep that secret out of chat and websites.',
      objective: 'Choose what can be shared and what must stay private.',
      notes: ['A public receiving address identifies a destination; sharing it does not share a private key.', 'Recovery phrases and private keys are secret wallet material. Someone with them may gain control of the wallet.', 'Kasware keeps recovery material on the device and cannot recover a lost phrase for you. Follow the wallet’s own backup instructions.'],
      example: 'A fictional reward page asks for your recovery phrase. Decline the request. A receiving address and a recovery phrase have different jobs.',
      source: { label: 'Kasware: wallet keys and privacy', url: 'https://docs.kasware.xyz/wallet/other/privacy-policy' },
      checkpoints: [
        { id: 'secret-request', prompt: 'A page offers a badge if you paste your recovery phrase. What do you do?', choices: ['Paste only half the phrase', 'Decline and leave the page', 'Send the phrase in a private chat', 'Share it because the page has a logo'], correctIndex: 1, explanation: 'A badge never needs secret wallet recovery material. Decline the request and keep the phrase private.' },
        { id: 'receiving-address', prompt: 'Which item identifies where a KAS payment can be received without revealing the private key?', choices: ['A recovery phrase', 'An account password', 'A public receiving address', 'A private key'], correctIndex: 2, explanation: 'A public receiving address is the destination. Recovery phrases, passwords and private keys are not receiving addresses.' }
      ]
    },
    {
      id: 'signature-gate', name: 'The Signature Gate', location: 'GUARDIAN 02',
      story: 'Two fictional panels appear: “Prove key control” and “Send payment.” Your Geek pauses. GIGA asks you to read them aloud. A.C.E. shows that a message signature and a transaction signature serve different purposes.',
      giga: 'Read what the wallet is asking you to sign. A proof of key control is different from authorizing a payment.',
      objective: 'Distinguish a message signature from a transaction approval.',
      notes: ['Kaspa’s KIP-5 defines a message-signing standard for proving access to a key without revealing it.', 'KIP-5 separates message signatures from transaction signatures through a distinct hashing domain.', 'A valid signature is evidence about a key and message. It does not prove that a website is trustworthy or that its promises are true.'],
      example: 'An app asks for an identity message, but the wallet displays a payment request. Decline the mismatch instead of approving it automatically.',
      source: { label: 'Kaspa KIP-5: Message Signing', url: 'https://github.com/kaspanet/kips/blob/master/kip-0005.md' },
      checkpoints: [
        { id: 'signature-purpose', prompt: 'What can a verified KIP-5 message signature demonstrate?', choices: ['Guaranteed investment returns', 'That all websites are safe', 'That a quiz sent a payment', 'Access to the key associated with that message'], correctIndex: 3, explanation: 'The verifier checks the message and public key. This demonstrates key access, without publishing the private key.' },
        { id: 'approval-mismatch', prompt: 'You expect an identity message, but the wallet asks to send KAS. What is the sensible next action?', choices: ['Decline and inspect the mismatch', 'Approve because both involve signatures', 'Share the recovery phrase to fix it', 'Approve twice to be sure'], correctIndex: 0, explanation: 'The displayed request should match the intended action. A payment approval is different from a message proof.' }
      ]
    },
    {
      id: 'verification-dock', name: 'The Verification Dock', location: 'GUARDIAN 03',
      story: 'Your Geek reaches the final dock. A fictional payment screen lists an amount, recipient and fee. GIGA keeps the launch button covered while A.C.E. asks you to compare the details with your intent. The mission is to make a deliberate choice.',
      giga: 'Slow down at the approval screen. Read the recipient, amount and fee before deciding.',
      objective: 'Inspect the request instead of trusting the appearance of the app.',
      notes: ['A wallet manages keys and accounts and builds transactions for destinations and amounts.', 'Check the recipient, amount and network fee shown by the wallet against the action you intended.', 'If details are unexpected or unclear, cancel and investigate. A successful signature does not correct a wrong destination.'],
      example: 'You intend to pay one recipient, but the confirmation shows another. Stop before approving; do not treat the app’s branding as verification.',
      source: { label: 'Kaspa developer docs: wallet and transaction flow', url: 'https://docs.kaspa.org/integrate/wallet' },
      checkpoints: [
        { id: 'inspect-payment', prompt: 'Which details belong in your check before a payment approval?', choices: ['Only the website color', 'Only your profile level', 'Recipient, amount and network fee', 'Only the badge offered afterward'], correctIndex: 2, explanation: 'Compare the displayed payment details with your intended action before approval.' },
        { id: 'unexpected-recipient', prompt: 'The confirmation displays an unexpected recipient. Which choice protects your intent?', choices: ['Approve and hope it is a display issue', 'Cancel and verify the destination', 'Post your private key to ask for help', 'Ignore the recipient if the fee is small'], correctIndex: 1, explanation: 'Cancel and investigate a mismatch. A valid signature cannot turn an unintended recipient into the intended one.' }
      ]
    }
  ],
  finish: 'The station doors open. Your Geek kept secrets private, distinguished a message from a payment, and inspected the final request. GIGA offers the Grid Guardian seal. “A good explorer knows when to pause.” No real wallet was needed for this journey.',
  next: { name: 'Value in Motion', href: '/quest/?chapter=value-in-motion' }
};

export const valueInMotion = {
  "prerequisite": "keys-to-the-grid",
  "id": "value-in-motion",
  "version": 1,
  "number": 4,
  "title": "Value in Motion",
  "heading": [
    "Value in",
    "Motion."
  ],
  "subtitle": "Follow the inputs. Account for the change.",
  "entrance": {
    "title": "Enter the Transaction Workshop.",
    "story": "GIGA leads your Geek into a workshop of glowing coin tiles. A.C.E. projects fictional payments so you can trace inputs, outputs and fees. This chapter builds no real transaction and asks for no wallet approval."
  },
  "completedTitle": "Every tile has a destination.",
  "objective": "Trace unspent outputs, account for recipient/change/fee amounts, and distinguish submission from accepted transaction evidence.",
  "reviewedAt": "2026-10-11",
  "badge": {
    "id": "value-in-motion",
    "name": "Value Pathfinder",
    "description": "Completed three transaction-workshop stops and six learning checks."
  },
  "scenes": [
    {
      "id": "input-workbench",
      "name": "The Input Workbench",
      "location": "WORKSHOP 01",
      "story": "Three coin tiles rest on the workbench. Your Geek chooses one, and GIGA traces its place in an earlier transaction. A.C.E. marks the tile as unspent. It can be an input only while that output remains available.",
      "giga": "A balance is a total. Each input points to a particular unspent output.",
      "objective": "Separate a displayed balance from individual spendable outputs.",
      "notes": [
        "UTXO means unspent transaction output. A wallet balance can combine many such outputs.",
        "An input consumes a particular existing output, identified by its transaction ID and output index.",
        "A consumed output cannot be reused. A transaction creates new outputs for its destinations."
      ],
      "example": "A fictional wallet has two outputs of 3 KAS and 5 KAS. Together they total 8 KAS, but they remain two separate outputs.",
      "source": {
        "label": "Kaspa UTXO reference",
        "url": "https://wiki.kaspa.org/en/utxo"
      },
      "checkpoints": [
        {
          "id": "balance-pieces",
          "prompt": "Two unspent outputs hold 3 KAS and 5 KAS. What does an 8 KAS balance represent?",
          "choices": [
            "One secret recovery phrase",
            "The total of two separate outputs",
            "A guarantee of a fixed fee",
            "A newly mined block"
          ],
          "correctIndex": 1,
          "explanation": "The displayed total adds two outputs. The total does not turn them into one existing output."
        },
        {
          "id": "already-spent",
          "prompt": "A transaction has consumed an output. Can a second valid transaction spend that same original output again?",
          "choices": [
            "Yes, if it has a different logo",
            "Yes, if the amount is small",
            "No, it has already been spent",
            "Only after changing the wallet nickname"
          ],
          "correctIndex": 2,
          "explanation": "An input must refer to an available unspent output. Reusing a spent output would conflict with the ledger state."
        }
      ]
    },
    {
      "id": "change-counter",
      "name": "The Change Counter",
      "location": "WORKSHOP 02",
      "story": "GIGA slides an 8 KAS tile to the counter. A.C.E. sketches 3 KAS for a fictional recipient, 4.99 KAS in change, and a 0.01 KAS fee. Your Geek follows every part of the value. The figures are teaching examples, not a quote for a real payment.",
      "giga": "Count all outputs, including change. The difference between inputs and all outputs is the fee.",
      "objective": "Reconcile a fictional payment without confusing change with fees.",
      "notes": [
        "Transaction fees are the sum of input amounts minus the sum of all output amounts.",
        "Change is a new output returning value left after the recipient amount and fee.",
        "Real fees depend on the proposed transaction and network rules. A classroom example is not a wallet fee estimate."
      ],
      "example": "8 KAS in inputs minus 3 KAS to a recipient minus a 0.01 KAS fee leaves 4.99 KAS of change.",
      "source": {
        "label": "Kaspa SDK: transaction fee accounting",
        "url": "https://kaspa.aspectron.org/transactions/fees/index.html"
      },
      "checkpoints": [
        {
          "id": "change-value",
          "prompt": "In this fictional example, 8 KAS funds 3 KAS to a recipient and a 0.01 KAS fee. What is the change?",
          "choices": [
            "8 KAS",
            "5.01 KAS",
            "3 KAS",
            "4.99 KAS"
          ],
          "correctIndex": 3,
          "explanation": "8 minus 3 minus 0.01 is 4.99 KAS. This arithmetic example does not establish a real transaction’s fee."
        },
        {
          "id": "fee-value",
          "prompt": "A transaction has 10 KAS in inputs and 9.99 KAS across all outputs. What is its fee?",
          "choices": [
            "0.01 KAS",
            "9.99 KAS",
            "10 KAS",
            "19.99 KAS"
          ],
          "correctIndex": 0,
          "explanation": "Subtract all outputs from the inputs: 10 minus 9.99 equals 0.01 KAS. A change output is included in that output total."
        }
      ]
    },
    {
      "id": "receipt-observatory",
      "name": "The Receipt Observatory",
      "location": "WORKSHOP 03",
      "story": "At the final station, a display says request sent while another tracks accepted transactions. GIGA asks your Geek to compare the two. A.C.E. records a checkpoint for its reader and watches for changes to the accepted path.",
      "giga": "A sent request and accepted transaction evidence describe different stages. Read what the receipt actually establishes.",
      "objective": "Recognize acceptance evidence and why transaction readers reconcile changes.",
      "notes": [
        "An application can follow accepted transaction IDs or request fuller transaction data through the node API.",
        "A request submission alone does not establish every later acceptance or application-token outcome.",
        "Readers save processing checkpoints and handle removed accepting blocks. Near the tips, confirmation buffers help account for changing state."
      ],
      "example": "A fictional app loses its reply after a submission. The learner checks transaction evidence instead of assuming that sending the same request again is necessary.",
      "source": {
        "label": "Kaspa developer guide: accepted transactions",
        "url": "https://docs.kaspa.org/integrate/accepted-transactions"
      },
      "checkpoints": [
        {
          "id": "submission-stage",
          "prompt": "An app says request sent. What additional evidence would establish native transaction acceptance?",
          "choices": [
            "A brighter button",
            "A higher player level",
            "Accepted transaction data from the network",
            "A copied app logo"
          ],
          "correctIndex": 2,
          "explanation": "Submission and acceptance are different stages. Accepted transaction data provides evidence about the network’s processing."
        },
        {
          "id": "reader-reconcile",
          "prompt": "A reader’s accepted path later removes a block it processed. What should the reader do?",
          "choices": [
            "Keep every derived record forever without checking",
            "Reconcile records tied to that removed block",
            "Invent a replacement receipt",
            "Ask for the user’s recovery phrase"
          ],
          "correctIndex": 1,
          "explanation": "The developer guide treats removed blocks as rollback input. A reader must reconcile derived data rather than assume the active path can never change."
        }
      ]
    }
  ],
  "finish": "Every glowing tile now has a destination. Your Geek traced unspent outputs, accounted for change and fees, and read acceptance evidence. GIGA offers the Value Pathfinder seal. “Good explorers follow the value and check the evidence.”",
  "next": {
    "name": "Explore tokens & indexers",
    "href": "/study/?topic=tokens&level=foundations"
  }
};

// Ordered public catalog. Server-verified completion unlocks the next chapter.
export const questChapters = [firstSignal, insideBlockdag, keysToTheGrid, valueInMotion];
export const getChapter = id => questChapters.find(chapter => chapter.id === id);
export const checksFor = chapter => chapter.scenes.flatMap((scene, sceneIndex) => scene.checkpoints.map(check => ({ ...check, sceneIndex, source: scene.source })));
export const questChecks = checksFor(firstSignal);
