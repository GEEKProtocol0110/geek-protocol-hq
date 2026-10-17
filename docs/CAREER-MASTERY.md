# Career mastery

GAME-001 / DR-021 implements the founder's October 17 request for modern game-style challenge depth: a clear first win, many parallel pursuits, and long-term goals for dedicated players. It uses Geek Protocol's own names, visual system and verified game records. There is no Call of Duty or Xbox integration.

## The collection

One server catalog defines **18 paths × five tiers = 90 challenges**. Every path progresses through Bronze, Silver, Gold, Platinum and Diamond. The existing 12 achievement IDs remain unchanged, giving My HQ **102 achievement entries**. Each of the 18 completed paths earns a derived mastery emblem. Emblems recognize game milestones, not professional competence or certification.

| Path | Bronze → Diamond targets | What counts |
| --- | --- | --- |
| Scored rounds | 1, 10, 50, 250, 1,000 | Saved completed rounds across the eight categories |
| Correct answers | 10, 100, 500, 2,500, 10,000 | Saved correct answers from scored play |
| Correct streak | 3, 5, 10, 15, 25 | Highest saved scored-answer streak |
| Gauntlet depth | 2, 4, 6, 8, 10 | Highest completed Gauntlet round |
| Gauntlet clears | 1, 5, 10, 25, 100 | Saved all-ten-round completions |
| Categories explored | 1, 2, 4, 6, 8 | Categories with at least one scored round |
| Eight category specialist paths | 25, 100, 250, 500, 1,000 each | Correct scored answers in that specific category |
| Daily Signal | 1, 5, 25, 100, 365 | New completed Daily rounds |
| Speed Signal | 1, 10, 50, 250, 1,000 | New completed Speed rounds |
| Perfect rounds | 1, 5, 25, 100, 500 | All five Daily or all ten Gauntlet/Speed questions correct |
| Prestige legacy | 1, 5, 10, 15, 25 | Existing authoritative manual-prestige count |

Daily, Speed and perfect totals were not retained in historical profiles. `careerCounters` starts those counters at zero for legacy records; each relevant card identifies this prospective scope. Partial Speed runs cannot count as full perfect rounds. The existing ranked commit makes counters, grade, result, XP and journey changes atomic. A lost final-answer response or duplicate answer cannot recount a round. No new telemetry or separate player activity stream is collected.

## Rewards and compatibility

Achievement unlocks follow saved results automatically. Claimable career XP additionally requires claiming the preceding tier. This separates recognition from spending a claim and keeps the next step clear. Earlier saved aggregate/category/prestige results count; claims do not rewrite them. Tracking automatically follows the next unclaimed tier, with a completed Diamond card retained when a pinned path is finished.

Rewards range from 25 to 300 XP per tier, totaling **11,975 once-only career XP** for all 90 challenges. The original `first-scored-round` (50 XP) and `kaspa-25-correct` (75 XP) receipts are reused as Bronze tiers. A claimed legacy reward cannot be reissued. The unchanged five-word hunt adds a maximum 200 XP. There are no XP-based challenge predicates that can unlock themselves with a reward, and no score, game-credit, token, payout or prestige multiplier is added.

Stable receipts survive prestige and bounded journey pruning. Profile receipt capacity increases from 32 to 256 validated entries, covering all 96 catalog/hunt receipts without resetting existing data. A future catalog expansion needs a fresh capacity/reward review. New IDs never reuse old claims.

## Interface and API

`/challenges/` shows three suggested next goals, favors ready rewards and nearby progress, and supports three saved tracked paths. The larger catalog and mastery emblem gallery are initially closed native disclosures. Search, path, tier and status filters combine; cards render in pages of 12. There are no expiring career goals, purchased skips or daily login penalties. Existing weekly/monthly quiz standings retain their separate period and score-only rules.

The existing session-bound private discoveries endpoint handles words, single claims, explicit tracking state and fixed-set multi-claims. Multi-claim accepts one to eight unique known task IDs, verifies all remaining eligibility/prerequisites, and writes all awards/receipts/audit together. It never automatically chains newly unlocked tiers. A retry of the same IDs cannot issue a second reward. Tracking is bounded to three unique known path IDs, is idempotent for the desired state, and changes no XP or game record. Both operations use the existing profile/prestige snapshot CAS with bounded retries, strict fields, rate limits and no-store responses.

My HQ shows saved tracked paths, earned mastery emblems, achievement counts and a small Next goals view. All/In progress/Earned filters remain available. Earned challenge achievements link back to reward claims. New round-result notices identify newly earned achievements and available claims; they never pretend that unclaimed XP was already granted.

## Verification and remaining scope

Catalog tests check tier boundaries, independent category progress, legacy IDs/amounts, recommended goals, prospective counters and shared profile state. Real Redis tests cover strict prerequisites, atomic multi-claims, lost replies, tracker bounds/recovery, concurrent claims and all 90 receipts after journey pruning. Ranked integration checks a real Daily result and repeat/lost-response counter preservation. Client execution checks bounded payloads, paging, combined filters, tracking, stale/error behavior and text safety. Full suite and actual preview/production evidence are retained in the release record.

Actual phone rendering/usability, independent review, public multiplayer/season-specific challenges and additional recognition artwork remain separate work. The existing 1,000-reviewed-per-category CCE hold, token settlement and collectible ownership boundaries remain unchanged.
