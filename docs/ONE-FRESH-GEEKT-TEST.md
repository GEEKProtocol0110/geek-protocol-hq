# One fresh GEEKT test — DR-027

October 25, 2026: the founder explicitly approves one fresh 1-GEEKT TN10 payment to the same intended recipient after accepting that the original could still confirm and both could arrive. This is a bounded test exception, not historical reconciliation or chain cancellation. The original receipt, signed journal, run lock and original recipient-day/budget records remain untouched. Separate blocked address-history queries are not authorized by this decision.

## Private activation

HQ Production receives TESTNET_AUTO_FRESH_TEST_APPROVAL as a private server-only value containing exactly originalRevealHash, recipient, riskAccepted=true and approvedAt (integer milliseconds). Never commit or print the live identifiers/value. Approval may create an attempt only within 24 hours and only for a matching original prepared/pending GEEKT TN10 job and the configured 100000000 raw units at eight decimals. An already confirmed original creates nothing.

The scheduled worker’s next HQ claim owns the existing sender lease. One Lua transaction compares that lease and the exact original record, checks storage types and all existing caps, writes a durable retirement/authorization marker, and queues a deterministic child. It consumes today’s global budget and recipient-day slot. The child retains the original earned proof, player, asset, amount and recipient but starts without a journal. The separate signer creates and acknowledges a fresh pair through the normal protocol.

## One-time behavior

The original job and journal remain byte-for-byte intact. A durable geek:testnet-auto:retired:v1: marker prevents later claims and updates of that original, even after configuration removal, pause/restart or a lost acknowledgement. The marker records the consent digest, approved time, original journal digest and child lineage privately. It has no expiry. Session cleanup must retain this marker with jobs and journals. Partial database restoration still requires the existing offline reconciliation discipline.

The deterministic child and atomic marker prevent another fresh creation; a child cannot itself authorize another fresh attempt. Stale worker updates fail before external reconciliation reads and in the final Redis CAS. Old signed bytes may still exist outside the service: stopping service retries cannot prove that the chain will never accept them. The founder expressly accepted that remaining risk for this one test.

Public/player views expose only fresh-attempt and service-retries-stopped labels, never signed journals or authorization payloads. They keep queued/prepared/awaiting-indexer/confirmed meanings and never call a retained receipt canceled or paid. No user retry button, new public payout permission, new key, Mainnet activation, question/CCE change or manual transfer is introduced.
