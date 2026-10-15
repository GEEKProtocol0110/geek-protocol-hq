# Free-beta candidate and pilot checklist

**Prepared October 9; refreshed October 15, 2026. Status: current comparison baseline recorded; production acceptance pending. The public release remains Alpha.** This checklist covers Kaspa-first learning and free gameplay. It does not approve paid entry, GEEK rewards, cash-out, treasury settlement, burns, NFT ownership or collection minting.

## Current comparison baseline

| Evidence | Recorded result |
| --- | --- |
| Code baseline | [`5421a78524cd81dcd54aeddb8f04ca01efb75e7c`](https://github.com/GEEKProtocol0110/geek-protocol-hq/commit/5421a78524cd81dcd54aeddb8f04ca01efb75e7c), the PR #109 Kaspa-first onboarding merge; the latest candidate is the checked head/merge of PR #84 |
| Application tree | `d0817b68cd1bcd3ba696f1c5b6d00fc73770dfc6`; the comparison baseline before the final homepage polish in PR #84 |
| Internal verification | 412 tests passed, zero failed/skipped; question, collection, archive, repository, economy stress checks and all 310 security assertions passed on the comparison baseline; rerun on the final PR head before merge |
| Dependency audit | `npm audit --omit=dev --audit-level=high`: zero reported vulnerabilities at verification time; not an independent security audit |
| CI | [Security verification run 38675575595](https://github.com/GEEKProtocol0110/geek-protocol-hq/actions/runs/38675575595) passed on the comparison baseline; [PR #84 checks](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/84/checks) identify the final candidate |
| Deployment | [Vercel production deployment](https://vercel.com/geek-protocols-projects/geek-protocol-hq/DDZUovShyuTDnZwzxWgVPf4ogqS2) reported ready for the comparison baseline; this does not establish private API health or a user's saved-record recovery |
| npm dependency inventory | [CycloneDX 1.5 SBOM](releases/free-beta-2026-10-09.cdx.json), historical October 9 inventory, generated with npm 11.9.0 / local Node 24.19.0; its lockfile hash still matches the current candidate |
| Lockfile SHA-256 | `a20b44b57303cdd9375399cfa7383c042690933c9fbec79a8cd9de3402548296` |
| SBOM SHA-256 | `5a0535cb0e645b703f94700770721fc314aedb6bbcbbdd9ae94661efeee4a426` |

The production lockfile and dependency graph remain unchanged. The retained October 9 inventory records its historical source commit (`382ffdb5...`), not the current application source; the matching lockfile hash above was rechecked October 15. The SBOM contains the declared production npm graph: HQ 0.1.0 and `@dfns/kaspa-wasm` 0.14.1, with its lockfile distribution integrity and license. It is a pre-build inventory, not a deployed artifact attestation or a complete inventory of the WASM package's upstream source dependencies, hosted runtime, Vercel, Redis provider, wallets, indexers or CDN assets. Production runtime and provider configuration remain owner evidence. The generator's root display name was normalized to `package.json`'s name; source commit and lockfile hash were added as metadata properties.

This baseline is recorded for comparison; no release tag, branch freeze, Beta announcement or production configuration change is performed. A code or dependency change requires a new baseline, SBOM when dependencies change, and relevant checks before acceptance. This PR also polishes homepage copy, ordering and responsive CSS; it does not alter gameplay authority or dependencies. Match acceptance to the final deployed PR merge, rather than assuming the comparison baseline includes that polish.

The founder confirmed the reported saved-step recovery on the existing phone/browser after the PR #92 production deployment. This confirmation is limited to resume: it does not complete campaign, badge reload, replay, Royale, owner MFA, or backup/restore acceptance. [Issue #81](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/81) records the closed finding and acceptance.

Current internal coverage includes legacy first-Begin recovery, strict identity records, packaged-verifier reachability from APIs, public ranked-answer exclusion, grading across all category/mode combinations, Royale reveal deadlines and disabled settlement flags. These are repository/real-Redis checks, not production pilot results. See [Identity protocol](IDENTITY-PROTOCOL.md) and [Threat model](THREAT-MODEL.md).

## Onboarding release evidence

The comparison baseline has two direct starting actions, visible sign-in and expandable optional content. Final polish in this PR states the Daily Signal limit before entry, puts practical Kaspa next steps ahead of extra games, improves narrow-header wrapping and footer tap targets, and corrects stale navigation/status copy. See [Mobile onboarding](MOBILE-ONBOARDING.md). Static and client-fixture checks are not new browser-rendering or physical-phone evidence. The founder reported on October 15 that the polished homepage looked good on their physical phone with nothing abnormal. This is a limited visual pass, with device/browser details and individual interaction steps unspecified. The earlier Quest-resume confirmation remains a separate historical pass; neither observation completes broader campaign/profile/device acceptance.

## Acceptance order

| Gate | Current status | Required result |
| --- | --- | --- |
| Reported Quest resume | **Passed — founder confirmation, October 9 at 18:57 America/Detroit; issue #81 closed** | Existing saved chapter resumed at the correct step after PR #92; no replacement profile or reset |
| Quest campaign and replay | **Pending** | All four chapters complete, badges/review persist after reload, and replay preserves badges and later unlocks |
| Phone learning and profile | **Pending** | Kaspa-first entry, visible sign-in, menu, quiz/lesson links, name save, selected Geek, Study, free practice, Gauntlet and dashboard work on actual devices |
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
| Final deployed PR #84 merge | Pending | Quest campaign and replay | Four badges persist; prerequisites remain correct | Pending | — |
| Final deployed PR #84 merge | Pending | Phone profile and learning | Name/Geek/Study/practice and gameplay entry persist | Pending | — |
| Final deployed PR #84 merge | Pending | Two-player Royale in a four-seat room | Ready/start, locked answers, reveal, reload and result agree | Pending | — |
| Final deployed PR #84 merge | Pending | Owner MFA and account recovery | Privately verified access/recovery; public evidence redacted | Pending | — |
| Final deployed PR #84 merge | Pending | Provider backup/isolated restore | Privately verified durable data and measured recovery | Pending | — |

Approve the free-beta scope only after reviewing these results and recording remaining limitations. Monetary gates retain their separate funding, settlement, reconciliation, security and independent-review requirements.
