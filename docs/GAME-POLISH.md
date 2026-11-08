# Geek Games polish — November 8, 2026

UX-020 combines the mobile-fit candidate #252 with chess #253 and a shared visual pass in #253. Mobile fit keeps UX-018; chess uses UX-019 to preserve distinct task identities.

Games hub: gold/cyan emblems identify recall, arithmetic, rule switching, chess, checkers and solitaire. Cards use quiet dark-blue surfaces, thin illuminated edges, clear headings and consistent play links. All game pages have matching branded headers and a four-game switcher with an explicit current-page marker. Active play hides that switcher and the coach panel to give the board room.

Brain Lab: framed number prompts, aligned full-width answer input and submit control, matched feedback surfaces and balanced Yes/No controls. Classics: consistent toolbars, collapsed rules panels, framed boards and clearer card destinations. Chess now uses the compact active-play state already used by checkers/solitaire. Shared typography explicitly avoids condensed display headings and text glow while retaining gold/cyan accent glow. No new score, account, token or network behavior.

The combined candidate retains #252's fluid checkers and seven-column solitaire boards with overlapping cards. The narrow-screen layout keeps labeled destination controls and readable face ranks. At very small widths board/card cells can be smaller than 44px; a complete physical-phone and screen-reader acceptance pass is still outstanding.

Validation: focused chess, classic-game, Brain Lab and homepage tests; site/continuity checks; public-answer/security checks; JavaScript syntax and whitespace checks. An attempted rendered preview at terminal.local:4173 timed out in the browser tool, so no visual acceptance is claimed. Local static preview startup alone is not a browser pass. PR #253 remains an unmerged candidate.
