# Geek Protocol HQ — Project Status

**Snapshot date:** 2026-10-03<br />
**Release channel:** Public Alpha  
**Production:** [www.geekprotocol.xyz](https://www.geekprotocol.xyz/)  
**Repository:** [GEEKProtocol0110/geek-protocol-hq](https://github.com/GEEKProtocol0110/geek-protocol-hq)

## Current product focus

The current focus is Learn, guided Study, practice, saved progress, and free game modes. Primary navigation prioritizes learning; Progress displays private Study feedback before separate timed-game XP and records. The founder reopened game-mode work on October 3: Memory Grid adds an untimed solo matching game. Multiplayer Arena expansions, DAO work and the launchpad remain planned. Economy foundations include the named power-up catalog, reserve configuration status and private planning journal. Real purchases, paid item use, treasury funding, payouts and burns remain disabled. Free 50/50 and Extra Time trial uses are available in separate assisted practice.

## Executive summary

Geek Protocol HQ is a deployed Proof-of-Learning Alpha for the Kaspa ecosystem. The current release supports untimed Kaspa Study with A.C.E., server-authoritative trivia, persistent player progression, live lobbies, Kasware-based identity proof and recovery, community question review, collectible trading, and a non-custodial interface for the existing GEEK fair mint.

The application is deliberately split into two risk classes:

1. **Live Alpha interactions** — learning, gameplay, identity, contribution records, and user-approved mint initiation.
2. **Gated value movement** — treasury payouts, reward withdrawals, redemptions, and collection ownership. These remain disabled pending independent review and operational controls.

The daily vault at `/vault/` adds seven cosmetic seal designs, one claim per UTC day, a private collection, and up to 14 recent receipts. Eligibility and grants share one atomic Redis record and survive verified identity recovery. Claims award no XP, credits, tokens, or tradable inventory.

## Readiness matrix

| Area | Implementation | Internal evidence | Independent review | Production boundary |
| --- | --- | --- | --- | --- |
| Public web experience | Live | CI and production checks | Not audited | Public Alpha |
| Kaspa Study | Guided lessons, levels, saved practice feedback | Session, privacy, race, retry, coverage, review, and rank-isolation tests | Internal source check only | Untimed; no XP, credits, tokens, or mastery certification |
| Daily vault | Implemented Alpha | Redis-clock bounds, atomic claims, retries, private collection and identity recovery | Not audited | Cosmetic only; no XP, credits or tokens |
| Weekly / monthly challenges | Implemented Alpha | UTC rollover, snapshot, clock, recovery, race, replay, and tie-ranking tests | Not audited | Free community standings; no XP, credits, or tokens |
| Ranked game authority | Implemented | Integration and abuse-case tests | Not audited | Unproctored trivia limitations remain |
| Wallet identity and recovery | Implemented | Signature, replay, race, and origin tests | Not audited | Kaspa Mainnet ownership proof only |
| GEEK fair-mint interface | Live | Pinned deployment and fail-closed tests | Not audited | Wallet signs and submits; HQ never holds keys |
| Community Content Engine | Alpha | Moderation and first-use reward tests | Not audited | Credits are internal and non-withdrawable |
| Payout preferences | Alpha | Reauthentication, notice, and review tests | Not audited | Settlement eligibility cannot be enabled |
| Player collectibles and stickers | Alpha | Atomic reservation and exchange tests | Not audited | Off-chain profile inventory only |
| 500-Geek collection | Production blueprint | Deterministic manifest and archive hashes | Not audited | Mint and on-chain ownership disabled |
| Economy planning foundation | Implemented | Exact amounts, rounding, idempotency, CAS races, corruption and private-access tests | Not audited | Planning receipts only; no money movement or paid item use |
| Treasury settlement | Not implemented here | Launch gates defined | Required | Disabled |

## Verified release controls

The repository currently verifies:

- session-bound untimed Study with guided lessons, distinct concepts, selectable practice levels, and atomic answer/progress writes;
- one-attempt periodic competitions with shared snapshots, atomic completed-score publication, and bounded separate boards;
- private concept coverage and saved-mistake review with bounded retention and replay-safe confidence feedback;
- server-owned answer validation, deadlines, scoring, XP, and rewards;
- single-use ranked tokens and atomic answer claims;
- exact-origin, single-use wallet challenges;
- server-side Kaspa Schnorr verification and address derivation;
- identity recovery with older-session invalidation;
- fail-closed GEEK deployment and remaining-supply checks;
- separation of moderation, audit export, and payout-review roles;
- deterministic 500-Geek and legacy-art manifests;
- private answer banks and production security headers; and
- stable control identifiers with machine-checkable evidence paths.

## Known boundaries

- The project has not completed an independent penetration test or blockchain/settlement audit.
- Web trivia cannot prevent every form of outside assistance.
- Alpha GEEK credits are not on-chain tokens and have no promised monetary value.
- Payout destinations are preferences only; withdrawals and treasury settlement are disabled.
- The recovered art archive contains authentic concepts, not approved collection editions.
- Future value-moving components require separate design review, implementation, testing, and audit.

## Product direction

[The full roadmap](PRODUCT-ROADMAP.md) restores the original Arena, creator, player-economy, governance, Education, Pro, and launchpad vision. The litepaper carries this direction with explicit live/planned/proposed labels. The first learning implementation adds guided Study, practice levels, and concept feedback; other future features retain their documented status. The proposed 70/30 policy allocates platform fees to recycling and burning; the isolated planning journal records proposed allocations, but no fee-distribution or burn engine is live.

## Required next gates

1. Freeze a named release candidate and software bill of materials.
2. Complete production architecture, incident-response, backup, and key-management evidence.
3. Configure protected production roles with individual MFA-backed access.
4. Commission the Web3 application penetration test defined in [AUDIT-SCOPE.md](AUDIT-SCOPE.md).
5. Audit any future treasury, signing, settlement, or contract implementation separately.
6. Remediate and retest every Critical and High finding against the exact release commit.
7. Launch value movement only with low caps, monitoring, circuit breakers, and a tested rollback plan.

## Release evidence

Run the local verification suite with:

```sh
npm ci --ignore-scripts
npm run verify
npm audit --omit=dev --audit-level=high
```

Passing repository checks are necessary evidence, not a substitute for independent review.

### Free assisted practice

50/50 and Extra Time are playable in a separate free ten-question Kaspa practice session at `/practice/`. Each is available once per session; Extra Time adds ten seconds before expiry. Assisted results award no XP, Alpha credits, tokens or ranked entries. The paid store, persistent purchased inventory, wallet setup and payout settlement remain unfinished.

### Giga learning buddy

Giga is present in Home, Study, assisted practice, Memory Grid and Progress. The shared authored guide offers four next-step choices, encouragement based on actual Study/practice outcomes, and links to the existing lesson/review paths. Giga's guidance creates no account state, stores no answers or preferences, and requests no wallet action. A.C.E. continues to provide source-linked lesson and answer explanations. Existing recovered Giga artwork is reused as concept art. Free-form chat, adaptive AI tutoring, voice interaction and Geek Jr integration are not implemented by this change.

### Traffic tracking

Vercel Web Analytics is integrated for production public-page visits and seven allowlisted learning activity events: lesson walkthrough completion, practice start/completion (Study and free assisted practice), confirmed free lifeline use, Giga next-step choice changes, and Memory Grid starts/completions. Page/event URLs exclude query strings/fragments; private moderation and local/preview traffic are excluded, and browser privacy preferences are respected. Only fixed curriculum/mode/item/choice/board-size categories are sent, with no answers, scores, wallets, or player/run IDs. Viewing or resuming saved results does not create completion/use events. Dashboard totals are approximate client activity, not proof of learning or payments. Custom-event reports require Vercel Pro or Enterprise; the founder's plan is unverified and no billing change is made. See [Architecture](ARCHITECTURE.md#learning-activity-events) for exact event definitions and reporting limits.

### Game modes

Gauntlet, Daily Signal and Speed Signal retain their existing server-owned gameplay. Memory Grid is now a separate free, unranked solo mode at `/memory/`, reachable from Play. It matches Kaspa words with meanings on shuffled four-, six-, or eight-pair boards. Players explicitly close mismatches; there is no timer or speed bonus. Matches reveal explanations, primary-source links and related Study lessons. Giga supplies authored encouragement. Board state and attempts exist only in page memory, with no account/progress writes, XP, credits, purchases or token rewards. The public teaching deck is intentionally visible and does not contain the private ranked bank. Trivia Royale, Fandom Duel and Quiz Quest are explicitly planned, not playable.
