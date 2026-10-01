# Untimed Kaspa Study

Implemented in the public Alpha on October 1, 2026. A.C.E. presents authored lessons, sourced explanations, and suggestions based on the answers in a practice session. It is not a general chat model, a proficiency certification, or an independent reviewer.

## Learning flow

Eight topics cover 80 distinct underlying Kaspa concepts. Each topic has a short lesson with primary sources and ten concepts. A new session draws five different concepts, shuffles answer options, and lets the learner take as long as needed. The answer is committed before its explanation and source appear. The completed session lists missed concepts and offers a practice containing exactly those concepts, or suggests the next topic when all answers were correct.

The 1,000 existing core bank entries are variations on those 80 concepts. Study uses one canonical entry per concept. The additional 32 current-topic questions remain available to timed play; they are not added to Study's introductory curriculum.

## API and authority

Study is selected explicitly by `service=study` on the existing ranked function. The ordinary ranked interface remains unchanged. GET returns public catalog metadata only. POST actions require a valid browser session:

| Action | Required input | Behavior |
| --- | --- | --- |
| `start` | `topic`; optional `practiceRunId` | Creates five questions, or the missed concepts from an owned, completed session in the same topic |
| `resume` | `runId` | Returns the current question or committed review |
| `answer` | `runId`, `questionToken`, numeric `selectedIndex` (0–3) | Atomically commits one answer and returns feedback |
| `next` | `runId`, reviewed `questionToken` | Advances once after feedback |

Private runs use `geek:study:` keys with a 24-hour TTL. A saved answer or next transition refreshes that TTL; catalog and resume reads do not. Ownership is bound to the creating browser session, including for wallet-linked players. Recovery in another browser does not transfer an unfinished Study session.

Redis compare-and-set validates the complete previous state. Concurrent answers cannot replace the first committed result. Retried answers and next transitions return the same result or next question. Stale tokens fail with a state conflict; foreign, malformed, missing, or expired run identifiers return not found. Invalid choices do not consume a question.

No answer key is returned before commitment. The Study handler has no profile, leaderboard, payout, mint, inventory, or contributor-credit writes. Study provides no XP, Alpha GEEK, ranked score, or token rewards. Its identifiers cannot be used as ranked runs.

## Browser notes and limits

Session storage holds an opaque run identifier for reload recovery in the same tab. Local storage holds only the last topic and missed-concept count. These values cannot establish rank or reward eligibility. Practice still works when storage is unavailable, although reload recovery is then unavailable. Errors provide a retry or a return to topic selection.

Source review is internal, dated, and described in [KASPA-CONTENT-REVIEW.md](KASPA-CONTENT-REVIEW.md). It does not activate monetary rewards. Other categories and independent editorial review remain separate work. An untimed session result is practice feedback, not proof of mastery.

Control: **GP-INV-022**. Integration tests cover answer privacy, session ownership, invalid inputs, ranked isolation, concurrency, retries, expiry, and exact missed-concept practice.
