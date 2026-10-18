# First proof, then expansion

October 18, 2026. LAUNCH-001 / DR-023. HQ is already public as **Alpha**. The immediate goal is one demonstrated learning loop and one separately verified Testnet reward, followed by a bounded release decision. More artwork, modes, wallets, question counts or automation do not replace these observations.

The live runtime baseline is #150 at `0654aa4ed5c4a0ebfa6c248b3f2607363379e4fb`; its prior verification is historical evidence. This change is a candidate until its exact CI, merge and deployment are recorded. See [maintained state](continuity/CURRENT-STATE.md) for the latest release.

## Scope that can be proved now

| Path | Included | Evidence still needed |
| --- | --- | --- |
| Learning | Kaspa Study, source-linked authored A.C.E. help, feedback and saved practice progress | A real phone completes a lesson/practice, reloads and finds the same progress |
| Player identity | Existing passkeys, profile and optional same-player tablet approval | Sign out and return to the same saved player; confirm name/progress. Amazon Silk approval/revocation remains its own device case |
| Free game | Five-question Kaspa Daily, server grading and once-only career XP challenges | Real player finishes and saves a round, claims an eligible XP reward, reloads and sees the same result; Daily/reward replay stays blocked |
| Reward proof | Owner-only manual GEEKT on TN10 | One eligible receipt, one wallet-approved transfer, same-hash indexed confirmation and recipient balance observation |
| Operations | Protected desks, monitoring, existing recovery controls | Passing current health checks and an isolated provider restore with custody and recovery evidence |

This is a supervised proof scope. Full four-chapter campaign/replay and a two-person Royale are still pending in the [free-beta checklist](FREE-BETA-READINESS.md). A successful Study/API run does not accept those features, phone biometrics or production capacity. The founder reviews these actual results before changing the release label to Beta.

## Shortest first-reward run

1. On the founder's phone, use the existing saved HQ player and sign in to [Testnet Operations](https://www.geekprotocol.xyz/ops/testnet/). Check the displayed amount/network and enter the intended recipient. Owner access and the HQ player session are separate; both must be present in the same browser.
2. Follow the desk's Kaspa Daily link. Finish all five questions, with at least one correct, and choose **Finish & save result**. The normal Daily limit still applies.
3. Return to the desk. The new preflight checks the actual current player, complete reviewed-question proof and remaining Redis lifetime. It shows the player name, correct count and a conservative countdown. Loading, returning or refreshing never renews the five-minute window. The queue button stays disabled without a current eligible proof. If expired, the next Daily is at 00:00 UTC; do not reset the player or bypass the lock.
4. Review the recipient and select **Queue pilot receipt**. Select/export the receipt. A queued receipt has sent no tokens. Review whole-token amount, raw units, TN10, sender and deployment in the export.
5. In the approved TN10 wallet, approve exactly one matching transfer. Attach its reveal hash and use **Check same hash**. If the send response is uncertain, reconcile wallet history and that hash before any further action. Inspect recipient balance and retain the final receipt privately.

Returning from a game tab or a browser back-forward cache performs reads only. It never queues a receipt, signs or sends a transaction. Countdown expiry only clears readiness; the server revalidates every queue request and the existing atomic replay locks remain authoritative.

## Release discipline

Fix a failure in these flows before adding optional features. Freeze this candidate's runtime/dependencies after checks; record the exact head/tree, CI, merge, deployment and observed results. If the production check is not green, retain its failure and investigate rather than declare launch health. Keep public evidence free of cookies, credentials, player/run identifiers, wallet addresses and private provider details.

The current bank has 750 internally source-reviewed Kaspa concepts and 537 introductory Study concepts. Finishing the other 250 Kaspa reviews and all eight 1,000-review category targets remains content/CCE work. Those targets do not activate token settlement. Paid A.C.E. generation needs its own model/budget/data-policy evaluation; authored help remains usable. Mainnet payouts, collection ownership, contributor rates and KCC20 migration keep their recorded holds.

## Candidate verification — October 18

- Full repository verification: 574 tests passed, zero failures/skips, native Redis 7.0.15, 311 security assertions and all bank/catalog/readiness, collection/archive, repository, economy, continuity and site checks. Six added tests exercise native-lifetime/no-renewal/access boundaries and client expiry/return behavior; existing replay and transfer checks remain passing.
- Two standard 21-probe checks from this execution environment failed at the unchanged five-second deadline: 9/21 and 10/21 passed respectively. Retain both failed observations. Some public pages and protected 401/303 boundaries responded correctly; these partial results do not establish current overall health or isolate the cause. No timeout threshold was relaxed, remote load test run or infrastructure changed.
- Browser rendering, physical phone/Silk, actual owner/wallet approval, first GEEKT transfer and provider restore are not established by the automated candidate checks. Exact-head CI and release evidence follow in the PR and maintained record.
