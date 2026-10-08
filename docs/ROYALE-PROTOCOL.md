# Trivia Royale — free Alpha event protocol

Trivia Royale at `/royale/` implements **The Battle of a Hundred Minds** as a separate Geek Arena event. A host chooses a player limit from **2 to 100** (the UI defaults to eight), shares an invitation and starts when all joined players are online and ready. The room need not reach its chosen limit. The host occupies one seat and plays too.

This release awards a visual **room-result medal** to the last mind standing. It creates no XP, game credits, tokens, NFT ownership, persistent collectible grants, purchases or monetary settlement. A.C.E. provides authored quiz-control cues; it is not an autonomous AI moderator. GIGA salutes the final survivors in the result copy.

## Rules

| Rule | First Alpha behavior |
| --- | --- |
| Room entry | Authenticated guest session or recovered stable wallet identity; invitation code required |
| Player limit | Integer 2–100 set at creation; atomic capacity checks, host included |
| Start gate | Host only, at least two players; every joined player ready and seen within 60 seconds |
| Roster lock | At start; existing participants may reconnect, new players cannot join |
| Countdown | Five seconds |
| Question | Shared prompt/order/options, 15 seconds; first answer locks |
| Reveal | Five seconds after the question deadline |
| Elimination | Wrong or missing answers are out. If multiple correct players have different response times, the entire slowest time group is out |
| Ties | Equal server times remain together; an all-equal correct group survives. No random tie-break or seat-order advantage |
| End | A single survivor wins; zero survivors means no winner. Remaining players share victory at the 100-question limit |
| Reconnect | Same stable player ID preserves seat/readiness/locked answer. Clocks continue offline; a missed deadline still eliminates |
| Spectators | Eliminated participants may view current play and reveals; they cannot answer again |
| Host tools | Remove waiting seats, start and end the event. Ending has no winner. Removing a seat is not a permanent ban |
| Leave | Releases a waiting guest seat or eliminates a playing participant. The host must end the event to leave early |
| Expiration | Fixed 24 hours from creation for invitation, state and snapshot; polling does not extend it |

Correctness is withheld until the shared deadline, including from a player who already answered. Response times use when Redis receives the answer, so network latency affects this speed competition. It is free community trivia, not a proctored assessment. Public names are labels and may be duplicated; seat numbers disambiguate them.

## State and authority

`/api/royale` is rewritten to the existing lobby function with `service=royale`. This preserves the deployment structure; the function's existing question-bank inclusion also covers Royale. `server/royale-api.js` checks the current session, per-player and create/join limits, input types, HTTPS request origin and JSON browser writes. `server/royale.js` owns the event state and projection.

- `geek:royale:<code>` stores the host/stable participant IDs, chosen capacity, readiness, immutable event ID, deadlines, current answers, elimination and result. Each player stores only one current answer, keeping room state bounded for 100 participants.
- `geek:royale:<code>:questions` stores a private 100-question snapshot drawn from distinct active concepts/prompts. Retired items never enter selection. Difficulty moves from easy toward hard. Categories use the existing pools and retain their current editorial-review limitations.
- A single Redis Lua transaction uses `TIME` to decide entry, start, deadlines, answer locking, elimination and final results. State changes are serialized across concurrent requests. A snapshot checksum detects missing/substituted event content; grading never switches to a changed live question bank.
- Public projections omit stable IDs, private answer maps, future questions and the snapshot checksum. Current answer keys, explanation and supported HTTPS source links appear only during the shared reveal.
- Mutations carry the immutable event ID to reject stale/reused-room actions. An identical answer retry returns the existing lock; a changed answer fails. The browser never automatically retries a write.

Guests cannot establish that each seat represents a unique human. Wallet recovery preserves an existing seat, not a new attempt, and revokes older sessions through the existing identity protocol. Names and cosmetic room results confer no authentication or economic entitlement.

## Browser behavior

Players reach Royale from Play or the Home/My HQ More menu. Creation exposes the numeric player limit and explicitly explains that filling the room is optional. An invitation opens the join form for an outsider and resumes the room for an existing participant.

The UI polls every roughly four seconds during play and five seconds while waiting, with jitter. Hidden tabs stop polling and refresh when shown. Requests time out after 15 seconds. Offline/stale state disables answers and exposes manual reconnect; a saved-state read recovers lost answer responses. A request-version guard prevents an older poll from overwriting a later answer receipt. Only the shared deadline reveals correctness.

The shared session endpoint now allows up to 600 session operations per IP/user-agent in ten minutes, with a separate 120-new-session limit and the existing 40-operations-per-session/minute limit. This supports onboarding and explicit name saves for 100 participants behind one network. Royale also caps room creation at five per player and fifteen per shared fingerprint/hour, with a bounded join rate.

## Verification and rollout

`tests/royale.test.js` uses real Redis and actual session/lobby/identity handlers. It covers all category snapshots, simultaneous capacity admission and 100 answer locks, shared-network onboarding, smaller chosen limits and partial-room start, host/ready/origin gates, stale event IDs, closed rounds, lost-response-safe locks, withheld answer keys, wrong/timeout/slowest elimination, tied groups, shared/no-winner results, leave/cancel behavior, missing snapshots, expiration, unchanged ranked balances and wallet recovery/old-session revocation.

Local capacity evidence is synthetic: the final 100-concurrent-answer test completed in 224 ms with a 194 ms p95 on the loopback Redis fixture. These numbers do not establish Vercel/Upstash production throughput. Run a real pilot with a small room first, then a controlled 100-player event, measuring actual latency, request/Redis usage and disconnect outcomes before declaring production capacity verified. Physical-phone and installed Kasware acceptance remain separate.

The release depends on the reviewed-content and durable-name/sign-in fixes in PR #67. No testnet or treasury configuration is changed by this mode.

### Release checks

All 182 tests pass with zero skips/failures; full content, repository and security verification passes (242 security-evidence assertions). HTTPS browser QA uses the real handlers and Redis with isolated browser contexts. It covers two players starting a four-seat room, shared reveal/elimination and winner medal, custom six-seat creation, host removal/cancellation, answer locking across reload, a lost answer response recovered without another write, a delayed poll unable to overwrite a newer answer receipt, outage/reconnect, and Play navigation. Home, Play and Royale fit tested widths 320, 375, 412, 768 and 1280. The fixture accelerates event deadlines; this is browser/device emulation, not a physical-phone or production-load result.
