# HQ launch-readiness review — October 11, 2026

Scope: the five requested public Alpha workstreams. This release builds on `1ebb02c10bbc70bfad1a5e3613e161de59dc044a`; the containing release commit identifies the reviewed implementation. Existing GitHub/Vercel hosting is retained.

## Delivered work

| Workstream | Result | Evidence |
| --- | --- | --- |
| First-player journey | Start Here has five steps: player → Geek → lesson → HQ Daily Signal → saved progress. Guest/sign-in returns to the guide; builder and Study link onward. Mini scores are explicitly separate. | `public/start/`, `public/sign-in/assets/sign-in.js`, `tests/start-client.test.js`, first-player integration in `tests/ranked-persistence.test.js` |
| Saved XP, levels, achievements and board | Ranked run/grade, round XP, career counters, practice balance, daily claim and associated ranked audit writes use one snapshot-checked Redis commit. Duplicate replies recover the committed receipt. Corrupt profile counters block writes instead of presenting a reset profile; unavailable board progression is null. | `server/ranked-state.js`, `server/profile.js`, `server/leaderboard.js`, `tests/ranked-persistence.test.js` |
| Mobile usability | First-visit navigation has a working shared menu, cards collapse to one column, long actions wrap, progress links follow results, quiz HUD stays visible at narrow widths, recovery buttons have 44px minimum height and focus/scroll into view. | Start/Play/Profile styles and native controls; synthetic client behavior tests. Physical-phone rendering acceptance remains outstanding. |
| Royale reliability | Transient failures retain the room for read-only reconnect. A server-confirmed missing room or removed seat clears only the browser view and restores creation/join controls while preserving the draft name. No automatic join, leave, answer or cancel is sent. | `public/royale/assets/royale.js`, `tests/royale-client.test.js`, real-Redis Royale suite |
| CCE, mint and payout readiness | Implementation and production status reviewed; controls and remaining financial launch gates recorded below. | Existing mint, CCE, payout, economy, operator and release-boundary suites; public health/mint observations |

## Ranked persistence and recovery

The commit compares the exact run, profile and prestige snapshots before changing them. A simultaneous character, trade, payout preference, prestige or different-game update causes a 409 instead of overwriting it. The player reconnects and deliberately retries an uncommitted action. A duplicate committed answer can return its existing grade. Payout-address saves also compare their loaded profile/prestige snapshots and commit their review/audit commands together; stale preferences cannot overwrite newer XP.

The daily-attempt claim and a session-scoped latest-run pointer are saved with a successful start. A lost start reply can recover that run rather than consume another Daily attempt. Reconnect checks only the current session's run, preserves the question token/deadline and returns only already graded answers. It neither advances the run nor restarts its timer. The browser stores a run ID or pending-start marker, not questions, answers, private tokens or wallet data. A missing run is cleared after the server confirms it is absent. The latest-run pointer retains only one run for the session; it is not a permanent career history or cross-session active-run migration.

Responses, including their JSON bodies, have a 15-second client deadline. Unconfirmed actions lock further game writes until recovery. Awaiting-next recovery offers a manual next button; finished-run recovery offers a deliberate retry of score publication. A finished run can be retried without incrementing completed-run counters again. Leaderboard publication is idempotent and follows the run/profile commit; it is not part of that same Redis transaction. A lost board write therefore needs an explicit finish retry. Active runs normally expire after two hours; finished recovery lasts five minutes. Career XP already committed survives run expiration.

Audit sorted-set types are checked before ranked/payout profile writes because Redis scripts do not roll back earlier commands after a runtime error. Missing legacy profile fields still receive defaults; this change validates critical counters and container shapes, not every possible nested historical field. Profile repair and restoration require operator recovery, not a browser reset.

## Reward-readiness findings

| Area | Verified boundary | Remaining acceptance work before value movement |
| --- | --- | --- |
| CCE | Submission/moderation and idempotent first-use accounting remain internal. `paid` is zero and settlement is launch-gated. | First-use credit is a separate operation before ranked commit; a failed grade commit can still leave the internal credit recorded. CCE audit publishing is best effort, and corrupt state/type failure paths are not a settlement-grade reconciliation system. A financial version needs coordinated use/credit/audit commits, corruption tests, reconciliation and independent review. |
| Fair mint | Fixed GEEK Mainnet deployment, gross-supply validation, fail-closed mismatches, fresh preflight, explicit acknowledgment and exactly one wallet-approved inscription. Server API is read-only. | Real Kasware extension/device acceptance, independent deployment verification and commit/reveal outcome testing. The fallback shares the Kasplex trust boundary; endpoint response time does not prove independent chain freshness or final token arrival. |
| Payout preferences | Mainnet destination validation, linked-wallet reauthentication, 72-hour cooldown, risk notices/review, and snapshot-checked profile writes. Approval cannot enable settlement. | Concurrent operator decision/destination transitions need settlement-grade reconciliation and review. Separate-admin append-only audit replication, actual alert delivery, individual operator access and production restore acceptance are not established by a configuration boolean. |
| Economy/treasury | Planning ledger and configured reserve status cannot activate purchases, burns, payouts or withdrawals. Supplied enable flags remain ineffective. | Treasury/signing/settlement implementation, funded reserve proof, operational controls and independent audits are separate launch work. No treasury credentials or funding were changed in this release. |

This is an internal engineering review, not an independent financial audit. Paid play, withdrawals, treasury settlement and NFT mint/ownership remain disabled. No wallet signature or on-chain transaction was requested during verification.

## Production observations

Read-only checks on October 11, 2026, before publishing this release:

- `GET https://www.geekprotocol.xyz/api/health/` returned 200 at **04:21:11 UTC**, storage connected, keyed audit integrity/export/reviewer configuration true, settlement false, independent audit `not-completed`. These flags do not prove role isolation, audit replication, incident response or external audit completion.
- `GET https://www.geekprotocol.xyz/api/mint/?fresh=1` returned 200 at **04:21:12 UTC**, matching the pinned Mainnet deployment and reporting open mint capacity through the primary Kasplex endpoint. The response required user approval, reported non-custodial handling and zero site-requested priority fee. No mint was attempted. Totals are an observation, not a promise of availability or current chain state.

Post-publication CI, deployment and browser checks are recorded in the release pull request. Browser QA does not substitute for a physical phone or real wallet extension.

## Validation

- `npm run verify` with required real Redis fixtures: **328 tests passed, zero failed, zero skipped**, followed by question/catalog, collection, archive, public-answer, security-evidence and repository checks.
- `node --check`: all **114** shipped API/server/public/script JavaScript files passed.
- `npm audit --omit=dev`: **zero reported vulnerabilities** at review time.
- New coverage includes a complete first-player Daily result, name/cosmetic retention, achievement/level/board agreement, lost start/final-answer replies, duplicate finishes, concurrent round/cosmetic/settings writes, stale debits, daily-claim failure, damaged profiles, wrong-type audit indexes, full answered-review recovery, request-body timeouts, fixed sign-in destinations, checklist migration/storage blocking and confirmed Royale seat removal/expiry.
- Existing real-Redis Royale tests cover small rooms, disconnect/rejoin and results, plus 100-player join/answer concurrency. These are isolated deterministic fixtures, not a production load-test claim.

## Practical next acceptance

A public free Alpha can continue under its existing controls. Before calling a financial release ready, complete the documented independent audit and operational gates in `AUDIT-SCOPE.md`, `MINT-PROTOCOL.md`, `PAYOUT-RISK-CONTROLS.md` and `BACKUP-RECOVERY.md`. Physical iPhone/Android and real-extension acceptance remain separate from the verified server/client tests.
