# GEEKT TN10 setup and deployment record

**GEEKT is now deployed and accepted by the TN10 indexer.** The founder submitted the external Kasware operations. The operation JSON files remain unsigned reference data; this repository did not send them. Do not deploy this ticker again. The public HQ Mint page remains Mainnet-only. The owner-only manual TN10 receipt pilot is now configured on production; authenticated desk reads have passed on the founder phone; the first receipt and reward transfer remain pending.

## October 15 indexed deployment

At 11:06:40 UTC, the token endpoint reported GEEKT deployed with 144 billion maximum, 100,000 per mint, eight decimals and zero premint. The deploy reveal hash is `2a74f6e1b4cf7c8f813cc089840a1ed85d90be96d6d48eb30f741b03d7161742`. Its operation returned `txAccept: 1`, `opAccept: 1`, no operation error, and a sender matching the founder-supplied address checked privately. Both metadata and operation fields match the prepared payload.

At that snapshot the indexer reported 19 mints, 1,900,000 GEEKT minted and zero transfers. Address holdings also showed GEEKT; address-specific details stay private. These are dated indexer observations. The founder's screenshot shows an ongoing 1,000-operation mint batch; its displayed percentage is batch progress. Neither screenshot completion counters nor this snapshot establish full-batch completion. Native TKAS balance remains unverified after API 403 responses; the screenshot's zero display alone does not establish exhaustion.

Next reconcile the existing mint batch and preserve its hashes. Verify a later stable token balance and spendable fee funds before configuring one manual reward transfer. No new deployment is needed. The public configuration template remains disabled with its sender omitted; the separate production checkpoint below records the applied private configuration.

## Matched deployment parameters

| Setting | Proposal |
| --- | --- |
| Network | Kaspa testnet-10 / Kasware `kaspa_testnet_10` |
| Standard | KRC-20 |
| Test ticker | **GEEKT**, distinct from Mainnet GEEK |
| Maximum | 144,000,000,000 GEEKT |
| Per mint | 100,000 GEEKT |
| Decimals | 8 |
| Premint | 0 |
| Full-supply mint operations | 1,440,000 |
| Initial experiment | Deploy once, verify, mint once and verify 100,000 tokens |
| Later receipt experiment | Proposed 1 GEEKT per eligible manual pilot transfer |

The founder requested matching GEEK tokenomics for a faithful rehearsal. Maximum supply, mint limit, decimals and zero premint now match the pinned `GEEK_DEPLOYMENT` in `server/mint.js`. This supersedes the earlier smaller test-supply proposal, which was never deployed. Network, ticker and eventual deployment identity remain separate. Matching these deploy fields does not implement rewards, pool/burn distribution or settlement; the 1-GEEKT receipt amount is the configured manual test amount, separate from the unselected contributor rate. Review the wallet request and fees before any approval.

- [Unsigned deploy operation](testnet/geekt-deploy.json): wallet operation type **2**.
- [Unsigned first mint operation](testnet/geekt-mint.json): wallet operation type **3**, only after deployment verification.
- [Machine-readable setup and incomplete disabled pilot configuration](testnet/geekt-setup.json).

`max` is 14,400,000,000,000,000,000 smallest units; `lim` is 10,000,000,000,000. Divide by 100,000,000 for display tokens. Neither operation embeds a transfer recipient. The sender stays in private pilot evidence; the wallet provides its current account.

## Verified preparation evidence

On October 15 the fixed TN10 indexer returned `successful` and `state: unused` for **GEEKT**, with no deploy hash. This is a dated observation, not a reservation or assurance of availability at signing. The founder identified Kasware and supplied a testnet address validated by checksum and Kaspa WASM parsing. Its KRC-20 token list was empty. Native REST checks returned HTTP 403, so the wallet screenshot balance remains independently unverified.

Kasware's [Connection API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-connection) documents TN10 and manual mobile network selection. Its [KRC20 API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-krc20) documents deploy/mint/transfer types and user approval. The pinned [Kasplex deploy executor](https://github.com/kasplex/indexer-executor/blob/0e4ee46fb6e7a148dfff38bac78bd8415c312c15/operation/op_deploy.go) validates deploy fields and the eight-decimal default. Its historical minimum protocol fee is 100,000,000,000 sompi (1,000 test KAS), before network fees. Verify current fees and available funds in the wallet before approving; this source is not a current fee quote.

## Reference sequence for a new deployment — already completed here through deployment

1. Use a separately reviewed Kasware deployment integration; HQ has no TN10 deployment signing screen yet. On mobile, select TN10 inside Kasware. Verify installed provider/version, exact `kaspa_testnet_10` network and checksum-valid account. Missing provider or unknown network stops the experiment.
2. Recheck GEEKT availability at the fixed TN10 indexer. If unavailable, already deployed, reserved or ambiguous, stop and revise the proposal. Do not silently select another ticker or reuse a Mainnet hash.
3. Review settings, funds and fees. Load the exact deploy JSON through the documented type-2 method after a direct user action. Inspect network, account and token details in Kasware before final approval. This packet does not initiate a wallet call.
4. Submit once and preserve commit/reveal identifiers, wallet history and timestamp privately. A missing or uncertain result requires reconciling that same request before another submission. A returned hash is submission evidence, not accepted deployment.
5. Read `https://tn10api.kasplex.org/v1/krc20/op/<reveal-hash>` and `/token/GEEKT`. Require the exact hash, accepted transaction and operation, no operation error, expected signer, ticker, maximum, limit, premint and decimals. Record the verified deployment hash privately.
6. Review and submit the first-mint JSON once through type 3 on the same verified network/account. Reconcile its separate hash and verify the accepted mint plus 100,000-token balance. Zero premint means deployment alone gives no tokens.
7. Fill the missing sender and deploy hash in a **private** pilot configuration. Keep `TESTNET_REWARDS_ENABLED=false` until asset, wallet and amount checks pass. Then follow the [manual receipt procedure](TESTNET-REWARD-PILOT.md) for one eligible Daily Signal transfer and reconciliation.

Preparing the original packet sent no wallet operation. The founder subsequently deployed and began minting externally in Kasware, as recorded above. HQ has configured the owner-only manual pilot as recorded below; no reward transfer or HQ TN10 deployment signer is claimed. CCE, collection ownership and Mainnet settlement stay held. Next reconcile the existing batch, then validate the private pilot configuration and execute one manual receipt flow; adding an HQ deployment button is not a prerequisite for this already-deployed asset.

## Production manual pilot configuration — October 15

After the founder reconnected Vercel, seven production-only settings were applied for GEEKT, eight decimals, the verified deploy hash, the privately supplied sender and **1 test GEEKT** (`100000000` raw). This amount is for the manual test, not the unselected contributor rate. The final enable flag is true. No signing key was requested or configured.

The existing verified Mainnet product source `e3fd589878d473939724b06882fb167b1e8d9b0a` was redeployed without a source change as `dpl_FwNcNoHHGZn4Znkz8aUcWobbgEjc`, READY at 12:03:22.952 UTC, assigned to the production domains. PR #114 remains open; it now includes a pilot run-loading UI fix as well as the continuation records.

Twenty read-only production response checks passed through a proxy-aware transport with a fifteen-second timeout. Health returned connected storage and disabled settlement. Anonymous testnet desk access returned 303 to login; its API and script returned 401. Mainnet economic purchase/payout/burn gates remain disabled. The standard local Node monitor with its five-second limit timed out, including after its proxy option; those timeouts are retained as a validation limit, not described as a passed monitor run.

Latest fixed-indexer snapshot at 12:01:31 UTC: 398 mints / 39,800,000 GEEKT, zero transfers. Full batch completion and native fee funds remain unverified. A separate recipient was validated privately and its token list was empty.

## Owner phone acceptance and expired-run blocker — October 15

Founder screenshots at approximately 08:29 Michigan time show a signed-in desk, refreshed empty receipts and GEEKT/testnet-10/`100000000` raw settings. This accepts authenticated desk reads, not receipt creation or wallet signing. A later screenshot at 08:50 shows the current-run API error: `That ranked run expired or is no longer active.` No pilot receipt was created in the supplied evidence. The manually copied run ID and five-minute window blocked the first attempt; the expired proof cannot be reconstructed or replaced with a client score.

PR #114 now adds a read-only current-run lookup when the pilot page opens and a **Use my latest completed Daily** button. It fills only an eligible-looking finished Kaspa Daily, clears stale IDs, explains expired/unfinished/player-session states, and leaves final validation to the receipt server. This fix is locally tested but unmerged and not deployed. The existing five-minute proof lifetime, one Daily per UTC day, receipt replay locks and manual-signing boundary remain unchanged.

**Next owner action after the fix is merged and deployed:** enter the recipient first. Complete the next eligible Kaspa Daily in the same browser/player, choose **Finish & save result**, return immediately to the desk, tap **Use my latest completed Daily**, then **Queue pilot receipt** within five minutes. Do not start another mode first because current-run lookup follows the latest run. If today’s Daily was already started, the next challenge unlocks at 00:00 UTC (8 PM Michigan on October 15). Do not reset identity, erase replay locks or synthesize a run to bypass that limit. The manual `run.id` field remains available for operator diagnosis; no JSON copying is required with the fix.

Review/export the queued receipt before any transfer. No owner credential should be sent through chat. Keep the original hash and inspect the same wallet history if any send result is uncertain. A first queued receipt and reconciled real transfer remain outstanding.
