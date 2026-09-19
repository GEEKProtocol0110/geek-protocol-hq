# Geek Protocol Security

## Current status

Geek Protocol HQ is a public Alpha. It has **not** completed an independent security audit, and no on-chain GEEK withdrawals are enabled. Alpha GEEK is an internal test ledger with no promised monetary value.

The repository is being prepared for two distinct independent assessments:

1. a Web3 application penetration test covering the browser, APIs, business logic, Redis data layer, deployment, wallet integration, and administrative surfaces; and
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
- Browsers never receive ranked answer keys before an answer is committed.
- Clients cannot write scores, reward balances, moderation results, or payout eligibility.
- A stored Kaspa address is an unverified Alpha preference until server-verified ownership and account recovery exist.
- Every sensitive payout-address change and moderation transition creates private, pseudonymous audit evidence.
- Real settlement stays disabled until the launch gates in `docs/AUDIT-SCOPE.md` are independently verified.

See `docs/THREAT-MODEL.md`, `docs/AUDIT-SCOPE.md`, and `security/controls.json` for the reviewable security baseline.
