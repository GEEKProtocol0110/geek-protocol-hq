# Isolated testnet reward pilot

This is an owner-only **manual transfer receipt workflow**, disabled by default. It does not implement an automatic signer or broadcaster, enable Mainnet withdrawals, convert Alpha credits, or promise payments to players. A synthetic fixture acceptance is not a real payout. Production was configured for the one-token manual GEEKT test on October 15; see the [deployment checkpoint](TESTNET-ASSET-SETUP.md#production-manual-pilot-configuration--october-15). Authenticated desk reads/settings were accepted on the founder phone; the first receipt and reward transfer remain pending after a run-expiry blocker. The run-loading UI fix in PR #114 is unmerged.

## October 15 compatibility checkpoint — CHAIN-001

The founder supplied a wallet screenshot showing TN10, a truncated `kaspatest:` address and 1,335,776.56869995 TKAS. This is a displayed wallet balance, not an independent chain balance check or proof of token holdings. The screenshot does not identify the wallet application or establish its dapp provider and signing methods. “No KCC20 tokens found” is a KCC20 display result, not a verified KRC-20 balance.

Source inspection at commit `3eccb9ac1dcf7c8018b21d0ab7acd504639f2143` confirms that `server/mint.js` pins the Mainnet GEEK KRC-20 deployment and `public/mint/assets/mint.js` requires Mainnet plus Kasware's `signKRC20Transaction`. That page is not a TN10 mint interface. The separate `server/testnet-rewards.js` workflow accepts TN10 KRC-20 manual-transfer receipts; it does not deploy, mint, sign or broadcast a token operation and does not implement KCC20.

A fresh read-only GET to `https://tn10api.kasplex.org/v1/krc20/token/GEEK` on October 15 returned `message: successful`, `state: unused`, an empty `hashRev` and zero `minted`. This is a dated indexer observation, not a permanent reservation or proof about another token standard. No configuration, wallet connection, deployment, mint or transfer was performed.

Next: identify the wallet app/provider and verify its TN10 KRC-20 signing workflow against its primary documentation. Specify a separate test asset and verify its deployment, decimals, funded sender and exact transfer amount. Only then configure the existing pilot. The screenshot's test KAS does not establish these prerequisites. Keep the Mainnet mint page and disabled settlement boundaries unchanged.

## Kasware clarification — October 15

The founder identified the screenshot application as **Kasware**. This resolves the app-name question; it does not establish the installed version or a working dapp connection.

Kasware's [Connection API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-connection) documents `kaspa_testnet_10` and says `switchNetwork` is disabled in the mobile app. Select TN10 in the wallet itself. Its [KRC20 API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-krc20) documents deployment, mint and transfer through `signKRC20Transaction`, plus an explicit TN10 network mapping for `submitCommitReveal`. This establishes a documented integration path, not device acceptance or an executed operation.

Next obtain the complete public `kaspatest:` address directly from the founder's wallet for checksum and read-only funding checks. Keep address-specific pilot evidence private. Verify provider presence/version/network on that device before any signing request; specify and verify the separate test asset before enabling receipts. No transaction or wallet connection was performed during this clarification.

## Prepared test-asset proposal

The [GEEKT unsigned setup packet](TESTNET-ASSET-SETUP.md) contains a separate test ticker, exact deploy/mint operations, supply arithmetic, incomplete disabled configuration and signing/reconciliation procedure. The founder subsequently deployed GEEKT externally in Kasware; accepted deployment and partial mint evidence are in the setup record. HQ still has no TN10 deployment signing screen. The founder supplied a valid full test address privately; native balance remains unverified after HTTP 403 responses.

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
2. With the PR #114 UI fix deployed, return to `/ops/testnet/` immediately and choose **Use my latest completed Daily**. The page also reads the latest current run on entry. No JSON copying is needed. Do not start another mode before queuing. The pilot accepts that current player’s run only; the server record lasts five minutes after finishing. Loading does not extend that window. Until that fix is deployed, the operator can read `run.id` from `/api/ranked?resume=1` in the same browser. An expired run cannot be recovered; a Daily already started remains locked until the next UTC day.
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
