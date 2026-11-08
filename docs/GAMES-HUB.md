# Geek Games hub

UX-015. /games/ presents eight existing modes: Assisted Practice, Daily Signal, Speed Signal, Memory Grid, Quiz Quest, Gauntlet, Duel and Trivia Royale. Sections group Quick play, Adventures and With friends. Cards describe actual timing (or untimed play), challenge style, player count and access. Assisted Practice has fifteen-second questions and assists; it is not the untimed Study path. Duel explicitly identifies A.C.E. as simulated. Royale is multiplayer Alpha.

Every game card is a normal setup-page link. There are no game API calls, room creations, new sessions from hub-specific code, fake resume detection, scores or rewards. Shared navigation/decoration code is the existing site script. My HQ opens saved progress; the hub does not claim an unfinished run exists. External games use the directory link, separate from Geek’s own modes and scoreboards. Economic holds and token-payout status remain unchanged.

Responsive static cards work without JavaScript, with labeled landmarks, semantic headings/definition lists, visible keyboard focus, reduced-motion and forced-color treatment. Gold/cyan accents and restrained title glow preserve the Geek identity; body text has no glow. Metadata, sitemap and home/game nav links are registered.

Source candidate. Local checks and exact-head CI belong in PR. Browser/physical-device visual acceptance remains separate; no production games were started for this change.
