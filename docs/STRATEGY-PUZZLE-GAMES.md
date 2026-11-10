# Strategy and puzzle games

GAME-003, November 9, 2026. Founder approved all nine games. This candidate adds nine local pages and five online modes using the existing lobby Function and atomic Redis storage.

| Game | Format | Rules implemented |
| --- | --- | --- |
| Geek Tac Toe | Local two-player and online | 3×3, Gold X first, three in a line, full-board draw. |
| Dots & Boxes | Local two-player and online | 4×4 dots / nine boxes; four-edge completion claims a box and grants an extra turn. Most boxes wins. |
| Battle Geek | Local pass-device and online | Custom 6×6 hidden-fleet strategy, three straight non-overlapping ships of lengths 3/2/2; ships may touch. Shuffle an automatic placement, then explicitly deploy. Scan one cell per turn, including after a hit. Seven hits wins. |
| Geek Connect Four | Local two-player and online | 7×6 gravity board, four in a line, full-board draw. |
| Geek Reversi | Local two-player and online | 8×8 bracket-and-flip; Gold first; automatic forced pass; neither side can move ends the game, most discs wins. |
| Geek Codebreaker | Solo | Four symbols from 1–6 with repeats, ten guesses; exact/elsewhere feedback counts repeated symbols once. No undo. |
| Tower of Hanoi | Solo | Four discs, three towers, target C, top-only moves and no larger disc on smaller; 15 moves is optimal. |
| Geek Sudoku | Solo | 9×9, locked clues, blocked peer conflicts; variations transform one uniquely solvable template rather than claiming a large authored bank. |
| Geek Peg Quest | Solo | Fifteen triangular holes; jump and remove a neighboring peg into an empty hole along six triangular directions. Pick a starting vacancy; one peg wins. No-jump positions allow undo. No guarantee for arbitrary routes. |

## Interface and state

All pages have explicit Start, native button controls, rule copy, local progress-in-this-tab disclosure and the shared gold/cyan Geek finish. Local practice undo is capped at 200 actions (except Codebreaker); leaving/reset discards state. No storage, account creation or network gameplay is initiated by local pages. The five multiplayer pages link to the online lounge. No AI opponent, new XP, rewards, leaderboard, wallet or payment features. These games practice specific tasks; no generalized intelligence or IQ benefit is promised.

Battle Geek local play is casual shared-device play. Its state exists in the browser; the handoff curtain clears the board DOM before the next player reveals their own view, but developer tools can inspect local game state. Local mode does not claim adversarial secret protection. Online room state retains both fleets only on the server: views expose the seated player's own fleet, incoming shots, scan results and fully sunk enemy ships. No unknown opposing ship cells, placement payloads, seeds or raw fleet arrays are returned through room views or history. Visitors receive no board. Deployment passes through existing revision checks; stale concurrent deployments must refresh and retry. There is no remote practice undo.

The existing online limits still apply: accepted two-seat games, public/private rooms, explicit requests, 24-hour expiry, bounded lists, four-second visible-tab polling, request deadlines, rate limits, resignation/draw consent and 600-action cap. Shared client/server rules run deterministically; the server validates moves and serializes revisions. This does not change any ranked quiz answer handling.

## Validation and limits

Engine tests cover all nine games, wins/draws, invalid moves, extra turns, Reversi passes, duplicate feedback, Hanoi optimal sequence, Sudoku transformations and a full 13-jump triangular solution. Client fixtures start all nine local pages and exercise local moves/undo/code feedback, the Battle Geek handoff, and online strategy moves/deployment/scan controls. Real-Redis integration completes the four open-board games and Battle Geek through the existing session/lobby API, checking hidden-fleet views and stale revisions.

A local preview server started, but the supported browser tab timed out. Browser renders, physical-device sizing, keyboard/screen-reader acceptance and separate-device live acceptance remain outstanding; synthetic DOM fixtures and API integration do not establish those. A.C.E. stays paused under DR-034. Candidate only; not merged or deployed to production.

Validation checkpoint: full npm test passes 821/821 with real Redis 7.2, zero failures/skips; signer 9/9. New domain/client/API checks include complete strategy matches, separate Battle Geek views, a solved triangle, optimal Hanoi and Sudoku uniqueness. The first full-suite attempt lost its /tmp Redis executable after the browser timeout; rebuilding the test executable under the workspace and rerunning the full suite produced the clean result above. Directory/site/continuity and public-answer/security (311 assertions) checks pass. Final online-entry links preselect the requested strategy game without creating a session.
