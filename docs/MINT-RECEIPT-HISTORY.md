# Local mint receipt history

MINT-001 source candidate, November 13, 2026. No release or real-wallet acceptance is claimed.

The mint page keeps up to 100 recent requests in this browser, across wallets, under `geek:mint-receipts:v1`. Only the connected Mainnet address history is shown. Public receiving addresses, opening times, a display id, request stage and validated transaction references are saved; raw wallet responses, keys and authorization are not saved. This browser storage is editable and never establishes mint authority or chain confirmation. Other users of the same browser can inspect its storage.

Before calling Kasware, save an unknown-outcome marker. A returned response adds any readable commit/reveal or generic transaction ids. A rejected, interrupted or unreadable request remains unconfirmed. Reload does not restore a queue, result authority, acknowledgment checkbox or wallet approval. The user checks Kasware and the fixed explorer links; the page does not reconcile indexed mint success or retry transactions automatically.

History is validated and bounded on read. Links use the fixed Kaspa explorer and validated 64-character hex ids; all labels use textContent. Users may clear only their connected wallet history. Storage failure preserves the current flow and tells users to copy receipts. Concurrent tabs are merged on save where possible; local storage is not a transactional ledger or cross-device backup.

Focused tests cover reloads, pending/rejected requests, wallet/network separation, clearing, invalid/oversized history, false confirmations, and blocked storage. Real-browser layout, physical-wallet transactions and device acceptance remain separate. The existing independent-audit and economic holds remain.
