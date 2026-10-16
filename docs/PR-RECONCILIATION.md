# Older PR reconciliation — October 16, 2026

Reviewed against main `a7eaca32908b30214aaf04730f485c851963ee30`. [Machine-readable inventory](continuity/pr-reconciliation.json) records every changed path and Git blob from both exact PR heads; fetched Git objects were checked against those blob IDs. This is a source disposition review, not a security audit or acceptance of the unmerged features.

## PR #119: superseded merge candidate

[PR #119](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/119), head `3b291065aad6dd2901225ab2f83100cb0277030b`, mixes older passkeys, infrastructure changes and three still-unshipped feature groups. It was closed as superseded during #139 while retaining `codex/five-leaps` and the exact source. Do not merge its old authentication, continuity or configuration files over main.

| Area | Disposition | Resume requirement |
| --- | --- | --- |
| Passkey and identity code | Superseded by focused PR #124 and later #125/#127 reliability/security changes | Preserve main and AUTH-002 phone evidence; remaining device/security review stays open |
| Clipboard/mobile sign-in | Shipped separately in #121/#123; later client fixes are on main | Do not restore the older client |
| `public/wallet-lab/`, SDK builder, wallet-vault tests | Unmerged; WALLET-001 | Fresh isolated branch, dependency/artifact/CSP review, encrypted-backup and actual-device restore acceptance; no Mainnet custody |
| Owner desk amount/copy view and tests | Unmerged; CHAIN-003 | Extract only the scoped presentation work onto current owner-client/session code; handle absent/denied clipboard and preserve one-send/same-hash rules |
| Wallet-safety course, evaluation script/server/tests | Unmerged; PILOT-002 | Fresh review, approved coordinator/assessments/privacy before recruitment; no public learner records |
| Old roadmap/continuity/package/config/recovery edits | Historical or mixed | Recreate only required settings for a scoped follow-up; do not cherry-pick whole files |

The old `docs/FIVE-LEAPS.md` exists only in that draft. This document and the current roadmap replace it as main's pickup reference. Its 460-test result belongs to the historical draft, not today's main or a future extracted feature. No wallet lab, evaluation service or new owner-desk runtime is shipped by this reconciliation.

## PR #120: paused artwork and tracker

[PR #120](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/120), head `d2a8a9959a8be2870d2fca58261f27eeaf523f4e`, retains twenty original PNGs in four supplied five-tier sets, their provenance records and the production tracker. Its metadata now explicitly marks it paused and open; do not generate art, change original bytes or merge its stale continuity files. ART-001 records the pause and safe resume path.

Reconciliation also recovers the founder's October 15 clarification from that draft: **500 character concepts × five rarity artworks = 2,500 planned images**, not 2,500 completed images or a mint-supply decision. DR-012 supersedes the old 500-total-edition interpretation. The [current structure note](GEEK-500-COLLECTION-STRUCTURE.md) preserves that direction without restarting production or migrating the compatible runtime manifest. Copies per artwork, IDs/duplicates, allocations and ownership remain separate work.

PR metadata changes and this reconciliation PR's final head/check/merge are recorded in the review record. Neither source branch is deleted. Closing the superseded draft does not discard its retained work; the paused art PR remains separate.
