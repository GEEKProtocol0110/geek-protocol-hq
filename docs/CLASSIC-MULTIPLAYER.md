# Classic multiplayer candidate

GAME-002, November 8, 2026. Stacked on the chess/mobile/polish candidate #253. `/games/online/` is a chess/checkers lounge. Solitaire and Brain Lab retain solo modes; no race mechanic is implied.

## Player flow

Enter explicitly refreshes an existing Geek session or creates a Guest Geek; it does not rename a signed-in player or silently create a session on page load. Display names come from the session, never a submitted opponent-name field. Players can manage their name in My HQ. A host creates a public listed lobby or private invitation-only lobby. Another player opens the invitation or list entry and requests a game; the host accepts one request or declines it. Requesters can withdraw; hosts can close waiting rooms. Accepted players take turns from different devices. Share links are copied locally, never sent to other people by the application.

Host plays White/Gold, guest Black/Cyan. Captures, chained jumps, king safety, chess special moves, promotion choices and terminal rules are authoritative on the server using the same engines as local play. Online has no takebacks. Draw offers require opponent consent; playing a move clears the outstanding draw offer. Resignation records a result and retains the final board. New lobbies provide rematches. Chess automatically applies its casual repetition/fifty-move/insufficient-material draws. Both games finish as a draw at 600 submitted moves/jumps. No ranking, XP, wallet, token or reward writes.

## Storage and concurrency

Routes through `/api/lobbies?service=classic`, preserving existing trivia/royale/duel dispatch. Uses `requireSession` and stable `playerIdFor` for account reconnect. Session cookies remain HttpOnly under existing policy. Redis records have a fixed 24-hour lifetime from creation, not indefinitely sliding expiration. Closed or expired rooms cannot restart. Public listings examine at most the latest 40 of a bounded 100-code index. Up to twelve pending requests per lobby, eight creates per player/hour, twenty requests per player/hour, shared create IP limit and 80 API requests/player/minute. There is no player directory or unsolicited targeted-message channel.

Opaque request IDs and 48-bit random room codes are public. Session/account IDs are excluded from every public view. Requesters only see their own requested flag; hosts see pending names and opaque IDs. Boards and histories are visible only to the two seated players. Private rooms are absent from listings. Hosts must accept a request before the second seat exists. Redis compare-and-set retries re-read and reauthorize each transition; racing accepts reserve exactly one guest. Every move carries the last room revision, so racing/replayed actions cannot make two moves. No optimistic board advancement is shown on an uncertain write.

Room/index keys are isolated from production when VERCEL_ENV is not production, with preview namespaces derived from deployment URL. Existing sessions/profile infrastructure is reused. Reads and moves fail closed when storage is unavailable. Deploying a new preview URL can create a new isolated lounge rather than carry rooms between builds.

## Live behavior and limits

Foreground clients poll every four seconds, with a single in-flight refresh, 10-second request deadlines and stale-page generation checks. Hidden tabs pause polling. This is live turn synchronization, not a WebSocket stream; there is no automatic presence claim, disconnect forfeiture, clock or guaranteed notification while the page is closed. Players reconnect through the invite on the same Geek account/session. Guest sessions on different devices are distinct players. Finishing a game does not create a durable lifetime match record; rooms expire after 24 hours. No chat, external notifications, spectators, push requests or automatic matchmaking.

Validation includes pure rules/permission tests, actual Redis transactions through existing HTTP handlers and shipped-client fixtures. Real Redis tests cover the full create/request/accept/move/reconnect path, private listing exclusion, competing accepts, duplicate moves, draw consent, missing session, expiry and environment isolation. Client fixtures exercise explicit entry, host acceptance, chess move/reply and checkers indices/revisions. These checks do not establish rendered two-browser, physical-device, screen-reader or production acceptance. Preview database configuration and separate-browser/device acceptance remain release checks. Nothing merged/deployed to production.

Local validation result: full `npm test` with compiled Redis 7.2 passes 800/800, zero skips/failures; signer checks 9/9. The twelve new multiplayer checks include seven domain tests, three real-Redis API tests and two shipped-client tests. Site/continuity, JavaScript syntax, public-answer/security (311 assertions), and whitespace checks pass. An initial full test run lacked the isolated worker dependencies; installing its locked package graph and rerunning the entire suite produced the clean result above.

## Release authorization — November 8

Founder requested Merge. Prerequisite #253 merged as 099bb78022bc579dfee72b134d97e47fe868fcc4 after exact-head verify and Vercel checks succeeded. #254 now targets main and includes that squash merge; final merge/deployment disposition is recorded in the #254 review record. Earlier candidate statements above describe the pre-release checkpoint. Separate-browser/device acceptance remains open.

## Abuse hardening — PR #254 security follow-up

- Lobby creation is limited per player (8/h), per network address only (30/h; User-Agent rotation no longer resets it) and globally (600/h).
- Host and requester names that look like links/domains or staff/project identities (geek, gee, official, admin, moderator, support, team, including spacing and common leetspeak) are rejected with `ONLINE_NAME_NOT_ALLOWED` and are also hidden from the public listing.
- Closed or started rooms are removed from the public index; listing reads prune stale entries.
- Each network address can send at most 4 requests per lobby per hour. Hosts can **Block** a request, which bars that player and network address from requesting the same lobby again (`ONLINE_BLOCKED`). Block data and network fingerprints are never returned to clients.
- Non-object request bodies return `INVALID_REQUEST`; unexpected API errors log only `{name, code}` classification, never the raw error.
