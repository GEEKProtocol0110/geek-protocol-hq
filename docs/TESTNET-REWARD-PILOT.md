# Isolated testnet reward pilot

This is an owner-only **manual transfer receipt workflow**, disabled by default. It does not implement an automatic signer or broadcaster, enable Mainnet withdrawals, convert Alpha credits, or promise payments to players. A synthetic fixture acceptance is not a real payout.

## Configure a real pilot

Use a separate funded testnet wallet and an approved signing tool outside HQ. Do not place wallet seeds or private keys in HQ, its environment, exports, browser storage, logs or chat. Verify the signing tool's network and transaction behavior separately before its first use.

The server accepts only `testnet-10`. Its fixed read-only indexer is `https://tn10api.kasplex.org/v1/krc20`; there is no configurable arbitrary URL or Mainnet fallback. A read-only observation on October 14, 2026 returned `state: unused` for testnet GEEK. No test GEEK deployment or funding was performed here. Deploy and fund the approved test asset before enabling the workflow; a matching ticker on Mainnet is insufficient.

Set every public configuration field below in the deployment environment, then redeploy. These are asset parameters and public addresses, not signing credentials:

| Variable | Required value |
| --- | --- |
| `TESTNET_REWARDS_ENABLED` | `true` only after the pilot prerequisites are met; default `false` |
| `TESTNET_REWARDS_NETWORK` | Exactly `testnet-10` |
| `TESTNET_REWARDS_TICKER` | Approved 4–6 uppercase-letter ticker |
| `TESTNET_REWARDS_DEPLOYMENT_HASH` | Exact testnet deploy reveal hash, 64 lowercase hex characters |
| `TESTNET_REWARDS_DECIMALS` | Exact deployment decimals, 0–18 |
| `TESTNET_REWARDS_SENDER` | Approved checksum-valid `kaspatest:` sender |
| `TESTNET_REWARDS_AMOUNT_RAW` | Positive canonical integer string, at most 20 digits; smallest token units |

The owner session must have the configured payout-review permission. Existing owner login, MFA when configured, origin checks, JSON writes and credential rotation apply. Direct credential headers cannot bypass this pilot's owner-session requirement.

## Run one concrete test

1. Sign in to Operations and play a complete **Kaspa Daily Signal** with the same HQ player in that browser. Finish all five questions, with at least one correct answer. Study, Royale, aborted rounds, other categories and client-supplied scores are ineligible. The pilot does not certify proctored knowledge or wallet ownership.
2. Obtain the finished run ID from your own ranked API response during the controlled pilot. The private pilot accepts that current player's run only; the server record lasts five minutes after finishing. This is an operator workflow, not public reward onboarding.
3. Open `/ops/testnet/`, enter the run ID and approved testnet recipient, and queue the receipt. The server rechecks the pinned deploy operation and token metadata and commits against the unchanged server run. One persistent replay lock per run prevents a second receipt. The pilot stops at 100 stored receipts.
4. Select and export the queued receipt. Review network, sender, deployment hash, recipient, decimals and raw amount. The exported `transfer` object is unsigned protocol instruction data, not a ready-to-broadcast transaction.
5. In the separately approved wallet, submit exactly that testnet transfer **once**. Verify test KAS for fees and the test token balance first. Record the returned transfer reveal hash. HQ does not sign or submit it.
6. Attach that hash to the selected receipt. Attachment is an operator assertion; `awaiting-indexer` is not proof that a transaction exists. The atomic hash lock prevents reuse across different receipts. A stale tab cannot overwrite the record.
7. Choose **Check same hash**. A missing operation stays pending. A mismatched protocol, operation, hash, ticker, sender, recipient, raw amount or pre-receipt timestamp is rejected. Both transaction and operation acceptance must equal `1`, with no operation error and valid operation score/checkpoint, before the state becomes `indexed-confirmed`.
8. Check it again after the indexer advances and inspect the recipient balance with the approved testnet tooling. Export the final receipt and record the network, deploy hash, transfer hash, exact amount and recipient balance observation. These observations are the evidence for a real payout; none was produced by this code release.

If any send response is uncertain, stop and reconcile the same wallet history and hash. Do not retry the transfer automatically. A hash is never erased or reset for another send. Rechecking a previously accepted operation can downgrade the receipt to pending if the indexer no longer accepts it. This preserves the hash and replay locks. `indexed-confirmed` means a matching indexed operation was accepted at the last check; it is not independent consensus finality, an independent audit or proof of a production settlement system.

## Retention and limits

Pilot receipts, the per-run locks and transaction locks persist without TTL so expiry cannot authorize another receipt for the same run. The private listing shows the newest twenty receipts; stored capacity is one hundred. Export records during the pilot. After reconciliation, an operator must define retention before extending this prototype; deleting replay locks casually would undo its duplicate protection. Addresses and run IDs stay in private records and exports, never public analytics. Audit events describe requested transitions and omit raw wallet addresses.

Changing any asset configuration changes its fingerprint. Existing receipts remain readable but cannot advance under different configuration. Disabling the pilot blocks writes; it does not erase evidence. No automatic retries are performed by the desk.

## Primary protocol references

Implementation was checked against [Kasplex SDK Kiwi](https://github.com/kasplex/sdk-kiwi/tree/06dc75ea1066aba4d78eb32711690f6f123a9575), especially its testnet constants, operation API and response types, and [Kasplex indexer executor](https://github.com/kasplex/indexer-executor/tree/0e4ee46fb6e7a148dfff38bac78bd8415c312c15) for accepted / rejected transfer semantics. These references do not establish the provenance of an unconfigured test asset or authorize its signer.

Real-Redis tests exercise a completed ranked Daily run, atomic receipt creation, disabled and wrong-network configuration, private access, stale writes, asset mismatch, exact indexed transfer matching, replay protection and damaged records. The transfer/indexer fixtures are synthetic and perform no blockchain transaction.
