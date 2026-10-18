# First manual GEEKT reward proof — October 18, 2026

**Completed on Testnet-10.** A completed eligible Kaspa Daily produced an owner-queued receipt, one manually approved Kasware GEEKT transfer, an observed recipient balance increase and an HQ `indexed-confirmed` receipt. CHAIN-001 is complete for this bounded manual pilot. Runtime is deployed PR #152; no runtime or environment change is needed to record this result.

| Boundary | Recorded evidence |
| --- | --- |
| Eligible learning run → receipt | Founder supplied the exported queued receipt from a complete server-graded Kaspa Daily. Receipt ID derivation, configuration fingerprint, exact operation fields and both address checks passed locally. |
| Asset/network | Fresh fixed TN10 indexer reads matched the pinned GEEKT deployment, eight decimals and accepted deploy operation. Its maximum, mint limit and zero premint match the approved GEEK rehearsal parameters. |
| Exact amount | `100000000` base units at eight decimals equals **1 GEEKT**. Sender and recipient are distinct, checksum-valid Testnet addresses. |
| Wallet transfer | Founder approved the transfer externally in Kasware. Direct operation-by-hash and filtered address history matched the receipt's sender, recipient, token, exact amount and post-receipt time. Both transaction and operation acceptance were `1`, with no operation error and valid operation-score/checkpoint fields. The existing server observation validator returned accepted. |
| Recipient balance | Fixed-indexer reads first showed no GEEKT row, then `100000000` base units at eight decimals with zero locked units. This is the observed one-token arrival. |
| Transfer → HQ receipt | Founder attached the matching reveal hash and supplied a physical-phone screenshot at about 03:02 America/Detroit showing `indexed-confirmed` for the same receipt. The prior screen showed the attached hash and same-hash reconciliation control. |

The source evidence includes a queued JSON export, founder phone screenshots and dated read-only indexer observations. Keep the exact wallet addresses, run/receipt identifiers, transfer hash, individual learning result and private exports out of this public record. They were reviewed privately; the final confirmed JSON export should also be retained privately by the owner. An indexer acceptance at observation time is not independent consensus finality or an independent audit.

The first Kasware attempt displayed a disconnected-WebSocket error. At that check the recipient had no indexed GEEKT. A later check found one matching accepted transfer and its balance change, followed by HQ reconciliation. The exact connection recovery action and installed wallet version were not supplied; do not invent a root cause or claim uninterrupted mobile reliability.

## What this closes

- CHAIN-001: the approved asset, real wallet signing path, one manual transfer, same-hash receipt reconciliation and recipient balance observation.
- CHAIN-003: the deployed whole-token/raw-unit review, export/manual-selection path and one-send/same-hash workflow were exercised on the founder phone.
- Part of LAUNCH-001: a real owner-phone Daily-to-receipt-to-wallet-to-indexed-confirmation path has now been demonstrated.

## Remaining release evidence

Retain the final confirmed export privately. Complete the saved-player sign-out/return and separate Silk approval/revocation checks, provider restore/independent source backup, full campaign/replay and a two-person Royale before claiming their acceptance. Production saturation and independent review remain separate.

HQ remains Public Alpha. This pilot uses an external owner-approved manual transfer; automatic signing, Mainnet payouts, collection ownership and CCE/contributor-economy activation retain their existing gates. No new payment amount, paid AI model, token migration or release label is selected by this milestone.
