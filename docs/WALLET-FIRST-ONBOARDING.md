# Wallet-first player access

AUTH-004 implements the founder's October 24 direction: connect a wallet, approve a free sign-in message, and continue playing. Owner enrollment forms, provider dashboards, transaction hashes and manual payout instructions do not belong in the player journey.

The sign-in page presents one **Connect & sign in** action. After connection, the client requests a fresh server challenge, asks the selected provider to sign that exact message, and submits the signature to the existing ownership verifier. Only successful verification continues to a fixed local destination. Connection alone never authenticates a player, and no signing prompt runs on page load. Rejected signatures restore the button. Mint-only connections keep their existing behavior. Saved passkeys, nearby-device access and manual recovery remain optional, closed sections.

The existing provider integrations require Kaspa message signing and Mainnet identity addresses. This change does not invent a mobile deep link or guarantee that any mobile app exposes a browser provider. A supported phone-wallet/browser signing flow still needs actual-device evidence. Never request recovery phrases or private keys as a workaround.

When no provider is available, Sign in presents KasWare in-app browser instructions and a selectable/copyable canonical HQ link instead of a disabled connect button. Only allowlisted continuation names are carried to that link; session parameters and arbitrary destinations are omitted. Clipboard denial leaves manual selection available. KasWare detection runs again on load, page return and an explicit connect tap, without requesting wallet accounts in the background. Official KasWare app release notes describe its in-app browser (https://github.com/kasware-wallet/kasware-app/releases); no Chrome-to-app launch scheme was verified. This is a supported route to try, not completed physical-phone acceptance or direct app launching.

## Backend-managed TN10 admission

For the bounded GEEKT pilot, the operator may privately configure `TESTNET_AUTO_APPROVED_WALLETS` as a comma-separated list of at most 100 checksum-valid TN10 recipient addresses. It is empty by default; it must not contain the dedicated sender. This is an admission policy, not part of the immutable payment configuration fingerprint: removing an approval cannot change or rebuild an already saved payment.

For an approved wallet without an existing owner enrollment override, HQ loads its durable signature-verified identity and derives the corresponding TN10 address from its public key. The player never pastes a destination or saves an enrollment form. A guest address, client claim or unapproved wallet cannot establish eligibility. An existing explicit enrollment, including a disabled one, takes precedence. Operator access remains necessary to configure or expand the bounded pilot; this implementation does not enable public rewards.

The existing atomic Daily finish watches the exact identity record used for derivation. A concurrent identity change skips stale reward admission while retaining the learning result. The same one-recipient-per-day, global daily limit, retained-capacity bound, per-run replay lock and immutable commit/reveal journal apply. A later approval removal or processing pause does not hide an already recorded payment or permit it to be resent.

Player text says what happens next: finish an eligible Daily and the test reward is sent automatically; saved, pending, paused and received states remain distinct. Operational diagnosis stays with the maintainer. GEEKT is testnet-only; real GEEK/Mainnet settlement, CCE and collectible ownership remain disabled.

## Evidence and remaining acceptance

Synthetic shipped-client tests cover a complete one-click connect/challenge/sign/verify sequence, cancellation, repeated clicks and ordinary connections without signatures. Real-Redis tests cover derived enrollment without an owner action, lack of authority for guests/unapproved wallets/disabled enrollments, exact identity snapshot races and retention of previous payment records. Existing cryptographic verification and journal-recovery tests remain required. These tests do not establish actual phone compatibility or a live automatic payment. Release results belong in the continuation worklog.

## Visible sign out

Authenticated players can choose **Sign out** beside their identity on My HQ or above the wallet card on Sign in. This calls the existing protected session-revocation endpoint and returns to Sign in with a signed-out message. It does not remove the saved player, wallet binding, passkeys or payment records. Guest sessions do not show the control. Server/read failures retain a usable retry, and an expired session can return directly to Sign in.

## Android app launch

Sign in offers an Android-only **Open KasWare** anchor using the package and scheme verified in the official v0.5.3 APK. This opens the wallet without requesting accounts or signatures and has a canonical HQ fallback. Players still copy the HQ link into KasWare's Mainnet browser. See [artifact and transport evidence](KASWARE-MOBILE-CONNECTION.md); direct Chrome signing and actual-device acceptance remain unresolved.
