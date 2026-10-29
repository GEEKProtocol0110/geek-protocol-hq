# Migration: private ranked question bank

Status: **proposed (draft PR)**. Nothing in this document is deployed. Payouts,
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
| `api/ranked.js` | New ranked rounds request `{ ranked: true }`. Grading is unchanged. |
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
| `GEEK_PRIVATE_QUESTION_DIR` | Absolute path to a directory of private bank files named `<category>.json` or `<category>-<anything>.json`, each `{ "questions": [ ... ] }` in the existing schema. |
| `GEEK_PRIVATE_QUESTION_URL` | HTTPS URL returning `{ "banks": { "<category>": [ ... ] } }`. Fetched once per cold start and cached. |
| `GEEK_PRIVATE_QUESTION_TOKEN` | Optional bearer token sent to the URL. Store as a Vercel **sensitive** env var. |
| `GEEK_RANKED_QUESTION_SOURCE` | Optional override: `private`, `fixture` (refused in production) or `exposed`. |
| `GEEK_RANKED_ALLOW_EXPOSED` | `true` lets production keep ranking from exposed public rows during a rollout window. |

Default behavior:

- Production (`VERCEL_ENV=production` or `NODE_ENV=production`) with no private
  source and no `GEEK_RANKED_ALLOW_EXPOSED=true`: new ranked rounds fail with
  `RANKED_BANK_UNAVAILABLE` (fail closed). Saved runs still grade.
- Local/dev/tests with nothing set: legacy exposed pool, so the existing suite
  is unchanged. Use `GEEK_RANKED_QUESTION_SOURCE=fixture` for the sample bank.
- A configured private source never falls back to exposed rows; a category with
  no private rows cannot start a ranked round (`QUESTION_POOL_EXHAUSTED`).

## Saved-game answer keys

A ranked run stores `run.current.questionId` plus the shuffled `options` it
issued; grading looks the question up by ID and maps
`question.options[question.correctIndex]` onto the issued order. Finished
rounds store `roundAnswers` (prompt, selected, answer) inline. Therefore:

1. Published and `*-retired.json` rows must stay in the repo (or at least on the
   server) and keep their IDs and `options`/`correctIndex`. This PR deletes none.
2. Private IDs must be globally new (enforced). Use a distinct prefix such as
   `PRK-<CAT>-<YYYYMM>-NNNN`.
3. A private row, once issued, must stay in the private bank (move it to a
   private `*-retired.json` when retired) so in-flight runs grade.

## Exposed questions

Treat every question that has ever appeared in this public repo's history
(including PR branches such as #198) as exposed. Because Git history is public,
deleting rows does not un-expose them.

- Exposed rows stay in `server/questions/` for practice, study, lobby, duel,
  royale and for grading saved games; `isExposedQuestion(row)` returns true for
  them at load time.
- They are never copied into the private bank. If a concept is worth ranking,
  write a materially new prompt and distractors with a new ID.
- Ranked leaderboards/history earned on exposed rows before cutover should be
  labeled (owner decision: archive as "Season 0 / exposed bank" vs. keep).

## Private storage options

| Option | How it is read | Access needed | Notes |
| --- | --- | --- | --- |
| **A. Private GitHub repo** (e.g. `GEEKProtocol0110/geek-protocol-hq-questions`, private) checked out at build time into `server/private-questions/` | `GEEK_PRIVATE_QUESTION_DIR=/var/task/server/private-questions` plus `vercel.json` `includeFiles` for `api/ranked.js` (and `api/lobbies.js` if private rows are ever used there) | Owner creates the private repo (free on GitHub). A fine-grained read-only token (contents:read on that one repo) stored as a Vercel sensitive env var used by the build/install step. | Keeps review history in Git (PRs, diffs) privately. Requires a `buildCommand`/install step change; not done in this PR. |
| **B. Private repo via URL** | `GEEK_PRIVATE_QUESTION_URL=https://api.github.com/repos/<owner>/<private>/contents/bank.json` with `Accept: application/vnd.github.raw` (or a compiled release asset) and `GEEK_PRIVATE_QUESTION_TOKEN` | Same fine-grained read-only token, as a runtime Vercel sensitive env var. | No build change. Adds a cold-start fetch; GitHub API rate limits apply. The current fetch sends `Accept: application/json`; the GitHub raw form needs a small header tweak or a pre-built JSON asset. |
| **C. Existing Redis/Upstash** | Load the bank into a private Redis key from an operator script | Existing Redis credentials (already in Vercel). | No new service. Needs a loader script and a reader (not implemented here). |
| **D. Vercel Blob (private) / S3 / R2** | `GEEK_PRIVATE_QUESTION_URL` + token, or signed URL | May require a paid plan or new provider. | Not to be purchased without owner approval. |
| Vercel env var holding the bank | Not recommended | — | Env vars are size-limited (~64 KB total per deployment); thousands of questions will not fit. |

Recommendation: **A** (or **B** to start without build changes). Both use only a
free private GitHub repo and a read-only token.

## Rollout steps

1. Owner approves storage option and creates the private repo/storage (no
   visibility change to this repo).
2. Create a read-only credential scoped to that storage; add it to Vercel
   (Preview first) as a sensitive env var. Never commit it.
3. Author the first private ranked set with new IDs. Move #198's Gauntlet set
   there only after rewriting it, since its current branch content is public.
4. Merge this PR with `GEEK_RANKED_ALLOW_EXPOSED=true` set in production so
   ranked play continues during the transition (current behavior), or schedule
   the merge for the cutover moment.
5. Configure the private source on Preview, run `npm run verify` plus a manual
   ranked run, confirm `RANKED_BANK_UNAVAILABLE`/collision errors do not occur.
6. Cutover: set the private source in Production and remove
   `GEEK_RANKED_ALLOW_EXPOSED`. Ranked rounds now draw only private rows.
7. Label pre-cutover ranked scores (owner decision) and announce a new season.
8. Rotate the private bank periodically; retire private rows into a private
   `*-retired.json`, never into the public repo.

## Remaining risks and owner decisions

- After each answer the ranked API returns `correctIndex`/`answer` for feedback.
  This is post-answer, but over many runs players can still harvest private
  answers. Options: keep (common for trivia), reveal only at round end, or
  rotate the bank faster.
- Non-ranked modes continue to use exposed rows; any rewards tied to those
  modes (Daily/rewarded challenges) should be reviewed with payouts kept off.
- CI/tests cannot read the private bank; they use the fixture bank. A private
  schema/duplicate check should run in the private repo's own CI.
- `scripts/public-answer-check.mjs` can index a private bank directory to make
  sure no private ID/prompt leaks into public files; run it against the private
  checkout before every release.
