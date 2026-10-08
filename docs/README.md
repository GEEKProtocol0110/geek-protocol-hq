# Geek Protocol Documentation

This directory is the reviewable specification set for Geek Protocol HQ. Documents describe the public Alpha as it exists; they do not activate settlement, collection ownership, or any future roadmap item.

## Start here

- [Editorial Review](EDITORIAL-REVIEW.md): current removals and the remaining draft review.
- [Player Journey Review](PLAYER-JOURNEY-REVIEW.md): browser walkthrough, fixes and physical-device acceptance work.

| Document | Audience | Purpose |
| --- | --- | --- |
| [Full Product Roadmap](PRODUCT-ROADMAP.md) | Community, builders, reviewers | Original vision, live foundations, feature backlog and acceptance criteria |
| [HQ Interface Polish](HQ-UX-POLISH.md) | Product reviewers | Calmer navigation, progressive disclosure and browser verification |
| [Project Status](PROJECT-STATUS.md) | Community, partners, reviewers | Dated product and launch-readiness snapshot |
| [Architecture and Trust Boundaries](ARCHITECTURE.md) | Engineers, auditors | Components, sensitive flows, and security boundaries |
| [Independent Audit Scope](AUDIT-SCOPE.md) | Audit firms, maintainers | Required engagements, evidence, and launch gates |
| [Threat Model](THREAT-MODEL.md) | Security reviewers | Assets, adversaries, abuse cases, and mitigations |

## Protocol specifications

| Document | Scope |
| --- | --- |
| [Operations Workspace](OPERATIONS.md) | Role-separated moderation, risk-review and audit workflows |
| [Economy Protocol](ECONOMY-PROTOCOL.md) | Restored power-ups, private planning receipts, reserve status and disabled transfers |
| [Daily Vault Protocol](VAULT-PROTOCOL.md) | Visible cosmetic contents, UTC eligibility, atomic claims, and private receipts |
| [Challenge Protocol](CHALLENGE-PROTOCOL.md) | UTC periods, private snapshots, clocks, attempts, and separate standings |
| [Study Protocol](STUDY-PROTOCOL.md) | Untimed practice, private answers, retry safety, and ranked isolation |
| [Question Maintenance](QUESTION-MAINTENANCE.md) | Distinct-question cleanup, expansion, attribution, and compatibility |
| [Kaspa Content Review](KASPA-CONTENT-REVIEW.md) | Source-check scope, corrections, and remaining editorial limits |
| [Identity Protocol](IDENTITY-PROTOCOL.md) | Wallet proof, account recovery, origin binding, and session invalidation |
| [Mint Protocol](MINT-PROTOCOL.md) | Canonical GEEK deployment verification and non-custodial mint flow |
| [Payout Risk Controls](PAYOUT-RISK-CONTROLS.md) | Destination changes, notices, cooldowns, and private review |
| [Collectible Protocol](COLLECTIBLE-PROTOCOL.md) | Player collectibles, sticker trades, and disabled on-chain ownership |
| [Dependency Provenance](DEPENDENCY-PROVENANCE.md) | Pinned verifier dependency and supply-chain evidence |

## Collection and worldbuilding

| Document | Scope |
| --- | --- |
| [500-Geek Art Bible](GEEK-500-ART-BIBLE.md) | Identity distribution, visual contract, production workflow, and recovered concepts |

## Evidence map

Machine-readable security controls live in [`security/controls.json`](../security/controls.json). `npm run verify` checks that each control has stable identifiers and existing evidence paths.

## Status language

Use these terms consistently in code, documentation, and public statements:

- **Planned** — approved direction without a complete implementation.
- **Implemented** — code exists and is covered by repository evidence.
- **Internally verified** — automated or manual project checks have passed.
- **Independently audited** — a named third party reviewed the exact stated commit and scope.

Geek Protocol HQ is implemented and internally verified in several areas. It is **not independently audited**.

- [Player dashboard and prestige rules](PLAYER-PROGRESSION.md) — optional level-50 resets, 25 prestige ranks, preserved career, and verified standings.
