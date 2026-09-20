# Geek Protocol Security

## Current status

Geek Protocol HQ is a public Alpha. It has **not** completed an independent security audit. The `/mint/` page can request one user-approved Kasware mint against the existing GEEK KRC-20 deployment; the site does not hold keys or sign that transaction. No on-chain GEEK reward withdrawals, treasury payouts, or redemptions are enabled. Alpha GEEK is a separate internal test ledger with no promised monetary value.

The repository is being prepared for two distinct independent assessments:

1. a Web3 application penetration test covering the browser, mint interface, APIs, business logic, Redis data layer, deployment, wallet integration, and administrative surfaces; and
2. a separate line-by-line audit of any future KRC-20 settlement, treasury, or smart-contract code before that code can move value.

An audit report applies only to the exact commit, configuration, contracts, and deployment scope named in that report. It is not a permanent guarantee.

## Reporting a vulnerability

Do not open a public issue for an unpatched vulnerability. Use GitHub's private vulnerability-reporting feature for this repository. Include:

- affected commit and environment;
- reproducible steps or proof of concept;
- expected and observed behavior;
- impact to funds, identity, rewards, content integrity, or availability; and
- any safe remediation suggestion.

Do not access another person's data, degrade the service, submit malware, attempt social engineering, or move funds. Stop testing after demonstrating the minimum evidence needed to explain the issue.

## Security invariants

- The application never requests or stores seed phrases or private keys.
- Every mint request is user-initiated, restricted to Kaspa Mainnet, pinned to the exact GEEK deployment and inscription, and approved or rejected inside Kasware.
- A fresh server-side indexer check runs before each mint request. An unavailable indexer, exhausted supply, or deployment mismatch blocks the request.
- The mint path is non-custodial and does not activate Alpha reward settlement, treasury transfers, or withdrawals.
- Browsers never receive ranked answer keys before an answer is committed.
- Clients cannot write scores, reward balances, moderation results, or payout eligibility.
- Identity binding and recovery use five-minute, single-use server challenges, Kaspa Schnorr verification, and public-key/address matching; no signature is stored.
- Wallet challenges embed the exact requesting HTTPS origin, and verification rejects proofs replayed through a different allowed hostname.
- The wallet binding, player record, replacement session, and successful audit event commit atomically; stale or raced identity state fails closed.
- Recovering with the linked identity wallet increments a server-side session version and invalidates older authenticated sessions.
- Once an identity wallet is linked, payout-setting changes require a fresh scoped wallet signature. A different payout destination remains ownership-unverified.
- Every payout-setting mutation creates a persistent player-facing notice. Higher-risk destinations enter a private queue whose reviewer role is separate from moderation and audit export.
- Reviewer decisions cannot make a destination settlement-eligible and cannot enable withdrawals.
- Every sensitive payout-address change and moderation transition creates private, pseudonymous audit evidence.
- Real settlement stays disabled until the launch gates in `docs/AUDIT-SCOPE.md` are independently verified.

See `docs/THREAT-MODEL.md`, `docs/MINT-PROTOCOL.md`, `docs/IDENTITY-PROTOCOL.md`, `docs/PAYOUT-RISK-CONTROLS.md`, `docs/DEPENDENCY-PROVENANCE.md`, `docs/AUDIT-SCOPE.md`, and `security/controls.json` for the reviewable security baseline.
