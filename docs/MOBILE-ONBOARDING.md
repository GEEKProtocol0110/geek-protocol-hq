# Kaspa-first mobile onboarding

Geek's onboarding objective is to help people discover Kaspa, understand it and choose practical next steps. Learning and play are the entry points; a wallet is optional for the first visit.

## First screen

- The homepage explains the purpose with “Your first steps into Kaspa.”
- The primary action opens the existing five-question Kaspa Daily Signal setup directly. It selects Daily and Kaspa and reveals the timed controls; it never starts the timer or submits a game automatically. The existing one-attempt-per-UTC-day rule applies.
- The secondary action opens the existing Origins lesson at Foundations level. The Study client selects and reveals that lesson; existing progress and resume rules remain authoritative.
- Sign-in stays outside the collapsed mobile menu. Its explanation describes recovery of a saved player, while guest progress follows the browser's session. Signing in is not required to begin or to obtain guest progress.

The former five-step Start Here checklist remains an optional guide under More. Game modes and the community ecosystem use closed native details, retaining direct links for Gauntlet, Quest, Memory Grid, Geek Jr, Mini, the widget and Hall of Thanks. Existing deep-link handling opens their enclosing details and focuses the destination.

## From learning to Kaspa use

“Your next steps with Kaspa” links to the wallet lesson, the field guide, public-address tracking in Geek Wallet and Kaspa wallet sign-in. These are distinct actions: public-address tracking does not prove ownership; sign-in proves control of an address and sends no payment. No new signer, payout, purchase, settlement or swap execution is added.

## Final polish

The homepage names today’s quiz and its one-attempt-per-UTC-day limit before entry. Lessons remain the untimed alternative. Practical Kaspa next steps appear before additional game modes. The mobile header allows the brand text to wrap, and the open menu uses the actual 64-pixel header offset. Footer navigation keeps six frequently used destinations, with 44-pixel targets and two columns on narrow screens; ecosystem and project links remain in their existing expandable sections. Alpha-status copy now names the actual More menu and distinguishes available free Duel/Royale from future paid features.

## Verification and acceptance

October 15 verification: all 412 tests passed with required real Redis and zero skips; full repository verification, 310 security assertions and the production dependency audit passed (zero reported vulnerabilities). HTML IDs, local links/fragments, panel ordering, footer destinations, CSS parsing and documentation links were checked.

Navigation tests cover the primary destinations, visible sign-in placement, preserved destinations and the shipped deep-link handler. Existing ranked tests cover explicit start, answer review, saved results and recovery; the optional checklist/sign-in return tests remain in place. Static HTML checks validate local links, fragment targets, closed details and unique IDs.

This environment has no supported browser-control capability, so this change has no new browser-rendering or physical-phone acceptance claim. Check 320, 375, 390, 768 and desktop widths on a supported browser: the initial choices, sign-in, menu keyboard order, large-text wrapping, expandable content, explicit game start and saved-result return. Run the repository verification and security checks before release.


## Founder phone observation — October 15, 2026

After the polished release, the founder reported that the layout looked good with nothing abnormal on their physical phone. This records a positive visual observation, not completion of every navigation, large-text, saved-progress or gameplay acceptance step. The report did not specify device model, browser version or viewport dimensions; broader device acceptance remains pending.


## Mobile edge correction — October 16, 2026

Founder supplied a phone screenshot and reported sideways movement and a zooming/unstable edge after the neon-background update. This supersedes the earlier positive phone observation for that later visual release; no physical-phone retest of this fix is implied.

Source diagnosis: the narrow `.hq-space-code` rule positioned its right edge at `-2rem` outside the scene while the legacy `.home-main .hero` rule used `overflow:visible`. That combination permits decoration to extend the document horizontally. The correction brings both mobile code rails inside, clips decorative children at the home hero, and uses horizontal `clip` on the shared root/body without disabling vertical scrolling or pinch zoom. The shared fixed cosmos gets paint containment. On narrow screens its grid is flat/static and uses stable `100lvh` height (with a `100vh` fallback), keeping perspective/percentage geometry from changing as mobile browser bars expand or collapse. Content font sizes and viewport zoom settings are unchanged.

Relevant existing onboarding/motion/holiday tests and the full verification suite remain required. Desktop preview/live layout, computed containment and navigation can be checked here; physical-phone browser-bar transitions and narrow-device acceptance require a subsequent device observation.
