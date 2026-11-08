# Mobile game fit candidate

UX-018 responds to the founder reporting that game content does not fit screens. The old CSS forced a 320px checker board inside nested padding and a 540px solitaire tableau; full-height cards in each column also made the initial deal unnecessarily tall. Direct live browser inspection confirmed the tall, separated-card layout. The classic header also accidentally read “solitaireS”/“checkersS”; corrected to GEEK // GAMES and the standard logo lockup.

This change makes both boards fluid with no minimum width. Seven solitaire columns use equal minmax(0,1fr) tracks with compact numbered destination buttons, responsive card dimensions and overlapping rows. Face ranks/suits stay at the top; keyboard focus brings a selected card outline into view. Foundations say Home 1–4 but retain explicit accessible foundation destination names. The explanatory copy no longer instructs players to pan the tableau.

At narrow widths, page/panel padding and header spacing shrink, typography wraps, input fields remain at least 16px to avoid focus zoom, and active play hides the GIGA tip panel plus nonessential classic feature badges. The compact hero keeps the game name visible. Rules begin collapsed but remain available. Exit returns the setup layout. No game state, rule validation, score or storage policy changes.

All 19 existing focused game/client/homepage tests and site checks pass; shipped-client fixtures now provide a body for the active-play class. Synthetic DOM tests establish behavior, not mobile geometry. Exact-head CI, preview viewport evidence, physical-device acceptance, merge and deployment are separate records. No claim of physical-phone acceptance is made.
