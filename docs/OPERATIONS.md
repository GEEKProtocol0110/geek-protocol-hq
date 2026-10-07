# Geek Protocol Operations

The workspace at [www.geekprotocol.xyz/ops/](https://www.geekprotocol.xyz/ops/) consolidates existing operator services. The dashboard and its JavaScript/CSS are served by a server-side access gate through the existing session function. Unauthenticated page visits redirect to a generic sign-in page, while unauthenticated asset requests are denied. The UI files live under `server/ops-ui/`, outside the public output directory. Existing public health, question-count and economy APIs retain their public status; this gate protects the Operations workspace. Role APIs continue to require their separate keys. No signing capability or settlement flag is introduced.

## Access

| Section | Existing server setting | Capability |
| --- | --- | --- |
| Community questions | `CCE_ADMIN_TOKEN` | Read community queue; approve, request changes, reject and publish |
| Payout-setting risk reviews | `PAYOUT_REVIEW_ADMIN_TOKEN` | Read masked destination-change cases; approve or reject risk reviews |
| Audit activity | `AUDIT_ADMIN_TOKEN` | Read paginated event records and server verification results |

Page access uses `OPS_ACCESS_TOKEN` when configured. While it is absent, the sole operator signs in with the existing `CCE_ADMIN_TOKEN`. A configured but empty/invalid dedicated key fails closed. This is possession-of-key access, not a named personal-account or MFA identity check. Keep the keys private; configure a separate `OPS_ACCESS_TOKEN` before sharing CCE moderation access.

Successful sign-in creates a random, Redis-backed, 30-minute `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookie. The password is never stored in the browser or session record. The session is tied to the configured access-key fingerprint; access-key/audit-key rotation invalidates it. Reads do not renew the absolute expiry. Logout deletes the server session, so a copied cookie cannot be reused after sign-out. Login/logout require JSON and an exact allowlisted HTTPS origin, are rate limited, and create credential-free audit events. Storage/configuration failures fail closed. Dedicated preview origins can be set in `OPS_ALLOWED_ORIGINS`; the deployment's own Vercel URL is also trusted.

Provision distinct random keys of at least 24 characters through the deployment's secret configuration. Operators obtain only keys for their role. This release does not configure missing production secrets or replace keys with individual MFA-backed login; that remains an operations/security upgrade. Never paste a wallet phrase or signing key into this page.

Each role sends its key only in its designated HTTP header to its existing same-origin API. Keys are not written to browser storage, URLs, analytics or logs by this workspace. Inputs clear after entry. Lock clears the role key, inputs and private rendered data, aborts its request and prevents late replies from repopulating the page. Lock all and pagehide apply this to every role. Reload requires fresh role keys while the short-lived page-access cookie remains valid. **Sign out** additionally revokes that server session. Page focus, visibility return and a periodic check clear roles and return to sign-in when page access has expired. Keys remain available in memory until lock/navigation/reload; this is not an idle-expiry session. Each role allows one in-flight request, uses a 15-second request timeout and never automatically retries a decision. Requests accepted by the server may finish after the browser locks or loses the response.

The legacy `/moderate/` namespace redirects to the protected workspace. Its former public HTML/scripts were removed, including the older session-storage credential behavior. The generic sign-in page removes any leftover `geek-cce-admin` session-storage value without reading/reusing it.

## Overview

Health uses the existing Redis PING API. A connected result verifies that request, not all game, wallet, treasury or backup operations. Reserve status reads the existing economy catalog and reports address configuration only; there is no indexed reserve balance, funding verification or signer. No private wallet destinations or user identifiers appear in this overview.

The generated count-only question catalog supplies category totals. Imported question review is separate from the CCE submission queue. Public sources document licenses and draft review status. GitHub links open existing issue and private-security reporting; no report inbox or report counter is fabricated.

## Question decisions

1. Open the question queue with the CCE key.
2. Check the wording, correct option, explanation, source and contribution rights.
3. Enter a decision note (at least six characters in this workspace).
4. Approve, request changes or reject using the existing endpoint. Rejection requires confirmation.
5. Approved questions require a separate **Publish to games** action and confirmation.

Returned queue length is a window of up to 100 records, not a lifetime or global total. No imported-bank editing, bulk approval, recurring creator earnings or new first-use reward rule is introduced. Contributor identifiers returned by the existing moderation API are not displayed in this workspace.

## Payout-setting risk decisions

Open this queue with the separate payout-review key. The endpoint returns masked destinations and existing risk reasons. Both decisions require a note of at least eight characters and explicit confirmation. Approval resolves a destination-setting risk hold; it does not authorize token settlement, remove the existing change cooldown or prove treasury funding. No transfer is constructed, signed or broadcast.

After a successful decision, refresh before reviewing the next case. Any failed or lost decision response clears actionable rows and asks the operator to refresh, because the server may already have recorded the change. This UI introduces no auto-retry or bulk execution. Existing API concurrency behavior is not changed by this release.

## Audit activity

The viewer requests 50 records at a time with newest/older navigation, using the existing API's bounded offset range. Filters apply only to the loaded page. Warning/critical/failed counts describe recorded events; they do not certify attacks, all-time totals or threat detection. Empty pages are reported as having no records to verify. Verification reports record digests using the server's configured integrity mode; an unkeyed Alpha mode is not independent tamper-proof evidence. Events retain pseudonymous server identifiers; the UI displays type, reason, object type, outcome, severity, sequence and time rather than raw identifiers or arbitrary details.

## Verification

`tests/operations-access.test.js` exercises real Redis login, protected files, origin checks, role-key separation, expiry, key rotation, logout, cookie replay, path allowlisting, rate limits and storage failures. `tests/ops.test.js` covers role-header isolation, cancelled/stale replies, mutation serialization, no automatic write retries, safe evidence links, escaped question content and privacy boundaries. Full repository checks retain existing API authorization and review behavior. Browser QA exercises actual moderation/risk/audit handlers through an isolated real Redis fixture and synthetic keys, plus locked, empty, outage, lost-response, confirmation, page-navigation and 320–1280 px layouts. Production credentials and real moderation/risk decisions are not used for QA. This is internal verification, not an independent audit.
