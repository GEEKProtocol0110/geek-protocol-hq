# Geek passkey login

October 16, 2026. Focused extraction from draft PR #119, based on main after the mobile guidance correction PR #123. This release concerns account access only; the testnet wallet lab, reward desk changes, pilot tool and artwork remain separate.

## Player flow

Open `/sign-in/` in an HTTPS browser that supports passkeys. On a first visit, choose **Create a passkey for this player** and save it through the device’s credential manager. The device may ask for a fingerprint, face or screen lock. Returning players choose **Sign in with a passkey** and select a previously saved credential. No KasWare connection, copied login message, seed phrase or wallet private key is needed for this path. In-app browsers can lack passkey support; the page points to an up-to-date browser such as Chrome and keeps guest play available.

Enrollment protects the current browser’s player. Signing into an existing credential replaces the browser session with its saved player; separate guest progress is not merged. A new passkey for a guest cannot recover someone else’s wallet-linked player. Wallet-linked players authorize a new passkey with fresh, explicit wallet proof. This remains a blocker when their wallet cannot sign and they have no enrolled passkey. Do not bypass that proof or ask them to clear browser data or move keys.

Passkeys can be named and removed. Management requires fresh passkey login or explicit wallet authorization; a stored bearer session alone does not authorize changing recovery methods. Removal revokes the account’s existing passkey sessions. Keep another saved/synced credential, another authenticator or a linked wallet. Geek has no help-desk recovery bypass when all credentials are lost. Credential-manager sync and recovery are controlled by that provider, not Geek.

## Verification and storage

The integrity-locked `@simplewebauthn/server` 14.0.3 library verifies registration and assertions. Discoverable credentials and user verification are required. The server checks the exact challenge, origin, RP ID, user handle, signature and counter. Five-minute challenges are consumed once and bound to the requesting player/session. Atomic Redis compare-and-set checks protect credential uniqueness, account and wallet snapshots, and session rotation. Stable player ID, profile bytes, chosen name and membership time are preserved. Malformed account/session data fails closed without a reset.

The production RP ID is `geekprotocol.xyz`; bare and www hosts each require their exact HTTPS origin. Preview hosts are rejected unless an exact `PASSKEY_ORIGIN` is explicitly configured. Local HTTP is permitted only for explicitly configured localhost outside production. Preview credentials cannot authenticate production players. This release needs no new production secret or origin configuration for the canonical hosts. Node 22 or higher is declared; CI uses Node 24.

Credentials store public keys, credential IDs, counters, labels, creation time, account epoch and wallet version. The site never receives biometric data or the passkey private key. Fresh management grants remain in memory and expire after five minutes. Wallet linking/recovery changes the wallet version and invalidates prior passkeys; explicit re-enrollment creates a new valid set. Wallet spending and protected payout settings still require their existing wallet authorization.

The client starts no authenticator prompt until a tap, prevents overlapping actions, bounds API requests to 15 seconds and authenticator requests to two minutes, and does not retry writes automatically. On an uncertain response, reload to inspect current state before another attempt. Successful login exposes the saved-player destination even if refreshing the credential list then fails. Existing exact-message copying and allowlisted return destinations remain supported.

## Recovery and rollout evidence

Durable passkey account and credential records belong in controlled database backups. Offline restored-session cleanup deletes passkey challenges/grants along with bearer sessions but preserves durable credentials. Production provider restore, actual Android credential-manager enrollment/login and independent security review remain acceptance work; synthetic cryptographic and client tests do not establish them.

Primary guidance: [SimpleWebAuthn server 14.0.x](https://simplewebauthn.dev/docs/packages/server), [WebAuthn Level 3](https://www.w3.org/TR/webauthn-3/). Dependency integrity is recorded in `package-lock.json`. See the PR discussion for the exact checked head, merge and deployment evidence.

Full local verification: 471 tests passed, zero failures/skips, required Redis 7.4.2 and 311 security assertions, plus bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Production dependency audit returned zero vulnerabilities. Twenty-four focused passkey/clipboard tests are included in the total. Real phone, rendered browser and independent review remain separate acceptance evidence.

Released in [PR #124](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/124), merge `c972e27301bc461a526230806d5e781adac05e50` at 2026-10-16T05:37:11Z. Exact-head and merge-source Vercel checks succeeded. The live browser shows enabled passkey actions and ready first-visit state; three targeted HTTP checks passed. Actual Android enrollment/returning login and independent review remain outstanding. The broad PR #119 must be reconciled before later feature merges.

A disposable live API probe also passed session/status/begin-registration (200 each), correct RP ID, and required resident-key/user-verification options. No authenticator credential was created.

Release follow-up: PR #125 introduced an update-only session write to prevent deleted-cookie resurrection. UX-001 strengthens this to an atomic compare-and-set against the exact validated session snapshot, with the durable name saved in the same script. A stale refresh cannot overwrite newer wallet protection; revoked/changed snapshots issue no cookie or partial name update. See `NEW-PLAYER-POLISH.md` for evidence and limitations.


## Founder phone result — October 16, 2026

At 2:35 AM Detroit the founder reported **“It worked”** in response to the live phone passkey instructions. This confirms founder-reported phone-flow success. Browser/app version and prompt method were not specified. Separate returning-login, cross-device recovery and revocation attempts remain unreported, and independent review remains pending. Preserve the working session and saved credential; do not repeat the original initial-enrollment request as though no phone result exists.
