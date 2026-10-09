# Geek Protocol Operations

The private Operations home at [www.geekprotocol.xyz/ops/](https://www.geekprotocol.xyz/ops/) links to five focused workspaces. Every page and its assets is served through the existing session function, outside the public output directory. Anonymous page visits redirect to sign-in and asset requests are denied. Public health, question-count and economy APIs retain their public status. No signing or settlement capability is introduced.

## Pages and access

| Page | Server capability | Existing role configuration |
| --- | --- | --- |
| `/ops/` | Owner home and service overview | Owner session |
| `/ops/questions/` | Read community queue; approve, request changes, reject and publish | `CCE_ADMIN_TOKEN` |
| `/ops/activity/` | Read paginated audit events and integrity results | `AUDIT_ADMIN_TOKEN` |
| `/ops/payouts/` | Read masked destination-change cases; approve or reject risk reviews | `PAYOUT_REVIEW_ADMIN_TOKEN` |
| `/ops/appearance/` | Preview and save site-wide holiday themes | Owner session; no additional key |

Sign in once with `OPS_ACCESS_TOKEN` when configured, or the existing CCE moderator key while it is absent. The current sole owner can keep using that existing key. A configured but empty/invalid dedicated owner key fails closed. Owner keys must be 24–512 characters. An optional authenticator adds a second factor through `OPS_TOTP_SECRET`; see [Owner authenticator setup](OPERATOR-SECURITY.md). This remains the current sole-owner identity, not named staff accounts. **Configure a distinct `OPS_ACCESS_TOKEN` before giving anyone the CCE moderator key: the fallback CCE key now grants the complete owner session.**

Login creates a random Redis-backed 30-minute `Secure`, `HttpOnly`, `SameSite=Strict`, `__Host-` cookie. Version 2 sessions explicitly record the owner role and configured permissions; older page-only sessions must sign in again and do not gain API permissions. Permissions are granted by the server only for roles whose existing configuration meets its 24-character requirement. Server-held role secrets never travel to the workspace browser. Changing the owner key, any configured role key, the authenticator secret, or the audit HMAC secret invalidates owner sessions. Reads do not extend the deadline. Sign out deletes the session, revoking copied cookies as well.

All three existing APIs now accept this server-validated owner session for the corresponding permission. While an authenticator is absent, direct API callers may still use their dedicated role credentials. When `OPS_TOTP_SECRET` is configured, all three APIs require the MFA-established owner session and reject direct credential headers. Explicit invalid credentials cannot fall back to a valid owner cookie. Cookie-authenticated mutations require JSON and an exact trusted HTTPS Origin. Cross-site request metadata and untrusted Origins are rejected. Audit remains GET-only. Configuration/storage failures fail closed, and an owner session cannot turn on an unconfigured role or token settlement.

The browser checks owner status before loading its active workspace. Each page requests only its own private records. Navigation, Clear view and sign-out clear loaded records, cancel requests and reject stale replies. Restored browser-history pages recheck the session before loading again. Focus, visibility return and a periodic check enforce session validity. Requests have a 15-second timeout and decisions are never automatically retried: a server-accepted write may complete after a response is lost or a view is cleared. Sign-out failures clear local records and ask the owner to retry revocation.

Keys remain server-side environment secrets and must stay configured even though the UI no longer asks for each role key. The generic sign-in page stores no credential and clears the retired review desk's session-storage value. The legacy `/moderate/` namespace redirects to Operations. Dedicated trusted preview origins can be configured with `OPS_ALLOWED_ORIGINS`, and the deployment's Vercel URL is trusted. No production credential is provisioned or rotated by this release.

## Owner protection and recovery

The owner-only overview reports whether authenticator login is enabled. It never displays the secret or code. Backup status is explicitly unverified until the provider restore drill is completed; connectivity is not backup evidence. See [Operator security](OPERATOR-SECURITY.md) and [Backup recovery](BACKUP-RECOVERY.md).

## Overview

Health uses the existing Redis PING API. A connected result verifies that request, not all game, wallet, treasury or backup operations. Reserve status reads the existing economy catalog and reports address configuration only; there is no indexed reserve balance, funding verification or signer. No private wallet destinations or user identifiers appear in this overview.

The generated count-only question catalog supplies category totals. Imported question review is separate from the CCE submission queue. Public sources document licenses and draft review status. GitHub links open existing issue and private-security reporting; no report inbox or report counter is fabricated.

## Question decisions

1. Sign in once as owner and open the Questions workspace.
2. Check the wording, correct option, explanation, source and contribution rights.
3. Enter a decision note (at least six characters in this workspace).
4. Approve, request changes or reject using the existing endpoint. Rejection requires confirmation.
5. Approved questions require a separate **Publish to games** action and confirmation.

Returned queue length is a window of up to 100 records, not a lifetime or global total. No imported-bank editing, bulk approval, recurring creator earnings or new first-use reward rule is introduced. Contributor identifiers returned by the existing moderation API are not displayed in this workspace.

## Payout-setting risk decisions

Open the Payout reviews workspace with your shared owner session. The endpoint returns masked destinations and existing risk reasons. Both decisions require a note of at least eight characters and explicit confirmation. Approval resolves a destination-setting risk hold; it does not authorize token settlement, remove the existing change cooldown or prove treasury funding. No transfer is constructed, signed or broadcast.

After a successful decision, refresh before reviewing the next case. Any failed or lost decision response clears actionable rows and asks the operator to refresh, because the server may already have recorded the change. This UI introduces no auto-retry or bulk execution. Existing API concurrency behavior is not changed by this release.

## Audit activity

The viewer requests 50 records at a time with newest/older navigation, using the existing API's bounded offset range. Filters and text search apply only to the loaded page. Warning/critical/failed counts describe recorded events; they do not certify attacks, all-time totals or threat detection. Empty pages are reported as having no records to verify. Verification reports record digests using the server's configured integrity mode; an unkeyed Alpha mode is not independent tamper-proof evidence. Events retain pseudonymous server identifiers; the UI displays type, reason, object type, outcome, severity, sequence and time rather than raw identifiers or arbitrary details.

## Holiday themes

Open **Holiday themes** from Operations. Off keeps the standard appearance; Automatic uses the Eastern-time celebration calendar; On lets the owner choose one of 14 holidays until changed. Previewing makes no write. Save applies fixed decorative colors and a small header mark across the public site. Settings default to Off and remain separate for production and previews. Successful saves are recorded atomically in audit activity. A conflict or failed response requires Refresh settings before another save. See [Holiday themes](HOLIDAY-THEMES.md) for dates, caching and verification.

## Verification

`tests/operations-access.test.js` exercises real Redis owner login, scoped API reads/writes, origin/JSON checks, legacy-session rejection, explicit credential isolation, configured-role checks, expiry, key rotation, logout, cookie replay, file allowlisting, rate limits and storage failures. `tests/ops.test.js` covers credential-free browser requests, focused page structure, cancelled/stale replies, mutation serialization, no automatic write retries, safe evidence links, escaped question content and privacy boundaries. Full repository checks retain existing API authorization and review behavior. Browser QA exercises actual moderation/risk/audit handlers through an isolated real Redis fixture and synthetic keys, plus locked, empty, outage, lost-response, confirmation, page-navigation and 320–1280 px layouts. Production credentials and real moderation/risk decisions are not used for QA. This is internal verification, not an independent audit.

## Community contributions

`/ops/community/` reviews Hall applications and offers to help, using the current owner session without a separate role key. Choose Pending or Published, review private evidence, enter a private note and an independently written public description. Publication requires requested recognition, explicit applicant consent and confirmation that you checked the contribution/public identity. Close offers without publishing, or withdraw an existing credit. Refresh after a lost decision response. Nothing in this workspace verifies a donation automatically or sends funds. See [Community Contributions](COMMUNITY-CONTRIBUTIONS.md) for retention and capacity limits.
