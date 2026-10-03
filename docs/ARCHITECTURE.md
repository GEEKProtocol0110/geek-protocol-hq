# Architecture and Trust Boundaries

## System context

Geek Protocol HQ is a static-first web application with Vercel Functions for trusted state transitions. Upstash Redis stores short-lived authorization state and durable Alpha records. Kasware remains the user's signing boundary; the application never requests private keys or seed phrases.

```mermaid
flowchart TB
    subgraph User[User-controlled boundary]
        B[Browser]
        W[Kasware]
    end

    subgraph Edge[Geek Protocol web tier]
        S[Static public experience]
        A[Vercel Functions]
    end

    subgraph Data[Private data boundary]
        R[(Upstash Redis)]
        L[(Integrity-protected audit records)]
    end

    subgraph Kaspa[Kaspa ecosystem]
        I[Indexer endpoints]
        N[Kaspa Mainnet]
    end

    B --> S
    B -->|Secure session + API requests| A
    W -->|User-approved proof or mint| B
    A -->|Atomic reads and writes| R
    A -->|Pseudonymous events| L
    A -->|Fresh deployment status| I
    W -->|Signed transaction| N
```

## Component responsibilities

| Component | Trusted responsibility | Explicitly not trusted for |
| --- | --- | --- |
| Browser | Rendering, user input, wallet request initiation | Correct answers, scores, balances, moderation, payout eligibility |
| Kasware | User approval, signatures, transaction submission | Geek Protocol game or reward state |
| Vercel Functions | Authorization, validation, scoring, state transitions | Custody of wallet keys |
| Redis | Session, game, identity, lobby, contribution, and Alpha ledger state | Independent settlement accounting |
| Kaspa indexer | Current public token deployment state | Player identity or application authorization |
| Audit records | Reviewable evidence for sensitive Alpha actions | Full production SIEM or immutable third-party replication |

## Daily vault

`/api/session/?service=vault` serves private status and explicit claims. A Lua transition checks Redis time against the server-selected UTC day, returns the original receipt on retries, and updates both the seven-design cosmetic collection and its latest 14 receipts in one `geek:vault:<player>` record. Eligibility does not expire or depend on browser storage. The vault does not write existing profiles, stickers, XP, balances, Study progress, or leaderboards.

## Primary flows

### Shared lobby practice round

1. The host starts a room only after at least two seats are active. The server fixes the participant roster, selects ten questions and options, and schedules one shared 15-second window per question.
2. Each participant fetches the current question from the server. The response contains no answer key or private match state.
3. An atomic Redis script checks the room roster, shared deadline, and previous answer, then records exactly one answer and updates the server-computed practice score.
4. All participants see the same questions and room standings. Lobby scores do not alter ranked Gauntlet scores, XP, Alpha GEEK, or on-chain balances.

### Untimed Study

1. Public catalog metadata contains eight guided lessons, objectives, worked examples/reflections, practice levels, and sources, without question pools or answer keys. The Study handler shares `/api/ranked/?service=study` to remain within the existing function budget.
2. A valid browser session starts up to five distinct concepts within its selected level in the private `geek:study:` Redis namespace. Questions have no answer deadline. State expires after 24 hours without a saved transition; unfinished runs retain their selected IDs and grading.
3. Only the owning session can answer, resume, or advance. One Redis script commits the answer and updates private player-keyed concept feedback atomically, then reveals the explanation and source. Retried answers and next requests return the recorded transition without extra progress.
4. A completed session can retry exactly its missed concepts. A separate review draws up to five concepts whose latest recorded answer was incorrect, independent of run expiry. Progress uses `geek:study-progress:` hashes, at most 80 canonical records per player, and a 180-day TTL refreshed by answers. Study never writes ranked runs, leaderboards, XP, credits, contribution rewards, or collectible inventory.
5. A.C.E. renders authored lessons and answer guidance. It is not an unrestricted chat service or an independent content reviewer.

### Weekly and monthly challenges

The existing ranked function routes `service=challenges` to the isolated periodic handler. Versioned deterministic selection freezes a private question snapshot per UTC period; each attempt pins that snapshot’s hash. One Lua claim checks capacity and creates one attempt per resolved player. Answer/next/finish transitions compare the full stored state and enforce deadlines. Completion writes state, score and public metadata together. Boards have tie-aware ranks, top-ten public listings and private own-rank results. Period data expires 60 days after close. No profile, Study, ordinary leaderboard or economy writes occur. See [Challenge Protocol](CHALLENGE-PROTOCOL.md).

### Ranked answer

1. The server selects a question and cryptographically shuffles answer options.
2. The browser receives display data, an opaque single-use token, and a deadline—not the answer key.
3. The player submits one answer.
4. The server atomically claims the token, validates time and choice, and commits the result.
5. The server derives score, streak, XP, and any eligible Alpha credit.

### Wallet identity proof

1. The server issues a random five-minute challenge bound to the exact HTTPS origin, player, wallet, and action.
2. Kasware signs human-readable challenge text in explicit Schnorr mode.
3. The server verifies the signature and derives the Kaspa Mainnet address from the public key.
4. The challenge is consumed once and the binding transition commits atomically.
5. Recovery increments the identity session version so older sessions fail closed.

### GEEK fair mint

1. The server obtains fresh deployment data and verifies the ticker, supply, limit, and reveal hash.
2. Any unavailable, mismatched, substituted, or exhausted state blocks the request.
3. The browser asks Kasware to create one fixed mint request on Kaspa Mainnet.
4. The user approves or rejects inside Kasware.
5. HQ never signs, submits, or stores the raw transaction.

## Data classification

| Class | Examples | Handling |
| --- | --- | --- |
| Public | Pages, leaderboard aliases, collection manifests | Publicly served and cacheable where safe |
| Pseudonymous | Player IDs in audit evidence, masked destinations | Minimized and kept behind authenticated or privileged APIs |
| Sensitive application state | Sessions, challenges, moderation, payout review | Server-only storage with bounded authorization |
| Secrets | Redis, moderator, audit, and review credentials | Deployment configuration only; never public or committed |
| Wallet secrets | Seed phrases and private keys | Never requested, transmitted, or stored by HQ |

## Deployment boundary

Production serves static assets from `public/` and JavaScript functions from `api/`. Domain logic lives in `server/`, and security controls map required evidence across code, tests, documentation, and deployment configuration.

The web tier is not a treasury. Any future signer, payout worker, reconciliation service, or contract belongs in a separately isolated and independently audited boundary before it can move value.

### Economy planning foundation

The existing session function routes `service=economy` to a public status/catalog read and a session-bound private journal read. The shared amount module uses pinned eight-decimal integer strings and BigInt fee splits. Trusted internal planning receipts use one-key Redis CAS, stable-reference idempotency, a bounded receipt chain and recomputed cumulative totals. No client write, payment acceptance, profile credit, inventory effect, token transfer or burn confirmation is exposed. A reserve-address configuration is format status only. See [Economy Protocol](ECONOMY-PROTOCOL.md) for current evidence and monetary launch work.

## Assisted practice

`/practice/` uses the existing ranked function router (`service=practice`) for a separate free, unranked ten-question Kaspa session. The private bank supplies questions and answer keys. A server-held one-use allowance for 50/50 and Extra Time is scoped to each session. One-key Redis compare-and-set serializes answers, lifelines and Next actions. Answer tokens and used flags make retries idempotent; expired questions cannot be extended. Explanations have no clock. Runs are isolated by resolved player ID and expire after two hours; they never update profile XP, Alpha credits, leaderboards, paid inventory or the economy journal. The UI can resume its session-tab run ID; storage failures leave new practice usable.
