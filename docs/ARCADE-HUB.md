# Main Geek Arcade lobby

UX-031 applies the visual direction accepted in #296 to `/games/`. All 24 existing game-card destinations, timing/access descriptions and section fragments are preserved. The real Game Lounge moves into With friends, alongside Duel and Trivia Royale; a direct lounge callout leads to invitations and My Games. The homepage keeps its Games navigation and labels its existing discovery link Play Games.

Self-hosted CSS and a small presentation-only script supply crisp teal/gold cards, existing GIGA/tabletop artwork, search, category filters, announced counts and an empty state. No third-party dependency, new quiz, demo substitute, new tracking, automatic session/game/room creation or economic change. Every card is a normal link and all modes remain available with JavaScript disabled. The superseded #296 concept page has been retired: `/games/preview/` now permanently (308) redirects to `/games/`, so old links land on the real 24-card hub instead of a stale mockup.

Existing shared Games styles and actual play engines stay in their own routes. Reduced-motion and forced-color handling remain. At 320px cards stack; typical phone widths use two columns; desktop grids use three, with four compact Quick play cards on larger screens. Browser emulation is distinct from physical-phone acceptance.

Validation and PR/deployment evidence are recorded with the source candidate. Not merged by creating this record.

## Candidate verification

Four focused discovery regression tests and five existing homepage tests passed. Continuity generation/check, site metadata/internal-link check, public-answer scan, 325 security assertions, JavaScript syntax and whitespace checks passed. Browser QA rendered the main catalog and existing tabletop assets; phone/tablet frames at 320, 390 and 820 CSS pixels reported no horizontal overflow (content widths 305, 375 and 805 after scrollbars). Friends filtering shows the real lounge, Duel and Royale. Case-insensitive Chess search shows one game; no results is announced and clearing restores all 24. Actual-phone and multiplayer acceptance remain separate. No game engine was changed.
