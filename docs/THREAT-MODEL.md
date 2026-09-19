# Geek Protocol HQ Threat Model

Version: 1.0  
Scope baseline: the Git commit supplied to an independent reviewer

## System purpose and value boundary

HQ hosts a server-ranked knowledge game, the Community Content Engine (C.C.E.), Alpha reward accounting, lobbies, leaderboards, and an unverified future payout-address preference. The live system does not mint, transfer, withdraw, custody, or promise redeemability of GEEK.

The future value-moving boundary is intentionally absent. Adding a treasury key, KRC-20 transfer mechanism, withdrawal worker, or contract changes the threat model and requires a new audit scope.

## Assets

| Asset | Security objective |
|---|---|
| Ranked answers and scoring rules | Confidential until commitment; server-authoritative |
| Alpha balances and C.C.E. credits | Integrity, idempotency, traceability |
| Payout-address preferences | Integrity, privacy, change traceability; never treated as proof of ownership |
| Moderator authority | Strong authentication, least privilege, complete action trail |
| Session identifiers and service secrets | Confidentiality; never written to audit records |
| Question submissions and sources | Integrity, attribution, review-state correctness |
| Audit evidence | Integrity, restricted access, exportability, retention |

## Trust boundaries

1. **Untrusted browser:** all names, answers, addresses, timing claims, wallet events, and request bodies are attacker-controlled.
2. **Vercel API functions:** enforce state transitions, validation, deadlines, permissions, and rate limits.
3. **Redis:** stores live state and private audit events. Administrative access is a high-impact trust role.
4. **Wallet provider:** may expose a public address or sign a message. A client-only signature check is not a server identity control.
5. **Moderator:** currently authenticates with a dedicated secret; this is an Alpha control, not the final privileged-access design.
6. **Future treasury/settlement:** not deployed and must be isolated from the web application when introduced.

## Primary attackers and abuse cases

- Players replay or race answers, forge scores, manipulate clocks, scrape answers, or farm Alpha rewards.
- Contributors submit duplicate, malicious, copyrighted, false, or manipulated questions and sources.
- Attackers steal an anonymous session and change its payout preference.
- Attackers brute-force moderator or audit credentials, exploit business-state transitions, or exfiltrate logs.
- Operators or database administrators modify reward or audit data.
- A compromised dependency, deployment token, CI workflow, or hosting account changes production code.
- A future settlement worker pays twice, exceeds a cap, uses the wrong token identity, or sends to a recently changed address.

## Enforced invariants

| ID | Invariant | Current control |
|---|---|---|
| GP-INV-001 | No browser-controlled score or balance write | Read-only leaderboard API; server scoring |
| GP-INV-002 | One committed result per question token | Atomic Redis answer claim and idempotent replay |
| GP-INV-003 | No answer key in the public bundle | Question banks are server-only and tested |
| GP-INV-004 | A C.C.E. first-use credit occurs at most once | Redis `HSETNX` reward ledger |
| GP-INV-005 | A payout preference never enables settlement | API always returns `withdrawalsEnabled: false` and `settlementEligible: false` |
| GP-INV-006 | A payout change has a review window | Every new or changed address starts a 72-hour future-settlement cooldown |
| GP-INV-007 | Sensitive state transitions leave evidence | HMAC-SHA-256 audit events when `AUDIT_LOG_SECRET` is configured |
| GP-INV-008 | Audit records do not contain bearer secrets | Pseudonymous actor/object hashes and detail allowlisting |

## Residual Alpha risks

- Sessions are anonymous bearer cookies with no recovery or MFA.
- A payout address is checksum-valid but ownership is not server-verified.
- The moderator credential is a shared secret rather than an individual hardware-backed identity.
- Redis administrators remain inside the operational trust boundary. HMAC evidence detects record edits when the key is protected, but production should also stream logs to separately administered, append-only storage.
- Unproctored trivia cannot prevent all outside assistance.
- Audit logging for the Alpha C.C.E. credit is best-effort after the atomic first-use credit; settlement must use an atomic outbox or equivalent transaction boundary.

These risks prohibit on-chain settlement. They are not waived by publishing this document.
