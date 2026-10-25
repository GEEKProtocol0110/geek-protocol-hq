# One fresh GEEKT test — DR-027

October 25, 2026: the founder explicitly approves one fresh 1-GEEKT TN10 payment to the same intended recipient after accepting that the original could still confirm and both could arrive. This is a bounded test exception, not historical reconciliation or chain cancellation. The original receipt, signed journal, run lock and original recipient-day/budget records remain untouched. Separate blocked address-history queries are not authorized by this decision.

## Private activation

HQ Production receives TESTNET_AUTO_FRESH_TEST_APPROVAL as a private server-only value containing exactly originalRevealHash, recipient, riskAccepted=true and approvedAt (integer milliseconds). Never commit or print the live identifiers/value. Approval may create an attempt only within 24 hours and only for a matching original prepared/pending GEEKT TN10 job and the configured 100000000 raw units at eight decimals. An already confirmed original creates nothing.

The scheduled worker’s next HQ claim owns the existing sender lease. One Lua transaction compares that lease and the exact original record, checks storage types and all existing caps, writes a durable retirement/authorization marker, and queues a deterministic child. It consumes today’s global budget and recipient-day slot. The child retains the original earned proof, player, asset, amount and recipient but starts without a journal. The separate signer creates and acknowledges a fresh pair through the normal protocol.

## One-time behavior

The original job and journal remain byte-for-byte intact. A durable geek:testnet-auto:retired:v1: marker prevents later claims and updates of that original, even after configuration removal, pause/restart or a lost acknowledgement. The marker records the consent digest, approved time, original journal digest and child lineage privately. It has no expiry. Session cleanup must retain this marker with jobs and journals. Partial database restoration still requires the existing offline reconciliation discipline.

The deterministic child and atomic marker prevent another fresh creation; a child cannot itself authorize another fresh attempt. Stale worker updates fail before external reconciliation reads and in the final Redis CAS. Old signed bytes may still exist outside the service: stopping service retries cannot prove that the chain will never accept them. The founder expressly accepted that remaining risk for this one test.

Public/player views expose only fresh-attempt and service-retries-stopped labels, never signed journals or authorization payloads. They keep queued/prepared/awaiting-indexer/confirmed meanings and never call a retained receipt canceled or paid. No user retry button, new public payout permission, new key, Mainnet activation, question/CCE change or manual transfer is introduced.

## Same-input fee correction

October 25 scheduled diagnostics establish RPC_INSUFFICIENT_FEE on the fresh commit. The pinned SDK defaults to 1 sompi/gram while current TN10 relay policy requires 100. Newly prepared pairs use 100 sompi/gram and retain the existing combined 5,000,000-sompi cap. Final signed-shape checks cover the full calculated mass; TN10's committed mass field stores storage mass only, separately from fee sizing. The pinned SDK's old reveal mass was an unsigned overall estimate. These are protocol corrections, not a higher reward amount.

Only the already approved fresh child may receive one fee correction after a specific insufficient-fee commit rejection. The worker first checks the old hash, reads the synced node's exact original funding outpoint and requires its amount, script, DAA score and coinbase flag to match. It never chooses another coin. The replacement commit spends that same single outpoint, preserves the exact inscription output and reduces only sender change. Its linked reveal preserves the redeem script, destination and one-GEEKT amount. The two conflicting commits cannot both spend the same outpoint, so this cannot add an independently payable third reward. The separately retired original remains under the founder's already accepted duplicate risk.

HQ validates the same-input/output lineage, exact asset, higher fee and combined cap, then appends feeRepair under the existing lease/version/retirement CAS. The original journal remains byte-for-byte intact; the appended journal becomes the active hash only after acknowledgement. Lost replies, stale workers and restarts cannot append another correction or broadcast an unacknowledged candidate. Existing earning, recipient-day, budget, job identity and retirement records remain intact. Accepted originals and malformed repair lineage fail closed. No new job, independent fresh retry, approval expansion, fee override or key change is introduced.

Primary protocol evidence: kaspanet/rusty-kaspa tn10-toc3 mining/src/mempool/config.rs specifies the 100-sompi/gram floor; consensus/src/processes/transaction_validator/tx_validation_in_utxo_context.rs compares the committed field with calculated storage mass. Local offline and real-Redis checks are separate from actual scheduled acceptance.

The SDK can under-estimate contextual mass when paying fees reduces the change output. Before returning any journal, commit construction checks the exact signed shape and may rebuild locally at most twice using the same input, adding the measured fee shortfall plus a bounded reserve. The combined fee cap still applies. Small-input regressions cover this feedback; a cap failure cannot select another coin or persist/broadcast a candidate.
