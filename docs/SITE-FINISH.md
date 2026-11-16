# Shared Geek finish

UX-032 expands PR #297 from the main Games lobby to the public HQ site. The founder explicitly requested the new finish mixed with what is already built.

The existing universe, code rain, GIGA and tabletop art, page layouts and entry points remain. A small shared self-hosted stylesheet harmonizes regular sans-serif headings, action buttons, quiet gold identity accents, illuminated dark panels, navigation and search/settings fields. It is loaded last on all 50 public nonprivate HTML pages by the page generator. Private operator pages remain separate; the retired `/games/preview/` concept now redirects to `/games/`.

No new library dependency, third-party request, tracking, or runtime JavaScript is added by this layer. Board cells, answer controls, collectible art, scores, gain/loss colors, gameplay, account/wallet settings, and economic gates keep their existing implementation. Panel decoration does not change board dimensions, display, padding or input handling. Reduced-motion and forced-color overrides are included. Third-party market iframe interiors remain provider-controlled.

Validation records the additive-link-only preservation of the 50 page sources, metadata idempotence, existing client checks, and representative browser QA. Browser frames are not physical-device acceptance. Review in #297 before merge.

## Candidate verification

All 50 page source bodies and existing head content were byte-identical after removing the single added stylesheet link. Site generation/check and continuity generation/check passed; 33 existing hub, home, session-access, receiving-address and atmosphere client tests passed. Public-answer scanning and all 325 security assertions passed.

Browser QA checked home, signed-out My HQ shell, sign-in shell, news and directory at 390px frames (375px content); directory, Play, Study, Practice, lounge and live local Chess at 320px frames (305px content); desktop home at a 1200px frame (1185px content). Those pages reported no horizontal overflow. A local Chess pawn move from e2 to e4 produced Black to move; the board stayed 271px wide at the narrow size. The mobile home menu opened and Escape closed it. Existing cosmos/code-rain and art rendered with the shared finish. Local HTTP preview cannot verify backend/session/passkey behavior; no real authentication, receiving mutation or multiplayer room was submitted. Phone/tablet hardware, signed-in private-account views and provider-controlled iframe interiors remain separate acceptance.
