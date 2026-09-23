# Geek Protocol Documentation

This directory is the reviewable specification set for Geek Protocol HQ. Documents describe the public Alpha as it exists; they do not activate settlement, collection ownership, or any future roadmap item.

## Start here

| Document | Audience | Purpose |
| --- | --- | --- |
| [Project Status](PROJECT-STATUS.md) | Community, partners, reviewers | Dated product and launch-readiness snapshot |
| [Architecture and Trust Boundaries](ARCHITECTURE.md) | Engineers, auditors | Components, sensitive flows, and security boundaries |
| [Independent Audit Scope](AUDIT-SCOPE.md) | Audit firms, maintainers | Required engagements, evidence, and launch gates |
| [Threat Model](THREAT-MODEL.md) | Security reviewers | Assets, adversaries, abuse cases, and mitigations |

## Protocol specifications

| Document | Scope |
| --- | --- |
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
