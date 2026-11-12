# Mainnet GEEK payout worker

Draft port of the tested CHAIN-004 GEEKT worker. Payouts stay off.

The worker uses the same settlement path: one sender lease, a KRC-20 commit/reveal journal saved before broadcast, and exact reveal reconciliation. It targets current KRC-20 GEEK on Kaspa mainnet. It does not add a second payout design.

## Flags

`settlementEligible` and `withdrawalsEnabled` remain false. A saved receiving address does not become eligible for settlement.

`MAINNET_PAYOUT_ENABLED` and `MAINNET_SIGNER_ENABLED` are false in the committed defaults and in `.env.example`. HQ admits a job only when the payout flag is exactly `true`. The signer loads its key only when the signer flag is exactly `true` and `VERCEL_ENV` is `production`. Otherwise the scheduled handler returns paused and does not read the key.

## Reward schedule

Amounts are whole GEEK on the pinned eight-decimal KRC-20 deployment. One qualifying result pays once. A retry of that same result does not pay again.

| Result | Amount |
| --- | --- |
| Qualifying completed Daily | 100 GEEK, once per player per UTC day |
| Finished Gauntlet round | `ROUND_CONFIG.max` for that round, once per finished round |

The Gauntlet ladder is 100, 200, 400, 800, 1500, 2800, 4500, 7000, 11000, 18000. A perfect 10-round Gauntlet is 46,300 GEEK. The amount is the round, not a payment per correct answer.

A Daily qualifies when the five-question round is finished and at least one answer is correct. A finished Gauntlet round is ten answered questions. Speed mode is not paid.

The temporary safety cap is 100,000 GEEK per UTC day. It is not a permanent reward policy. Cap exhaustion saves the learning result and records that earning as not paid. The index also has a 10,000-job safety ceiling.

Jobs are created only for an account-confirmed mainnet receiving address whose cooldown has elapsed, and only when the payout flag is later enabled. The destination is copied onto the job. The hot wallet is not a valid recipient.

## Signing and the hot wallet

The public hot-wallet receive address, which is not the token deploy address, is pinned in `workers/mainnet/schedule.mjs`:

`kaspa:qql9hrch8rqk62ywncjmm4y3qr6dv0d8r0vvu8q7382ccawlwz50xqu0e3gvs`

No private key for that address is stored here. The signer reads `MAINNET_SIGNER_PRIVATE_KEY` from the environment at runtime, using the same secret-env pattern as `TESTNET_SIGNER_PRIVATE_KEY`. Add the signing key in the Vercel or GitHub secret UI. Do not commit it.

`MAINNET_PAYOUT_WORKER_TOKEN` and `CRON_SECRET` are also runtime secrets for a later separate worker project. Set those in the secret UI as well. HQ and the worker must receive the same worker token only as part of an explicit enable.

HQ imports `workers/mainnet/schedule.mjs` from the payout module, so the ranked and session functions trace that schedule without a new deployment glob. The checked-in worker cron lives in `workers/mainnet/vercel.json` for a separate project with root `workers/mainnet`, Node 24, and no framework. Do not point the HQ production project at that directory. Installing the isolated package is `npm ci --prefix workers/mainnet --ignore-scripts`. An alternative host can run `node workers/mainnet/worker.mjs --once` with the same environment secrets. Do not run two signers for this sender.

The signer refuses any sender other than the pinned address, any ticker other than GEEK, any network other than mainnet, and any amount outside the schedule. Offline fixture tests may pass a synthetic key only inside `workers/mainnet/check-signing.mjs`. That path is not used by the scheduled worker.

## Not enabled

This change does not deploy the worker, admit jobs, sign, broadcast, or change CCE or collection ownership. Indexed confirmation would still be an indexer observation, not an independent finality proof. Review the reward rules, the temporary cap, the retention ceiling, and the signer before any explicit enable.
