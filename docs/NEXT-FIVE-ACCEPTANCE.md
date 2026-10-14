# October 14 improvements: acceptance and remaining work

The release implements the following software. It does not assert that outside acceptance work happened.

| Improvement | Implemented | Remaining acceptance |
| --- | --- | --- |
| Imported question review | Private ten-row review desk, explicit source check, atomic stale-version checks, correction / retirement export, new-identity staging | Owner checks actual imported sources and publishes a reviewed bank change; independent editorial review |
| Mobile entry and recovery | Guest option before wallet setup, fixed activity return links, readable form sizing and larger mobile controls | Physical Android / iPhone layout, keyboard, wallet, reconnect and recovery trials |
| Deeper guided learning | Three practical technology lessons; fifteen original questions; eleven topics / 191 concepts; saved mistakes and source links | Learner feedback and independent editorial review |
| Royale discovery | Opt-in public waiting-room list, default private invitations, counts-only discovery, bounded index and explicit join | Actual 10–20-player cross-device community match and observed production latency |
| Testnet reward pilot | Private, disabled-by-default graded-run receipts, exact instructions, one attached transaction hash, indexed acceptance checks | Approved funded test wallet, deployed test asset, reviewed signer, real transfer and recipient balance evidence |

## Phone trials

For each available phone, start as a guest, read one technology lesson, finish practice, reload and review a missed concept. Then enter sign-in from Study, Play, Royale and Quest and check its return destination. Test the on-screen keyboard at 320–430 px widths, large text, landscape, touch targets, copy fallback and flaky connectivity. Record phone model, OS, browser and observed result. Do not repeat a timed answer or create a second game after an uncertain response; refresh saved state first. Existing recovery requires the same verified wallet identity; test it separately with an approved wallet.

The implementation environment had no permitted browser preview or physical phone. Synthetic client tests and static markup checks are behavior evidence, not rendered mobile or wallet acceptance.

## Community Royale trial

Use a free room with capacity 20. The host explicitly checks the public-listing option; a private control room must not appear in discovery. Recruit 10–20 willing participants independently; this release did not invite or message anyone. Avoid sensitive display names: names become visible to joined players, while discovery itself has only the code, category and counts.

Confirm that Use this code only fills the invitation form, and Join Royale takes the seat after name review. Ready all online players and start a partially filled room. Observe the shared clock, answer locking, elimination, ties, late/reconnected players, results and expired invitation. Test one host disconnect before start: discovery should exclude a host unseen for sixty seconds and include the waiting room again after the host returns. Started, ended and full rooms must be absent. Indexer / Redis failures must show unavailable status, never invented rooms or counts.

Record concurrent participant count, device mix, observed request latency, disconnects and any confusing screens. A 100-player local Redis fixture is not a 100-person production trial. Public discovery is limited to twenty current summaries from the latest 250 opt-in rooms. It is not a permanent lobby directory or guaranteed seat reservation.

## Editorial and reward steps

Use [Imported Question Review](IMPORTED-QUESTION-REVIEW.md) for the actual bank decisions and a separately checked source release. Corrections retire the old grading identity instead of silently changing a saved run.

Use [Testnet Reward Pilot](TESTNET-REWARD-PILOT.md) for configuration and an actual funded transfer. Keep synthetic tests and live payout evidence separate. Mainnet withdrawals and automatic settlement remain disabled.
