# GEEK Fair-Mint Protocol

Version: 1.1
Network: Kaspa Mainnet  
Status: implemented, not independently audited

## Purpose and boundary

`/mint/` is a non-custodial interface for the existing GEEK KRC-20 deployment. It can request exactly one mint through Kasware after a direct user click. Kasware constructs the commit/reveal transaction, shows the final request, and requires the user to approve or reject it.

Geek Protocol HQ never receives a seed phrase or private key, cannot sign for the user, and does not custody KAS or GEEK. A public fair mint is separate from the game's internal Alpha GEEK ledger. It does not enable reward withdrawals, treasury settlement, redemptions, or payout eligibility.

## Canonical deployment

The server and browser pin the following record:

| Field | Required value |
|---|---|
| Network | `kaspa-mainnet` |
| Protocol | `KRC-20` |
| Ticker | `GEEK` |
| Mode | `mint` |
| Decimals | `8` |
| Maximum raw supply | `14400000000000000000` |
| Per-mint raw limit | `10000000000000` |
| Per-mint display amount | `100,000 GEEK` |
| Premint | `0` |
| Deployer | `kaspa:qzj0e55rlxpm0knvra9wvgckpkyq9h8hv8wl0lh2ngjad9a4cedmj24cy07ew` |
| Deployment reveal hash | `c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1` |

The total gross mint capacity is 1,440,000 mints. Burned GEEK does not reopen mint capacity; remaining capacity is calculated from gross `minted / max`, not circulating supply.

## Exact wallet request

The only enabled transaction is:

```json
{"p":"KRC-20","op":"mint","tick":"GEEK"}
```

The browser calls Kasware with transaction type `3`, no destination override, and a site-requested priority fee of `0`:

```js
window.kasware.signKRC20Transaction(inscription, 3, undefined, 0)
```

Normal protocol and Kaspa commit/reveal network fees still apply. The project publishes a 1 KAS protocol mint fee, but the wallet confirmation is authoritative for the final cost. Fee estimates can change and HQ does not debit KAS itself.

## Fail-closed sequence

1. The server fetches the GEEK record from the fixed Kasplex KRC-20 primary endpoint. On a transport failure, HTTP 429, or HTTP 5xx, it tries the fixed mainnet fallback published in Kasware's source. Each attempt is bounded to nine seconds; redirects are refused. An HTTP-success response with invalid data or a mismatched deployment stops the sequence without trying another source.
2. It validates every pinned deployment field, integer encoding, supply relationship, and remaining gross mint capacity.
3. The browser independently rechecks the network, deployment hash, ticker, per-mint limit, transaction type, custody flag, and exact three-field inscription.
4. A fresh server check runs immediately before each wallet request.
5. Kasware must report `kaspa_mainnet` and a `kaspa:` receiving account.
6. The user must check the disclosure box and click the mint button.
7. Kasware presents the final transaction for approval. A rejection stops the flow.
8. HQ displays only the returned commit and reveal transaction IDs. Raw transaction data is not retained or rendered.

An unavailable indexer, malformed status response, deployment mismatch, exhausted supply, wrong wallet network, changed wallet account, or missing wallet capability blocks the request before wallet handoff.

A fulfilled Kasware call with no readable transaction ID is not reported as a failed mint. HQ shows a receipt notice and preserves each individually valid 64-character hexadecimal commit/reveal ID. It also accepts a bare transaction ID as a generic reference, without calling it a reveal, and decodes at most two JSON string layers. It does not infer token arrival or mint completion from any receipt. No other field aliases or raw transaction data are accepted. A receipt containing both IDs still means submission only. Responses with no readable ID block another wallet request until the user explicitly checks wallet activity, resets the request, and reviews the terms again; the reset and background status refresh never invoke Kasware. Wallet rejections and thrown errors retain their separate error path.

## Multiple mint requests

- The count selector offers 1, 2, 5, 10, 25, 50, or 100 mints. Each remains an exact, independent type-3 GEEK inscription requesting 100,000 GEEK. The review shows the selected token total and 1 KAS protocol fee per mint, plus separately disclosed network fees. Changing the count clears the acknowledgment. The reviewed total cannot change while a queue runs.
- HQ uses the existing public `signKRC20Transaction` API sequentially. It does not call Kasware's internal batch-mint method, bypass approval, or broadcast raw transactions. Every queued request still requires the user to approve in Kasware; this is not a single-approval bulk transaction.
- Before each request, HQ fetches fresh verified supply and rechecks the selected wallet, provider and Mainnet. It requires sufficient gross remaining mint capacity for the unrequested portion. Counts are bounded to 1–100 and the original wallet and count are fixed for the queue.
- Stop queue prevents further requests, including a request still in preflight. It does not cancel or undo a request already handed to the wallet. Account or network changes stop the queue. A wallet error, unreadable response, or hidden page pauses it. Visibility changes and status recovery never resume a queue automatically.
- Continuing a paused queue requires a new explicit review and click. Unknown outcomes additionally require a wallet-activity acknowledgment. The queue advances past each wallet call already attempted; it never replays one to recover a receipt. The displayed count is wallet requests, not confirmed mints. Receipts remain page-local and can be copied; reloading does not persist or resume a queue.

## Receipt compatibility diagnostics

The current official [Kasware provider](https://github.com/kasware-wallet/extension/blob/78bb30045edd4d898c4d61c4c75ba1bc37e18748/src/background/controller/provider/controller.ts) delegates minting to `signKRC20Tx`, whose current implementation returns JSON with `commitId` and `revealId`. The affected user's exact response was not available during development, so no specific wallet-version defect or wrapper is assumed.

The page optionally reads Kasware's public `getVersion()` without requesting an account, signature, or transaction. The diagnostic stores only a bounded version string, response type, decoded type, JSON layer count, and types of a fixed list of known receipt fields. It never retains raw payloads, field values, arbitrary field names, addresses, keys, or transaction bytes. Copy receipt diagnostics is a separate user action from copying a receipt, and contains no wallet address or transaction IDs. There is no automatic diagnostic logging or transmission. This allows a user to share the response shape if their receipt remains unreadable.

## Availability, recovery, and diagnostics

- Primary: `https://api.kasplex.org/v1/krc20/token/GEEK`
- Fallback: `https://api-fallback.kasplex.org/v1/krc20/token/GEEK`
- The fallback comes from Kasware's `KASPLEX_FALLBACK_MAINNET` constant at [commit 78bb300](https://github.com/kasware-wallet/extension/blob/78bb30045edd4d898c4d61c4c75ba1bc37e18748/src/shared/constant/index.ts). This expands the transport endpoint list within the same Kasplex trust boundary; it does not introduce an independent consensus source. Both responses must pass the exact same deployment and supply checks. The API reports which endpoint answered in `sourceUrl`.
- Successful display status may be cached for ten seconds, with no stale-while-revalidate allowance. A fresh check bypasses and invalidates the prior in-process cache. Failures return a non-cacheable 503; availability failures include `Retry-After: 30`.
- The visible page checks fresh status every 30 seconds and when brought back to the foreground. Checks pause during wallet approval and do not invoke the wallet. A failed check clears displayed live totals; recovery only restores status. Each mint still requires a direct click and a fresh preflight. Client responses older than 60 seconds are rejected.
- Automatic recovery does not clear transaction errors or retry a transaction whose outcome is uncertain. The user must review wallet activity before explicitly acknowledging another request.
- Server logs emit `geek_mint_status_failure` with a fixed source URL, reason, and HTTP status. No wallet identifiers, request headers, raw exception messages, or response bodies are logged. Use Vercel runtime logs to distinguish primary failure, fallback failure, and deployment mismatch.
- On 2026-09-22, production status returned 503, the primary returned HTTP 530 / Cloudflare 1016, and the documented fallback returned a connection failure from the check environment. These observations do not prove a global outage. The recovery change cannot guarantee availability while both upstreams are unreachable.

## Audit evidence

- Canonical status validation: `server/mint.js`
- Read-only status endpoint: `api/mint.js`
- Browser preflight and wallet request: `public/mint/assets/mint.js`
- User disclosures and confirmation: `public/mint/index.html`
- Unit and mismatch cases: `tests/mint.test.js`
- Browser recovery and wallet boundary cases: `tests/mint-client.test.js`
- Machine-checked invariants: `scripts/security-check.mjs`
- Control mapping: `security/controls.json`

## Residual risks

- The application and Kasware integration have not completed an independent penetration test.
- A compromised browser, extension, dependency, hosting account, DNS route, indexer, or device can mislead a user. The Kasware confirmation is the user's final independent checkpoint.
- Kasplex can lag the Kaspa network. A wallet or node can reject a request even when the page displays remaining capacity.
- KAS fees can change between page rendering and wallet approval.
- Commit/reveal protocols can produce partial or delayed outcomes. Users must inspect wallet activity and explorer results before retrying an uncertain transaction.
- On-chain transactions are irreversible. No refund, price, liquidity, profit, availability, or value is promised.

## Reference baseline

- Kasware Kaspa integration guidance: <https://docs.kasware.xyz/wallet/developer-documentation/kaspa>
- Kasware KRC-20 transaction API: <https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-krc20>
- Live GEEK Kasplex record: <https://api.kasplex.org/v1/krc20/token/GEEK>

Deployment values and live state were rechecked on 2026-09-20. Reviewers must recheck them against an independent Kaspa/KRC-20 source before accepting an audit baseline.

## Guided mint experience (October 8, 2026)

The page presents Connect → Review → Approve, with the full selected wallet address and a fee summary beside the review checkbox. Technical inscription/deployment details and common questions are expandable. The connection panel describes minting rather than requesting a player identity signature. Missing Kasware and wrong-network states explain the next step without invoking the wallet.

Preflight and wallet approval have separate visible stages. Review and status-refresh controls are disabled during a pending request. An account/network change clears acknowledgment; an account change during preflight blocks handoff. The request remains exactly one mint, with the existing pinned deployment, Mainnet, fresh-status, fee and user-approval boundaries.

A successful wallet return shows a **submission** receipt, not a confirmation of token arrival. It includes both complete transaction IDs, separate commit/reveal explorer links, the wallet selected for the request, and the local submission time. A later wallet change updates the current selected address without rewriting the previous receipt. Receipt copying is explicit, includes the selected wallet address, and falls back to manual selection if clipboard access is unavailable. Receipts are held only in page memory and are lost on reload; no wallet information is persisted or sent to analytics.

An uncertain or failed wallet outcome remains blocked across status refreshes and review-checkbox changes. The owner of the wallet must inspect wallet activity and explicitly reset the request; reset clears acknowledgment and starts no transaction. A new request still requires a new acknowledgment, click, fresh preflight and wallet approval. This change does not add bulk minting or automated retries, transaction confirmation polling, new wallet adapters or an additional indexer.

Validation: mint client tests cover guided readiness, wrong-network/missing-wallet guidance, pending control locks, account changes during preflight, exact submission receipts, malformed IDs, explicit error reset and clipboard failure, alongside existing outage/recovery and stale-status cases. Browser access was declined during this change; responsive CSS and native keyboard/disclosure controls are reviewed in source, but rendered-layout and real-extension acceptance remain outstanding.
