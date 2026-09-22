# Geek Protocol HQ Threat Model

Version: 1.3
Scope baseline: the Git commit supplied to an independent reviewer

## System purpose and value boundary

HQ hosts a server-ranked knowledge game, the Community Content Engine (C.C.E.), Alpha reward accounting, lobbies, leaderboards, recoverable wallet-protected player identities, a future payout-address preference, and a non-custodial interface for the existing GEEK KRC-20 fair mint. The browser can ask Kasware to create one user-approved mint. HQ does not hold a private key, sign on the user's behalf, transfer GEEK, withdraw rewards, custody funds, or promise redeemability.

The server-side value-moving boundary is intentionally absent. Adding a treasury key, automated KRC-20 transfer mechanism, withdrawal worker, or contract changes the threat model and requires a new audit scope. The current user-signed mint path is already inside the browser and deployment audit scope described here.

## Assets

| Asset | Security objective |
|---|---|
| Ranked answers and scoring rules | Confidential until commitment; server-authoritative |
| Alpha balances and C.C.E. credits | Integrity, idempotency, traceability |
| Player identity wallet | Server-verified ownership, recovery, replay resistance, session invalidation |
| Payout-address preferences and reviews | Integrity, privacy, change traceability; ownership true only when it equals the verified identity wallet |
| Moderator and payout-review authority | Strong authentication, separation of roles, least privilege, complete action trail |
| Session identifiers and service secrets | Confidentiality; never written to audit records |
| Question submissions and sources | Integrity, attribution, review-state correctness |
| Audit evidence | Integrity, restricted access, exportability, retention |
| GEEK mint request | Exact deployment, inscription, network, one-at-a-time user consent, fail-closed supply check |

## Trust boundaries

1. **Untrusted browser:** all names, answers, addresses, timing claims, wallet events, and request bodies are attacker-controlled.
2. **Vercel API functions:** enforce state transitions, validation, deadlines, permissions, and rate limits.
3. **Redis:** stores live state and private audit events. Administrative access is a high-impact trust role.
4. **Wallet provider:** exposes a public address/key, signs exact identity text, and constructs user-approved KRC-20 mint transactions. The server independently verifies identity proofs; the user must independently verify transaction details in Kasware.
5. **Kasplex indexer:** provides current GEEK deployment and gross-mint state through a fixed primary and Kasware-published mainnet fallback. Both are the same trust boundary, not independent consensus. The fallback is used only for transport errors, HTTP 429, or HTTP 5xx; mismatched or invalid successful responses block without fallback. The server pins all canonical deployment fields and blocks minting on unavailability or mismatch; a stale but internally consistent response remains a residual availability/state risk.
6. **Privileged reviewers:** C.C.E. moderation, audit export, and payout review use separate credentials. These are Alpha controls, not the final individual hardware-backed access design.
7. **Future treasury/settlement:** not deployed and must be isolated from the web application when introduced.

## Primary attackers and abuse cases

- Players replay or race answers, forge scores, manipulate clocks, scrape answers, or farm Alpha rewards.
- Contributors submit duplicate, malicious, copyrighted, false, or manipulated questions and sources.
- Attackers steal a browser session, race a wallet-binding request, replay an old proof through another hostname, substitute a payout address, or attempt recovery with an unrelated key.
- Attackers brute-force moderator or audit credentials, exploit business-state transitions, or exfiltrate logs.
- Operators or database administrators modify reward or audit data.
- A compromised dependency, deployment token, CI workflow, or hosting account changes production code.
- A malicious page, compromised indexer, wallet extension, or injected script substitutes the mint ticker, network, recipient, quantity, or fee; a user approves without inspecting the wallet request.
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
| GP-INV-009 | A wallet proof is server-issued, short-lived, and usable once | Random 256-bit nonce, exact origin/action text, five-minute TTL, atomic `GETDEL` consumption |
| GP-INV-010 | A signature cannot bind an unrelated address | Server Schnorr verification plus public-key-to-Kaspa-mainnet-address derivation |
| GP-INV-011 | Recovery cannot leave older authenticated sessions active | Monotonic identity session version checked on every authenticated request |
| GP-INV-012 | A linked identity protects payout-setting changes | Fresh scoped wallet signature and one-time five-minute authorization before set/remove |
| GP-INV-013 | Wallet and player identity binding cannot partially commit | Redis compare-and-set script atomically writes the wallet mapping, player record, replacement session, and successful audit event |
| GP-INV-014 | A wallet challenge cannot move between allowed hostnames | Exact requesting HTTPS origin is signed and rechecked during verification |
| GP-INV-015 | Higher-risk payout changes cannot silently bypass review | Persistent player notice, deterministic risk triggers, private review queue, stale-decision check, and settlement-disabled decision output |
| GP-INV-016 | HQ only requests the pinned GEEK mint on mainnet while gross capacity remains | Server-side exact deployment check, client-side duplicate validation, fresh preflight, fixed type-3 inscription, zero added priority fee, and Kasware user approval |

## Residual Alpha risks

- Unlinked players still use anonymous bearer sessions and cannot recover them.
- Wallet proof currently supports Kaspa Schnorr personal-message signatures. Other wallet signature schemes require separately reviewed adapters before they can protect an identity.
- One recovery wallet protects one player identity in this Alpha. Dual-wallet rotation, social recovery, and out-of-band email, SMS, push, or wallet notifications are not implemented.
- A payout destination different from the verified identity wallet remains ownership-unverified, even though a fresh identity-wallet signature authorizes the preference change.
- Privileged Alpha credentials are shared secrets rather than individual hardware-backed identities. Production reviewer configuration and access logging remain launch gates.
- Redis administrators remain inside the operational trust boundary. HMAC evidence detects record edits when the key is protected, but production should also stream logs to separately administered, append-only storage.
- Unproctored trivia cannot prevent all outside assistance.
- Audit logging for the Alpha C.C.E. credit is best-effort after the atomic first-use credit; settlement must use an atomic outbox or equivalent transaction boundary.
- The GEEK mint interface and its wallet-extension interaction have not completed an independent penetration test. A compromised wallet, client runtime, dependency, hosting account, or DNS path can mislead the user; the Kasware confirmation is the final independent review point.
- Kasplex state may lag the Kaspa network. The wallet or network can reject a mint even after the page reports capacity, and displayed totals can update after a delay.

These risks prohibit on-chain settlement. They are not waived by publishing this document.
