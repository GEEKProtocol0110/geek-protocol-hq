# Private ranked bank: review process

Status: **process draft for owner review**. No code changes. It describes how
questions for the private ranked bank from draft PR #200 are written, reviewed,
staged, run and retired. Rewards stay **XP and off-chain Alpha credits only**.
Token payouts, treasury settlement and collection ownership stay disabled, and
nothing here promises a payout.

Pinned sources: PR #200 reviewed head `5f1e909` (draft):
`docs/MIGRATION-private-ranked-bank.md`, `server/question-source.js`,
`scripts/private-bank.mjs`, `private-bank-template/`. Capacity and rotation
numbers come from [RANKED-CAPACITY.md](RANKED-CAPACITY.md). The existing static-bank
conventions are in [QUESTION-MAINTENANCE.md](QUESTION-MAINTENANCE.md) and
[EDITORIAL-REVIEW.md](EDITORIAL-REVIEW.md) / `editorial-review.json`.

> **[#200-DEP]** marks anything that depends on PR #200 details (env names,
> file layout, schema fields, error codes, ID format, tooling commands). #200 is
> still a draft, so re-check every [#200-DEP] item against the merged code before cutover.

> **Every example in this document is FAKE.** FAKE examples start with
> `EXAMPLE —` and match the `private-bank-template/` fake rows. No real or
> planned ranked question, option or answer appears in this public repository.

## 1. Where things live

| Location | May contain | Must never contain |
|---|---|---|
| **Separate private GitHub repo** (founder-created; the only confirmed private storage) [#200-DEP] | Real ranked rows (`bank/<category>.json`), lookup-only retired rows (`bank/<category>-retired.json`), `manifest.json`, review records with evidence, drafts in progress | Tokens or other secrets |
| This **public** repo | This process, the FAKE template, tooling, aggregate **counts** per category/tier, bank **version strings** (`sha256:<hash>` / `git:<sha>`), and opaque `PRK-…` IDs only when needed for an exposure or retirement note | Any real ranked prompt, option, answer, explanation or source snippet, including in PR descriptions, issues, commit messages, CI logs and screenshots |
| `server/private-questions/` (local mount, git-ignored by #200) [#200-DEP] | A local checkout of the private repo | n/a. Never `git add -f` it |
| Vercel env (sensitive, server-only) [#200-DEP] | `GEEK_PRIVATE_QUESTION_URL`, `GEEK_PRIVATE_QUESTION_REF` (40-hex commit), `GEEK_PRIVATE_QUESTION_TOKEN` (fine-grained, Contents read-only, that repo only) | n/a |
| Chat, email, shared docs, AI tools | Nothing beyond FAKE examples and opaque IDs | Real rows. Treat any paste as exposure (§8) |

Until the private repo exists and its access is confirmed, nobody authors real
rows anywhere. Drafts on a laptop, gist or public PR count as exposed.

Public-side items allowed by #200: `manifest.json` holds per-file SHA-256 hashes,
row counts and per-tier active/retired counts. **Decided:** publish only the
counts and a **single whole-bank-version hash** (the version string). Never
publish per-file, per-question or per-answer hashes: with 4-option answers they
are trivially brute-forceable. No answer-derived hash for any live or future
ranked question ever goes in the public repo. The existing `answerKeyHash`
entries in `docs/editorial-review.json` are acceptable only because they cover
retired questions whose content is already public in `*-retired.json`. [#200-DEP]

## 2. Roles and two-person rule

| Role | Who | Does | Must not |
|---|---|---|---|
| Author | contributor or Gee | Writes the row, attaches primary evidence, records flags | Approve their own row |
| Fact-checker | a second person, not the author | Re-derives the answer from the cited evidence alone; runs the quality checks in §5; sets `reviewStatus: "source-checked"` and `reviewedAt` | Fix grading content silently (send it back to the author) |
| Approver | **Gee** | Accepts batches into a staged version, signs off the season cutover and exposure retirements | Skip the fact-check. If Gee wrote the row, someone else must fact-check it |

Each approved row has two distinct people: author ≠ fact-checker. Gee approves
every staged version. Record the names (or handles) in the private review
record, not in the public repo.

## 3. Lifecycle

```
draft ──► source-checked ──► approved ──► staged (private bank version) ──► live (one season) ──► retired
  ▲            │                                                              │
  └─ returned ◄┘                                    exposure / error ─────────┘ (immediate retire)
```

| State | Where | Exit criteria |
|---|---|---|
| draft | private repo, draft area or branch | All required fields (§4) present; flags listed |
| source-checked | private repo | Fact-checker passed §5; `reviewStatus: "source-checked"` and `reviewedAt` set (#200's check rejects ranked rows without them) [#200-DEP] |
| approved | private repo | Gee approved the batch; all flags cleared or row dropped |
| staged | new commit in private repo: rows in `bank/<category>.json`, `manifest.json` regenerated (new `sha256:` version) | `private-bank.mjs check` passes; Preview runs on that pinned commit (§7) |
| live | Production `GEEK_PRIVATE_QUESTION_REF` points at that commit | Runs bind `bankVersion` at start; in-flight runs keep their version [#200-DEP] |
| retired | moved to `bank/<category>-retired.json` with `retiredReason` and `retiredAt` | Lookup-only forever. Never moved back to `banks`, never deleted, ID never reused, never copied to the public repo |

Any change to grading content (prompt meaning, options, correct answer) after
a row has been **staged** creates a **new ID** and retires the old row. This is
the same rule as `editorial-review.json` ("corrections that alter grading need
a new active identity and a preserved retired record"). Typos that do not change
meaning before staging may be edited in place. After staging, any edit makes a
new bank version, because a published version is immutable (the manifest check enforces this) [#200-DEP].

## 4. Required fields and evidence

Fields checked by `scripts/private-bank.mjs` [#200-DEP]:

| Field | Rule |
|---|---|
| `id` | `PRK-<CAT>-<YYYYMM>-<NNNN>`, unique across active **and** retired rows, never published publicly |
| `category` | one of the 8 category keys, matching the file |
| `difficulty` | `easy` / `medium` / `hard` |
| `prompt` | ≥12 chars, not equal to any prompt ever in the public repo |
| `options` | exactly 4 distinct non-empty strings |
| `correctIndex` | integer 0–3 |
| `funFact` | the explanation (≥8 chars; see §5) |
| `source` | `https://` primary-source URL |
| `reviewStatus` | `source-checked` (required for ranked rows) |
| `reviewedAt` | `YYYY-MM-DD` |
| `retiredReason`, `retiredAt` | retired files only |
| `conceptId` | **required on every row** (decided; #200 currently treats it as optional). The 24-hour exposure retirement in §8 retires by `conceptId`, so it cannot be missing |

Process-only fields live in a **separate private review file** in the private
repo, keyed by row ID (decided). #200's row format is unchanged:
`author`, `factChecker`, `approvedBy`, `evidence[]`, `flags[]`, `seasonIntroduced`.
Anything that names or hints at a correct answer (evidence notes, flags,
reviewer comments) stays private.

Evidence rules (same standard as the Kaspa reviews in this repo):

- **Primary sources only**: official docs, specs, the project's own repo, the
  publisher or rights holder's official pages. No wikis, other trivia sites or AI output.
- **Pin it**: code facts cite a repo URL at a **40-hex commit** with file and
  line. Web facts cite the exact URL plus retrieval date, and an archive link where possible.
- Scope time-sensitive facts to the date ("as of <commit/date>"). Rows whose
  answer can change during a season are not allowed in ranked.
- **Uncertainty flags**: the author lists any doubt (`ambiguous-wording`,
  `source-conflict`, `time-sensitive`, `difficulty-guess`, `secondary-only`).
  A row with an open flag cannot be approved.

FAKE row (illustrative only; the shape matches the template):

```json
{
  "id": "PRK-KAS-202611-9999",
  "category": "kaspa",
  "difficulty": "easy",
  "prompt": "EXAMPLE — Which option is labeled 'Example answer'?",
  "options": ["Example distractor A", "Example answer", "Example distractor B", "Example distractor C"],
  "correctIndex": 1,
  "funFact": "FAKE explanation for illustration only.",
  "source": "https://example.com/not-a-real-source",
  "reviewStatus": "source-checked",
  "reviewedAt": "2026-11-01",
  "example": true
}
```

## 5. Quality checks (fact-checker)

1. **One unambiguous answer.** The fact-checker answers the question from the
   evidence without seeing `correctIndex`. A mismatch sends the row back.
2. **Distractors are wrong and plausible**, and no distractor is the correct
   answer to another row's question in the same category/tier. This stops
   cross-question leaks within one round.
3. **No in-prompt leaks**: the prompt does not contain the answer or wording
   that gives it away. The explanation is only shown at round lock (deferred feedback) [#200-DEP].
4. **Length bias**: the correct option is not systematically the longest or most
   specific. Per batch, report the share of rows where the correct option is the
   longest. Aim for about 25%, and investigate if it is above 40%.
5. **Position balance**: `correctIndex` is spread roughly evenly across 0–3 per batch.
6. **Duplicate and concept checks**: `private-bank.mjs check` (ID, normalized
   prompt, `conceptId`, and comparison with every public ID/prompt) **plus** a
   manual search for the same fact under different wording in the private bank
   and the public banks. Facts already public in this repo are exposed and must not be reworded into ranked.
7. **Explanation quality**: `funFact` says *why* the answer is right and is
   consistent with the source. It does not repeat the prompt or add new unverified claims.
8. **Difficulty fit**: a reasoned tier (easy/medium/hard). This is a guess
   until in-game rates exist (see §9).
9. **Reward language**: no prompt, option or explanation promises tokens,
   payouts, airdrops or value. Rewards are XP and off-chain Alpha credits only.
10. **Content policy**: no unsuitable language and no dated phrasing like "currently" or "latest".

## 6. Capacity and rotation targets

From RANKED-CAPACITY.md, per category (easy / medium / hard):

| Stage | Easy | Medium | Hard |
|---|---|---|---|
| Floor (3× per-run draws) | 90 | 120 | 90 |
| Recommended launch | 260 | 240 | 180 |
| Target steady state | 550 | 460 | 350 |

Season = one calendar month (UTC), with one pinned bank version per season.
At each cutover, retire **33% of easy, 25% of medium and 25% of hard** (oldest
first) and replace them with new IDs. Exposure leads to **immediate** retirement
in a patch version. If a tier falls below the floor, pause that mode/category
instead of running short rounds. Count distinct concepts, not rows.

## 7. Season cutover checklist

Start about 10 days before month end:

- [ ] Replacement batch authored, fact-checked (two people) and approved by Gee, with all flags cleared.
- [ ] Rotation set chosen: 33% easy / 25% medium / 25% hard of the oldest live rows, plus any exposed rows.
- [ ] Rows **moved** (not deleted) to `*-retired.json` with `retiredReason` (`season-rotation` / `exposure` / `error`) and `retiredAt`.
- [ ] `node scripts/private-bank.mjs check <private-repo>` passes (schema, duplicates, public-exposure, manifest current) [#200-DEP].
- [ ] `manifest --write [--commit <previous sha>]` run, committed and pushed to the private repo. Record the new commit SHA. No force-push or history rewrite.
- [ ] Per-category concept counts ≥ floor (target: ≥ launch / steady-state numbers).
- [ ] Public-exposure check: run `npm run private-bank:check` and `npm run private-bank:leak-check` (`scripts/private-bank-leak-check.mjs`, added in #200 at 47212a1; use `--private` to cross-check against the private repo). It fails on active `PRK-*` IDs in the public repo and on per-question answer hashes outside `*-retired.json` rows with `retiredAt`. `scripts/public-answer-check.mjs` (run by `security:check`) scans only the served `public/` output and is not a substitute [#200-DEP].
- [ ] Preview: set `GEEK_PRIVATE_QUESTION_REF` to the new SHA. Run `npm run verify`, manual Gauntlet/Daily/Speed runs, check deferred feedback, and confirm no `RANKED_BANK_UNAVAILABLE` / `PRIVATE_BANK_*` errors.
- [ ] Production: update `GEEK_PRIVATE_QUESTION_REF` at 00:00 UTC on the 1st. Do **not** set `GEEK_RANKED_ALLOW_EXPOSED`. Confirm in-flight runs still grade (old `git:<sha>` stays readable) [#200-DEP].
- [ ] Publish counts and the version string only (no rows) in a dated public note. Update the metrics (§9).
- [ ] Fail-closed check: if the bank cannot load, new ranked runs return 503 `RANKED_BANK_UNAVAILABLE` and Practice stays open. Never "fix" this by falling back to the exposed or fixture pool [#200-DEP].
- [ ] Token expiry checked. Rotate the PAT before it lapses.

Season numbering and leaderboard keys (`geek:leaderboard:season-1:*`) follow #200.
Monthly seasons map onto leaderboard seasons in order (resolved, §10 Q5):
Season 0 history is preserved; Season 1 is the first private-bank month, then
Season 2, Season 3, and so on (`geek:leaderboard:season-N:*`). Royale, Duel and
Lobby stay outside Season 1 ranked until their private-bank handling is ready [#200-DEP].

## 8. Exposure and leaks

A row is **exposed** if its prompt or answer appears anywhere outside the
private repo and the live game. That includes the public repo or any PR branch,
social posts, answer sheets, chats, AI tools, screenshots, or a report of harvesting.

1. Report privately to Gee with the row **ID only**. Never quote the row in a public issue.
2. Within 24 h: move the row (and every row with the same `conceptId`) to
   retired with `retiredReason: "exposure"`, cut a patch version, and repoint
   `GEEK_PRIVATE_QUESTION_REF`. Saved runs keep grading from the lookup-only row.
3. If a **whole file or the bank** leaked (repo made public, token leaked):
   revoke the token, retire all affected rows, and if the remaining pool falls
   below the floor, pause ranked (fail closed) until a fresh bank is approved.
   Discuss leaderboard integrity for the affected window with Gee.
4. If real rows were committed to the public repo: treat them as permanently
   exposed. Deleting them does not undo it. Retire them and do not
   rewrite history as the fix.
5. Exposed facts may only return as materially new questions with new IDs and,
   where possible, a different concept.
6. Log the incident in the private repo (ID list, cause, time to retire). Publicly, give only counts.

## 9. Metrics to track

Kept in the private repo. Counts and aggregates may be published.

| Metric | Why |
|---|---|
| Active concepts per category × tier vs floor / launch / steady state | capacity |
| Rows retired per season by reason (rotation / exposure / error) | rotation health |
| Exposure incidents and time from report to patch version | leak response |
| Authoring throughput vs need (≈385 rows/category/month at steady state) | sustainability |
| Fact-check return rate and top reasons | author quality |
| Post-live error reports and answer disputes per 1,000 issued | accuracy |
| Per-row correct rate vs tier (once data exists) | difficulty calibration |
| Correct-option-longest share and `correctIndex` distribution per batch | bias |
| Per-player repeat rate (seen-before share) vs the modelled `p_end` | validates capacity math |
| `RANKED_BANK_UNAVAILABLE` / `PRIVATE_BANK_*` error counts | fail-closed health |
| Days until the PAT expires | operations |

## 10. Open questions

1. ~~Review metadata in the row or a separate file?~~ **Resolved:** separate private review file; #200 row format unchanged (§4).
2. ~~Should `conceptId` be mandatory?~~ **Resolved:** required on every row (§4, §8).
3. ~~Per-file hashes public?~~ **Resolved:** only one whole-bank-version hash plus counts; no per-file, per-question or per-answer hashes (§1).
4. Who is the standing second reviewer when Gee authors? **Resolved:** Question Bot fact-checks and validates every incoming question, including Gee's and CCE submissions; Gee remains final approver.
5. ~~How do monthly seasons map onto leaderboard season keys beyond Season 0/1?~~ **Resolved:** Season 0 history is preserved; monthly seasons are numbered in order (Season 1, 2, 3, …); Royale, Duel and Lobby stay outside Season 1 ranked until their private-bank handling is ready (§7, RANKED-CAPACITY §6).
6. Should there be a mid-season 15% easy refresh trigger threshold (RANKED-CAPACITY §6)?
7. Is a length-bias threshold of 40% the right trigger?
