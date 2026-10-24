# KasWare Android connection evidence

AUTH-004, checked October 24, 2026. This records app-launch evidence separately from signed-in acceptance.

## Official artifact

The latest release returned by the official `kasware-wallet/kasware-app` GitHub API was [v0.5.3](https://github.com/kasware-wallet/kasware-app/releases/tag/v0.5.3). `KasWare-Wallet-v0.5.3.apk` is 43,082,075 bytes. SHA-256 `c90959cb64103a534bf2f0654d8e0b9d4a51464b989960c81ee1c36ee70f9ee6` matches the release's `sha256sum.txt`. The APK was parsed outside the repository, without installing or executing it; no wallet or user data was inspected.

The compiled Android manifest declares package `com.kasware.app`, exported `com.kasware.app.MainActivity`, and a VIEW intent with DEFAULT and BROWSABLE categories. Its scheme resource `0x7f120041` resolves to `com.kasware.app`. `assets/capacitor.config.json` independently identifies the same app ID. These are launch-registration facts, not a documented website/signature handoff contract.

[Chrome's Android Intent documentation](https://developer.chrome.com/docs/android/intents) defines user-tapped intent anchors, a package constraint and an encoded `S.browser_fallback_url`. HQ therefore offers an Android-only **Open KasWare** anchor using that exact package and scheme. No timer or page-load launch runs. The fallback is the canonical HQ Sign-in URL, carrying only an allowed continuation and a fixed unavailable marker. User-supplied destinations, accounts, signatures and session data never enter the intent.

## Connection limits

The bundled app JavaScript was searched for `appUrlOpen`, `getLaunchUrl`, deep-link and WalletConnect handling, and MainActivity's method list was inspected. No website-opening or Kaspa signature-return contract was established. A generic launch URI cannot be presented as such a contract. Do not add guessed `browser`, `connect`, `url` or callback arguments, or treat the app opening/page visibility as successful authentication.

The player copies HQ's link, opens KasWare, chooses Mainnet and uses the in-app browser. There the existing provider requests accounts and a free, exact server-challenge signature after the player's explicit action. KasWare's [Connection API](https://docs.kasware.xyz/wallet/developer-documentation/kaspa/kaspa-connection) documents `requestAccounts` and notes that programmatic network switching is disabled on mobile. APK registration supports offering the launch action; physical-phone launch and full signing still need actual-device evidence.

Direct Chrome sign-in remains unresolved. It needs a supported wallet transport that can return a signature to the originating browser; a launcher, copy action or deployment does not supply one. No replacement wallet, seed import, new account system or public payment activation is implied.
