# Kaspa Basics Gauntlet — source notes (draft, October 29, 2026)

The KGNT-0001..0100 set is **practice-only and unranked** (`practiceOnly: true` on the file and every row). Rows stay `draft-needs-human-review`: these notes are internal pre-review checks, not a source-checked status change. Practice-only rows are excluded from ranked/daily/lobby/duel/royale selection and from generated "sourced"/readiness counts.

| Item | Claim | Verdict | Primary source |
| --- | --- | --- | --- |
| KGNT-0035 | PHANTOM paper first posted 2018 | Correct (ePrint received 2018-01-30) | https://eprint.iacr.org/2018/104 |
| KGNT-0078 | Exact PHANTOM (max k-cluster) is NP-hard | Correct (abstract: "Implementing PHANTOM requires solving an NP-hard problem") | https://eprint.iacr.org/2018/104 |
| KGNT-0082 | SPECTRE lacks a full linear order | Correct (SPECTRE decides order only for honest users' transactions; PHANTOM "provides a robust total order") | https://eprint.iacr.org/2016/1159 ; https://eprint.iacr.org/2018/104 |
| KGNT-0077 | GHOSTDAG is greedy: extends the selected parent's blue set instead of solving globally | Correct | https://eprint.iacr.org/2018/104 ; https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/consensus/src/processes/ghostdag/protocol.rs |
| KGNT-0064 | Blue score counts blue blocks in a block's past | Correct (selected parent's blue score + mergeset blues) | https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/consensus/src/processes/ghostdag/protocol.rs |
| KGNT-0037 | Selected parent = parent with most blue work | Correct (`find_selected_parent` maxes blue_work) | https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/consensus/src/processes/ghostdag/protocol.rs |
| KGNT-0093 | Schnorr is the default address signature scheme | Correct (Version::PubKey=0 is Schnorr; PubKeyECDSA=1 is the alternative) | https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/crypto/addresses/src/lib.rs |
| KGNT-0091 | kHeavyHash uses cSHAKE256 | Correct (cSHAKE256 "ProofOfWorkHash" / "HeavyHash" states) | https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/crypto/hashes/src/pow_hashers.rs |
| KGNT-0060 | Coinbase maturity 1,000 blocks | Correct only at 10 BPS (BPS x 100 s); prompt now scoped to mainnet's 10 BPS | https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/consensus/core/src/config/bps.rs ; https://github.com/kaspanet/rusty-kaspa/blob/4edcbbccb449f84832afb1ca157904b35f37d006/consensus/core/src/config/params.rs |
| KGNT-0025 | KRC-20 burn destroys tokens | Correct (subtracts from sender balance, adds to token Burned) | https://github.com/kasplex/indexer-executor/blob/0e4ee46fb6e7a148dfff38bac78bd8415c312c15/operation/op_burn.go |
| KGNT-0047 | KRC-20 list offers tokens for sale | Correct; explanation refined (moves amount from balance to locked, records a market order) | https://github.com/kasplex/indexer-executor/blob/0e4ee46fb6e7a148dfff38bac78bd8415c312c15/operation/op_list.go |
| KGNT-0057 | KasWare getAccounts reads connected account(s) | Correct; explanation refined (returns current account address array; used to check connection) | https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-connection |

Also fixed: KGNT-0094 explanation misquoted the paper title (now "PHANTOM and GHOSTDAG: A Scalable Generalization of Nakamoto Consensus"). The set's review notice no longer contains reward/payout language. The ePrint PDF was behind a browser challenge; claims above rely on the ePrint abstract pages and pinned code.
