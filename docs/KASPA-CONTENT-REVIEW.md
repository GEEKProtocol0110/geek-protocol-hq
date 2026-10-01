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

`scripts/review-kaspa-content.mjs` records this specific review's corrections and metadata. It is idempotent. Running it again does not fetch new sources or conduct a new review; future changes require a fresh human assessment and date.

Automatic tests validate IDs, answer schemas, HTTPS sources, 80 concept identities, and consistent options and answers across variants. Study draws only distinct canonical concepts. These checks do not establish factual correctness by themselves.

Independent item-level editorial review remains necessary, especially for variant wording and future monetary incentives. Proposal status, protocol releases, source links, and time-sensitive developer-stack descriptions should be rechecked before publication of further updates. The source labels describe internal evidence, not certification or an external audit.
