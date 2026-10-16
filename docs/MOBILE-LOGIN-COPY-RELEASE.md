# Android login-copy release

PR #121 merged at `78e9c0e0a3e8f275d162a470448e4fa0b9abe4ca` on October 16, 2026 at 03:40:36 UTC (October 15 in Detroit). The candidate head was `6dbc8d8b24abb79bc1502df6b9bac49dd395b08b`; full local verification passed 455 tests with zero failures/skips, required real Redis and 311 security assertions. Candidate GitHub verify and Vercel checks passed.

The exact merge source's Vercel status reported deployment completed. A browser reload of `https://www.geekprotocol.xyz/sign-in/` showed the new KasWare phone guidance. Standard read-only production monitoring at 2026-10-16T03:41:03.589Z passed 21/21 checks. These checks establish deployment/public responses, not physical Android clipboard or authenticated wallet acceptance.

## What changed

The page selects the full exact server message and attempts selection-based copying during the tap. Clipboard API fallback has a two-second UI deadline. Missing, denied or stalled clipboard support returns to clear touch-and-hold Copy instructions. An explicit Select entire message action is available. Late clipboard results cannot restore obsolete UI state; browser clipboard writes cannot themselves be cancelled once submitted.

The existing KasWare in-app-browser connection route is explained on the page. There is no new provider, mobile deep link, signature scheme or account-recovery bypass. Backend APIs, wallet transport, dependencies, Mainnet identity requirement, five-minute expiry, origin/replay checks, saved-player recovery and payout protections remain unchanged.

## Phone acceptance still needed

Reload the canonical sign-in page. With a fresh login message, try Copy message. If needed, choose Select entire message, touch and hold the selected text and choose Copy, then sign the entire message in the wallet and paste its signature into the same browser before expiry.

Alternatively, open KasWare Explore, visit the canonical sign-in page, select the usual Mainnet account and use Connect a browser wallet followed by Sign in with wallet. Preserve user control over approval. Record device/browser/wallet build and actual result without storing credentials, signed challenges or private keys in the repo.

The agent did not sign into the user's account or operate the user's wallet. AUTH-002 remains needs-evidence until the founder confirms the phone result. Artwork intake/generation is paused; PR #120 keeps the original art and tracker. PR #119's optional passkeys/testnet wallet remain a separate unmerged candidate.
