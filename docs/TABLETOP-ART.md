# Geek tabletop artwork

UX-021, November 8, 2026. Founder requested more rendering flair for chess, checkers and solitaire.

Twelve hand-authored SVG assets depict six recognizable chess silhouettes in metallic gold and cyan: crossed king, crowned queen, crenellated rook, split bishop, horse knight and pawn. These are original repository-native vectors, not generated bitmap images or font-dependent glyphs. The local and online clients share one rendering helper. Decorative images have empty alt text inside aria-hidden wrappers; the existing square button names retain color, piece type, coordinates and legal-destination announcements. An image error reveals a Unicode fallback. No runtime external asset requests.

Checker tokens gain machined rings, specular shading and a short raised edge. Gold/Cyan letter marks and king crowns remain visible; online tokens use the same finish. Board light/dark squares get quiet tonal shading with a framed rim. All board dimensions continue to fit the existing responsive container; focus and legal-move markers are retained.

Solitaire faces show rank/suit corners, central suit or royal letter, and a small reversed suit. A patterned navy, gold and cyan back carries a framed G mark. Overlapped non-top faces hide central/bottom decorations so rank/suit corners remain readable. Existing accessible card names, column controls, foundations, moves and undo are unchanged. Phone sizing hides the bottom decoration. Hover lift is limited to hover-capable devices with reduced motion disabled. Forced-color overrides remove decorative shadows while retaining control outlines and textual marks.

Validation: all twelve vectors rasterized in a contact sheet and visually inspected for distinct silhouettes/shading. Focused chess/classic/client tests exercise the changed renderers. Site/continuity/security and syntax/whitespace checks run before PR. The contact sheet validates asset drawing, not rendered application layout. Browser, screen-reader and physical-phone acceptance remain outstanding. Candidate only; not merged or deployed to production.
