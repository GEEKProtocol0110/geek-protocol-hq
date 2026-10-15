# GEEK mint availability — issue #14

Task: **OPS-003**. Ticket: [HQ #14](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/14). PR: [#115](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/115). Status: merged, deployed and production-checked; issue #14 closed completed.

## October 15 investigation

Direct connected GitHub REST lists found one open issue across thirteen public Geek Protocol repositories, and no open PRs at the inventory checkpoint. The sole ticket is HQ #14. This is a ticket inventory, not a claim that no other defects exist. The dated [inventory](continuity/github-issues.json) preserves scope; private repositories are excluded.

Historical Vercel production logs for September 23, 11:30–12:00 UTC, were available. At 11:58:54–11:59:54, fixed diagnostic events `geek_mint_status_failure` reported primary `http_error` / HTTP 530 and fallback `transport_error` / null HTTP status. These corroborate the upstream failure observed in the original ticket. They do not establish the provider's internal root cause, and no provider representative was contacted.

At 14:29:59 UTC on October 15, read-only HQ `/api/mint/?fresh=1` returned HTTP 200 and `Cache-Control: no-store, max-age=0`, with the exact pinned GEEK Mainnet deployment verified. It reported `mint.open: true`, 1,758,000,000 minted tokens, 17,580 completed mints and 1,422,420 remaining mints out of 1,440,000. These are gross mint-capacity counts, not circulating-supply or price estimates. Direct primary token lookup also returned HTTP 200 with matching deployment metadata. The fixed fallback returned HTTP 502; redundancy is not independently healthy at this checkpoint. No transaction was requested or sent.

Existing recovery/hardening in commit `698e956` and later mint changes preserve fixed sources, deployment pinning, fallback only for availability errors, explicit paused state, fresh preflight and wallet approval. Existing client fixtures verify PAUSED → live recovery without invoking the wallet. Historical root cause and real-device acceptance remain distinct from fixture results.

## Remaining application gap and candidate fix

The production monitor covered twenty surfaces but omitted mint status. Add a twenty-first read-only probe of the fixed HQ fresh-status endpoint. Check HTTP/no-store, status age, both allowlisted source identities, all pinned deployment fields, raw/display supply arithmetic, remaining operations and explicit noncustodial wallet approval. A verified exhausted supply with minting closed is healthy. Transport/HTTP errors, stale data, deployment substitution, inconsistent capacity or incorrect open/paused state fail; report only the existing bounded metadata, never response bodies.

New reports use schema 2. Exact schema-1 twenty-check snapshots remain readable and unchanged. The owner UI labels them **Earlier coverage**, with a request for a new check; they cannot be presented as mint-covered health. Malformed snapshots remain unavailable. The existing fixed origin, five-second deadlines, global run lock, private owner routes, credential-free scheduled runner and disabled treasury settlement remain unchanged.

## Acceptance and next action

Targeted monitor/owner/client/mint tests cover the new probe, outage and recovery, throttling/gateway/transport failures, mismatched/stale supply, verified exhaustion, retained legacy history and truthful UI labels. Full `npm run verify` passed **441 tests, zero failures/skips**, with real Redis 7.4.2 and 311 security assertions. Fifty-one targeted monitor/owner/client/mint tests passed. The first full run exposed an import-initialization interaction; canonical deployment metadata was extracted unchanged into a pure shared module, preserving the existing mint export without initializing its loader from the monitor. Release-boundary and final full verification passed after that correction. At 14:36:33 UTC, all **21 candidate response validators** passed against the live production endpoints using proxy-aware read-only transport with a fifteen-second timeout; mint status returned HTTP 200 in 4,345 ms. This is a candidate contract check against existing endpoints, not deployment of the new monitoring code or a passed standard five-second runner. Synthetic client tests are not rendered browser or phone acceptance.

The candidate was merged and verified in production, as recorded below. Do not claim that an unmerged probe is deployed or that the remaining fallback 502 was repaired. A future upstream outage must remain visible and fail closed; no mint or automatic retry is needed to verify this change.

## Merged production acceptance — October 15

Founder-authorized PR #115 merged at 14:58:30 UTC as `b0bc952d14d06b34cf82ae7b3794f61f6916c900`. Vercel production `dpl_2koiXamNy5a1eVmMsbuHXnaKKMEG` is READY at 14:58:47.234 UTC on that exact commit and assigned to geekprotocol.xyz and www.geekprotocol.xyz.

The standard `NODE_USE_ENV_PROXY=1 npm run monitor:production -- --json` passed all **21 checks** at 14:59:09.158 UTC, using the existing five-second deadlines. Schema 2; total duration 4,981 ms; mint HTTP 200 in 4,550 ms. This is a passed standard monitor run, separate from the earlier fifteen-second response-only check. GitHub main-branch verify and the production-monitor check also passed. Issue #14 is closed as completed with the evidence preserved in its body.

Closure covers application recovery and mint monitoring. The fallback's earlier HTTP 502 is not claimed repaired; no provider representative supplied an internal root-cause report. PAUSED → live recovery is covered by shipped-client regression tests, not a new rendered phone wallet mint. No blockchain transaction, signing request or settlement enablement was performed. New upstream failures must remain visible and fail closed.
