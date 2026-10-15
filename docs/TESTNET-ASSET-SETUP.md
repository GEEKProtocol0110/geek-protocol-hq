# GEEKT unsigned TN10 setup packet

**Prepared proposal, not deployed.** This packet preserves the exact operation for founder review before a separate wallet signing step. It contains unsigned protocol data, not a signed transaction, deployment hash, reserved ticker or working HQ deployment button. The public Mint page remains Mainnet-only; the Operations testnet desk records manually submitted transfers.

## Proposed parameters

| Setting | Proposal |
| --- | --- |
| Network | Kaspa testnet-10 / Kasware `kaspa_testnet_10` |
| Standard | KRC-20 |
| Test ticker | **GEEKT**, distinct from Mainnet GEEK |
| Maximum | 1,000,000 GEEKT |
| Per mint | 1,000 GEEKT |
| Decimals | 8 |
| Premint | 0 |
| Full-supply mint operations | 1,000 |
| Initial experiment | Deploy once, verify, mint once and verify 1,000 tokens |
| Later receipt experiment | Proposed 1 GEEKT per eligible manual pilot transfer |

The maintainer chose a small test supply for exercising deployment, minting and receipts. It does not amend GEEK's Mainnet supply, contributor rates or launch conditions. Review these settings before any wallet approval.

- [Unsigned deploy operation](testnet/geekt-deploy.json): wallet operation type **2**.
- [Unsigned first mint operation](testnet/geekt-mint.json): wallet operation type **3**, only after deployment verification.
- [Machine-readable setup and incomplete disabled pilot configuration](testnet/geekt-setup.json).

`max` is 100,000,000,000,000 smallest units; `lim` is 100,000,000,000. Divide by 100,000,000 for display tokens. Neither operation embeds a transfer recipient. The sender stays in private pilot evidence; the wallet provides its current account.

## Verified preparation evidence

On October 15 the fixed TN10 indexer returned `successful` and `state: unused` for **GEEKT**, with no deploy hash. This is a dated observation, not a reservation or assurance of availability at signing. The founder identified Kasware and supplied a testnet address validated by checksum and Kaspa WASM parsing. Its KRC-20 token list was empty. Native REST checks returned HTTP 403, so the wallet screenshot balance remains independently unverified.

Kasware's [Connection API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-connection) documents TN10 and manual mobile network selection. Its [KRC20 API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-krc20) documents deploy/mint/transfer types and user approval. The pinned [Kasplex deploy executor](https://github.com/kasplex/indexer-executor/blob/0e4ee46fb6e7a148dfff38bac78bd8415c312c15/operation/op_deploy.go) validates deploy fields and the eight-decimal default. Its historical minimum protocol fee is 100,000,000,000 sompi (1,000 test KAS), before network fees. Verify current fees and available funds in the wallet before approving; this source is not a current fee quote.

## Signing and reconciliation sequence

1. Use a separately reviewed Kasware deployment integration; HQ has no TN10 deployment signing screen yet. On mobile, select TN10 inside Kasware. Verify installed provider/version, exact `kaspa_testnet_10` network and checksum-valid account. Missing provider or unknown network stops the experiment.
2. Recheck GEEKT availability at the fixed TN10 indexer. If unavailable, already deployed, reserved or ambiguous, stop and revise the proposal. Do not silently select another ticker or reuse a Mainnet hash.
3. Review settings, funds and fees. Load the exact deploy JSON through the documented type-2 method after a direct user action. Inspect network, account and token details in Kasware before final approval. This packet does not initiate a wallet call.
4. Submit once and preserve commit/reveal identifiers, wallet history and timestamp privately. A missing or uncertain result requires reconciling that same request before another submission. A returned hash is submission evidence, not accepted deployment.
5. Read `https://tn10api.kasplex.org/v1/krc20/op/<reveal-hash>` and `/token/GEEKT`. Require the exact hash, accepted transaction and operation, no operation error, expected signer, ticker, maximum, limit, premint and decimals. Record the verified deployment hash privately.
6. Review and submit the first-mint JSON once through type 3 on the same verified network/account. Reconcile its separate hash and verify the accepted mint plus 1,000-token balance. Zero premint means deployment alone gives no tokens.
7. Fill the missing sender and deploy hash in a **private** pilot configuration. Keep `TESTNET_REWARDS_ENABLED=false` until asset, wallet and amount checks pass. Then follow the [manual receipt procedure](TESTNET-REWARD-PILOT.md) for one eligible Daily Signal transfer and reconciliation.

No wallet request, deployment, mint, transfer or environment update was performed in preparing this packet. CCE, collection ownership and Mainnet settlement stay held. The next implementation task is a separately reviewed Kasware integration with fresh TN10/asset checks, explicit operation actions, durable uncertain-outcome protection, receipt export and real-device acceptance.
