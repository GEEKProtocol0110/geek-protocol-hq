# Geek Protocol HQ

The official Geek Protocol experience for Kaspa: a server-ranked trivia game and community hub.

## Included

- Geek Protocol landing page
- Ten-round server-authoritative Gauntlet
- Server-authoritative Daily Signal and 30-second Speed Signal modes adapted from Geek Mini
- Eight selectable trivia categories
- Kasware connection, mainnet detection, GEEK balance display, and server-verified Kaspa Schnorr ownership proof
- Non-custodial, one-at-a-time GEEK KRC-20 fair-mint requests with live deployment and remaining-supply verification
- Wallet-recoverable player identities with older-session invalidation
- Fresh, single-use wallet authorization for protected payout-setting changes
- Exact-origin enforcement when wallet challenges are issued and verified
- Wallet-neutral payout destination registration for any valid Kaspa mainnet address
- Persistent payout-change notices and a private high-risk review queue
- Anonymous server sessions with secure, HTTP-only cookies
- Persistent lobby records, active-seat presence, and shareable live room codes
- Category- and mode-specific verified global leaderboards
- Community Content Engine submission, review, publication, and first-use reward ledger
- Integrity-protected, pseudonymous security events for sensitive Alpha changes
- Private auditor export with per-record verification
- Lobby, rewards, current litepaper, live mint, and Kaspa information pages
- Public security and audit-readiness status page
- Private server-side question banks plus complete artwork, styles, and scripts

## Run locally

The public information pages can be served as static files. Ranked play requires the Vercel Functions in `api` and Redis credentials; answer keys are intentionally unavailable to the browser.

Run the API integration tests with:

```sh
npm test
```

## Deployment

Vercel deploys `public` directly and discovers the JavaScript functions in `api`. Connect an Upstash Redis database to the project so Vercel provides:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The server also accepts the legacy `KV_REST_API_URL` and `KV_REST_API_TOKEN` names. After adding variables, redeploy the project. If storage is unavailable, information pages and URL-based local lobby invites continue working, while ranked play remains locked.

Community Content Engine moderation also requires:

- `CCE_ADMIN_TOKEN`: a private random moderator key of at least 24 characters
- `CCE_REWARD_AMOUNT`: integer Alpha GEEK credited on a published question's first ranked use (defaults to `25`)

Audit evidence supports:

- `AUDIT_LOG_SECRET`: at least 32 random characters used to HMAC-SHA-256 security events
- `AUDIT_KEY_ID`: non-secret identifier for the current audit-integrity key
- `AUDIT_ADMIN_TOKEN`: private random token of at least 24 characters for `/api/audit` exports

Private payout-risk decisions require a separate role secret:

- `PAYOUT_REVIEW_ADMIN_TOKEN`: a private random token of at least 24 characters for `/api/payout-review`

Wallet identity also supports:

- `IDENTITY_ALLOWED_ORIGINS`: optional comma-separated HTTPS origins beyond the two production hostnames and Vercel preview hostnames
- `IDENTITY_ORIGIN`: legacy single-origin allowlist entry retained for deployment compatibility
- `IDENTITY_ENV`: an optional non-Vercel environment namespace; Vercel automatically separates production and preview identity keys

If `AUDIT_LOG_SECRET` is absent, Alpha events use visibly labeled unkeyed SHA-256 integrity. That mode is not sufficient for mainnet settlement. Real settlement must fail closed until keyed integrity, separately administered append-only replication, monitoring, and retention are configured.

The private review desk lives at `/moderate/`. The key is sent only in the `X-CCE-Admin` request header and is held in browser `sessionStorage`, so closing the tab clears it.

## Ranked integrity

- Question selection and option order use server-side cryptographic randomness.
- Correct answers are bundled only with the ranked function, never under `public`.
- Each question has a one-use opaque token and a server-enforced deadline.
- Atomic answer claims stop parallel multi-answer races and replayed answers return the first committed result.
- The server computes streaks, speed bonuses, XP, Alpha GEEK, and final scores.
- Daily and Speed modes award XP and verified scores but no Alpha GEEK during the Alpha.
- Daily attempts are limited server-side by UTC day; Speed uses one server-owned 30-second run deadline.
- The leaderboard endpoint is read-only; only the ranked service can write a result.
- Session- and network-level rate limits reduce automated run farming.

## Identity and recovery

- `/api/identity` issues a random, five-minute server challenge bound to the exact origin, action, identity wallet, and requested payout destination when applicable.
- The exact requesting HTTPS origin is embedded in the signed text and rechecked when the proof is submitted; a challenge cannot move between the apex and `www` hosts.
- Kasware signs human-readable text with explicit Schnorr mode. The browser never sends a seed phrase or private key.
- The server verifies the signature and derives the Kaspa mainnet address from the supplied public key before creating any binding.
- Challenge records and payout authorizations are atomically consumed once. Replays fail closed.
- Wallet/player binding, session replacement, and the successful audit event commit in one Redis compare-and-set transition, preventing partial or raced identity claims.
- A linked wallet can recover the same persistent profile in a new browser. Recovery increments an identity session version, invalidating older authenticated sessions.
- Identity keys are environment-scoped so preview bindings cannot overwrite production bindings.
- The pinned `@dfns/kaspa-wasm` package supplies the Node-compatible Kaspa personal-message verifier. Its exact version and integrity digest are locked for independent dependency review.

## Payout change protection

- Every destination create, change, reaffirmation, or removal stores a persistent in-product security notice with masked addresses only.
- Unlinked identities, ownership-unverified destinations, destination changes, recent identity recovery, and repeated recent mutations create a private review record.
- Review records expose no player ID or raw address through the reviewer API. Reviewer decisions create pseudonymous, integrity-protected audit evidence.
- `PAYOUT_REVIEW_ADMIN_TOKEN` is separate from moderation and audit-export credentials. A review decision never enables withdrawals or makes a payout settlement-eligible.
- The precise policy and residual limitations are documented in `docs/PAYOUT-RISK-CONTROLS.md`.

## Transparent Alpha

Ranked Alpha balances, XP, game progress, lobbies, presence, verified scores, contributions, C.C.E. reward records, wallet identity bindings, and payout-address preferences use Redis. Server verification protects competitive integrity and wallet proof, but this is still an unproctored web trivia game and cannot prevent every form of outside assistance.

C.C.E. rewards are internal, claim-gated Alpha ledger credits. They are created only once, when an approved and published question is first answered in ranked play. They are not token transfers, cannot be withdrawn, and have no promised monetary value. A player may register any checksum-valid Kaspa mainnet address as a future destination. The separate `/mint/` page can ask Kasware to create one user-approved mint against the pinned existing GEEK deployment. HQ never signs or submits that transaction for the user. Treasury settlement, reward transfers, withdrawals, and on-chain rewards remain disabled.

## Audit readiness

The project has not completed an independent audit. `SECURITY.md`, `docs/THREAT-MODEL.md`, `docs/MINT-PROTOCOL.md`, `docs/IDENTITY-PROTOCOL.md`, `docs/PAYOUT-RISK-CONTROLS.md`, `docs/DEPENDENCY-PROVENANCE.md`, `docs/AUDIT-SCOPE.md`, and `security/controls.json` define the review baseline and evidence map. `npm run verify` runs integration tests and checks the pinned mint deployment, fail-closed settlement, private answer-bank, HTTP-header, wallet-proof, payout-review, audit-integrity, and control-evidence invariants.

Geek Protocol requires two independent scopes before value moves: a Web3 application penetration test of the complete browser/API/cloud stack, and a separate code audit of every future KRC-20 settlement and treasury component. All Critical and High findings must be remediated and retested against the exact release commit.
