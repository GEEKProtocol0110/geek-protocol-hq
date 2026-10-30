# Migration: private ranked question bank

Status: **proposed (draft PR #200, merges last, at cutover)**. Nothing in this document is deployed. Payouts,
treasury settlement and collection ownership remain disabled; this change adds
no monetary flow.

## Problem

Every file in `server/questions/` (29 files: 8 active category banks, 13 Kaspa
supplements, 8 `*-retired.json` lookup files) is committed to this public
repository with `correctIndex` for every question. Anyone can build an answer
table and script perfect ranked scores. Draft PR #198
(`server/questions/kaspa-basics-gauntlet.json`, KGNT-0001..0100) would publish
another 100 answer keys the same way.

## What this PR changes

| Area | Change |
| --- | --- |
| `server/question-source.js` (new) | Resolves the ranked source from env: private directory, private HTTPS URL, public fixture, or the exposed legacy pool. Validates every private row (4 distinct options, integer `correctIndex` 0–3, difficulty). |
| `server/questions.js` | All public rows are flagged exposed via `isExposedQuestion(row)` (tracked out-of-band, so row objects and the audit corpus hash are unchanged). New `loadRankedBank(category)`; `selectRoundQuestionIds(..., { ranked: true })` draws only from the ranked source. `questionById` still resolves published, retired and private IDs so saved runs keep grading. Private IDs that collide with a published/retired ID are rejected (`PRIVATE_BANK_ID_COLLISION`). Community (CCE) items are not mixed into a private ranked pool. |
| `api/ranked.js` | Season + bank version assigned server-side at run start; each issued question's key is snapshotted in server-side run state; ranked feedback is deferred until the round locks (see below). |
| `server/leaderboard.js`, `api/leaderboard.js` | Season 0 keeps the legacy keys; Season 1 (private bank) writes to `geek:leaderboard:season-1:*`. `?season=season-1` reads it. |
| `.github/workflows/security-verification.yml` | **Pending founder push**: switch to full `npm run verify` (Ubuntu / Node 24 / native Redis, `DUEL_REQUIRE_REDIS=1`, `QUEST_REQUIRE_REDIS=1`). The automation token lacks the `workflow` scope, so this change is attached to the PR as a patch, not committed. |
| `server/question-fixtures/ranked-sample/` (new) | Public sample bank, 45 obviously fake questions per category ("Which option is labeled 'Sample answer'?"). No real ranked answers. |
| `tests/private-ranked-bank.test.js` (new) | Source-mode matrix, fail-closed production, fixture isolation, private dir + URL sources, collision rejection, saved/retired ID grading, exposed flags, no `correctIndex` in issued questions. |
| `.gitignore` | `server/private-questions/` (conventional local mount point for a private checkout) is never committed. |

Not changed: the 29 public bank files themselves (no rows deleted or rewritten,
so #180/#198 diffs and review fingerprints are untouched), lobby/duel/royale/
study/practice/assisted modes (they keep using the exposed public pool, which is
acceptable for non-ranked play), payout code.

## Configuration

| Variable | Meaning |
| --- | --- |
| `GEEK_PRIVATE_QUESTION_URL` | HTTPS URL of the bank document. Intended: the GitHub Contents API URL of one file in the **separate private repo**, e.g. `https://api.github.com/repos/GEEKProtocol0110/<private-repo>/contents/bank.json`. |
| `GEEK_PRIVATE_QUESTION_REF` | 40-hex commit SHA of the private repo. **Required in production for URL sources** (`PRIVATE_BANK_REF_REQUIRED` otherwise). Appended as `?ref=<sha>` so the bank is immutable. |
| `GEEK_PRIVATE_QUESTION_TOKEN` | Fine-grained PAT, **Contents: Read-only on the private repo only**, no other permissions/repos. Vercel sensitive env var, server-side only. |
| `GEEK_PRIVATE_QUESTION_DIR` | Alternative: absolute path to a directory of `<category>.json` / `<category>-*.json` / `<category>-retired.json` files (version = SHA-256 of the files, or `git:<REF>` if set). |
| `GEEK_RANKED_QUESTION_SOURCE` | Optional override: `private`, `fixture` (refused in production) or `exposed`. |
| `GEEK_RANKED_ALLOW_EXPOSED` | Rollout escape hatch. **Do not set in production as part of this plan.** |

Bank document: `{ "banks": { "<category>": [rows] }, "retired": { "<category>": [rows] } }`.

### Loader behaviour

- `VERCEL_ENV=preview` is treated like production: no exposed/fixture
  fallback; a preview without a private source fails closed
  (`RANKED_BANK_UNAVAILABLE`), and URL sources need a pinned ref.

- Sends `Accept: application/vnd.github.raw` (raw file body). If a JSON
  Contents wrapper (`{ "encoding": "base64", "content": ... }`) comes back it is
  decoded. `encoding: "none"` (file >1 MB without raw media type) is rejected.
- Redirects are refused (`redirect: "error"`) so the token is never forwarded.
- Bounded: 8 s timeout (`AbortSignal.timeout`), 8 MiB max (Content-Length and
  streamed byte count). Errors: `PRIVATE_BANK_TIMEOUT`, `PRIVATE_BANK_TOO_LARGE`,
  `PRIVATE_BANK_UNREACHABLE`, `PRIVATE_BANK_INVALID` → HTTP 503
  `RANKED_BANK_UNAVAILABLE` for new ranked runs (Practice stays open).
- Fetched once per instance per pinned version and cached; grading never makes
  a GitHub request per answer.
- `retired` rows (and `*-retired.json` files in DIR mode) are **lookup-only**:
  they grade saved runs but never enter the selectable pool. Private IDs that
  collide with any public, retired, or other private ID are rejected.

### Run binding and historical keys

- At `start` the server assigns `season`, `seasonLabel` and `bankVersion`
  (`git:<sha>`, `sha256:<hash>` or `public`). Clients cannot choose them.
- Later rounds of the run select from the same `bankVersion`. If an old
  `git:<sha>` is not cached, that exact commit is fetched once (immutable). If
  the version can no longer be read, `continue` returns 409
  `RANKED_BANK_VERSION_CHANGED`; completed rounds still finish/submit.
- Each issued question's row is snapshotted into server-side run state
  (`run.current.key`, never serialized to clients) so the answer grades
  against the key it was issued with even after the bank rotates.
- Keep every published commit of the private repo (no force-push/history
  rewrite) so pinned versions stay readable; retire rows into
  `retired`, never delete or reuse an ID.

## Ranked feedback (deferred)

- Practice/Study/Assisted practice keep immediate teaching feedback (unchanged).
- Ranked (gauntlet, daily, speed) runs started after this PR use
  `feedback: "deferred"`. Until the round locks (`between-rounds`/`finished`):
  - `answer` returns `{ feedback: "deferred", recorded: true, timedOut, locked: false }`
    (no `correct`, `correctIndex`, `answer`, `scoreAdded`, `streak`, `funFact`, `source`, `contributorCredit`).
  - `run` omits `correct`, `streak`, `roundScore`, `maxStreak`; `answeredReview` is `[]`.
  - Retries and `GET ?resume=1` return the saved (masked) `lastResponse`.
  - `profile`/`totalScore`/XP/Alpha balance change only at round lock.
- When the round locks the final answer response carries the full result,
  `run.answeredReview` and `roundResult.review` for the whole round.
- Runs created before deploy (no `feedback` field) also default to deferred feedback; only an explicit `feedback: "immediate"` reveals per answer (no ranked path sets it).

### Question reuse / rotation policy

Delayed feedback still lets a player harvest answers over many runs. Controls:

1. Rate limits: 240 ranked actions / 5 min per player, `RANKED_START_IP_LIMIT`
   per client fingerprint, and (new) 30 ranked run starts / hour per player
   (`RANKED_START_PLAYER_LIMIT`).
2. A run never repeats an ID, concept or prompt (`usedQuestionIds`).
3. Each private season ships with a pinned bank version. Rotate at least once
   per season (target: monthly, or sooner if a row's exposure is reported):
   move rotated rows to `retired`, add materially new rows with new IDs, bump
   `GEEK_PRIVATE_QUESTION_REF`.
4. A retired private row is never moved back into `banks` and never copied
   into the public repo.
5. Target pool ≥ 3× the questions drawn per tier per run so a single run sees
   a small fraction of the bank (owner to confirm the exact multiple).

## Seasons and leaderboards

- All existing ranked history is **"Season 0 — Public-bank Alpha"**. Its
  leaderboard keys (`geek:leaderboard:*`) are unchanged; history, XP, profile
  stats and journey entries are preserved.
- Runs bound to a private bank are Season 1 and record to
  `geek:leaderboard:season-1:*` only. `GET /api/leaderboard?season=season-1`
  reads it; the default remains Season 0.
- Alpha play stays Season 0 until cutover.
- Payouts, treasury settlement and collection ownership gates are unchanged
  and remain disabled; seasons do not add any monetary flow.

## Exposed questions

Every question that has ever appeared in this public repo's history (including
PR branches such as #198) is exposed; deleting rows does not un-expose them.
Exposed rows stay in `server/questions/` for practice/study/lobby/duel/royale
and for grading saved Season 0 runs (`isExposedQuestion(row)` is true). They
are never copied into the private bank; rewrite materially with a new ID.

## Rollout steps (no step here is done by this PR)

1. Founder creates a **separate private GitHub repo** for the bank (HQ app
   code stays public; no visibility change to HQ).
2. Founder creates a fine-grained token: resource owner GEEKProtocol0110,
   **only that private repo**, **Contents: Read-only**, short expiry.
3. Store it as a Vercel **sensitive** env var on a **restricted, reviewed
   Preview** only first (with `GEEK_PRIVATE_QUESTION_URL` and a pinned
   `GEEK_PRIVATE_QUESTION_REF`). Never commit it.
4. Author and review enough new private rows per category/tier (new IDs,
   prefix e.g. `PRK-<CAT>-<YYYYMM>-NNNN`; nothing ever published here).
5. Preview acceptance: `npm run verify`, manual ranked runs in each mode,
   confirm deferred feedback, Season 1 board, no `RANKED_BANK_UNAVAILABLE`.
6. Merge order: #180, then #198, then **#200 last at cutover**.
7. Cutover: set the same vars in Production. Do **not** set
   `GEEK_RANKED_ALLOW_EXPOSED`. Announce Season 1.
8. Rotate per the policy above.

## Remaining risks and owner decisions

- Rotation cadence and pool-size multiple (policy above) need founder sign-off.
- Non-ranked modes continue to use exposed rows; rewards tied to those modes
  must stay unpaid (payouts remain disabled).
- CI uses the fixture bank; the private repo needs its own schema/duplicate CI.
- Run `scripts/public-answer-check.mjs` against a private checkout before each
  release so no private ID/prompt leaks into public files.
