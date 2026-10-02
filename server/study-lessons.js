// Authored teaching support for the source-checked introductory Study bank.
// These are learning objectives and worked examples, not ranked assessments.
export const guidedLessons = {
  origins: {
    objective: 'Separate Kaspa’s research, fair launch, and native coin from the apps built on it.',
    steps: [
      { title: 'Start with the research', text: 'PHANTOM and GHOSTDAG explore how proof-of-work blocks can be ordered when miners produce blocks in parallel. Kaspa is a network built from that research lineage.' },
      { title: 'Understand the launch', text: 'Kaspa mainnet launched in 2021 without a premine or presale. Public proof-of-work mining began distributing the native coin, KAS.' },
      { title: 'Keep the assets separate', text: 'KAS is Kaspa’s native coin. GEEK is an application token using KRC-20. Sharing the network does not make the two assets interchangeable.' }
    ],
    example: 'A GEEK token page and a KAS wallet balance describe different assets. Read the ticker and protocol before treating them as the same balance.',
    reflection: 'How would you explain the difference between Kaspa, KAS, and GEEK to a new learner?'
  },
  blockdag: {
    objective: 'Explain why parallel blocks still need a consistent order.',
    steps: [
      { title: 'Picture a graph', text: 'A directed acyclic graph has links with a direction and no directed cycles. In a blockDAG, blocks point to predecessors; more than one valid block can be created at about the same time.' },
      { title: 'Add an ordering rule', text: 'GHOSTDAG derives an agreed ordering from the graph. Parallel production is useful, but applications still need a consistent history for deciding which conflicting spend can be accepted.' },
      { title: 'Use classifications carefully', text: 'Blue and red describe how blocks fit the algorithm’s structural rules. A color alone does not prove that a miner is honest or malicious.' }
    ],
    example: 'Two miners can find valid blocks before hearing from one another. Keeping both blocks in the graph still leaves consensus the job of ordering their transactions.',
    reflection: 'Why does accepting parallel blocks not mean accepting two spends of the same output?'
  },
  mining: {
    objective: 'Distinguish proof of work, network hashrate, and a target block rate.',
    steps: [
      { title: 'Work secures block production', text: 'Kaspa miners perform proof-of-work computation using kHeavyHash. Hashrate measures the rate of hashing; it is different from transaction volume.' },
      { title: 'A target is an average', text: 'Crescendo raised the target rate to 10 blocks per second. The corresponding average target interval is one tenth of a second, but actual arrivals vary.' },
      { title: 'Difficulty responds to mining conditions', text: 'The difficulty adjustment algorithm changes the required work as mining conditions change. More hashrate does not mean an unlimited number of accepted blocks per second.' }
    ],
    example: 'Ten blocks per second is a target over time. A short gap between blocks does not by itself mean that the network failed.',
    reflection: 'What is the difference between a target interval and a guaranteed schedule?'
  },
  emission: {
    objective: 'Read KAS amounts and explain how new issuance differs from transaction fees.',
    steps: [
      { title: 'Read the units', text: 'One KAS equals 100 million sompi. Sompi let amounts be expressed as whole numbers at eight decimal places.' },
      { title: 'Follow the issuance schedule', text: 'Kaspa has no premine. During its chromatic phase, the scheduled subsidy declines monthly at a rate that halves it over a year.' },
      { title: 'Separate subsidy from fees', text: 'A block subsidy creates new coins under the emission rules. A transaction fee pays from existing coins. A declining subsidy does not make those two things identical.' }
    ],
    example: '0.5 KAS is 50 million sompi. Moving that amount transfers existing coins; it does not create a new block subsidy.',
    reflection: 'Which changes the issued supply: transferring existing KAS, or a mining subsidy?'
  },
  wallets: {
    objective: 'Recognize what is public, what is secret, and what a wallet approval authorizes.',
    steps: [
      { title: 'Know your outputs', text: 'Kaspa uses unspent transaction outputs, or UTXOs. A transaction spends outputs and creates new ones; unused value can return as a change output.' },
      { title: 'Protect signing access', text: 'A public address can receive funds. A private key authorizes signatures. A seed phrase can restore signing access, so never paste it into a website or share it with a stranger.' },
      { title: 'Read every approval', text: 'A message signature can demonstrate access to a key. A checksum can catch typing mistakes. Neither tells you that an unknown website or recipient is trustworthy. Read the requested message or transaction.' }
    ],
    example: 'An address can pass its checksum and still belong to the wrong person. Compare the recipient, network, amount, and fee before approving a transfer.',
    reflection: 'Why is a valid-looking address not enough to approve a transaction?'
  },
  tokens: {
    objective: 'Distinguish token operations, indexer state, and the native Kaspa network.',
    steps: [
      { title: 'Understand fungible units', text: 'A fungible token has interchangeable units of the same token. A ticker names the token; it does not by itself establish that a project is trustworthy.' },
      { title: 'Separate the operations', text: 'A KRC-20 deployment establishes token parameters. Mint creates units within those rules. Transfer moves units between holders.' },
      { title: 'Locate the indexer', text: 'A KRC-20 indexer reads and interprets application token operations recorded through Kaspa transactions. Its token view is separate from native KAS consensus.' }
    ],
    example: 'If a token balance cannot be read because an indexer is unavailable, that does not establish that Kaspa stopped producing blocks. Check the application data service separately.',
    reflection: 'Which service would you investigate first if native transactions work but a token balance is unavailable?'
  },
  ecosystem: {
    objective: 'Choose the right tool for observing, integrating, or experimenting with Kaspa.',
    steps: [
      { title: 'Observe and verify', text: 'An explorer displays network data. A full node independently checks consensus rules. Seeing a page and running a validating node serve different purposes.' },
      { title: 'Connect an application', text: 'RPC provides an interface for applications to communicate with a node. Applications should handle connection failures rather than treating one unavailable provider as the whole network.' },
      { title: 'Experiment and check proposals', text: 'Testnet uses test coins for experimentation. KIPs document proposals and changes publicly; a proposal’s existence is not proof that it has activated on mainnet.' }
    ],
    example: 'Before trying a wallet integration, confirm that its node, wallet, and coins all use the same test network. Then consult the current SDK documentation.',
    reflection: 'What evidence would you seek before saying a proposed upgrade is live?'
  },
  fundamentals: {
    objective: 'Connect signatures, transaction ordering, and confirmation confidence.',
    steps: [
      { title: 'Authorize and verify', text: 'Private keys authorize signatures; public keys support verification. A cryptographic hash gives data a compact fingerprint, but is not an encryption tool for hiding a seed phrase.' },
      { title: 'Resolve conflicting spends', text: 'A double spend tries to use the same value more than once. Consensus gives participants a consistent history so conflicting spends do not both become accepted payments.' },
      { title: 'Understand confidence', text: 'Proof-of-work confirmation confidence strengthens with accumulated work. Finality is not a promise of zero reversal risk. Self-custody means retaining control of your keys and the responsibility that comes with them.' }
    ],
    example: 'A signed transaction proves authorization under its rules. It still needs network acceptance; signing alone does not establish final settlement.',
    reflection: 'How do authorization and confirmation answer different questions about a payment?'
  }
};
