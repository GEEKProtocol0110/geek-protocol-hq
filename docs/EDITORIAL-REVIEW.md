# Editorial review — October 8, 2026

The first editorial pass retires 272 problematic questions from new-game selection. The active pool is now **7,776**. Every category still supports the full Gauntlet allocation of 30 easy, 40 medium and 30 hard concepts. This is a targeted category/context and unsupported-claim review, not a completed factual or difficulty audit of every import.

| Category | Active before | Retired this pass | Active now |
| --- | ---: | ---: | ---: |
| Kaspa | 184 | 0 | 184 |
| Video Games | 736 | 134 | 602 |
| Science Fiction | 584 | 69 | 515 |
| Technology | 1,504 | 22 | 1,482 |
| Movies | 1,496 | 1 | 1,495 |
| History | 1,510 | 0 | 1,510 |
| Comics | 462 | 45 | 417 |
| Pop Culture | 1,572 | 1 | 1,571 |
| **Total** | **8,048** | **272** | **7,776** |

## Findings and decisions

Broad keyword matching had included physical sports and tabletop games under Video Games, sitcoms/comedians under Comics, and food, holidays and Latin phrases under Science Fiction. This pass reviews flagged prompts and records explicit retirements. Related franchises and crossovers are not rejected simply because they mention another field: examples retained include Terminator films, SCP fiction, Greek mythology and the Marvel/Hulk Hogan name-rights question.

Missing-context examples include absent soundtracks, an unnamed film, a bare list of films without a question, and a generic request to identify an unspecified television show. Technology removals include clinical diagnosis/treatment prompts and undated medical statistics, not an assertion that their answers are all wrong. The EKG anatomy item remains.

`TECH-N-8be37bf2d04f` asserts proof of microbial life on Mars. [NASA's definition of a potential biosignature](https://science.nasa.gov/resource/what-is-a-potential-biosignature/) requires additional evidence before conclusions about life can be reached. The overstated prompt is retired rather than silently changing an issued answer.

The machine-readable [decision register](editorial-review.json) records every removed ID, category, reason, note and original grading-content hash. These rows remain in server-only retired banks, with their original prompts, options and answer indices. Existing games can finish with the answer key they were issued; every new selector uses the active pool. Verification rejects reinstated held IDs, missing compatibility rows and changed historical answer keys.

The October 7 expansion remains a historical milestone. Current counts are generated from the active files. A fixed count target must not force unsuitable items back into play.

## Review still pending

The earlier expansion documentation misstated the authored/import split. The original snapshot contained 3,856 new licensed draft imports and 168 new source-checked authored items: 92 Kaspa, 39 Comics and 37 Science Fiction. This pass retires 258 of those imports. **3,598 new licensed drafts remain for primary-source factual, wording and difficulty review.** There are 7,516 active drafts in total when older retained imports are included. None is promoted to `source-checked` by this screening pass.

Next review batches should verify a named subject against primary evidence, record an item-level source/date and explanation, check distractors and ambiguity, then calibrate difficulty. Corrections that alter grading need a new active identity and a preserved retired record. Existing CCE moderation handles community submissions; this static-bank decision register is a separate repository review process.
