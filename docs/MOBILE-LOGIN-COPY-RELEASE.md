# Android login-copy release

PR #121 merged at `78e9c0e0a3e8f275d162a470448e4fa0b9abe4ca` on October 16, 2026 at 03:40:36 UTC (October 15 in Detroit). The candidate head was `6dbc8d8b24abb79bc1502df6b9bac49dd395b08b`; full local verification passed 455 tests with zero failures/skips, required real Redis and 311 security assertions. Candidate GitHub verify and Vercel checks passed.

The exact merge source's Vercel status reported deployment completed. A browser reload of `https://www.geekprotocol.xyz/sign-in/` showed the new KasWare phone guidance. Standard read-only production monitoring at 2026-10-16T03:41:03.589Z passed 21/21 checks. These checks establish deployment/public responses, not physical Android clipboard or authenticated wallet acceptance.

## What changed

The page selects the full exact server message and attempts selection-based copying during the tap. Clipboard API fallback has a two-second UI deadline. Missing, denied or stalled clipboard support returns to clear touch-and-hold Copy instructions. An explicit Select entire message action is available. Late clipboard results cannot restore obsolete UI state; browser clipboard writes cannot themselves be cancelled once submitted.

The original release included KasWare Explore instructions; the mobile capability correction below supersedes that guidance. There is no new provider, mobile deep link, signature scheme or account-recovery bypass. Backend APIs, wallet transport, dependencies, Mainnet identity requirement, five-minute expiry, origin/replay checks, saved-player recovery and payout protections remain unchanged.

## Mobile capability correction — October 16, 2026

The founder reports that the described KasWare mobile feature is unavailable. The clipboard release has not resolved their login. Its 455 passing tests and 21 public production probes did not verify the installed wallet’s message-signing capability.

Updated sign-in guidance explains that biometric wallet unlocking is separate from Geek login-message signing. Manual signing requires the wallet’s actual Kaspa Sign message feature; browser signing requires an actual compatible provider. Do not direct a user without either feature through another copy attempt or promise Explore will support it. Guest learning remains available in the same browser, with no claim that it recovers another saved player.

AUTH-002 is blocked on this phone. Isolate and verify wallet-independent passkey login from draft PR #119 next; it is not live. New guest enrollment must not be represented as recovery of an existing wallet-linked player. Artwork remains paused in PR #120. No backend proof, wallet transport, credential, signature scheme or payout change is part of this guidance correction.
