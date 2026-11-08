# Classic Strategy & Cards

UX-017 adds two playable first-party games alongside the pending Brain Games candidate in #250. The founder agreed to start with checkers and solitaire, then chess and backgammon. Those latter two remain planned; no placeholder play buttons imply they exist.

## Rules and scope

Checkers: American-style short-range rules, two players on the same device, Gold starts from the bottom and moves first. Normal pieces move/capture forward; kings in either diagonal direction. Captures are compulsory across the whole board, multi-jumps lock to the same piece, and crowning ends the turn. No legal move means defeat. Casual draws require player agreement; no automatic repetition or tournament no-progress adjudication is claimed. The rules reference is World Checkers/Draughts Federation: https://wcdf.net/rules/rules_of_checkers_english.pdf. Custom Gold/Cyan colors, practice undo and agreed-draw control are explicitly casual conventions. There is no bot or remote multiplayer.

Solitaire: 52-card draw-one Klondike, seven columns dealt 1–7 with one exposed card each, 24-card stock. Tableau builds downward in alternating colors, with kings/runs beginning with kings in empty columns. Exposed cards flip automatically. Foundations build ace to king by suit, one exposed card at a time; foundation tops can return to columns. Stock recycles without a pass limit. Tap a card/run then a destination; no dragging or auto-solving. The introductory rules reference is https://bicyclecards.com/how-to-play/klondike/. Unlimited redeals, moving valid subruns and undo are declared app variants. Some deals are unsolvable; there is no guarantee or automated loss detector.

## Boundaries and controls

All state stays in memory in this tab. Refresh, leaving or exiting resets play; no account/browser persistence, API, wallet, scoring service, XP, leaderboard or token integration. Undo stores at most 200 prior actions; checkers undoes one jump at a time. Start is explicit; an exit returns to setup for a fresh game. Text/letters label pieces and card suits so color is not the only cue. Squares/cards and column/foundation controls are native buttons with accessible names and focus outlines. Narrow screens can horizontally scroll the board/columns inside labeled keyboard-focusable regions. Solitaire destination labels remain visible. No external assets, iframe, dependency or tracking was added.

Game-rule/immutability tests and shipped-client fixture tests cover opening moves, mandatory captures, chained jumps, promotion, backward king movement, no-move victory, unique shuffled deal, stock/recycle order, legal/illegal runs, reveals, foundation restrictions and completion; client start/move/draw/undo/exit are exercised. These do not establish rendered-browser, screen-reader or physical-device acceptance. No real IQ or generalized intelligence improvement is claimed. Release and exact-head CI evidence belong in #250.


## Geek visual finish — November 8, 2026

Founder requires a consistent Geek look for every new game. Shared /games/assets/geek-play.css adds branded headers, existing GIGA artwork in compact practice-tip panels, gold primary controls, cyan/gold rimmed checker pieces, a framed board and circuit-patterned dark card backs. Card fronts retain readable rank/suit symbols on dark blue panels with distinct red-suit text; no color-only cues. Brain prompts use a framed signal panel. No new game logic, image generation, external requests or score behavior. Site and all 19 focused game/client/homepage checks pass. Visual browser/phone acceptance remains unclaimed.

## Geek Chess candidate — November 8, 2026 (UX-018)

Local two-player untimed chess with legal hints, undo, board flip and all four promotion choices. Castling, en passant, checkmate, stalemate, insufficient material, threefold repetition and fifty-move draws use vendored chess.js 1.4.0, BSD-2-Clause; license retained beside the unmodified ESM build. Source: https://github.com/jhlywa/chess.js/tree/v1.4.0 (npm chess.js 1.4.0). No runtime network dependency. Repetition and fifty-move draws are automatic casual conventions rather than tournament claims. Refresh resets the in-memory game. No bots, remote multiplayer, account writes or rewards. Board scales to its parent without a minimum width; gold/white and cyan/black pieces have explicit accessible names. Browser, screen-reader and physical-phone acceptance remain open.

Validation: opening perft depth 3 (8,902 leaves), mate/undo, castling, en passant, underpromotion, repetition, stalemate and pinned-piece safety. This validates rules integration, not a complete browser interaction test.
