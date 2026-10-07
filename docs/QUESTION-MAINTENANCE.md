# Question Maintenance — October 7, 2026

The eight HQ categories now contain **8,048 active questions**, exactly twice the **4,024-question cleaned baseline**. The previous 8,032 rows included generated variants, repeated facts, and unusable imports. **4,008 rows were retired** and **4,024 distinct questions added**. Retired records remain server-only for previously issued game IDs and are excluded from every new pool and public count.

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

The expansion includes 92 original source-checked Kaspa questions, 39 original DC Comics questions, and 25 original Star Wars questions. The remaining 3,868 additions are licensed trivia imports. Each new item includes provenance and its correct answer; source-checked authored items also include explanations and a review date.

- [OpenTriviaQA](https://github.com/uberspot/OpenTriviaQA), pinned to `dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9`: CC BY-SA 4.0, credited to its contributors. Source category and ordinal are retained. Wording/encoding, options, categories, and selection were normalized; the publisher supplies the answer key.
- [Open Trivia Database](https://opentdb.com/) / PIXELTAIL GAMES LLC: multiple-choice API records retrieved October 7, 2026, CC BY-SA 4.0. HTML entities are decoded and publisher difficulty labels retained. These items retain `draft-needs-human-review`; publisher verification is not a GEEK editorial review.
- Kaspa: official integration and wallet documentation; Rusty Kaspa pinned to `01b532e8b553523216471682649693af92f0fd16`; KIPs pinned to `e4ae2332117b5cb68bd6188e065ef885b6d17939`. Original prompts cover inputs/outpoints, address types, script budgets, resource pricing, commitments, RPC, wallet lifecycle, and checkpointed ingestion. Implementation questions are scoped to their cited snapshot.
- DC's official character profiles and the official Star Wars Databank: original questions cite their specific primary character pages. These added items are internally source-checked, not independently audited.

Existing imported items retain draft status. OpenTriviaQA has no difficulty labels: imported additions receive provisional easy/medium/hard assignments, not empirical calibration. A full item-level factual, wording, genre, and difficulty review remains outstanding for the imported pool. Structural checks and a doubled count do not certify correctness. This release changes no reward or settlement permissions.

Code retains the repository MIT license. Imported question content and its adaptations retain CC BY-SA 4.0. Newly authored questions are marked CC BY 4.0; those can coexist in the general CC BY-SA collections. The existing Kaspa material retains its repository license. [Public attribution](https://www.geekprotocol.xyz/play/sources/) links both licenses and identifies these modifications.

## Gameplay and compatibility

`loadQuestionBank().questions` contains only active rows. `byId` also resolves lookup-only retired rows, preserving their original IDs, prompts, options, and correct indices for unfinished ranked/practice/Study runs. Shared lobby, duel, and periodic challenge snapshots already retain issued question data. New round selection excludes both previously used concepts and normalized prompts, including previously issued retired variant IDs and exact and conservatively similar community duplicates.

Every category supports the full 30 easy / 40 medium / 30 hard Gauntlet allocation without repeat concepts. Daily/Speed, lobbies, and Duel use the same cleaned selection boundary. Assisted practice reads only active easy questions. Study contains 166 active canonical concepts across its eight existing topics; current-topic questions remain outside its introductory curriculum. Former Study concept aliases resolve to the latest saved observation; counts/streaks from equivalent records are not combined into invented confidence. Progress reads do not refresh retention or mutate saved records.

## Maintenance commands

```sh
npm run questions:catalog   # regenerate count-only browser data and static counts
npm run questions:check     # validate identities, similarity, schema, metadata, and capacities
npm run verify             # includes the question checks
```

The old `review-kaspa-content.mjs` entrypoint now verifies the banks without rewriting review dates or evidence. It cannot silently mark an import source-checked. GitHub CI runs question checks. `docs/question-maintenance.json` records counts, reasons, and source snapshots; retired rows record their disposition. Keep question JSON under `server/questions/`, never under `public/`.

Validation: all eight categories complete two ten-round selections with 100 distinct concepts, including both Kaspa focus paths. Tests cover retired answer keys, concept exclusions, generated browser counts, source schemas, and saved Study alias feedback. Browser checks exercise game setup, category switching, grading/review, mobile layout, and the attribution page with real local handlers and Redis. Independent content review remains separate.
