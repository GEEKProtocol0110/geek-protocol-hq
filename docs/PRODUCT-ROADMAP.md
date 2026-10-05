# Geek Protocol — Full Product Roadmap

**Reviewed direction:** October 2, 2026  
**Public edition:** [HQ Litepaper v1.11](https://www.geekprotocol.xyz/litepaper/)
**Purpose:** Carry the original project vision into an explicit implementation backlog.

This document preserves the founder's full direction. It records features and acceptance criteria; it does not activate gameplay formats, payments, treasury authority, DAO votes, or collection ownership. Kaspa 101 remains the main Learn destination. Geek Jr's current implementation is outside this HQ release.

Geek Protocol was born in Detroit, Michigan, USA. Use American English in public copy and project documentation, including “practice.”

## Current priorities: core polish and economy foundations

**Founder decision, October 2, 2026:** pause feature expansion and focus on Learn → Study → practice → see progress. Preserve Kaspa 101 in full. Home and primary navigation should make the next learning step clear; Progress should put saved Study feedback ahead of separate timed-game records. Existing challenges, vault, minting, collectibles, lobbies and contributions remain accessible as optional paths.

**Later founder direction, October 2, 2026:** start the wallet, payout, power-up purchase and 70/30 economy foundation. The first release restores the named catalog, planned treasury accounts and an isolated planning journal; purchases, gameplay effects, funding and settlement are not enabled. See [Economy Protocol](ECONOMY-PROTOCOL.md).

**Next founder direction, October 2, 2026:** pause wallet and sensitive configuration for the founder to handle. Continue free gameplay: a separate ten-question assisted practice session implements one 50/50 and one ten-second Extra Time trial use. No XP, credits, tokens or ranked entries are awarded. Paid inventory and the remaining effects are unfinished.

**Founder direction, October 3, 2026:** reopen free game-mode work. The first addition is Memory Grid: untimed solo term/meaning matching, using four-, six-, or eight-pair Kaspa boards, source-linked explanations, related lessons and Giga encouragement. Results stay in the page and award no XP, credits or tokens. This does not activate paid entry or settlement.

Multiplayer Arena expansions, DAO work, and the launchpad remain **planned** while the core and free games are polished and tried by real learners. The feature tables below preserve the full long-term vision; “Planned” does not mean active work or the next release. No existing service is shut down by this prioritization.

First-visit guidance points beginners to Where Kaspa began at Foundations level, explains read → practice → review, and gives learners with no saved answers an explicit first-lesson action. Existing learners keep their saved review and continuation recommendations. The final lesson idea offers an explicit Start practice action using the selected topic and level; reading the lesson never starts a run automatically. This is interface guidance, not evidence of improved learning outcomes.

The next review should ask whether learners can find a lesson, understand its objective, answer a short practice set, find saved mistakes, and choose the next step without help. Record confusing steps and content corrections through the existing issue process. Usability observations are not evidence of improved learning outcomes; any outcome claim needs a separate evaluation. Do not add analytics or collect learner data merely to carry out this review.

## Original references

- [Master Document](https://geek-litepaper-nu.vercel.app/docs/Master_Document_v1.3.html): labels itself v1.5 despite its legacy v1.3 URL.
- [Litepaper v1.3](https://geek-litepaper-nu.vercel.app/docs/Litepaper_Themed_v1.3.html).

Earlier documents express a proposed ecosystem. The present implementation uses static pages, Vercel Functions, and Redis; the older React/MongoDB/IPFS stack is not a description of deployed HQ. Source archives remain linked, while [Architecture](ARCHITECTURE.md) and [Project Status](PROJECT-STATUS.md) describe current evidence.

## Live starting point

| Capability | Current evidence and boundary |
| --- | --- |
| Kaspa 101 | Field guide, live graph embed, milestones, builder paths, curriculum, sources; main Learn destination |
| Study with A.C.E. | Eight guided lessons, three practice levels, saved concept feedback, untimed explanations, session and saved-mistake review; no rank or rewards |
| Gauntlet | Ten rounds of ten questions, eight categories, server-owned deadlines/scoring; later rounds use internal credits |
| Daily and Speed | Implemented timed alternatives, with their existing separate modes |
| Weekly and monthly challenges | Shared reviewed Kaspa sets, UTC periods, one attempt per player, accuracy scoring, bounded separate boards |
| Player dashboard / Geek's Journey | Server XP, levels 1–50, 25 optional prestige resets, achievements, challenge cards, verified standings, category records, journey history and avatars |
| Shared lobbies | Ten-question host-started practice, roster/deadline authority; Quick Duel is a two-seat template |
| Community Content Engine | Submission, human moderation, publication, one internal first-use credit |
| Collectibles and trades | Off-chain avatar/sticker inventory and atomic sticker offers |
| GEEK fair mint | Non-custodial interface against a pinned 144B-max, eight-decimal, no-premint deployment |
| Wallet identity | Server-verified proof, recovery, and protected payout preferences; settlement remains disabled |
| 500-Geek world | Stable identity/design manifest and recovered-art provenance; NFT ownership is not enabled |

These capabilities remain covered by their existing protocol specifications and controls. Public web trivia is not a proctored credential.

## 1. Learning depth

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| LEARN-01 | Reviewed difficulty progression | Partial: Study level selection live | Existing easy/medium tiers exposed as Foundations/Connections; Mixed includes technical concepts. Full difficulty audit, independent editorial approval, and ranked progression changes remain |
| LEARN-02 | Guided learning / Learn & Earn modules | Guided Study live; earning path planned | Eight objectives, three teaching ideas plus a worked example/reflection per topic; Study remains unranked. Future rewarded assessments need separate validation |
| LEARN-03 | Weekly and monthly challenges | Implemented Alpha | UTC periods, shared immutable concept sets, one server player attempt, strict clocks, atomic completion, recovery/replay tests, tie ranks and bounded separate boards |
| LEARN-04 | Daily login vault | Implemented Alpha | Seven visible cosmetics, one claim per UTC day, Redis-clock eligibility, atomic receipts/collection, recovery and duplicate-claim checks; no XP or monetary rewards |
| LEARN-05 | Mastery feedback | Practice feedback live; validated assessment planned | Private server-owned concept records, coverage, saved mistakes, and two-run confidence signals. These do not certify mastery |

Start with content quality and guided practice. Educational benefit and question diversity should improve before additional earning incentives are introduced.

**October 2 learning release:** guided lessons and practice levels are implemented in Study. Selection covers unseen concepts first; saved mistakes can be reviewed after a run expires. Progress survives across sessions for the same verified player identity, while guest access follows the browser session. Weekly/monthly challenges now have shared sets and separate standings. The daily vault now gives one visible cosmetic seal per UTC day with private receipts and duplicate-claim protection. Independently reviewed difficulty progression and reward-enabled assessments remain separate work.

[Challenge protocol](CHALLENGE-PROTOCOL.md) defines the ten-question Weekly Signal and twenty-question Monthly Circuit, UTC boundaries, one-attempt rule, no-reward boundary, capacity and retention.

## 2. Geek Arena

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| ARENA-01 | The Duel: dedicated 1v1 | Implemented free Alpha | Mutual ready-up, ten shared questions, Redis clock and atomic scoring, winner/draw/forfeit/disconnect results, fixed two-player roster, reload recovery and mutual rematches; no XP or monetary rewards |
| ARENA-02 | Team Battle: 2v2 | Planned | Fixed team rosters, cooperative answer rules, team scoring, and adversarial cross-team authorization tests |
| ARENA-03 | Party Mode: social co-op | Planned | Group objective, shared progress, accessible pacing, host/rejoin rules, and clearly separate practice standings |
| ARENA-04 | Trivia Royale | Planned | Event entry/round lifecycle, elimination and tie rules, A.C.E. hosting tools, server authority, and tested participant-capacity limits |
| ARENA-05 | Optional Duel wagers / event prizes | Proposed monetary extension | Separate approved economic specification, reviewed custody/settlement path, reconciliation, eligibility and dispute rules; follows economy work |

Geek Duel at `/duel/` is the dedicated free 1v1 format. The existing Quick Duel lobby template remains shared practice. Wagered Duel and specialized Fandom Duel rules remain planned. See [Duel protocol](DUEL-PROTOCOL.md).

### Original game-mode lineup

| Mode | Current status | Remaining work |
| --- | --- | --- |
| Geek Gauntlet | Live server-owned ten-round Alpha; Daily/Speed alternatives live | Continued content/rule review; any funded entry or cash-out is a separate monetary extension |
| Memory Grid | Live free Kaspa solo matching; 4/6/8 pairs, explanations, source/lesson links | Additional reviewed decks and any future saved progression require separate work |
| Trivia Royale | Planned | Shared event lifecycle, elimination/ties, reconnect handling, hosting and capacity tests |
| Fandom Duel | Planned | Dedicated head-to-head rules and reviewed fandom content; existing Quick Duel rooms are shared practice |
| Quiz Quest | First Signal free Alpha chapter implemented | Three source-linked origins scenes, six untimed checks, saved resume/review and one completion badge; further chapters planned |

The first Memory Grid release uses explicit player-controlled mismatch review rather than a countdown. Attempt counts describe pairs turned over, not certified knowledge. Ranked authority and real money remain outside this casual browser game.

## 3. Creator ecosystem

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| CREATE-01 | Community peer review | Planned | Reviewer identity and authorization, conflict-of-interest rules, review history, appeal/correction path, and publication controls |
| CREATE-02 | Creator attribution and reputation | Planned | Verifiable authorship, version history, transparent quality/use records, and abuse-resistant reputation criteria |
| CREATE-03 | Recurring question-use earnings | Proposed | Defined payable usage, funded reward pool, replay-resistant accounting, attribution splits, caps and correction policy; no guaranteed passive income |
| CREATE-04 | Contributor grants | Proposed | Public proposals, funding source, reviewer/executor separation, deliverables, decisions, and expenditure records |

The Alpha's implemented reward is one internal first-use credit. Recurring earnings and funded grants do not exist merely because this roadmap names them.

## 4. Player economy and ownership

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| ECON-01 | Cosmetic/consumable store | Catalog restored; purchases planned | Item definitions and inventory authority; purchases cannot buy ranked score or certify knowledge |
| ECON-02 | Collection production and NFT achievements | Planned | Finished reviewed art, frozen metadata/provenance, selected ownership standard, and an independently reviewed mint/transfer design |
| ECON-03 | Peer-to-peer NFT marketplace | Planned | Ownership verification, trade lifecycle, custody/signing boundaries, fees, settlement records and independent review |
| ECON-04 | 70/30 Recycle & Burn | Planning accounting implemented; settlement proposed | Define eligible collected platform fees, denomination, rounding, recycling destination, burn mechanism/evidence, caps and auditable reconciliation |
| ECON-05 | Token rewards and wallet-neutral payouts | Proposed | Funded treasury, eligibility, transfer implementation, limits, monitoring, recovery/disputes and independent exact-release audit |

**70/30 applies to proposed platform fees:** 70% recycles into ecosystem reward funding; 30% is burned. It is not a 70/30 split of the 144-billion token supply. No operating fee-distribution or burn engine is being asserted. Game credits and the independently user-approved fair mint remain separate systems.

The named lineup is 50/50, Ask the Fandom, Extra Time, Skip Question, Safety Net, and Double GEEK opportunity. Free trial rules are implemented for 50/50 and Extra Time in assisted practice. Prices, paid eligible modes, persistent inventory consumption and monetary reward rules remain explicit unfinished requirements. Restored treasury accounts are Reward Reserve, Creator Reward Pool, Tournament Pool, Operations Treasury, Burn Pending/Confirmed, Withdrawal Hot Wallet and Emergency Reserve. No funded reserve is verified.

Existing sticker trades are off-chain. Future token utilities include skill rewards, protocol spending, marketplace payments, and governance, subject to implemented rules. Wagers and event prize settlement depend on this stage.

## 5. Contributors and community governance

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| GOV-01 | Public proposals and participation | Planned | Transparent proposals, discussion, decisions, contributor roles, and authority records |
| GOV-02 | Grant accountability | Proposed | Identified treasury authority, budget/expenditure reports, milestone evidence, and accountable execution |
| GOV-03 | Geek Protocol DAO transition | Planned | Published eligibility/voting/delegation/quorum rules, conflict controls, execution and treasury design, and independent review of value-moving authority |

Progressive decentralization is the direction. Today's server-ranked Alpha and moderator operations should not be described as an already community-controlled DAO. Founder and core-contributor roles remain visible; GEEK-holder voting is not live.

## 6. Education and open infrastructure

| ID | Feature | Status | Completion evidence |
| --- | --- | --- | --- |
| OPEN-01 | Geek Protocol for Education | Long-term planned | Teacher-supported pilot, curriculum objectives, appropriate learner controls, and measured learning outcomes |
| OPEN-02 | Geek Protocol: Pro | Long-term planned | Domain-specific content, assessment standards, progress evidence, and a professional-learning pilot |
| OPEN-03 | Open learning interfaces | Planned | Versioned documented interfaces, authorization and data boundaries, example integration, and reproducible developer checks |
| OPEN-04 | Community Launchpad | Long-term planned | Community selection/funding rules, governance foundation, project accountability, and a bounded pilot |

Schools, professional development, and the launchpad extend the learning purpose beyond entertainment. They are directions to build and test, not claims of existing partners, qualifications, or launched products.

## Character roles

**Giga** is the welcoming community robot and the social heart of the project. **A.C.E.** is the analytical teaching and event-host character. Giga now welcomes learners on Home and Study, offers a next-step chooser, responds to Study and assisted-practice results with encouragement, and links Progress to the next lesson or saved review. This is authored guidance grounded in the existing page state, with no new chat, tracking, or reward authority. Current A.C.E. Study uses authored, source-linked guidance. Adaptive tutoring and automated event hosting need their own implementation and evaluation. Existing recovered art remains identified as concept art.

## Delivery order and change discipline

1. Preserve Kaspa 101 and the existing live learning path.
2. Improve content quality and guided learning.
3. After the founder reopens expansion, build practice Arena formats from the existing server-authoritative lobby foundation.
4. Expand creator review and transparent contribution records.
5. Specify and review store, ownership, treasury and fee behavior before monetary modes.
6. Introduce community governance through published, accountable steps.
7. Pilot education, professional learning, integrations, and the launchpad with their dependencies in place.

Core polish and the authorized economy foundation are active. Other expansion stages remain on hold until the founder chooses to reopen them; their stated dependencies remain. There are no invented launch dates. Each implemented feature should have a focused issue/PR, documentation, meaningful authorization/state tests where relevant, and production evidence before its public status becomes Live.

## Profile character and NFT collection (October 3, 2026)

The founder specifies 500 NFTs in five tiers: Common 250, Rare 125, Epic 75, Legendary 48 and Mythic 2. Collection schema 1.1 folds the prior eight Elite identities into Legendary, retaining IDs, names, lore and GIGA/A.C.E. anchors. Planned public mint, earned reward, and GEEK/KAS purchase routes share this one capped supply. Allocations and prices are unset and all routes remain disabled. Verified ownership is required before NFT equipping; profile cosmetics cannot alter frozen NFT metadata.

Build-a-GEEK is a free off-chain profile character editor with fixed color, headgear, face, torso, arms, legs, back and effect options. Previewing causes no write. Explicit Save & equip uses the session-authenticated, rate-limited collectibles endpoint, rejects arbitrary traits, stores the customization and equips `giga-builder`. Atomic Redis field patches preserve concurrent profile fields, with audit records. Existing five launch avatar unlocks remain server-controlled. Switching avatars retains the saved custom design. Reloading retrieves it from the same profile. Session loss follows the existing profile recovery rules. No profile traits are sent to analytics. This release does not mint NFTs, create token rewards, accept payments or require sensitive configuration.
