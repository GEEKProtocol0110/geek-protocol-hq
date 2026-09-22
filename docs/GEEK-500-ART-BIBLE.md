# GEEK-500 Art and Lore Bible

## Canon

The Omniscient Grid is a living knowledge network built around one idea: curiosity becomes stronger when it is shared, tested, and preserved.

- **GIGA (#499)** is the community heart. GIGA represents hope, family, culture, persistence, and the human reason Geek Protocol exists.
- **A.C.E. (#500)** is the protocol mind. The Automated Cerebral Emulator coordinates challenges, verifies learning signals, and protects the integrity of the Grid.
- **The Cognoscenti** are learners and builders who strengthen the Grid by proving knowledge and contributing verified questions.
- **The 498 field identities** are the working population of the Grid: archivists, builders, ciphers, explorers, guardians, mentors, operators, scouts, tacticians, and visionaries.

The central conflict is not a war for tokens. It is the fight against the Static: misinformation, forgotten context, manufactured certainty, and systems that reward attention without understanding. Every verified lesson restores part of the signal.

## The eight districts

| District | Learning world | Environment | Visual motif | Credo |
| --- | --- | --- | --- | --- |
| Kaspa Core | Kaspa | Parallel block foundry | Interlocking DAG nodes | Useful work is never wasted. |
| Arcade Foundry | Video Games | Infinite cabinet hall | Pixel circuits | Every failure teaches the next input. |
| Nebula Archive | Science Fiction | Orbital memory library | Star maps | Imagine far enough to find the future. |
| Tech Spire | Technology | Vertical systems laboratory | Stacked logic gates | Understand the tool before trusting it. |
| Cinema Vault | Movies | Frame-sealed screening chamber | Film apertures | Every frame hides a decision. |
| History Relay | History | Chronology transmission station | Layered timelines | Memory is civilization’s checksum. |
| Comic Forge | Comics | Panel-powered fabrication bay | Halftone bursts | A symbol can move a world. |
| Culture Circuit | Pop Culture | Live signal amphitheater | Broadcast waves | Shared knowledge becomes culture. |

## Rarity contract

| Tier | Editions | Count | Aura direction |
| --- | --- | ---: | --- |
| Common | #001–#250 | 250 | Signal Glow |
| Rare | #251–#375 | 125 | Twin Pulse |
| Epic | #376–#450 | 75 | DAG Current |
| Legendary | #451–#490 | 40 | Golden Proof |
| Elite | #491–#498 | 8 | Cognoscenti Crown |
| Mythic | #499–#500 | 2 | Genesis Field |

Rarity changes production complexity and visual presence. It must never create a scoring advantage, payout multiplier, easier questions, or leaderboard benefit.

## Character construction

Every identity has a stable edition, callsign, district, archetype, role, signal, temperament, frame, silhouette, visor, core, tool, pose, aura, motif, and three-color palette. These fields are generated deterministically in `server/geek-collection.js` and published in `public/data/geek-500.json`.

Artists may interpret a field but may not silently rename, renumber, or re-tier an edition. Proposed canon changes require a manifest schema version change and review.

### Archetype silhouettes

| Archetype | Story function | Required silhouette cue |
| --- | --- | --- |
| Archivist | Preserves sources and lost context | Long memory mantle |
| Builder | Turns verified ideas into systems | Heavy utility frame |
| Cipher | Finds patterns inside noisy signals | Narrow stealth chassis |
| Explorer | Maps unknown edges of the Grid | Range-ready scout frame |
| Guardian | Protects fair play and knowledge | Shielded sentinel frame |
| Mentor | Converts hard lessons into clear paths | Open beacon mantle |
| Operator | Keeps critical Grid systems online | Modular control rig |
| Scout | Detects new questions early | Light antenna frame |
| Tactician | Plans routes through uncertainty | Layered command shell |
| Visionary | Models futures not yet reached | Halo projection frame |

## Art production specification

- Master canvas: 2048 × 2048 pixels, square, layered source retained.
- Delivery image: 1024 × 1024 PNG, sRGB, no embedded private author data.
- Thumbnail QA: readable at 160 × 160 pixels.
- Safe area: face, core, and primary tool stay inside the central 80 percent.
- Background: district environment must remain distinguishable without competing with the silhouette.
- Lighting: cypherpunk neon with Kaspa cyan as a recurring network signal; district palettes provide differentiation.
- Branding: no third-party logos, copied characters, unlicensed marks, or token imagery that implies endorsement.
- Accessibility: every edition receives a concise alt description and non-color trait labels.
- Source record: creator, creation date, tool disclosure, license confirmation, review notes, and version.

## Review states

1. `design-pending` — structured slot exists; no finished image claim.
2. `draft` — source art exists but is not public collection art.
3. `lore-review` — district, role, traits, and accessibility checked.
4. `visual-review` — silhouette, palette, originality, and small-size readability checked.
5. `approved` — final source accepted; still not an NFT.
6. `hashed` — delivery image and metadata have recorded SHA-256 values.
7. `frozen` — collection-wide provenance manifest published; edits require a new public version.
8. `deployment-approved` — independent audit and governance sign-off completed.

The public explorer currently shows `design-pending` for editions #001–#498 and `anchor-concept` for GIGA and A.C.E. No edition is `approved`, `hashed`, `frozen`, minted, or transferable.

## Metadata contract

Each record contains:

- immutable collection symbol, ID, edition number, and name;
- description, district, category, discipline, role, lore sector, home, credo, dispatch, and alignment;
- standardized NFT-style attributes;
- expected source, image, and metadata paths;
- image and metadata hash fields, initially `null`;
- explicit competitive-advantage, payout-multiplier, and on-chain-ownership flags;
- an external URL that resolves to the edition in the official explorer.

`metadata.image` remains `null` until an edition passes art review. Placeholder paths are production instructions, not ownership or mint claims.

## Kaspa deployment gates

The collection is Kaspa-ready, not Kaspa-deployed. Any future KRC-721 or marketplace layer is an external application-layer dependency and must not be presented as Kaspa consensus.

Before deployment:

- approve all 500 original images and metadata records;
- independently review originality and license provenance;
- hash every asset and publish a reproducible collection root;
- pin the network, standard version, deployment transaction, supply, authority, royalty, and metadata mutability policy;
- verify wallet ownership server-side using single-use signed challenges;
- define indexer disagreement and outage behavior;
- implement transfer, listing, recovery, compromised-wallet, and delisting threat controls;
- commission an independent application and deployment audit;
- run a public review period before any mint opens.

Until those gates pass, the website must keep `configured`, `onChainOwnershipActive`, `metadataFrozen`, and `independentlyAudited` set to `false`.
