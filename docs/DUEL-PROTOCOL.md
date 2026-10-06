# Geek Duel — Free Arena Alpha

Geek Duel supports invitation-based head-to-head trivia and solo play against a simulated A.C.E. opponent. It uses the current eight reviewed category banks and saved off-chain profile characters. It does not implement wagers, a public matchmaking queue, specialized Fandom Duel, NFT ownership, paid power-ups, ranked XP or treasury settlement.

## Player experience

1. Create a Duel, choose a category, and share its invitation URL or `DUEL-` code. Creating and joining disclose the display name and chosen Geek to the opponent. A wallet is optional.
2. Two distinct durable player identities reserve the seats. The creator takes slot 1. One atomic join claims slot 2. A third identity cannot watch private questions or replace either player, including after disconnect or completion. Multiple sessions for one recovered identity share the same seat.
3. Both players explicitly ready up. Readiness older than the connection grace period is cleared. The second active consent starts a common three-second countdown.
4. Both receive the same ten questions and shuffled answer order. Each question has a fifteen-second window. The first answer accepted inside that Redis-clock window counts. Missing an answer gives zero; the clock continues even while a page is hidden or offline.
5. A correct answer grants 1,000 room points plus 30 per whole second remaining, up to 450. Wrong answers give zero. Higher total wins; exact ties draw. No further tie-break advantage goes to a room creator or seat.
6. The room result and scores survive reload. After completion, both active players must request a rematch. The next match receives a fresh ID and question selection, resets only room answers/scores, and starts a new shared countdown. Selection may repeat concepts from the category; it is not an unseen-question guarantee.

## Connection and exit rules

Accepted views/actions refresh that player's presence. The browser polls every three seconds while visible and refreshes at question boundaries. Closing/reloading/hiding a tab does not send a leave command. A returning player retains their slot, but question deadlines do not pause.

The server grants 45 seconds since the last accepted activity. During a starting/playing match, one expired connection gives the other slot a disconnect win. Both expired connections yield an abandoned result with no winner. Settlement happens on the next authorized request; no worker is needed. A fully elapsed ten-question match is scored as completed before checking connection loss, preventing a retroactive forfeit after the last question. A late return cannot undo an already elapsed grace period.

Leaving is explicit and uses an accessible confirmation dialog. Leaving a waiting room cancels it. Leaving an active countdown/game forfeits to the other player. Leaving a finished room preserves its result and disables rematches. Reserved players are never replaced; create a new invitation for a different opponent. Waiting rooms do not award disconnect victories.

Each ledger expires one hour after the last successful participant transition. Losing an unprotected guest session loses access to its seat; existing verified wallet identity recovery maps to the same durable player identity. The Duel page does not request a signature or transaction.

## Authority and privacy

The room, both players, presence timestamps, consent, questions, answers and result share one Redis record. `DUEL_LUA` uses Redis TIME and one atomic transition for roster, readiness, answer claim, score, result and rematch updates. Mutations carry the exact match ID; stale answer/rematch/leave requests cannot affect a newer match. API validation rejects malformed indices and match IDs. Session authentication, per-player limits, and creation/rematch/IP quotas bound access. No client-supplied avatar, winner, score or clock is trusted.

Cosmetic snapshots are read through existing profile ownership/unlock rules and the fixed customization vocabulary. Only the selected avatar is shared. Opponent responses contain public slot numbers, display names, cosmetic snapshots, aggregate room scores and presence, never durable player/session IDs, opponent answers, correct indices, future questions, wallet addresses or private profile records. Your own accepted answer feedback is available. Display text is escaped; SVG artwork is generated only from the fixed character schema. Duel adds no custom analytics events; existing page analytics strips invite query parameters.

`/api/duel` routes through the existing lobby function, which already bundles private question files. This preserves the deployment's function count. Existing shared practice and ranked APIs keep their current rules. Duel never writes XP, prestige, profile balances, achievements, purchased inventory, leaderboards, payments or settlement. Web trivia remains unproctored.

## Verification

`tests/duel.test.js` runs the production Lua against a disposable real Redis process bound only to loopback, with persistence disabled. Install `redis-server`, then run `npm test`. CI sets `DUEL_REQUIRE_REDIS=1`, so missing Redis fails instead of skipping the suite. A custom local binary can be selected with `REDIS_SERVER_BIN`; it is test tooling, not production configuration.

Coverage includes saved personal character and existing XP, simultaneous seat claims, private responses, shared clock/options, first-answer-only races, malformed/stale/expired answers, reload recovery, completed wins/draws, grace-period return, single/both disconnects, explicit cancellation/forfeit, no replacement, mutual rematches and old-match replay rejection. Browser verification uses isolated profiles and the actual handlers/Redis ledger, not production accounts.

## Solo A.C.E. opponent (October 6, 2026)

Create a Duel with `opponent: "ace"` and optional `difficulty: "cadet" | "operator" | "vanguard"` (default Operator). The human takes slot 1; a server-owned simulated A.C.E. seat occupies slot 2 and is ready immediately. A second human cannot join, impersonate or view that seat. The human explicitly starts the countdown. The API validates category, opponent and difficulty; client bot plans, scores and answer keys are never used.

| Preset | Independent per-question correctness probability | Scheduled response delay |
| --- | ---: | --- |
| Cadet | 45% | 7–13 seconds |
| Operator | 70% | 4–10 seconds |
| Vanguard | 90% | 2–7 seconds |

These are preset simulations, not a generative AI service, adaptive tutoring, a guaranteed result or another online person. The server generates an independent selection and delay for each question with Node cryptographic randomness. Incorrect choices are selected from the other three indices. The private ten-item `acePlans` stays in the same room record; public responses expose only the difficulty label, simulated-player flag and aggregate scores. Future choices, response delays and correct indices remain private.

Before a result/transition, the same atomic Lua settles every scheduled answer whose Redis-clock time has passed. Answer keys prevent duplicate points. Correctness and time bonus use the scheduled time, so polling frequency, retries and visibility do not accelerate or improve A.C.E. Its presence is refreshed by the trusted transition; the human retains the existing 45-second grace, forfeit and fully elapsed completion rules. Room points have no career or monetary effect.

A human rematch request constitutes consent in solo mode and generates a fresh match ID, questions and private plan at the same difficulty. Stale requests cannot affect it. Leaving preserves the existing no-rematch rule; New Duel lets the player change difficulty or return to friend play. Existing human rooms without an opponent field continue as player-versus-player, with mutual consent unchanged.

Real-Redis tests verify validation/privacy, reserved roster, scheduled catch-up, duplicate reads/answers, final scoring, rematch, stale IDs, disconnect/forfeit and isolation from the profile ledger. Browser checks cover selected Geek, difficulty, start, answer, reload, final result, rematch, exit and phone widths.
