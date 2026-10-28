# Question-bank audit — October 27, 2026

**BANK-009 is active.** Founder direction is to audit every category thoroughly for duplicate facts, strange or broken questions, context, category fit and answer quality. Count growth cannot substitute for that work. This first batch screens every active static row and internally reviews a bounded set of likely repeats; it is not a completed factual audit.

## What this batch establishes

The baseline is deployed #175: 8,371 active questions, 766 Kaspa concepts and 864 recorded internal source checks. All eight registered categories were scanned, including the source-checked rows. Retired lookup-only rows and held community submissions are excluded from new-game audit coverage; their existing compatibility controls remain.

The broader candidate screen found 33 related-wording/shared-answer pairs: 26 within categories and seven across categories. Internal reading of all 33 pairs led to 15 confirmed duplicate draft retirements, ten retained distinct objectives, four pairs needing edition/franchise/objective review and four needing cross-category review. A shared answer is not itself a duplicate. Neither a low similarity score nor absence from the queue establishes uniqueness.

The fifteen retired identities retain their exact prompts, option arrays and answer indices in lookup-only banks. Each maps to its surviving canonical concept so a historical exclusion also excludes that fact in later rounds. Survivors remain drafts; no factual source certification is added. The item-level decisions, grading hashes and before-scan digest are in server-only `server/question-audit/decisions-2026-10-27.json`. Original licensed attribution remains attached.

The candidate bank has **8,356 active questions, 864 recorded source checks and 7,492 drafts still needing factual review**. Kaspa remains 766, with 234 more needed toward 1,000. Recorded reviews needed across the eight category targets remain 7,136. Counts may fall further when unsuitable items are removed; do not pad them with paraphrases.

| Category | Before | Duplicate drafts retired | Candidate active | Recorded source checks | Drafts needing factual review |
| --- | ---: | ---: | ---: | ---: | ---: |
| Kaspa | 766 | 0 | 766 | 766 | 0 |
| Video games | 602 | 1 | 601 | 0 | 601 |
| Science fiction | 515 | 1 | 514 | 37 | 477 |
| Technology | 1,497 | 3 | 1,494 | 15 | 1,479 |
| Movies | 1,495 | 3 | 1,492 | 0 | 1,492 |
| History | 1,508 | 4 | 1,504 | 7 | 1,497 |
| Comics | 417 | 1 | 416 | 39 | 377 |
| Pop culture | 1,571 | 2 | 1,569 | 0 | 1,569 |
| **Total** | **8,371** | **15** | **8,356** | **864** | **7,492** |

## Remaining risks and review order

The scan flags 76 rows for suspected encoding damage and four for time-related wording. These 80 signals are candidates, not 80 proven factual errors. Some time terms refer to a current connection or executing input rather than an undated changing fact. The persistent scan also retains eleven within-category and seven cross-category pairs: ten have been retained as distinct objectives; eight require further scope/category decisions.

1. Triage the 76 encoding candidates with the original source and all options. Preserve old grading records; use a new identity for a corrected question. Resolve the eight outstanding pair decisions, checking franchise/edition and category fit. Review the four time-wording signals in context.
2. Review category suitability and missing context throughout all seven non-Kaspa banks, starting with Technology, History and Comics. Their legacy imports include broad source categories; a keyword or a reference to an adaptation does not prove category fit. Use explicit subject, edition, period and jurisdiction where needed. Text describing a soundtrack is not itself a missing audio clip.
3. Review **every** remaining draft against specific primary evidence, including unflagged rows. Check the stem, keyed answer and all three distractors for correctness and ambiguity; supply an original useful explanation, specific evidence URL/review date, scope, attribution/license and provisional difficulty. Keep, correct, consolidate or retire with an item-level decision. Do not promote a whole publisher import at once.
4. Recheck semantic duplicates within and across categories, including different answer spellings, inverse questions and paraphrases with little shared wording. The current lexical method does not reliably catch these. Keep category overlap explicit rather than treating it as automatic duplication.
5. Before declaring the audit complete, reconcile every active identity to an item-level disposition and evidence, rerun compatibility/capacity/security checks, and assign independent editorial review. Internal source-check labels are not independent certification; measured difficulty and learner outcomes remain separate.

BANK-001's remaining Kaspa growth and BANK-002–008's category targets remain on the roadmap. BANK-009 is the immediate content priority. Continue small source-reviewed batches after risk triage; the full-bank audit remains open until its item coverage and review acceptance are satisfied.

## Repeatable evidence and validation

`npm run questions:audit -- --write` regenerates `server/question-audit/latest.json`; `npm run questions:audit` checks the committed report. `npm run questions:check` now includes this check, so CI rejects stale coverage. The report records a whole-corpus digest, category coverage, ID/grading-hash signals and candidate pair dispositions, without exporting question text or answer keys to public assets. It does not mutate any bank. Changed grading evidence invalidates an earlier pair decision even if the changed prompt leaves the candidate set.

Seven focused audit regressions cover paraphrases, distinct facts sharing answers, cross-category/key conflicts, encoding/media/time signals, all-row coverage, stale decisions and malformed input. A compatibility regression checks all fifteen retirements, original grading hashes, canonical aliases and subsequent-round exclusions. Full required verification, exact CI/tree, merge, deployment and canonical aggregate delivery must be recorded before release. No independent editorial, complete factual, difficulty-calibration or Beta acceptance claim is made. No live database, player, game, payment, wallet, provider configuration or billing action is part of this work.

## Candidate validation result

Full npm run verify passed with required native Redis 7.4.2: 708 HQ tests plus nine offline signer checks (717 total), zero failures/skips; 311 security assertions and all bank/schema/similarity/audit, catalog/readiness, archive/collection, repository, economy, continuity and site checks. A separate before/after comparison preserved all 12,660 historical grading tuples, all 4,289 prior retired objects and all 8,356 retained active objects. Exactly fifteen duplicate drafts moved to retirement with canonical aliases; no replacements or review-status promotions. Seven focused audit regressions include all fifteen saved-key/later-round exclusions. Site checks cover 41 pages / 882 local links. Independent source review of the remaining 7,492 drafts, encoding repair, taxonomy/scope review and independent editing remain incomplete. Continuity and whitespace checks passed after recording the result. Final exact-head CI, merge and deployment remain release evidence in the scoped PR.
