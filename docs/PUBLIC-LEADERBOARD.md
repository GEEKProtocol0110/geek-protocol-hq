# Public Geek leaderboards

UX-011, founder direction November 5, 2026 (America/Detroit): Geek Protocol needs a global leaderboard and may show Geek Mini stats; Mini's board contains Mini players only. This paired HQ/Mini candidate is not a release or a private-ranked-bank cutover.

## Public experience

HQ `/leaderboard/` is open without sign-in and compares existing HQ scores within a mode/category. A separate Mini view shows the same Mini Daily/Speed standings and selected-board player count as Mini's `/leaderboard`. Different scoring systems are never summed into a fabricated overall intelligence rating. Ties use competition ranks. Dynamic empty/loading/unavailable states do not invent scores or counts. Home, Play and My HQ link to the public HQ board; Mini's header/footer and homepage link its own board.

Mini retains existing `/daily`, `/speed` and `/progress` personal-practice behavior. New `/compete` explicitly asks the player to start a public challenge and explains the public nickname/result. Home's main play links lead to that readiness screen; anonymous personal practice remains one link away. Existing scores are never imported. A random browser-specific Mini identity is independent of the HQ account, with a generated `Mini Geek` nickname. Names cannot be supplied by callers, so this release introduces no free-text public-profile moderation flow.

## Authority and storage

HQ owns `/api/mini` and a pinned copy of Mini's **already-public practice bank** under `server/mini`. Source: GEEKProtocol0110/geek-mini at eae52c3048f19d964b0547946aa2b28372451f47, `src/data/questions/kaspa.daily.json`. This is not the future private ranked bank. The bank fingerprint separates new versions' standings and prevents an old in-flight round from being regraded under changed answers. Future Mini bank edits must review/update this server copy; existing public practice is not evidence of private ranked readiness.

The existing HQ Redis connection is reused only through `geek:mini:v1:` keys. No wallet/reward/account/private-bank state is mutated. Mini's same-origin Next route calls only the fixed canonical HQ endpoint. It stores the random bearer in an HttpOnly, Secure (production), SameSite=Lax cookie, strips it from browser JSON, checks Origin on writes, and never receives a Redis credential. There is no new provider/environment secret. The HTTP body and cookie are not logged by this implementation; existing provider/network request processing still applies.

Server round IDs, selected questions, original-choice grading, server deadlines and sequential answer records determine scores. Client score, elapsed time, nickname and player ID are never accepted. Lua atomically creates/resumes an attempt, consumes a Daily slot, locks each answer through compare-and-set and publishes the best finished result. Same-answer retries are idempotent; changed/reordered answers fail. Server-side Speed expiry closes the run without grading late answers. Returning after an interrupted request can retrieve/resume saved state. A Daily identity has one public attempt per UTC date; Speed has a shared 30-second post-finish break across topics. Users do not need accounts to view or participate.

Mini's public bank remains readable and browsers can create new identities. Server grading prevents edited score payloads; it does not establish honest learning, one person per identity, bot resistance, identity uniqueness or a measure of intelligence. These are low-stakes public practice standings, with no reward, payout or private-ranked-season authority.

## Bounds and removal

Rounds expire after one hour; Daily slots after two days. Identity/board-index state expires after 90 days of inactivity; Daily boards after 35 days without an update and Speed boards after 90 days. Per-identity quotas, a shared anonymous endpoint quota, at most 10,000 new identities per UTC day and at most 10,000 entries per board bound ordinary storage/traffic. These are explicit basic controls, not a capacity guarantee or an independent adversarial audit. Rankings expose only generated nickname, score/counts, rank and update time; no token, address or account identifier is returned in a board response.

Mini lets the cookie holder remove their public standings and identity. Lua serializes removal against an in-flight score update so deletion cannot be undone by a delayed submission. Practice history is separate and unchanged. Losing/clearing the Mini identity cookie loses its control; the design does not claim account recovery or link visitors across devices. Existing practice Clear Mini records does not erase public standings and is labeled separately.

## Release order and checks

1. Review/test both candidates. HQ must release first, including `/api/mini` and server bank packaging.
2. Deploy Mini only after the corresponding HQ API is live. Its fixed proxy destination intentionally remains canonical HQ, including in a Mini preview. No synthetic scores should be written into production for preview testing.
3. Rehearse the pair locally with real Redis and synthetic identities; check origin/cookie handling, duplicate/changed/late answers, restart/resume, attempt boundaries, topic isolation, tie ranks and self-removal races. Exact provider/browser/phone evidence is separate.
4. Keep Mainnet, CCE, settlement, collection ownership and private-ranked-bank holds unchanged. Public leaderboard release does not enable any of them.

Managed local browser preview remains unavailable for Next in this environment because the runner passes Vite-only flags to `next dev`. The HQ static preview server started successfully, but its browser navigation was interrupted and was not retried. Do not change working app startup code or install another browser to compensate. Record actual checks, exact published heads and CI results in the PR descriptions; rendered/device acceptance remains open until performed.

## Local validation record

The real Redis Mini suite passes 11 checks (zero failures/skips), covering deterministic Daily selection, one-attempt resumes, duplicate/changed/reordered answers, identity isolation, late Speed answers, shared cooldown, category separation, competition ranks, midnight/version changes, serialized self-removal and bounded storage. Five Mini proxy tests also cover fixed HQ routing, Secure/HttpOnly identity handling, same-origin writes, forged fields, generic failures and self-removal behavior; the full Mini suite has 38 passing tests. TypeScript, ESLint, Mini production build and its production dependency audit pass. A local paired-code rehearsal exercised the actual Mini route and HQ handler against real Redis through five graded answers, equal public views and removal, while an unrelated HQ profile sentinel remained unchanged. It made no production writes. No rendered/browser/phone acceptance is claimed. Full HQ regression and final CI are recorded in the PR descriptions.

## Released source and HTTP checkpoint

Founder-approved HQ [#238](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/238) merged as `3a98a38dee7eb3d7d7fa2733ab38c324fce88cf4`, matching checked tree `64a2f01a74fd306143b20bcc5e318a6b1c45c25f`. CI 42115327072 passed 741 HQ tests, nine signer checks and supporting verification. Production `dpl_GQDZHv5VKYhJQkx1KffcZnxyygUR` is READY on that merge with both canonical domains; leaderboard HTML/JS/CSS match source and `/api/mini?mode=daily` returns a successful Mini-board read.

Mini [#13](https://github.com/GEEKProtocol0110/geek-mini/pull/13) merged as `845eef9fec91acf5109362750e82a05a56e23711`; CI 42115333430 and both existing production checks succeeded. Public homepage, leaderboard and competition routes return HTTP 200; the Mini proxy returns the corresponding successful board read. No synthetic scores were posted to production. Exact release evidence is retained in the paired PR descriptions. Rendered/device acceptance and independent abuse review remain open; all public-practice limitations and economic/private-ranked holds remain.
