# Untimed Kaspa Study

Initial Study shipped October 1, 2026; guided learning and saved feedback added October 2, 2026. A.C.E. presents authored lessons, sourced explanations, and suggestions based on the answers in a practice session. It is not a general chat model, a proficiency certification, or an independent reviewer.

Kaspa 101 at `/kaspa/` is the main Learn destination. Study remains available through a prominent field-guide action and direct links from timed Play. The field guide retains its protocol, live DAG, milestones, builder, curriculum, and source sections.

## Learning flow

Eight topics cover 80 distinct underlying Kaspa concepts. Each topic has an objective, three teaching ideas, a worked example, an ungraded reflection, primary sources, and ten canonical concepts. Foundations selects existing easy items (terms and basic safety); Connections selects medium items (mechanisms, units, and practical distinctions); Mixed challenge includes all existing tiers, including technical concepts. These are the bank’s existing labels, not a newly independently calibrated difficulty scale. A session draws up to five different concepts at its level, preferring unseen concepts, then saved mistakes, then practiced concepts. Small pools produce shorter sessions; the UI reports the actual size. Options are shuffled and practice has no timer. The answer is committed before its explanation and source appear. The completed session lists missed concepts and offers a practice containing exactly those concepts, or suggests further coverage in the same topic when concepts remain unexplored. A perfect short run does not establish mastery. Learners can also review up to five saved mistakes from their selected topic after an individual run expires.

The 1,000 existing core bank entries are variations on those 80 concepts. Study uses one canonical entry per concept. The additional 32 current-topic questions remain available to timed play; they are not added to Study's introductory curriculum.

## API and authority

Study is selected explicitly by `service=study` on the existing ranked function. The ordinary ranked interface remains unchanged. GET returns public catalog metadata only. POST actions require a valid browser session:

| Action | Required input | Behavior |
| --- | --- | --- |
| `start` | `topic`; optional `level`, `practiceRunId`, or boolean `review` | Creates up to five level-selected questions, exact missed concepts from an owned complete run, or saved mistakes. Review and practiceRunId cannot be combined. Omitted level defaults to mixed for API compatibility |
| `progress` | No player identifier accepted | Returns only the authenticated player’s practice feedback |
| `resume` | `runId` | Returns the current question or committed review |
| `answer` | `runId`, `questionToken`, numeric `selectedIndex` (0–3) | Atomically commits one answer and returns feedback |
| `next` | `runId`, reviewed `questionToken` | Advances once after feedback |

Private runs use `geek:study:` keys with a 24-hour TTL. A saved answer or next transition refreshes that TTL; catalog and resume reads do not. Ownership is bound to the creating browser session, including for wallet-linked players. Recovery in another browser does not transfer an unfinished Study session.

Redis compare-and-set validates the complete previous state. The same script updates the private concept record, so the answer and feedback count commit together. Concurrent answers cannot replace the first committed result. Retried answers and next transitions return the same result or next question. Stale tokens fail with a state conflict; foreign, malformed, missing, or expired run identifiers return not found. Invalid choices do not consume a question.

No answer key is returned before commitment. The Study handler has no profile, leaderboard, payout, mint, inventory, or contributor-credit writes. Study provides no XP, Alpha GEEK, ranked score, or token rewards. Its identifiers cannot be used as ranked runs.

## Saved feedback and retention

`geek:study-progress:<playerId>` is a private Redis hash with at most 80 canonical concept records. Each record has attempts, correct attempts, latest outcome/time, a consecutive-correct streak, and the last run identifier. The hash expires after 180 days without a newly committed answer. Catalog, progress reads, resumes, and next requests do not refresh retention. No browser-provided player ID, progress total, or status is trusted.

A latest incorrect answer marks **Review**. A latest correct answer marks **Practicing** until at least two separate runs have answered that concept correctly since its last mistake; then it marks **Building confidence**. A mistake resets the streak. Retried submissions do not increment counts. Distinct runs for the same player update records atomically without replacing one another’s counts.

Progress uses the resolved server player identity. It survives recovery for a linked player, while guest access depends on retaining the browser session. An unfinished run remains bound to its original session even when progress is available to the recovered identity. Run expiry does not delete feedback. Saved review reads only the caller’s latest mistakes and does not depend on an old run being present. Public responses expose no answer keys or last-run identifiers.

The totals describe practice coverage and next steps, not a credential, validated assessment, or reward eligibility. Historical completed runs are not backfilled into the new progress records.

## Browser notes and limits

Session storage holds an opaque run identifier for reload recovery in the same tab. Local storage holds only the last topic and missed-concept count; it is a navigation hint, not the authority for saved feedback. These values cannot establish rank or reward eligibility. Practice still works when storage is unavailable, although reload recovery is then unavailable. Errors provide a retry or a return to topic selection.

Source review is internal, dated, and described in [KASPA-CONTENT-REVIEW.md](KASPA-CONTENT-REVIEW.md). It does not activate monetary rewards. Other categories and independent editorial review remain separate work. An untimed session result is practice feedback, not proof of mastery.

Control: **GP-INV-022**. Integration tests cover answer privacy, session ownership, invalid levels, private progress, distinct coverage, ranked isolation, concurrency, retry counts, expiry, confidence resets, and both review modes.

## Core journey presentation

The Progress page reads the existing private `action: progress` response and shows concept coverage, saved mistakes and two-run confidence separately from game XP. It exposes no new progression write. Each topic links back to its authored lesson. An explicit topic URL takes priority over an unrelated browser-held active run hint; it never starts or answers a run automatically. A requested saved-mistake review focuses the existing review control when feedback is available. Study, game and collection outages are displayed independently on Progress. Visiting Progress preserves the session name and works without browser storage.
