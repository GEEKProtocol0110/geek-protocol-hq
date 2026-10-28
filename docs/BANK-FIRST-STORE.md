# Bank-first release and Geek Store

Founder direction, October 15, 2026: build 1,000 legitimate questions per category before CCE runs; keep future rewards small; develop clothing, equipment, tools, accessories, lifelines, perks and bonuses.

## The actual bank

The audit began with 7,801 active questions and 285 recorded source reviews. Historical expansion and editorial corrections remain in the maintenance record. Release [#175](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/175) is deployed at **766 Kaspa concepts, 8,371 active questions and 864 internal source-review records**. The [BANK-009 audit candidate](QUESTION-BANK-AUDIT-2026-10-27.md) retires fifteen duplicate drafts across the seven other categories, producing **8,356 active questions** with the same **864 recorded checks**. Kaspa remains 766 / 234 needed; all category targets need **7,136 further reviews**. The table describes the audit candidate, not its deployment. Screening does not certify all active rows as distinct or factually reviewed; **7,492 drafts still need factual review**. Exact releases are recorded in the scoped PRs and [maintained state](continuity/CURRENT-STATE.md).

| Category | Active | Recorded source reviews | Still needed for 1,000 | Additional distinct questions needed even if every current draft passes |
| --- | ---: | ---: | ---: | ---: |
| Kaspa | 766 | 766 | 234 | 234 |
| Video games | 601 | 0 | 1,000 | 399 |
| Science fiction | 514 | 37 | 963 | 486 |
| Technology | 1,494 | 15 | 985 | 0 |
| Movies | 1,492 | 0 | 1,000 | 0 |
| History | 1,504 | 7 | 993 | 0 |
| Comics | 416 | 39 | 961 | 584 |
| Pop culture | 1,569 | 0 | 1,000 | 0 |

`node scripts/question-bank-readiness.mjs --write` refreshes the counts-only public report and table. The check runs with `npm run questions:check` and fails on stale generated evidence. Runtime CCE status independently computes the same aggregates from deployed server-only banks. No question text or answer key enters the public report.

The target counts unique canonical concepts with four distinct choices, one answer index, HTTPS evidence, an explanation, source-checked status and a valid review date. Duplicate identities, concepts and normalized prompts make readiness unavailable. Retired rows, generated variants, drafts and future/malformed review dates cannot contribute. Each category also needs enough reviewed easy/medium/hard questions for the existing 30/40/30 Gauntlet capacity. Suggested production mix: 300 easy, 400 medium and 300 hard; this is an editorial planning mix, not an automatic difficulty certification. Internal review records and structural checks cannot establish factual correctness by themselves.

## Editorial production

Work in small batches, starting with Kaspa and categories with the largest evidence gaps. For each item: identify a distinct learning fact; read its specific primary source; check the key and every distractor; state edition, date or jurisdiction when necessary; write a useful explanation; inspect existing concepts and near-duplicates; calibrate difficulty; and retain licensing/attribution. Reworded or renumbered versions of the same fact do not earn another slot. Time-sensitive claims need a dated scope and subsequent review.

Use the existing private imported-review workspace for drafts and the staging tool for corrections/retirements. Author new bank items in server-only source files through a reviewed PR. Update metadata and maintenance accounting, regenerate catalogs, and run the full checks. Existing issued answer keys stay lookup-only when an item is replaced. Never turn an entire imported bank into source-checked merely because its publisher is named.

Primary-source lanes: Kaspa research/KIPs/node and wallet documentation; game publisher manuals and release records; franchise/edition-specific science-fiction material; MDN/specifications for technology; studio/film credits for movies; archives, museums and historical institutions for history; publisher and issue-specific comics references; and dated artist, label, broadcaster or award-institution records for pop culture. The target is broad topic coverage, not 1,000 narrowly repeated facts.

## First source-review batch

Seven History corrections add internally checked sources and explanations, with clearer scope and provisional difficulty. New identities preserve the original issued records in retirement. Imported CC BY-SA 4.0 licensing remains attached to these adaptations; source publishers provide evidence, not permission to copy their prose or an endorsement.

| Prior identity | Decision and evidence |
| --- | --- |
| HIS-N-f317c834cef3 | Separate adoption from the start of signing the engrossed copy; [National Archives](https://www.archives.gov/milestone-documents/declaration-of-independence) |
| HIST-0033 | Date the Wright powered flights specifically; [National Park Service](https://www.nps.gov/articles/wrightflyer.htm) |
| HIS-N-2086bc060489 | Scope Mandela's release to Victor Verster; [Nelson Mandela Foundation biography](https://www.nelsonmandela.org/biography) |
| HIST-0924 | Distinguish first lunar footsteps from the other Apollo crew roles; [NASA mission overview](https://www.nasa.gov/history/apollo-11-mission-overview/) |
| HIST-0051 | Identify the First Corps commander killed on the battle's first day; [NPS Reynolds record](https://www.nps.gov/people/john-f-reynolds.htm) |
| HIST-0052 | Correct division-command scope instead of implying overall cavalry command; [NPS commanders](https://www.nps.gov/articles/000/federals-gettysburg.htm) |
| HIS-N-3162317504ab | Scope the Berlin Wall question to the border opening rather than a vague end-of-war claim; [Office of the Historian](https://history.state.gov/milestones/1989-1992/fall-of-communism) |
| HIS-N-ec831b5b832f | Retire a second question testing the same Berlin Wall year |
| HIST-0121 | Retire an unverified Andorra peace-treaty premise; do not assert it as fact without suitable evidence |

This is a focused internal review, not independent editorial approval or a review of the remaining bank.

## CCE hold

New submissions, revisions, publication, new-game CCE selection and new first-use credits are held. Server guards cover direct calls as well as HTTP/UI routes. Existing contributor history and earned internal credits remain readable; saved games retain lookup/grading of historical published questions. Moderators may still read, approve, reject or request changes for old records, but cannot publish them during the hold. This does not pause the separate Hall of Thanks application workflow.

`GET /api/content/?view=readiness` is credential-free, read-only and aggregate-only. A fresh Contribute page checks it without creating a player session. Viewing historical contribution records remains an explicit session-bound action. The old 25-credit offer is removed from new-intake copy; legacy records keep their exact historical amounts.

The gate has two independent requirements: the reviewed bank and an approved contributor economy. Reaching a count cannot activate rewards. No environment variable bypasses this hold; reopening requires a separately reviewed implementation/release.

## Small contributor rewards: proposal only

Start by comparing **1 or 5 GEEK once per qualifying original question**, payable only after source review, publication and a first qualifying third-party use. For 10,000 qualifying first uses, those candidate budgets are 10,000 or 50,000 GEEK. These are token-unit planning examples, not prices, funded obligations or projected token values. Neither amount is selected or enabled here. The separate proposed player-round reward remains 100 GEEK per qualifying round.

Before activation define: funded creator-pool budget; daily/global and per-contributor caps; qualification and third-party-use evidence; duplicate/self-use/collusion handling; correction and appeal policy; pending/available/settled accounting; verified payout receipts; and a reward-versus-store-spending policy. Repeated views must not create repeated earnings. A store purchase cannot create correctness, ranked points or a qualification. The existing 70/30 policy applies only to an explicitly identified future platform-fee portion. It does not authorize a burn or a charge.

## Geek Store first release

`/store/` has a searchable, filtered fitting room with front/back views, Personal Geek/GIGA style selection, 30 free studio parts, two career effects, six lifelines and two proposed perks/bonuses. It adds five authored cosmetic options: lab coat, field jacket, goggles, field tool pack and robot handheld scanner. Fixed vocabulary, normalization and rendering are shared with the server-validated character studio. No user SVG, remote asset, arbitrary trait or ownership claim is accepted.

The fitting room starts collapsed on phones so the catalog is reachable sooner; trying on an item opens it. Desktop layouts start with the fitting room open. Try-on changes only a local preview. **Review this look in my studio** puts a validated design in same-tab session storage for at most 30 minutes, consumes it once at `/profile/?store=preview#geek-builder`, and leaves it unsaved. Only the existing explicit Save my Geek operation can equip it. A subsequent profile read cannot replace an edited preview. Invalid, oversized, expired or storage-blocked handoffs fail without changing the saved character. Career effects still require their existing server-checked level/prestige unlock.

50/50 and Extra Time link to the existing free assisted practice. Ask the Fandom, Skip Question, Safety Net and Double GEEK opportunity remain proposed. Companion themes and a cosmetic learning-streak bonus are also proposals. Prices, paid inventory, purchase verification, paid consumption and new reward effects are unfinished. Existing free parts remain free; this release does not monetize them or make a paid advantage.

## Verification limits

Validation: `npm run verify` passed with 422 tests, zero failures/skips and required real Redis; 310 security assertions, all question/catalog/retirement, collection, archive, repository and economy stress checks passed. The unchanged production dependency graph audited with zero reported vulnerabilities. Edited HTML/CSS and local documentation links passed static checks.

Tests cover readiness edge cases, blocked CCE writes/selection/credits, historical lookup/credit preservation, cosmetic validation/rendering, store filtering/preview and one-time studio handoff. Existing profile and API tests cover explicit save, concurrency and earned-effect authority. Generated counts, content/retirement accounting, licenses and original answer hashes remain checked by the question suite.

No supported browser control is available in this environment. The founder's earlier positive phone-layout observation covers the preceding homepage release, not this new store or Contribute layout. New phone/browser acceptance remains to be performed.
