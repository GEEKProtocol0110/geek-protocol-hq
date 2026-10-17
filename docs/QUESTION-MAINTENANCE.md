# Question Maintenance — October 8, 2026

The October 7 expansion reached **8,048 active questions**, twice the **4,024-question cleaned baseline**. The October 8 editorial pass retired **272 additional items**, leaving **7,776 active questions** before the subsequent ten KRC-20 additions. The October 8 total was **7,786** (194 Kaspa). The current merged total is **8,305** (700 Kaspa); see the dated follow-ups below. Historical expansion counts below describe October 7; current counts and review dispositions are in [Editorial Review](EDITORIAL-REVIEW.md). The previous 8,032 rows included generated variants, repeated facts, and unusable imports. **4,008 rows were retired** and **4,024 distinct questions added**. Retired records remain server-only for previously issued game IDs and are excluded from every new pool and public count.

| Category | Previous rows | Cleaned baseline | Added | Active questions |
| --- | ---: | ---: | ---: | ---: |
| Kaspa | 1,032 | 92 | 92 | 184 |
| Video Games | 1,000 | 368 | 368 | 736 |
| Science Fiction | 1,000 | 292 | 292 | 584 |
| Technology | 1,000 | 752 | 752 | 1,504 |
| Movies | 1,000 | 748 | 748 | 1,496 |
| History | 1,000 | 755 | 755 | 1,510 |
| Comics | 1,000 | 231 | 231 | 462 |
| Pop Culture | 1,000 | 786 | 786 | 1,572 |
| **Total** | **8,032** | **4,024** | **4,024** | **8,048** |

## Cleanup scope

Kaspa's core contained 80 concepts repeated across 1,000 variants. Canonical concept IDs and a manual alias map consolidate overlap within the core and with the current-topic bank. The cleaned Kaspa pool contains 92 concepts, expanded to 184 with 92 original primary-source questions. Existing canonical IDs survive where retained.

Generated `derivedVariant` rows are removed from the seven general banks. Screening also removes exact prompts, conservative token/answer-similarity matches, incomplete questions, missing audio or image dependencies, broken Unicode, padded true/false choices, positional all/none options, unstable undated wording, and unsuitable explicit language. Narrow categories use franchise and subject filters; unclassified prompts are retired for review rather than asserted to be factually wrong. Some legitimate questions may be excluded by these conservative filters.

Cross-category duplicates are retained in one active category only. Similarity screening is a heuristic: it does not establish exhaustive semantic equivalence. New editorial contributions must identify the underlying fact, check neighboring prompts, and reuse a concept ID when proposing a rewording. Active banks require one canonical row per concept.

## Sources and review status

The expansion includes 92 original source-checked Kaspa questions, 39 original DC Comics questions, and 37 original Star Wars questions. The remaining 3,856 additions are licensed trivia imports. Each new item includes provenance and its correct answer; source-checked authored items also include explanations and a review date.

- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA), pinned to `dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9`: CC BY-SA 4.0, credited to its contributors. Source category and ordinal are retained. Wording/encoding, options, categories, and selection were normalized; the publisher supplies the answer key.
- [Open Trivia Database](https://opentdb.com/) / PIXELTAIL GAMES LLC: multiple-choice API records retrieved October 7, 2026, CC BY-SA 4.0. HTML entities are decoded and publisher difficulty labels retained. These items retain `draft-needs-human-review`; publisher verification is not a GEEK editorial review.
- Kaspa: official integration and wallet documentation; Rusty Kaspa pinned to `01b532e8b553523216471682649693af92f0fd16`; KIPs pinned to `e4ae2332117b5cb68bd6188e065ef885b6d17939`. Original prompts cover inputs/outpoints, address types, script budgets, resource pricing, commitments, RPC, wallet lifecycle, and checkpointed ingestion. Implementation questions are scoped to their cited snapshot.
- DC's official character profiles and the official Star Wars Databank: original questions cite their specific primary character pages. These added items are internally source-checked, not independently audited.

Existing imported items retain draft status. OpenTriviaQA has no difficulty labels: imported additions receive provisional easy/medium/hard assignments, not empirical calibration. A full item-level factual, wording, genre, and difficulty review remains outstanding for the imported pool. Structural checks and a doubled count do not certify correctness. This release changes no reward or settlement permissions.

Code retains the repository MIT license. Imported question content and its adaptations retain CC BY-SA 4.0. Newly authored questions are marked CC BY 4.0; those can coexist in the general CC BY-SA collections. The existing Kaspa material retains its repository license. [Public attribution](https://www.geekprotocol.xyz/play/sources/) links both licenses and identifies these modifications.

## Gameplay and compatibility

`loadQuestionBank().questions` contains only active rows. `byId` also resolves lookup-only retired rows, preserving their original IDs, prompts, options, and correct indices for unfinished ranked/practice/Study runs. Shared lobby, duel, and periodic challenge snapshots already retain issued question data. New round selection excludes both previously used concepts and normalized prompts, including previously issued retired variant IDs and exact and conservatively similar community duplicates.

Every category supports the full 30 easy / 40 medium / 30 hard Gauntlet allocation without repeat concepts. Daily/Speed, lobbies, and Duel use the same cleaned selection boundary. Assisted practice reads only active easy questions. Study contains 537 active canonical concepts across eleven topics (eight Kaspa and three practical technology topics); current-topic questions remain outside its introductory curriculum. Former Study concept aliases resolve to the latest saved observation; counts/streaks from equivalent records are not combined into invented confidence. Progress reads do not refresh retention or mutate saved records.

## Maintenance commands

```sh
npm run questions:catalog   # regenerate count-only browser data and static counts
npm run questions:check     # validate identities, similarity, schema, metadata, and capacities
npm run verify             # includes the question checks
```

The old `review-kaspa-content.mjs` entrypoint now verifies the banks without rewriting review dates or evidence. It cannot silently mark an import source-checked. GitHub CI runs question checks. `docs/question-maintenance.json` records counts, reasons, and source snapshots; retired rows record their disposition. Keep question JSON under `server/questions/`, never under `public/`.

Validation: all eight categories complete two ten-round selections with 100 distinct concepts, including both Kaspa focus paths. Tests cover retired answer keys, concept exclusions, generated browser counts, source schemas, and saved Study alias feedback. Browser checks exercise game setup, category switching, grading/review, mobile layout, and the attribution page with real local handlers and Redis. Independent content review remains separate.

## KRC-20 additions — October 8, 2026

Ten original source-checked questions extend the Kaspa category from 184 to 194 distinct concepts; Study gains the same ten, from 166 to 176. Existing deploy/mint/transfer and indexer questions were checked for overlap before adding operation-data, SDK behavior, marketplace and project-lore concepts. Correct-answer positions span all four choices. New content carries CC BY 4.0 attribution and individual review dates. No public asset contains the answer keys.

Seven implementation questions cite Kasplex Kiwi commit `06dc75ea1066aba4d78eb32711690f6f123a9575` (README-Node.md, src/krc20.ts and src/check.ts); implementation-specific prompts explicitly identify that SDK or snapshot. Three community questions cite KaspaCom, Nacho’s Kat Bot description and Kaspy’s project story. Product-capability questions are marked volatile; no prices, market rankings or investment predictions are included. Quiz inclusion does not establish partnership or support for Geek.

The original doubling milestone remains historical. `postReviewAdditions` records subsequent authored content separately from `addedQuestions`; verification checks both counts and per-category accounting. Existing and retired answer keys remain intact. Difficulty is provisional editorial judgment, not empirical calibration.

## Kaspa editorial follow-up — October 8, 2026

A focused pass rechecks 33 existing KRC-20/Toccata questions, improves their wording and explanations, and changes ten provisional difficulty labels. Specific primary sources and individual decisions are recorded in [Kaspa Content Review](KASPA-CONTENT-REVIEW.md#focused-editorial-follow-up--october-8-2026) and its linked item-level register. Kaspa retains 194 concepts (71 easy / 82 medium / 41 hard); the site total remains 7,786. Answer options, correct indices and all retired rows are preserved. This pass does not complete the general imported-question review.


## October 14 practical technology additions

Fifteen original MIT-licensed questions in `technology-current-questions.json` extend the Technology category and guided Study. Each has an explanation, an individual source-check date and a primary MDN reference. Web responses, browser privacy and exact values each have five concepts, three guided ideas, an example, a reflection, and Foundations / Connections / Mixed practice. Their private grades and saved mistakes use the existing Study authority and retention. Imported draft Technology questions remain outside Study. Total active bank size is 7,801; Study has 191 concepts. These are internal source checks, not independent editorial approval.

The [private imported-question desk](IMPORTED-QUESTION-REVIEW.md) now stages source-checked proposals for a maintainer-reviewed bank release. Corrected grading content receives a new question identity; saved runs retain the original answer key.


## Bank-first target — October 15, 2026

The new target is 1,000 distinct, internally source-reviewed questions in every category, before CCE reopens. The generated readiness report counts review records separately from active drafts. Seven sourced History corrections retire their prior identities and two further rows are retired for repetition or an unsupported premise. At that release: 7,799 active questions, 292 recorded source reviews and 7,708 further reviewed questions needed across the category targets. See [the source register, production workflow and acceptance limits](BANK-FIRST-STORE.md). This target supersedes earlier quantity milestones; it does not claim that the remaining drafts have been fact-checked.

## Kaspa 250 milestone — October 15, 2026

Fifty-six original MIT-licensed questions in `kaspa-expansion-2026-10-15.json` bring Kaspa to **250 distinct source-checked concepts**: 83 easy, 111 medium and 56 hard. Study now exposes 247 concepts across its existing eleven topics. The total bank has 7,855 active questions and 348 recorded internal source reviews; another 7,652 reviewed questions are needed across the eight category goals. Kaspa still needs 750.

The batch adds GHOSTDAG mechanics (6), transaction validation (12), signature-hash permissions and reuse (6), hierarchical wallet concepts (12), coinbase rewards/payloads (6), standard scripts/multisig (6), and node/fee API interpretation (8). It contains no generated variants or replacements. Four answer positions each occur fourteen times; labels are provisional editorial difficulty, not player calibration. Every original and retired record remains unchanged.

All implementation evidence is pinned to Rusty Kaspa commit `01b532e8b553523216471682649693af92f0fd16`, already used in the maintenance source snapshots. The [item register](kaspa-250-review-2026-10-15.json) records the distinct concept, exact source line, evidence symbol, full source-file SHA-256 and complete question SHA-256. Each linked implementation file was fetched and read for the relevant behavior. These questions describe the cited implementation; they make no new release/activation or product-support claims. No source prose or code was imported.

Review checked the answer and all distractors, scoped implementation-specific details, distinguished unspent from immediately spendable outputs, distinguished node policy from consensus, and kept estimated inclusion separate from finality. Internal source checks and duplicate screening are not independent approval. CCE and the contributor economy remain held.

Validation: full `npm run verify` passed with 424 tests, zero failures/skips, required real Redis, all question/count/retirement checks, 310 security assertions and the economy stress baseline. The production dependency audit reports zero vulnerabilities. Review-register tests detect item edits made without updating their evidence record; Study tests now discover every configured Kaspa bank. No browser layout change or physical-phone test is part of this content release.

## Kaspa 500 milestone — October 15, 2026

The server-only `kaspa-500-2026-10-15.json` adds **250 original questions**, reaching **500 distinct Kaspa concepts**: 108 easy, 208 medium and 184 hard. Study now includes **497 concepts**. The full bank contains 8,105 active questions and 598 recorded internal source reviews; another 7,402 reviewed questions are needed across the eight category targets, including 500 more Kaspa questions.

Coverage extends block/header validation, proof-of-work calculation, peer handshakes, mempool relay/replacement/orphan policy, node data and subscriptions, wallet derivation and balance states, payment generation, scripts, transaction hashes and network identifiers. No generated variants, replacements, token-price forecasts or inferred network activation claims are added. Existing active and retired question records are unchanged.

The [250-item register](kaspa-500-review-2026-10-15.json) records each distinct concept, anchored implementation source, evidence symbol, full source-file SHA-256 and complete question SHA-256. The 34 cited files were read and their Git blob hashes matched to Rusty Kaspa snapshot `01b532e8b553523216471682649693af92f0fd16`. These are original MIT-licensed questions; no source code or prose is imported. The pinned implementation is the evidence scope; it does not prove that a feature is active or supported on every network today.

Correct-answer positions occur 63/63/62/62 times. Internal review checks the keyed answer, distractors, explanation, source scope and neighboring concepts. Automated duplicate detection supplements that review; it does not prove semantic uniqueness or factual accuracy. Difficulty labels are provisional. Future batches should broaden source lanes and learner coverage. CCE and the contributor economy remain held. The [working handoff](HANDOFF.md) preserves the continuation point and outstanding founding-archive/roadmap request.

Validation: full `npm run verify` passed with **426 tests, zero failures/skips**, required real Redis 7.4.2, all bank/count/retirement checks, 310 security assertions, collection/archive checks, repository presentation and the economy stress baseline. The production dependency audit found zero reported vulnerabilities. Every source anchor, full-file hash and pinned Git blob hash was checked. Existing Kaspa banks and retired answer keys have no diff against the preceding release. Edited documentation links and whitespace checks passed. No layout or physical-device test is part of this content-only release; production deployment evidence remains separate.

## Kaspa conventions follow-up — October 15, 2026

Twenty original MIT-licensed questions in `kaspa-conventions-2026-10-15.json` bring the candidate bank to **520 Kaspa concepts** (114 easy / 218 medium / 188 hard), **8,125 total active questions**, **618 recorded internal source reviews** and **517 Study concepts**. Another 480 Kaspa reviews and 7,382 across the category targets remain. Historical milestones above retain their original counts. This candidate is unmerged and not deployed.

The [item review register](kaspa-520-review-2026-10-15.json) pins four Kaspanet KCC files at `1516a6c4cef59940fc3af3096dbcdd9c08690254`, with full-file SHA-256, Git blob, exact line/evidence anchor and complete question hash. Questions cover convention lifecycle/conformance, KCC-20 transfer and borrowing controls, KCC-2 authority scope and KCC-23 metadata. They describe that document snapshot rather than asserting final standards, universal wallet support or approved Geek token migration. Source prose/code is not imported; the questions are original.

Internal review checks answers, distractors, explanations, source scope and existing concept neighbors. Automated similarity screening is supplementary, not proof of exhaustive semantic uniqueness. Answer positions occur five times each; difficulty labels remain provisional and independent review remains outstanding. Existing question files and issued/retired answer keys are unchanged. CCE, contributor economics, Mainnet settlement and collection ownership stay held.

Validation: full `npm run verify` passed **443 tests, zero failures/skips**, required real Redis 7.4.2 and 311 security assertions, with all bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Twenty source anchors and full-file hashes/Git blobs were verified; all preexisting banks remain byte-identical. This is candidate verification, not deployment or independent content approval.

## KasWare integration follow-up — October 15, 2026

Twenty original MIT-licensed questions in `kaspa-wallet-integration-2026-10-15.json` extend the open PR #118 candidate to **540 Kaspa concepts** (120 easy / 230 medium / 190 hard), **8,145 active questions**, **638 recorded internal source reviews** and **537 Study concepts**. Another 460 Kaspa reviews and 7,362 across the category targets remain. This candidate is unmerged and not deployed; the earlier 520 checkpoint remains historical.

The [item review register](kaspa-540-review-2026-10-15.json) pins five KasWare extension files at `78bb30045edd4d898c4d61c4c75ba1bc37e18748`. It retains full-file hashes, Git blobs, exact evidence anchors and complete question hashes. Coverage includes provider discovery, origin permissions, operation approvals, account/network events, amount units, KRC-20 balance requests, transaction submission, signing options, deprecated API handling and error/precision boundaries. This is that revision’s browser API behavior, not every wallet, an installed-version assertion or a security audit. No source code or prose is imported.

Questions and distractors were checked against the pinned implementation and existing concept neighbors. Answer positions occur five times each; difficulty is provisional and independent review is outstanding. Existing active and retired banks remain byte-identical. Games and Study include the new bank; catalog/readiness counts and the maintained pickup are regenerated. CCE, economics, ownership and Mainnet settlement remain held.

Validation: full `npm run verify` passed **445 tests, zero failures/skips**, required real Redis 7.4.2 and 311 security assertions, plus all bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Five source-file Git blobs and twenty exact anchors/item hashes were verified; all preexisting question files remain byte-identical. No browser/layout, physical-device, wallet-send or independent editorial acceptance is claimed.

## Toccata application-design follow-up — October 15, 2026

Forty original MIT-licensed questions in `kaspa-app-design-2026-10-15.json` extend open PR #118 to **580 Kaspa concepts**, **8,185 active questions** and **678 recorded internal source reviews**. The remaining gap is 420 Kaspa and 7,322 across the category targets. The new batch is 5 easy / 21 medium / 14 hard; difficulty remains provisional. Historical 520/540 checkpoints above retain their dated evidence. This candidate remains unmerged and not deployed.

The [item review register](kaspa-580-review-2026-10-15.json) pins seven Kaspanet Toccata guide files at `0ac77d043a802fc8196abfd5812ac2afbd97a2b9`, with full-file SHA-256, Git blobs, exact line/anchor and complete question hashes. Topics include covenant grouping and state readers, compiler/ABI and actor routing, proof-batched settlement, local ZK and resource sizing. These questions describe that guide revision; experimental Argent and evolving vprogs material is explicitly scoped. No live activation, audited-interface, migration or independent editorial/security review is implied.

The new bank uses the existing Toccata Programmability topic. It enters game selection and remains outside the introductory Study topic filter, which stays at **537 concepts**. No new Study topic or lesson is introduced. Existing active and retired banks and issued answer keys stay unchanged. Each correct-answer position occurs ten times. Review checks distractors, explanations, source scope and neighboring facts; automated similarity screening is supplementary. CCE, economics, ownership and Mainnet settlement stay held.

Validation: full `npm run verify` passed **447 tests, zero failures/skips**, required real Redis 7.4.2 and 311 security assertions, plus bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Seven full-file Git blobs, forty evidence anchors and complete item hashes were verified. Every previous active/retired bank remains byte-identical. No physical-device, browser/layout, wallet-send, current-network activation or independent review is claimed.


## October 16 PSKT coordination batch — 600 Kaspa concepts

Twenty original MIT-licensed questions in `kaspa-pskt-2026-10-16.json` extend the merged 580-question bank to **600 Kaspa concepts**, **8,205 active questions** and **698 recorded internal source reviews**. The remaining gap is 400 Kaspa concepts and 7,302 across all eight category targets. The new batch is 4 easy / 10 medium / 6 hard, with provisional difficulty and five correct answers in each option position. PR #140 merged October 17 at `0a553b5b02bc4466f8302d89a5acad00b3f20b73` and is deployed. Standard production monitoring passed 21/21; live static/server readiness and catalog counts agree. Exact release evidence is retained in the continuity record.

The [item review register](kaspa-600-review-2026-10-16.json) pins six Rusty Kaspa PSKT source files at `01b532e8b553523216471682649693af92f0fd16`, including their exact Git blobs, SHA-256 hashes, line evidence and complete question hashes. Topics cover coordinated signing, bundle transport, role responsibilities, metadata and merge constraints, lock-time selection, version gates and the distinction between finalization and checked script execution. The source's incomplete v1 compute-budget path is recorded; format gates do not certify end-to-end feature support.

Existing prompts, answer keys and retired lookup records are unchanged. These advanced transaction-coordination questions remain outside the introductory Study filter, preserving its 537 concepts. CCE, contributor-rate selection, Mainnet settlement and collectible ownership remain held. Internal source checks and similarity screening do not establish independent editorial approval or exhaustive semantic uniqueness.


## October 17 script execution follow-up

[Internal primary-source review](KASPA-SCRIPT-REVIEW-2026-10-17.md) adds 24 distinct execution/lock-constraint questions on pinned Rusty Kaspa code. Candidate totals: 624 reviewed Kaspa, 8,229 active, 722 recorded source reviews. Existing keys remain unchanged; introductory Study remains 537 concepts. Kaspa needs 376 more toward 1,000; all CCE/economy gates remain held. Independent editorial review and device acceptance are separate.

The 624-question checkpoint shipped in [PR #148](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/148). Live server readiness and count-only assets agree; CCE remains held.


## October 17, 2026 — 700-concept integration batch

Seventy-six distinct source-pinned resolver, wallet recovery, subscription, script/address encoding and Merkle construction concepts bring Kaspa to 700. All 76 carry dated explanations and item-level source/question hashes in [the review register](kaspa-700-review-2026-10-17.json); see [review scope and limits](KASPA-700-REVIEW-2026-10-17.md). Current total: 8,305 active / 798 recorded reviews / 7,202 still needed across the eight targets. No old active or retired question file changes. Advanced additions stay outside introductory Study (537 concepts). Difficulty is provisional; independent review and CCE/economy approval remain open. Exact release evidence belongs to the maintained state.

The 700-concept checkpoint shipped in [PR #149](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/149). Live runtime readiness and exact public count assets agree; CCE remains held.
