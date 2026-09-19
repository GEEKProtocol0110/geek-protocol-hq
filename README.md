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

## Ranked integrity

- Question selection and option order use server-side cryptographic randomness.
- Correct answers are bundled only with the ranked function, never under `public`.
- Each question has a one-use opaque token and a server-enforced deadline.
- Atomic answer claims stop parallel multi-answer races and replayed answers return the first committed result.
- The server computes streaks, speed bonuses, XP, Alpha GEEK, and final scores.
- The leaderboard endpoint is read-only; only the ranked service can write a result.
- Session- and network-level rate limits reduce automated run farming.

## Transparent Alpha

Ranked Alpha balances, XP, game progress, lobbies, presence, and verified scores use Redis. Wallet proof state remains local to the browser. Server verification protects competitive integrity, but this is still an unproctored web trivia game and cannot prevent every form of outside assistance. Scores cannot earn tokens or determine payouts. Kasware can display the active address, network, and GEEK balance, but server wallet authentication, minting, and on-chain rewards are not enabled.
