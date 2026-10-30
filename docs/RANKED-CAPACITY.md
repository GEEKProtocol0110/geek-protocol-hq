# Ranked question-bank capacity plan

Status: planning draft for owner review. Proposes concrete numbers for the two
placeholders in PR #200's `docs/MIGRATION-private-ranked-bank.md`
("Rotate at least once per season" and "Target pool ≥ 3× the questions drawn per
tier per run"). No code changes. Rewards remain XP and off-chain Alpha credits
only; token payouts stay disabled, and nothing here promises any payout.

Pinned sources: `main` = `33f74c0aee05e416f91b8331cf4236d9ddd758a4`, PR #200 head = `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` (draft).

## 1. How ranked draws work today

| Fact | Gauntlet | Daily Signal | Speed Signal |
|---|---|---|---|
| Questions per round | 10 | 5 | 10 (assigned; 30 s overall clock may end early) |
| Rounds per match | up to 10 (entry cost per round) | 1 | 1 |
| Difficulty per round | R1–3 easy, R4–7 medium, R8–10 hard | easy (round 1) | easy (round 1) |
| Draws per full match | 30 easy / 40 medium / 30 hard | 5 easy | 10 easy |
| Matches per player | ≤30 ranked starts/hour (shared) | 1 per player per UTC day (all categories) | ≤30 ranked starts/hour (shared) |
| Category | one category per run (8 categories) | same | same |
| Repeat exclusion | within a run only (ID, concept, prompt) | within a run | within a run |
| Season length | not defined in code; monthly, approved by Gee (§6): Season 1 = first private-bank month, then Season 2, 3, … | same | same |

Consequences:

- **Easy is the hot tier.** Every mode draws easy; Daily and Speed draw *only* easy.
- **No cross-run memory.** A player's later runs can redraw anything they saw before. Repeat probability is governed purely by pool size versus cumulative draws.
- **Answers are revealed at round end** (deferred feedback), so every drawn question should be treated as known to that player afterward.
- **Hard floor:** a full Gauntlet needs ≥30 distinct easy, ≥40 medium, ≥30 hard *concepts* per category or rounds come up short. PR #200's sample fixture has 15 per tier, so it cannot complete a full Gauntlet (fine for a fixture, not for launch).

## 2. Demand math

Notation per category, per tier, per player, per period (month):

- `N` = selectable private rows in the tier (distinct concepts).
- `D` = draws that player makes from the tier in the period.
  - easy: `D_e = 30·G + 5·Dd + 10·S`
  - medium: `D_m = 40·G`
  - hard: `D_h = 30·G`
  - `G` = full Gauntlets, `Dd` = Daily runs in this category, `S` = Speed runs (all adjustable).
- Draws are uniform random without cross-run exclusion, so the expected share of the pool the player has seen after `D` draws is `seen(D) = 1 − e^(−D/N)`.
- **Repeat probability** of the next question at the end of the period: `p_end = 1 − e^(−D/N)`. Average over the period: `p_avg = 1 − (N/D)(1 − e^(−D/N))`.
- **Required pool** for target `p`: `N ≥ D / −ln(1 − p)`. (p=0.25 → N ≈ 3.48·D; p=0.5 → N ≈ 1.44·D.)
- **Floor per run:** `N ≥ k · d_run`, where `d_run` = draws per tier per run (30/40/30). PR #200's `k = 3` gives a single full run seeing ≤ ~1/3 of a tier.
- **Leakage via sharing:** if sharing players collectively make `D_pop` draws from a tier, the expected exposed share is `1 − e^(−D_pop/N)`. With the rate limit (30 starts/h × 10 easy), one determined harvester can draw ~300 easy/hour, so *any* realistic pool is fully exposed within hours to days. Size cannot prevent leakage; only rotation can bound its lifetime.

## 3. Player profiles (FAKE inputs, adjust freely)

The repo has **no production usage data** (player counts or match counts). The only load figure is a 24-synthetic-player benchmark. These profiles are assumptions:

| Profile | G (full Gauntlets/mo, one category) | Dd (Dailies in that category/mo) | S (Speed runs/mo) | D_e | D_m | D_h |
|---|---|---|---|---|---|---|
| Casual | 4 | 4 | 4 | 180 | 160 | 120 |
| Regular | 8 | 8 | 10 | 380 | 320 | 240 |
| Heavy | 12 | 30 | 30 | 810 | 480 | 360 |

## 4. Required pool per category per tier (per month)

| Profile | Easy p≤0.25 | Easy p≤0.5 | Medium p≤0.25 | Medium p≤0.5 | Hard p≤0.25 | Hard p≤0.5 |
|---|---|---|---|---|---|---|
| Run floor 3× | 90 | 90 | 120 | 120 | 90 | 90 |
| Casual | 626 | 260 | 557 | 231 | 418 | 174 |
| Regular | 1321 | 549 | 1113 | 462 | 835 | 347 |
| Heavy | 2816 | 1169 | 1669 | 693 | 1252 | 520 |

Applies identically to each of the 8 categories (kaspa, video-games,
science-fiction, technology, movies, history, comics, pop-culture), if each is ranked.

## 5. Recommended starting pools

| Stage | Easy | Medium | Hard | Per category | 8 categories | Basis |
|---|---|---|---|---|---|---|
| Minimum launch (confirms 3×) | 90 | 120 | 90 | 300 | 2,400 | one run sees ≤1/3 of a tier |
| Recommended launch | 260 | 240 | 180 | 680 | 5,440 | casual p_end ≤ 0.5 |
| Target steady state | 550 | 460 | 350 | 1,360 | 10,880 | regular p_end ≤ 0.5 |

Easy is weighted up because Daily and Speed draw only easy. If authoring
capacity is short, launch fewer ranked categories at the recommended size
rather than all eight at the minimum.

## 6. Rotation cadence (replaces "at least once per season")

Proposal: **season = 1 calendar month** (UTC), one pinned bank version per season.

Season mapping (resolved, see PRIVATE-BANK-REVIEW §10 Q5):

- **Season 0 history is preserved.** Season 0 keys and results are kept as-is, not renamed or merged.
- **Monthly seasons are numbered in order:** Season 1 is the first private-bank month, then Season 2, Season 3, and so on (FAKE example: if Season 1 is a given month, the next month is Season 2 with key `geek:leaderboard:season-2:*`).
- **Royale, Duel and Lobby stay outside Season 1 ranked** (and later seasons) until their private-bank handling is ready. They are not counted in the demand math above.

Each season boundary below is therefore one season-number increment.

| Trigger | Action |
|---|---|
| Every season boundary (monthly) | Retire 33% of easy, 25% of medium, 25% of hard; replace with new IDs; bump bank ref |
| Mid-season (around day 15) | Optional extra easy refresh of 15% if harvesting is suspected |
| Row exposure reported | Retire that row (and its concept) immediately in a patch version |
| Pool falls below the 3× floor | Pause the affected mode/category rather than run short rounds |

Reasoning: under the regular profile a tier with the recommended pool is
~50–75% seen by month end, and shared leakage approaches full exposure, so a
quarterly cadence would leave most rows known. Retiring the oldest third or
quarter monthly caps any row's lifetime at about 3–4 seasons (e.g. a row introduced in Season 1 retires by about Season 4). Monthly
authoring load at the target pool: about 0.33·550 + 0.25·460 + 0.25·350 ≈ 385 rows per category.

## 7. Example row format (FAKE)

FAKE — illustrative only: `Q: Example question? A: Example`. No real or
future ranked questions or answers appear in this document.

## 8. Evidence

| Figure | Source |
|---|---|
| Mode config 10/5/10 questions, max rounds 10/1/1, Speed 30 s | `api/ranked.js` L29–31 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; L31–33 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| 15 s per question | `api/ranked.js` L22 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4` |
| Tier by round (≤3 easy, ≤7 medium, else hard) | `server/questions.js` L64 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; L142 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| ≤10 selected per round | `server/questions.js` L91 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; L169 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Within-run exclusion by ID/concept/prompt | `server/questions.js` L65–75 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; `api/ranked.js` L105–106 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`, L145–146 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Daily once per player per UTC day | `api/ranked.js` L284 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; L330 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| 30 ranked starts/hour per player | `api/ranked.js` L23 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Gauntlet continues to round 10 only with credits for entry | `api/ranked.js` L206, L310–312 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4` |
| Season 0 / Season 1 definitions, no end date | `server/questions.js` L102–111 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| 8 categories | `server/question-categories.js` L3–10 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4` |
| Sample fixture 15 easy/15 medium/15 hard | `server/question-fixtures/ranked-sample/kaspa.json` @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Placeholders "rotate at least once per season", "≥ 3×" | `docs/MIGRATION-private-ranked-bank.md` L104–111 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Answers revealed for whole round at round end | `docs/MIGRATION-private-ranked-bank.md` L89–94 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Settlement disabled on ranked entries/rewards | `api/ranked.js` L228, L331 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4`; L269, L377 @ `5f1e909a4dedb829dd20fc09df4fd7c3356f7e98` |
| Only load data: 24 synthetic players | `docs/PERFORMANCE-BASELINE.md` L14 @ `33f74c0aee05e416f91b8331cf4236d9ddd758a4` |

## 9. Flags (uncertain facts and assumptions)

1. **No real usage data.** All profiles (G, Dd, S) are assumptions; replace them with production counts once available.
2. **Full-Gauntlet worst case.** Most runs likely stop before round 10 (credits/losses), which lowers medium and hard demand. No completion-rate data exists.
3. **Uniform draw assumed.** The `priority`, topic-spread, and Kaspa focus logic (and focus terms) skew draws, so effective N is smaller than row count; add 10–20% headroom.
4. **Speed early stop.** 10 easy are assigned per Speed run, but the 30 s clock may cut answering short. Assigned-but-unseen rows still count as drawn here (conservative).
5. **Daily category split.** The Daily key is per player per day, not per category; the per-category Dd split is assumed.
6. **Season length is not in code.** Monthly seasons are approved by Gee (Season 1, 2, 3, …); the code still needs to implement the boundary.
7. **Concept collapsing.** Exclusion is by concept as well as ID. Rows sharing a `conceptId` count as one for capacity.
8. **#200 is a draft** (head `5f1e909`). Line numbers may move before merge.
9. **Royale/Duel/Lobby** are out of scope and stay outside Season 1 ranked until their private-bank handling is ready (§6). Per #200 they keep the exposed public pool; verify this before merge.
10. **Leakage is not size-bounded.** The leakage model assumes sharing is limited; a coordinated harvester defeats any pool size within the rate limits.
11. **Private-bank authoring throughput** (about 385 rows per category per month at target) is unverified against editorial capacity.
