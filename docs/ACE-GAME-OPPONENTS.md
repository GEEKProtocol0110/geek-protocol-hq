# A.C.E. local game opponents — UX-034

The founder wants to play one side of a board game rather than make both players' moves. Chess, Checkers, Geek Tac Toe, Connect Four, Reversi, Dots & Boxes and Battle Geek now default to A.C.E. computer practice. The player controls White or Gold; A.C.E. controls Black or Cyan. Same-device friend play and the existing online lounge remain available.

Relaxed and Steady use bounded local algorithms, not a remote model or paid AI service. Chess uses the existing legal chess engine with shallow material/position search; Checkers respects forced jumps and continued captures. Tac Toe searches to terminal states. Connect Four and Reversi use shallow search; Dots favors completed boxes and avoids handing over third edges; Battle Geek uses known hits and unknown targets. These are casual practice opponents, with no claimed rating or expert strength.

Search runs in a self-hosted module worker. Each request has a generation token; undo, restart and exit terminate pending work and invalidate late responses. The player cannot move the computer's side while it thinks. A recoverable worker error exposes Retry A.C.E.; it does not silently turn into two-human play. Undo returns to the player's previous decision, including computer bonus turns. Battle Geek's worker receives only its masked view, never the human's hidden fleet.

The original opponent release adds no network AI request, new dependency, account requirement, tracking, storage, reward or economic enablement. UX-035 separately adds browser-local practice continuity; see [the Arcade milestone](ARCADE-300.md). Solitaire and other one-player puzzles retain their existing behavior. The compact active-game layout from merged PR #298 remains in use.

Source checks cover legal chess replies, mate/capture/promotion, forced Checkers chains, tactical strategy choices, complete legal strategy games, masked Battle targeting, stale/duplicate worker responses, retry, ownership and undo. Browser and provider evidence belongs in the PR. Physical-device acceptance and independent review remain separate. This source candidate is not a production release until reviewed and merged.
