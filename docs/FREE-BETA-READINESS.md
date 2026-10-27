# Free-beta candidate and pilot checklist

**Prepared October 9; current handoff refreshed October 27, 2026. Status: current runtime evidence recorded; broader production pilot acceptance pending. The public release remains Alpha.** This checklist covers Kaspa-first learning and free gameplay. It does not approve paid entry, GEEK rewards, cash-out, treasury settlement, burns, NFT ownership or collection minting.

## Current continuation — October 27

PR #171 fixed Royale finalization and the original timed-out room recovered its saved no-winner result; #172 records that acceptance. The fresh Royale check remains incomplete, and the private retry invitation was lost when test tabs were cleaned up. Browser policy blocks internal history recovery; do not bypass that restriction or repeat uncertain room actions.

All 21 standard production probes passed with unchanged five-second bounds. A deployed desktop guest completed introductory Study, recovered the same mid-run review and completed summary after reload, and corrected only a deliberately missed concept without losing explored progress. This is deployed agent-operated desktop evidence; physical-device, account-switching, independent learner and full multiplayer acceptance remain separate. The maintained state/backlog own exact release evidence and current tasks. Continue useful reviewed Kaspa content while multiplayer reconciliation is unavailable.

## Historical first-proof handoff — October 18

The immediate task is [LAUNCH-001: first proof, then expansion](FIRST-PROOF-LAUNCH.md). Runtime #151 is the latest recorded deployed baseline: 750 reviewed Kaspa concepts; 574 tests at that release. The maintained project record owns exact later release evidence. PR #151 is now merged/deployed: 574 local tests passed, exact-head/merge CI passed and the standard 21-probe post-deployment monitor passed on GitHub. The [first-proof release record](FIRST-PROOF-LAUNCH.md#released-checkpoint--pr-151) preserves earlier local monitoring failures and all acceptance limits. Phone, wallet, provider, campaign and Royale acceptance below remain explicit. Current monitoring failures are retained in the first-proof record.

The October 16 and earlier checkpoints below are historical; they do not describe current main.

## Historical October 16 runtime and acceptance checkpoint

Runtime is [PR #137](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/137), merge `b194970626b4864286fb25a210b33df14047d3bc`, tree `0b2499b3dc0fe03db7ef8fc3606099926999cbe2`. Main also includes later documentation through #138. The maintained [project record](continuity/project.json) owns later exact runtime evidence.

| Evidence | Current recorded result |
| --- | --- |
| Internal checks | 496 tests, zero failures/skips, required Redis 7.4.2, 311 security assertions and supporting checks on #137 |
| CI / deployment | Exact-head verify run 38927170918 and Vercel passed; merge-source Vercel succeeded; desktop live containment checked |
| Phone access | Founder reported initial passkey flow success October 16, 2:35 AM Detroit; returning-login/cross-device/revocation scenarios remain separate |
| Phone layout | Founder reported “Ok better” after #137, October 16 at 1:00 PM Detroit; limited improvement observation, not a complete browser-bar/device matrix |
| npm inventory | [October 16 CycloneDX SBOM](releases/free-beta-2026-10-16.cdx.json): 26 dependency components; source checkpoint `a7eaca32908b30214aaf04730f485c851963ee30` |
| Lockfile SHA-256 | `8f1e46d66eb413f6d8ebf245a796f54c98fe7bc937ad4a20e537de7d6860237c` |
| SBOM SHA-256 | `5505bb8290dcac560b784ad30a9fc1740b9e49e9c7223badd3380f18e3adc9d2` |
| Dependency audit | October 16 `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities; no independent audit claim |

The new SBOM includes `@simplewebauthn/server` and its dependency graph. It is a local installed production-npm inventory bound to the recorded lockfile/source, not an attestation of deployed provider assets or a complete upstream WASM inventory. The October 9 SBOM below remains historical and no longer matches today's lockfile. No runtime dependencies changed during this documentation cleanup.

## Historical October 9–15 comparison baseline

| Evidence | Recorded result |
| --- | --- |
| Code baseline | [`5421a78524cd81dcd54aeddb8f04ca01efb75e7c`](https://github.com/GEEKProtocol0110/geek-protocol-hq/commit/5421a78524cd81dcd54aeddb8f04ca01efb75e7c), the PR #109 Kaspa-first onboarding merge; a historical source snapshot; the old #84 references below are not the current candidate |
| Application tree | `d0817b68cd1bcd3ba696f1c5b6d00fc73770dfc6`; the comparison baseline before the final homepage polish in PR #84 |
| Internal verification | 412 tests passed, zero failed/skipped; question, collection, archive, repository, economy stress checks and all 310 security assertions passed on the comparison baseline; rerun on the final PR head before merge |
| Dependency audit | `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities at verification time; not an independent security audit |
| CI | [Security verification run 38675575595](https://github.com/GEEKProtocol0110/geek-protocol-hq/actions/runs/38675575595) passed on the comparison baseline; [PR #84 checks](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/84/checks) identify the final candidate |
| Deployment | [Vercel production deployment](https://vercel.com/geek-protocols-projects/geek-protocol-hq/DDZUovShyuTDnZwzxWgVPf4ogqS2) reported ready for the comparison baseline; this does not establish private API health or a user's saved-record recovery |
| npm dependency inventory | [CycloneDX 1.5 SBOM](releases/free-beta-2026-10-09.cdx.json), historical October 9 inventory, generated with npm 11.9.0 / local Node 24.19.0; its lockfile hash belongs to that historical checkpoint and does not match current main |
| Lockfile SHA-256 | `a20b44b57303cdd9375399cfa7383c042690933c9fbec79a8cd9de3402548296` |
| SBOM SHA-256 | `5a0535cb0e645b703f94700770721fc314aedb6bbcbbdd9ae94661efeee4a426` |

At the October 15 checkpoint the lockfile and dependency graph were recorded as unchanged. Later passkey dependencies supersede that statement for current main. The retained October 9 inventory records its historical source commit (`382ffdb5...`), not the current application source; that historical lockfile hash was rechecked October 15. The SBOM contains the declared production npm graph: HQ 0.1.0 and `@dfns/kaspa-wasm` 0.14.1, with its lockfile distribution integrity and license. It is a pre-build inventory, not a deployed artifact attestation or a complete inventory of the WASM package's upstream source dependencies, hosted runtime, Vercel, Redis provider, wallets, indexers or CDN assets. Production runtime and provider configuration remain owner evidence. The generator's root display name was normalized to `package.json`'s name; source commit and lockfile hash were added as metadata properties.

This baseline is recorded for comparison; no release tag, branch freeze, Beta announcement or production configuration change is performed. A code or dependency change requires a new baseline, SBOM when dependencies change, and relevant checks before acceptance. The earlier onboarding release polished homepage copy, ordering and responsive CSS without altering gameplay authority or dependencies. Match new acceptance to the current deployed runtime above; these old comparison pointers do not establish it.

The founder confirmed the reported saved-step recovery on the existing phone/browser after the PR #92 production deployment. This confirmation is limited to resume: it does not complete campaign, badge reload, replay, Royale, owner MFA, or backup/restore acceptance. [Issue #81](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/81) records the closed finding and acceptance.

Current internal coverage includes legacy first-Begin recovery, strict identity records, packaged-verifier reachability from APIs, public ranked-answer exclusion, grading across all category/mode combinations, Royale reveal deadlines and disabled settlement flags. These are repository/real-Redis checks, not production pilot results. See [Identity protocol](IDENTITY-PROTOCOL.md) and [Threat model](THREAT-MODEL.md).

## Onboarding release evidence

The comparison baseline has two direct starting actions, visible sign-in and expandable optional content. Final polish in this PR states the Daily Signal limit before entry, puts practical Kaspa next steps ahead of extra games, improves narrow-header wrapping and footer tap targets, and corrects stale navigation/status copy. See [Mobile onboarding](MOBILE-ONBOARDING.md). Static and client-fixture checks are not new browser-rendering or physical-phone evidence. The founder reported on October 15 that the polished homepage looked good on their physical phone with nothing abnormal. This is a limited visual pass, with device/browser details and individual interaction steps unspecified. The earlier Quest-resume confirmation remains a separate historical pass; neither observation completes broader campaign/profile/device acceptance.

## Acceptance order

| Gate | Current status | Required result |
| --- | --- | --- |
| Reported Quest resume | **Passed — founder confirmation, October 9 at 18:57 America/Detroit; issue #81 closed** | Existing saved chapter resumed at the correct step after PR #92; no replacement profile or reset |
| Quest campaign and replay | **Pending** | All four chapters complete, badges/review persist after reload, and replay preserves badges and later unlocks |
| Phone learning and profile | **Partial; full flow pending** | Kaspa-first entry, visible sign-in, menu, quiz/lesson links, name save, selected Geek, Study, free practice, Gauntlet and dashboard work on actual devices |
| Small Royale pilot | **Pending** | Two distinct participants finish a real production room with ready/start, shared reveal, reload and result behavior observed |
| Controlled capacity event | **Pending; separate gate for a 100-player capacity claim** | Measured production latency, errors, reconnect outcomes and request/Redis usage during a progressively larger event |
| Owner authenticator and account recovery | **Pending verification** | Owner confirms authenticator login, protected workspaces and offline recovery; GitHub, hosting and database account recovery verified privately |
| Production backup and restore | **Pending verification** | Completed provider backup, retained recovery point and successful isolated restore drill with measured loss/recovery time |
| Beta decision | **Pending** | Owner reviews completed evidence and unresolved findings, defines the pilot's scope/size, and explicitly approves the public release label |

Repository tests cannot complete device, account or provider acceptance. Passing a small pilot does not establish 100-player production capacity. A failed saved-record check must not be marked passed because a new profile works.

## 1. Quest on the affected phone

The reported saved-step resume passed on October 9 at 18:57 America/Detroit. The campaign/completion/replay steps below remain pending. Keep the existing browser session and saved profile. Do not clear cookies, create a replacement profile, reset a record or paste a wallet secret into support.

1. Refresh [Quiz Quest](https://www.geekprotocol.xyz/quest/) on the recorded candidate deployment. If a saved-record warning appears, select **Retry loading saved chapter**. The unverified entrance must not offer Begin; the campaign card must say status unavailable.
2. Confirm a successful retry resumes the server's saved place. If it still returns an error, record the visible message, approximate time, device/browser and chapter; report the support code and reopen [issue #81](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/81) if the same failure recurs. Do not infer the missing step or reset progress.
3. Complete First Signal's six checks and final **Finish chapter & save badge** continuation. Reload: the completion, notes and badge must remain, and Inside the blockDAG must unlock.
4. Finish Inside the blockDAG, reload its result, then finish Keys to the Grid and reload again. Each chapter should show its own badge and review; the dashboard should match.
5. Finish Value in Motion, the fourth chapter unlocked after Keys to the Grid, and reload its Value Pathfinder badge and review. The dashboard should show all four chapter completions.
6. Confirm Replay starts a new visit while retaining the original badge and previous completion. Returning to an unfinished visit must restore that visit's step. Replaying an earlier chapter must not relock later chapters.

Do not deliberately disrupt production requests to manufacture failures. Lost replies, stale requests and concurrent answers are already covered locally; record natural production failures if encountered.

## 2. Two-player Royale pilot

Use two distinct participants on separate devices or browser sessions. Guest play is sufficient; no wallet transaction or payment is required. Agree on a test time and keep both browsers visible while checking ready/start behavior.

1. The host opens [Royale](https://www.geekprotocol.xyz/royale/), chooses a **four-seat limit** and shares its invitation privately with one participant. Confirm the host occupies one of two joined seats.
2. Both mark Ready. The host must be able to start with two players despite the four-seat limit. Confirm the countdown and same prompt/options on both screens.
3. Each submits an answer. The accepted answer must lock; correctness should appear only at the shared reveal. Observe the described wrong, missing or slowest-group elimination. Network latency affects response times; do not interpret a faster answer as a learning assessment.
4. Reload one participant's browser after its accepted answer. The same session should restore its seat and answer; the shared clock continues. A missed deadline can legitimately eliminate that player. Do not clear its session.
5. Observe a valid winner, shared victory or no-winner result. An eliminated participant can watch but cannot answer again. Check the room-result medal and confirm the event promises no XP, credits, tokens or persistent inventory award.
6. In a separate waiting room, confirm the host can remove a waiting seat and end the event. Record any room stuck in waiting, inconsistent reveal, duplicate seat, blank question or failed reconnect.

Use ordinary play; no scripted production load test is part of this checklist. After a successful small pilot, plan a larger controlled event and capture provider request/Redis usage privately before promoting 100-player capacity as verified. See [Royale protocol](ROYALE-PROTOCOL.md).

## 3. Owner-only launch checks

Follow [Owner authenticator login](OPERATOR-SECURITY.md) to enroll privately, enable the Production secret and verify the actual Operations status. A merged MFA feature does not prove activation. Never include owner keys, authenticator enrollment material, codes or recovery copies in GitHub evidence.

Follow [Backup and recovery](BACKUP-RECOVERY.md) for completed backups and a restore into a **new isolated destination**. Verify representative durable records, revoke restored bearer sessions, and measure recovery before any cutover. Local Redis drills and a successful database PING do not prove provider backup coverage. Production restore, secret rotation, new infrastructure and cutover are separate owner actions.

## Result record

Record one row per run. Public evidence uses test display names and redacted screenshots only. Keep room invitations, wallet addresses, player/session identifiers, private provider details and enrollment material out of public issues. A pending or failed result remains pending/failed until a recorded retest passes.

| Run / candidate commit | Date and device | Scenario | Expected and observed behavior | Pass / fail / pending | Finding / retest |
| --- | --- | --- | --- | --- | --- |
| `382ffdb5...` | October 9, 18:57 America/Detroit; founder’s existing Android phone/browser | Affected Quest save | Founder confirmed saved chapter resumed at the correct step without replacement | Pass — founder reported | #81 closed after PR #92; completion/replay not covered |
| Current runtime #137; record exact retest release | Pending | Quest campaign and replay | Four badges persist; prerequisites remain correct | Pending | — |
| Current runtime #137; record exact retest release | Pending | Phone profile and learning | Name/Geek/Study/practice and gameplay entry persist | Pending | — |
| Current runtime #137; record exact retest release | Pending | Two-player Royale in a four-seat room | Ready/start, locked answers, reveal, reload and result agree | Pending | — |
| Current runtime #137; record exact retest release | Pending | Owner MFA and account recovery | Privately verified access/recovery; public evidence redacted | Pending | — |
| Current runtime #137; record exact retest release | Pending | Provider backup/isolated restore | Privately verified durable data and measured recovery | Pending | — |

Approve the free-beta scope only after reviewing these results and recording remaining limitations. Monetary gates retain their separate funding, settlement, reconciliation, security and independent-review requirements.


## October 17 player/A.C.E. readiness candidate

[Candidate scope and remaining acceptance](PLAYER-READINESS-2026-10-17.md) cover the integrated saved-player regression, bounded lesson tutor (AI activation absent), selected GEEKT instructions, local performance baseline and 624 reviewed Kaspa concepts. The earlier October 16 inventory above remains historical. The current [production-npm CycloneDX inventory](releases/readiness-2026-10-17.cdx.json) has 37 dependency components and includes integrity-locked AI SDK 7.0.143. Lockfile SHA-256: `537c89fe9aaa0091c013dd8ab716d14eb141c69d89faba194acf7efdddf8fab2`; SBOM SHA-256: `664421b05ffde9503efba711876751581cc8f316c2088f8374624fbe1217b17e`. It describes the locally installed npm graph, not deployed provider artifacts or an independent security audit. October 17 production dependency audit reports zero vulnerabilities. Final checks/CI/deployment are recorded in the maintained project/release record. Actual phone/Silk, live AI evaluation, TN10 transfer and provider restore are still required; Public Alpha remains the release channel.

PR #148 is merged/deployed; 568 tests pass and ten targeted canonical delivery checks pass. The [maintained project baseline](continuity/project.json) records the exact checked head/tree, CI, deployment, probe correction and device/model/wallet/provider limits. This does not change Public Alpha to accepted free beta.
