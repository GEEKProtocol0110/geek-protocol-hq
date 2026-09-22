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

An unavailable indexer, malformed response, deployment mismatch, exhausted supply, wrong wallet network, changed wallet account, missing wallet capability, or invalid result blocks the request.

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
