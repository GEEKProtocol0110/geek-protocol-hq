# Account and Data Guide

**Document:** GEEK-DATA-001 · **Version:** 0.1 · **Status:** Founder review draft — not adopted

**Source baseline:** HQ commit `b7521c6db2087d0c40580afa443104f33f4cd212` (November 16, 2026 snapshot). This draft distinguishes recorded implementation from proposed requirements. It does not revise the published whitepaper or activate a release gate.

## What this guide covers

This guide describes the account and storage boundaries recorded for HQ Public Alpha. It is not a complete privacy notice, contractual retention policy or claim of regulatory compliance. It adds no tracking or data collection.

Geek Jr, Geek Mini, external wallets and linked services have separate implementations and provider behavior. This HQ guide must not be copied to them as proof that their handling is identical.

## Guest, account and wallet access

Guests can try supported activities. Guest access depends on browser session state and can be lost when site data is cleared. Saved account access uses the available passkey and recovery paths. A passkey provider's sync and recovery behavior varies by device and credential manager; one successful test does not prove access on every device.

A wallet connection, a Geek account and a receiving address are separate. Desktop wallet sign-in requires an explicit supported connection and approved proof; unlocking an extension alone does not sign into Geek. A phone player can use their Geek passkey and save a receiving address from a Kaspa wallet.

Entering an address does not authenticate its owner. Replacing a saved destination requires the existing fresh account confirmation flow and preserves the player's account and progress. Check network and full address before saving. Mainnet and Testnet destinations are distinct; public Mainnet payouts remain disabled.

## Where records live

| Record | Recorded storage boundary | Practical limit |
| --- | --- | --- |
| Sessions, account and learning progress | Authorized application services backed by Redis | Not every feature has the same lifetime or recovery path |
| Public standings | Public display metadata and score | Published information can be copied by others |
| A.C.E. saves and practice history | This browser's local storage | No account sync; clearing site data removes the record |
| Mint history references | Bounded browser-local request markers and public transaction references | Not proof of ownership or confirmation |
| On-chain activity | Kaspa and token indexer views | Public transaction data cannot be removed by clearing browser data |

The Arena keeps one unfinished game per title, up to 200 recent results and persistent local milestones. A new game replaces that title's save. Its clear control affects its own record; close active game tabs first because later moves can create fresh saves. Storage failures can leave play usable without saving.

Mint references do not restore approval, wallet keys or authority to resume a transaction queue.

## Analytics and external services

HQ's recorded analytics integration limits collection to explicit public production routes and fixed activity categories. Its filtering removes URL queries and fragments and excludes answer text, scores, wallet addresses, names and player/run identifiers from custom event payloads. The integration adds no browser storage or cookies of its own and excludes Do Not Track and Global Privacy Control.

Those application controls do not establish that hosting, security infrastructure, credential managers or external links process no data. Provider access records and terms need their own review. Opening another site or signing in through a device provider crosses that boundary.

## Retention, deletion and recovery limits

Feature-specific expiration exists; there is no single universal lifetime established by this guide. The architecture records a 24-hour unfinished Study run expiry, a 180-day refreshed Study progress lifetime and periodic challenge data expiry 60 days after close. These examples are not promises that all associated logs, exports or provider backups disappear on that schedule.

Clearing local storage is different from deleting server records and cannot erase public chain data. Before publishing a formal notice, maintainers need a complete data inventory, provider scope, backup retention and verified export/deletion procedure. No unimplemented self-service deletion control or response deadline is promised here.

## Getting help safely

Use the [security page](https://www.geekprotocol.xyz/security/) and official project channels to find the current reporting route. Describe the affected feature, device and approximate time. Keep passkey challenges, recovery material, cookies and wallet secrets out of public reports.

Children's or school accounts require separate roles, consent, minimization and retention design before a pilot; consumer Alpha access does not establish that program.

## Evidence and document control

- [Account and receiving-wallet behavior](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/HOME-ACCOUNT-WALLET.md)
- [Data, analytics and feature lifetimes](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/ARCHITECTURE.md)
- [Browser-local Arena records](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/ARCADE-300.md)
- [Mint reference limits](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/MINT-RECEIPT-HISTORY.md)
- [Recovery and institutional boundaries](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/WHITEPAPER.md)

Revision 0.1: initial review draft. Approval, effective date and publication location remain unassigned. Reconcile this document with the source candidate and founder decisions before adopting version 1.0.
