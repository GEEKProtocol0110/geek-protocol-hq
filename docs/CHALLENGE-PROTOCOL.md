# Weekly and Monthly Challenges

**Implemented:** October 2, 2026. **Surface:** `/challenges/`. **API:** `/api/ranked/?service=challenges` (existing function budget).

Weekly Signal and Monthly Circuit are free community competitions with separate standings. They do not award XP, Alpha credits, inventory, contributor rewards, or tokens, and do not modify Gauntlet/Daily/Speed leaderboards or Study feedback. Kaspa 101 remains Learn.

## Periods and participation

| Rule | Weekly Signal | Monthly Circuit |
| --- | --- | --- |
| UTC boundary | Monday 00:00 through the next Monday, end exclusive | First day 00:00 through the next month, end exclusive |
| Distinct canonical concepts | 10 | 20 |
| Difficulty mix | 4 easy, 4 medium, 2 hard | 8 easy, 8 medium, 4 hard |
| Per-question deadline | 15 seconds | 15 seconds |
| Overall limit, including answer review | 5 minutes | 10 minutes |
| Attempts | One per resolved server player identity per period | Same |
| Points | 100 per correct answer, no time/streak bonus | Same |
| Capacity | 5,000 started players per period | Same |

Starting consumes the attempt. A repeated start returns its existing state rather than restarting a clock. Recovery of a verified identity resumes that identity’s attempt, while guests depend on their browser session. Player names are snapshotted at start and shown publicly only on submitted results; wallet addresses, player IDs, and run IDs are absent from standings.

Every question’s options are shuffled independently, but the prompts and order are shared for that period. Tied scores share a competition rank: two players tied for first are both rank 1; the next lower score is rank 3. Boards list at most ten submitted players, including zero-score submissions. Private results return the caller’s own current rank even when outside the ten shown. The board reports its total submission count, so a limited list cannot imply that it includes all participants.

Finishing early forfeits unanswered questions (zero points). Expired overall clocks can submit the already recorded score while the period remains open. Completed results cannot be replaced or replayed into extra points. Unsubmitted attempts are excluded when the period closes; they can be reviewed privately but cannot be added later. Current and immediately previous periods are displayed. Stored period data expires 60 days after period close; reads do not extend retention.

## Question selection and snapshots

The introductory source-checked bank supplies one canonical item for each of 80 concepts. Period ID and a versioned SHA-256 seed deterministically order candidates; selection covers all eight topics and satisfies the quotas above. Questions progress from easy to medium to hard. Current/volatile questions and community submissions are outside this initial periodic curriculum.

The first successful start freezes a private Redis snapshot containing prompt, options, correct index, explanation, source, topic and concept identity. `SET NX` makes one snapshot win concurrent creation. Each attempt pins its hash. Grading reads that snapshot, never a replacement answer from the live bank. Missing or substituted snapshots fail closed without consuming an answer. New app releases therefore cannot silently change an existing period’s grading. Reviewed difficulty labels remain internally assigned, not independently calibrated.

## Authority and atomic transitions

| Action | Boundary |
| --- | --- |
| GET | Current or `previous=1` period metadata and bounded public boards; no questions or answer keys |
| `status` | Authenticated player’s current/previous attempts; no other player selector is accepted |
| `start` | Server kind/period validation, IP and player limits, atomic one-attempt claim and capacity increment |
| `resume` | Private state with the same token/deadlines; submits a timed-out attempt only if its period is still open |
| `answer` | Numeric selection -1..3, current token, private snapshot, strict server deadline, atomic state transition |
| `next` | Reviewed token; retries return the already issued next question rather than advancing twice |
| `finish` | Atomic attempt completion plus board score and public metadata; retries return committed results |

Runs are stored at private `geek:challenge:attempt:<period>:<player>` keys. Snapshot, start count, board and metadata use separate `geek:challenge:` keys. A Lua compare-and-set validates the complete previous state and period cutoff; completion and score publication occur in the same transition. Concurrent answers cannot overwrite the first result, and duplicate finishes cannot add another participant. Public scoring authority never comes from a browser score, clock, correctness claim, or player ID.

The browser’s visible timer uses server time and a monotonic local elapsed clock, while the server alone decides validity. Reloads preserve question and overall deadlines. Answer keys and sources are revealed only after a committed answer; completed/private closed attempts contain only explanations for answered questions. Browser storage holds an optional opaque recovery hint; the private cards still allow recovery without storage.

## Limits and evidence

This is public web trivia. Open source content, other browsers, outside assistance, and multiple guest/wallet identities cannot be fully prevented. One attempt means one resolved player identity, not one provably unique human. The release makes no claims of proctoring, monetary eligibility, or certified mastery.

Control **GP-INV-023** covers period boundaries, deterministic selection, private answers, identity recovery, capacity, deadline enforcement, immutable snapshots, atomic/replay-safe submissions, tie ranking, bounded standings, and isolation from the existing learning/economy systems.
