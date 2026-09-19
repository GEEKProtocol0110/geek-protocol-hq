# Independent Audit Scope and Launch Gates

## Required engagements

Geek Protocol should commission both of the following before enabling value transfer:

### 1. Web3 application penetration test

Scope the production domain, Vercel functions, Redis authorization and data flows, session management, one-time wallet challenges, Schnorr verification, identity recovery and session invalidation, payout reauthentication, ranked-game business logic, C.C.E., moderation, audit export, wallet integration, CI/CD, cloud configuration, secret management, and any future settlement API.

The engagement should include authenticated and unauthenticated testing, business-logic abuse, race conditions, replay, authorization, rate-limit bypass, API fuzzing, cloud misconfiguration, dependency and supply-chain review, and remediation retesting.

### 2. Blockchain and settlement audit

Audit every line of future KRC-20 transfer, treasury, signing, batching, reconciliation, and contract code. Review exact token identifiers, network assumptions, decimal handling, caps, replay protection, idempotency, key rotation, multisignature or policy controls, emergency pause, upgrade authority, and recovery paths. Use formal specifications for high-value invariants where the chosen implementation supports them.

CertiK describes these as separate services: its smart-contract audit reviews blockchain code and logic, while its Web3 penetration testing covers applications, APIs, networks, cloud infrastructure, SDKs, and source code. A single badge or contract-only review is not enough for HQ's mixed on-chain/off-chain architecture.

## Review baseline

The auditor must receive:

- an immutable Git commit SHA and software bill of materials;
- production architecture and data-flow diagrams;
- this threat model and the machine-readable control map;
- test commands and clean results;
- sanitized deployment configuration and secret inventory;
- privileged-role and key-management procedures;
- audit-event schema and a sample integrity-verified export;
- the identity protocol specification, wallet-signature test vectors, dependency provenance, nonce/replay/race tests, and identity-recovery/session-invalidation evidence;
- incident response, backup, recovery, and log-retention procedures;
- proposed treasury policy, payout caps, eligibility rules, and legal terms; and
- all known risks, prior findings, accepted exceptions, and remediation evidence.

## Non-negotiable launch gates

On-chain settlement remains disabled until all gates are documented as complete:

1. Recoverable player identity and server-verified wallet ownership independently tested against replay, substitution, race, recovery, and session-fixation attacks. The Alpha implementation exists; external verification remains open.
2. Hardware-backed, individual privileged access with MFA; no shared production moderator or audit credentials.
3. Protected payout changes with fresh wallet reauthentication, destination ownership proof where supported, user notification, cooldown, revocation, and administrative review for high-risk changes. Alpha reauthentication and cooldown exist; notifications and high-risk review remain open.
4. Canonical GEEK token identity and network parameters independently confirmed.
5. Treasury isolated from the public web tier with least-privilege signing policy, transaction caps, allowlisted methods, and emergency pause.
6. Idempotent payout jobs, double-entry accounting, balance invariants, reconciliation, retries, and dead-letter handling.
7. HMAC audit integrity enabled, centralized append-only log replication, monitoring, alerting, and tested retention.
8. CI security verification, protected main branch, required reviews, pinned build inputs, and reproducible release evidence.
9. Independent Web3 penetration-test report with all Critical and High findings resolved and retested.
10. Independent settlement/smart-contract audit tied to the exact release commit, with all Critical and High findings resolved and retested.
11. Incident-response and treasury key-compromise exercises completed.
12. Staged launch with low caps, circuit breakers, monitoring, and a published rollback plan.

## Evidence standards

Findings should use reproducible steps, affected components, impact, severity, remediation, and retest status. Public statements must distinguish `planned`, `implemented`, `internally verified`, and `independently audited`. Geek Protocol must never describe itself as audited until a named third party has published or delivered a completed report for the exact deployed scope.

## Reference baseline

- OWASP Application Security Verification Standard and Logging guidance
- NIST SP 800-218 Secure Software Development Framework
- CertiK Smart Contract Audit methodology
- CertiK Web3 Penetration Testing methodology
