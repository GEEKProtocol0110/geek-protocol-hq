# Mainnet GEEK payout worker

Draft port of the tested CHAIN-004 GEEKT worker. Payouts stay off.

The worker uses the same settlement path: one sender lease, a KRC-20 commit/reveal journal saved before broadcast, and exact reveal reconciliation. It targets current KRC-20 GEEK on Kaspa mainnet. It does not add a second payout design.

## Flags

`settlementEligible` and `withdrawalsEnabled` remain false. A saved receiving address does not become eligible for settlement.

`MAINNET_PAYOUT_ENABLED` and `MAINNET_SIGNER_ENABLED` are false in the committed defaults and in `.env.example`. HQ admits a job only when the payout flag is exactly `true` and `VERCEL_ENV` is `production`. Preview cannot admit or pay, even if a secret is present. A missing worker token skips admission and does not fail the saved answer. The signer, including `workers/mainnet/worker.mjs`, loads its key only when the signer flag is exactly `true` and the environment is production.

## Reward schedule

Amounts are whole GEEK on the pinned eight-decimal KRC-20 deployment. One finished round pays once. A retry of that same round does not pay again. The correct count is the number of server-graded boolean answers. The client does not supply the count, the round, or the amount.

| Result | Amount |
| --- | --- |
| Qualifying completed Daily | 100 GEEK once per player per UTC day, not per question |
| Finished Gauntlet round | `ROUND_CONFIG.reward` times the graded correct count |

Per-answer rewards are 10, 20, 40, 80, 150, 280, 450, 700, 1100, 1800. A perfect round is that reward times 10, the same integers as `ROUND_CONFIG.max`. A perfect 10-round Gauntlet is 46,300 GEEK. One correct answer in round 10 is 1,800. The 18,000 perfect maximum is not payable for that job. Zero correct admits no job. The calculation is integer `max × correctCount / 10`, which is exact on this table.

A Daily qualifies when the five-question round is finished and at least one answer is correct. Speed mode is not paid.

Three temporary caps apply together: 100,000 GEEK globally per UTC day, and 46,400 GEEK per player and per receiving address (one perfect Gauntlet plus one Daily). They are not permanent policy. Exhaustion of any cap saves the learning result and records that earning as not paid. Play is not blocked.

The active index holds outstanding jobs only. `indexed-confirmed` and `stuck` jobs are removed, so the 10,000-job ceiling counts work still in the queue. A claim reads at most 50 active ids.

A journal that is still unconfirmed six hours after its first `submitted` time is marked `stuck`. The clock does not start at preparation, so a journal that was never submitted is not abandoned. Stuck jobs are listed in `geek:mainnet-payout:stuck:v1` and emit the fixed code `PAYOUT_UNCONFIRMED`. The original journal and earning lock stay. The job is not broadcast again and cannot receive a replacement journal. A later manual check of that same hash can still record confirmation. Automatic retry is not allowed.

Jobs are created only for an account-confirmed mainnet receiving address whose cooldown has elapsed, and only in production when the payout flag is later enabled. The destination is copied onto the job. The hot wallet is not a valid recipient. Ranked starts are limited to 20 per hour for one network address. Changing the User-Agent does not reset that limit.

## Signing and the hot wallet

The public hot-wallet receive address, which is not the token deploy address, is pinned in `workers/mainnet/schedule.mjs`:

`kaspa:qql9hrch8rqk62ywncjmm4y3qr6dv0d8r0vvu8q7382ccawlwz50xqu0e3gvs`

No private key for that address is stored here. The signer reads `MAINNET_SIGNER_PRIVATE_KEY` from the environment at runtime, using the same secret-env pattern as `TESTNET_SIGNER_PRIVATE_KEY`. Add the signing key in the Vercel or GitHub secret UI. Do not commit it.

`MAINNET_PAYOUT_WORKER_TOKEN` and `CRON_SECRET` are also runtime secrets for a later separate worker project. Set those in the secret UI as well. HQ and the worker must receive the same worker token only as part of an explicit enable.

HQ imports `workers/mainnet/schedule.mjs` from the payout module, so the ranked and session functions trace that schedule without a new deployment glob. The checked-in worker cron lives in `workers/mainnet/vercel.json` for a separate project with root `workers/mainnet`, Node 24, and no framework. Do not point the HQ production project at that directory. Installing the isolated package is `npm ci --prefix workers/mainnet --ignore-scripts`. An alternative host can run `node workers/mainnet/worker.mjs --once` with the same environment secrets. Do not run two signers for this sender.

The signer refuses any sender other than the pinned address, any ticker other than GEEK, and any network other than mainnet. It recomputes the amount from the job proof's kind, round, and `correctCount` and requires an exact match. An amount that is valid for a different correct count is a policy failure. Each admitted job also carries an HMAC over an explicit ordered list of payable fields: earning id, amount, recipient, sender, player, network, protocol, ticker, decimals, deployment, fingerprint, and each proof field (`kind`, `round`, `correctCount`, `runId`). Nested proof fields are not dropped. The secret name is `MAINNET_PAYOUT_JOB_HMAC`. It is Production-only. Add it later in the Vercel or GitHub secret UI for HQ production and the worker project. Do not put a value in the repository. Preview, or a process without that secret, does not create a signature production will accept. Claim, the worker, and the signer all reject a missing, wrong, or mutated mac and do not pay that job. A record that fails decoding or the mac check is logged with a fixed code and moved to `geek:mainnet-payout:quarantine:v1`. The job body and earning lock stay. The first accepted journal is stored in `geek:mainnet-payout:signed:v1`, which the worker handler writes. Claim, payment processing, and the signer refuse a second, different signature for that earning, including when the original queued record is put back on the queue. The same journal can still be reconciled. A stuck job that is later confirmed is removed from the stuck list. Changing a temporary cap does not change the fingerprint. Changing network, protocol, ticker, decimals, deployment, or sender does.

Offline fixture tests may pass a synthetic key only inside `workers/mainnet/check-signing.mjs`. That path is not used by the scheduled worker. `MAINNET_*`, `CRON_SECRET`, and the signing key are Production-only settings.

## Not enabled

This change does not deploy the worker, admit jobs, sign, broadcast, or change CCE or collection ownership. Indexed confirmation would still be an indexer observation, not an independent finality proof. Review the reward rules, the temporary cap, the retention ceiling, and the signer before any explicit enable.


## November 13 recovery follow-up (source candidate)

Review of draft #278 at `721c973eb32d8d6b38c281331a7f06dbdb9a03bc` reproduced a failure between the replay-marker write and the journal save. A failed second write could leave an unpaid queued earning marked signed but without its journal, causing quarantine on retry. No broadcast was needed to reproduce this availability failure.

Preparation now checks the exact job snapshot, live sender lease, replay-marker key type, and any existing reveal id before writing the marker and complete prepared job in one Redis Lua operation. A rejected request writes neither record. A lost acknowledgment after successful execution preserves both records, and the next claim retrieves the same journal. Previously accepted replay markers cannot be replaced. This removes the inter-request failure window; it does not establish provider durability or backup/restore safety.

Real local Redis regression tests exercise a request rejected before execution, a response lost after commit, lease expiry at execution, a changed job snapshot, a conflicting reveal marker, and an invalid marker-key type. Existing replay and flags-off checks remain. This is an internal source candidate only; all external audit, release and economic holds remain.
