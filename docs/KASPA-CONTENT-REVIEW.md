# Kaspa Content Review — October 1, 2026

This internal primary-source check covers the 80 underlying concepts represented by 1,000 core practice variants and the 32 current-topic items. It is not independent editorial approval, a claim of 1,032 unique questions, or an authorization for monetary rewards. The seven other category banks remain outside this review.

## Sources and corrections

| Source | Review focus |
| --- | --- |
| [Kaspa lore](https://kaspa.org/lore/) and [tokenomics](https://wiki.kaspa.org/en/tokenomics) | Launch, mining distribution, emission, approximate supply |
| [PHANTOM/GHOSTDAG paper](https://eprint.iacr.org/2018/104) | Authorship, ordering, anticones, blue/red classification, probabilistic security |
| [Original GHOST paper](https://eprint.iacr.org/2013/881) | Correct research lineage; GHOST is not GHOSTDAG |
| [DAGKnight paper](https://eprint.iacr.org/2022/1494) and [KIP-2](https://github.com/kaspanet/kips/blob/master/kip-0002.md) | Research proposal versus activation; no invented launch date |
| [Rusty Kaspa](https://github.com/kaspanet/rusty-kaspa), its constants, address implementation, and coinbase rules | Node software, sompi, prefixes, checksum, DAG-specific rewards |
| [KIP repository](https://github.com/kaspanet/kips), especially KIP-5 and KIP-14 | Message signatures versus transactions; Crescendo and average 10 BPS |
| [Kaspa builder docs](https://docs.kaspa.org/) | Native UTXO builder stack and Silverscript; future architecture must not be presented as activated |
| [Kasplex SDK](https://github.com/kasplex/sdk-kiwi) | KRC-20 deploy, mint, transfer, and indexer interfaces |
| [Ethereum scaling docs](https://ethereum.org/developers/docs/scaling/) | Generic Layer 2 definition; token protocols alone are not Layer 2 systems |

Clarifications include: blue does not guarantee that a miner is honest; red does not automatically invalidate every transaction; parallel block inclusion does not accept conflicting spends; 100 ms is an average target; the commonly quoted supply is approximate; a checksum cannot verify the intended recipient; signatures prove control for a particular message; majority work does not expose private keys; and proof-of-work finality is probabilistic.

The fee question now states that it is a conventional linear-chain example and explains Kaspa's different mergeset rewards. All existing answer options and correct indices were preserved to keep in-flight ranked grading compatible with the updated bank. Prompt corrections retain variant prefixes.

## Reproducibility and remaining work

The original review was recorded in Git history. After October 7 maintenance, `scripts/review-kaspa-content.mjs` verifies banks without rewriting evidence or dates. Future changes require fresh source assessment and individual review dates.

Automatic tests validate IDs, answer schemas, HTTPS sources, 80 concept identities, and consistent options and answers across variants. Study draws only distinct canonical concepts. These checks do not establish factual correctness by themselves.

Independent item-level editorial review remains necessary, especially for variant wording and future monetary incentives. Proposal status, protocol releases, source links, and time-sensitive developer-stack descriptions should be rechecked before publication of further updates. The source labels describe internal evidence, not certification or an external audit.

## Guided lesson extension — October 2, 2026

Eight authored lessons add objectives, teaching steps, worked examples, and ungraded reflection prompts in `server/study-lessons.js`. The launch, graph ordering, emission, wallet, indexer, and confirmation explanations follow the primary sources above. Lore, the GHOSTDAG paper, node documentation, KIP-5, KIP-14, integration documentation, tokenomics, and Kasplex interfaces were checked for this extension. It introduces no new ranked answer keys and preserves all existing bank IDs, options, grading, and active-run selections.

Practice-level selection exposes the existing easy and medium tags plus a mixed pool. Names/definitions and safety form Foundations; mechanisms, unit relationships, and practical distinctions form Connections; technical concepts remain in Mixed. These criteria describe the present introductory bank. Some existing assignments (for example historical dates) still need a full item-level difficulty calibration. No separate hard-only pool is offered because not every topic has hard-tagged concepts. Independent editorial approval remains outstanding.

## Distinct question extension — October 7, 2026

The historical 1,000-variant bank described above has been retired from active selection. At the October 7 expansion milestone, Kaspa had 184 distinct active questions (166 core, 18 current), twice its cleaned 92-concept baseline. Ninety-two new original questions were checked against official integration documentation and pinned node/KIP source snapshots. Dates are retained per item. See [Question Maintenance](QUESTION-MAINTENANCE.md) for the complete audit, compatibility boundary, sources, and limits.

### KRC-20 follow-up — October 8, 2026

Ten distinct, original source-checked questions bring Kaspa to 194 active questions (176 core, 18 current). They add protocol data, explicitly scoped Kiwi SDK behavior and community project facts. Sources and the pinned SDK commit are recorded in Question Maintenance; existing and retired records are unchanged.

### Focused editorial follow-up — October 8, 2026

This pass checks **33 existing questions**: `KASPA-0626`–`KASPA-0635`, all ten `KRC20-2026` items, and thirteen Toccata items (`KCUR-0003`, `0004`, `0009`, `0010`, `0012`–`0018`, `0021`, `0022`). It improves prompts, source specificity and explanations. The [item-level register](kaspa-editorial-review-2026-10-08.json) records each source, decision, difficulty change, and before/after SHA-256 of the complete question JSON. These are internal editorial decisions, not independent approval.

| Evidence | Review decision |
| --- | --- |
| [Kiwi SDK](https://github.com/kasplex/sdk-kiwi/tree/06dc75ea1066aba4d78eb32711690f6f123a9575) | Scope field spelling and P2SH/direct-payload paths to this snapshot. Explain that `validateDec` checks numeric bounds without establishing complete decimal validity. |
| [Kasplex executor](https://github.com/kasplex/indexer-executor/tree/0e4ee46fb6e7a148dfff38bac78bd8415c312c15) | Check deployment modes, mint limits and indexed balance transfers. This archived reference is evidence for these mechanics, not a claim about today's operated service. |
| [Fungible token definition](https://ethereum.org/developers/docs/standards/tokens/erc-20/) and [scaling guide](https://ethereum.org/developers/docs/scaling/) | Specify interchangeability within one token; distinguish a token format from Layer 2 execution/security. |
| [Kaspa lore](https://kaspa.org/lore/) and [Toccata source map](https://docs.kaspa.org/toccata/references) | Recheck activation markers; use specific transaction, covenant, pricing, proof and authoring pages for the respective questions. Explain lineage versus transition validation and L1 ordering versus off-chain execution. |
| [Programmability overview](https://docs.kaspa.org/programmability) | Preserve the distinction between current options and Full vProgs as a future direction. Argent remains described as experimental in its specific guide. |
| [KaspaCom](https://kaspa.com/tokens/marketplace), [Nacho](https://nachothekat.xyz/) and [Kaspy](https://kaspy.io/) | Describe the marketplace's purpose, attribute Kat Bot capabilities to its publisher, and identify Kaspy's story as project lore. No product transaction or bot was tested. |

The Kasplex GitBook landing pages redirected to an inaccessible editor surface and were not counted as checked evidence. The SDK and executor source above were inspected instead. Current web documentation was checked on the item review date; it remains subject to change. Pinning implementation evidence does not establish indexer acceptance for another version.

Ten difficulty labels change using these editorial criteria: basic definitions and operation/project recognition are easy; interpreting one mechanism or scoped SDK rule is medium; specialist implementation/numeric recall and comparisons across layers remain hard. This is provisional classification, not calibration from player performance. Kaspa now has **71 easy, 82 medium and 41 hard** active questions, retaining the complete 30/40/30 Gauntlet capacity. Study's Foundations and Connections pools follow the revised labels for future selections.

All 194 Kaspa concepts and the 7,786-question total remain. IDs, concept IDs, answer options/order, correct indices and retired records are unchanged. No duplicate concept or replacement was needed in this batch. Existing issued questions keep the same answer mapping; snapshots already held by shared modes retain their wording. Future selections can use the revised tiers. The broader imported-bank review remains unfinished.

Validation: the full repository verification passes with 232 tests, zero failures and zero skips, using isolated real Redis. Question checks cover schemas, duplicate screening, historical answer compatibility, count metadata and Gauntlet capacity; the dependency audit reports zero vulnerabilities. This change introduces no new interface. No live-site browser, bot, wallet or transfer test was performed for this pass.
