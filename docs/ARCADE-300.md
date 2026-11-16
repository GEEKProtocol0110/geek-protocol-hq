# A.C.E. Arcade milestone — UX-035

The founder asked to make PR #300 special after approving seven local A.C.E. opponents in #299. The original acceptance-fix draft was merged independently as #300 (ee0716f) during implementation. Publish this milestone in a new follow-up PR built on that release. The new practice loop is: choose a board, play one side, leave, resume and see a personal record. Preserve the original draft's mobile art sizing, retired-concept redirects, disabled mint-button contrast and lounge spacing fixes.

## Player experience

`/games/ace/` is the A.C.E. Arena: seven direct game entries, a latest-save shortcut, per-game recent wins/losses/draws, the last eight results and four practice milestones. The main Games hub links to it without replacing any original game. All seven local A.C.E. titles offer Resume; Arena links can resume directly. A.C.E. completes a pending computer turn after restoration. The existing finish dialog offers Rematch A.C.E. and an Arena return; losses do not trigger the victory fireworks.

One unfinished game per title, the latest 200 results and persistent practice milestones live in this browser's local storage. No account, cross-device sync, rating, leaderboard, XP, credits or token reward is implied. Starting a new game replaces that title's save. Multiple tabs of one game use the most recent save. Clearing site data removes the record. The Arena has an explicit confirmed clear action limited to its own storage key; other game/account records are untouched. Close active game tabs before clearing so later moves cannot create fresh saves.

## Save integrity and limits

Save legal action journals rather than accepting arbitrary stored boards. Restoration replays those actions through the existing Chess, Checkers and strategy engines, retaining chess turn, castling and repetition. At most 1,200 actions per game are supported. Malformed, terminal, oversized or illegal journals cannot be resumed. Unavailable/quota-blocked storage produces a visible status and does not stop the game; keep that tab open when saving is unavailable.

Undo returns to the player's decision and trims the journal with it. Battle Geek's initial computer deployment is retained without consuming the player's undo step; resumed workers still receive only the masked computer view. Journals for Battle Geek contain both fleets locally because this is an expressly browser-local practice game, not a hidden server opponent. No private room, learner/account data or credentials enter this record.

A match records its first finish once within the bounded recent record, so replaying the finish UI or undoing and finishing again does not add results. This is a mutable local learning record, not fraud-resistant competition or a verified award. Milestones persist after older results leave the 200-result display. Every rematch gets a new practice identity.

## Verification

Tests exercise real client start/save/reload/worker-reply/undo/exit paths for all seven games, including Battle fleets and a pending computer turn. Separate checks cover chess castling/repetition, invalid journals, blocked/quota storage, result deduplication, bounded recent records, retained milestones and clearing only the Arcade key. Existing friend, solo, online, engine, focus and hub discovery regressions remain required. Browser/provider evidence is recorded in the milestone follow-up PR; physical-device and independent acceptance stay separate.

This candidate adds no remote AI, paid service, dependency, production configuration or economic enablement. Founder review and merge remain separate from preparation.
