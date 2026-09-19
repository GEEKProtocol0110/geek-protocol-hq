# Geek Protocol HQ

The official Geek Protocol experience for Kaspa: a server-ranked trivia game and community hub.

## Included

- Geek Protocol landing page
- Ten-round server-authoritative Gauntlet
- Eight selectable trivia categories
- Kasware wallet connection, mainnet detection, GEEK balance display, and local signed ownership proof
- Anonymous server sessions with secure, HTTP-only cookies
- Persistent lobby records, active-seat presence, and shareable live room codes
- Category-specific verified global leaderboards
- Community Content Engine submission, review, publication, and first-use reward ledger
- Lobby, mint-readiness, and Kaspa information pages
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

The private review desk lives at `/moderate/`. The key is sent only in the `X-CCE-Admin` request header and is held in browser `sessionStorage`, so closing the tab clears it.

## Ranked integrity

- Question selection and option order use server-side cryptographic randomness.
- Correct answers are bundled only with the ranked function, never under `public`.
- Each question has a one-use opaque token and a server-enforced deadline.
- Atomic answer claims stop parallel multi-answer races and replayed answers return the first committed result.
- The server computes streaks, speed bonuses, XP, Alpha GEEK, and final scores.
- The leaderboard endpoint is read-only; only the ranked service can write a result.
- Session- and network-level rate limits reduce automated run farming.

## Transparent Alpha

Ranked Alpha balances, XP, game progress, lobbies, presence, verified scores, contributions, and C.C.E. reward records use Redis. Wallet proof state remains local to the browser. Server verification protects competitive integrity, but this is still an unproctored web trivia game and cannot prevent every form of outside assistance.

C.C.E. rewards are internal, claim-gated Alpha ledger credits. They are created only once, when an approved and published question is first answered in ranked play. They are not token transfers, cannot be withdrawn, and have no promised monetary value. Server wallet authentication, claim binding, minting, treasury settlement, and on-chain rewards are not enabled.
