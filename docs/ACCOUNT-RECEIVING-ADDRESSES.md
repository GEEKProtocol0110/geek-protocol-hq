# Geek accounts and receiving addresses

AUTH-004 / DR-026, October 24, 2026. Sign in to a Geek account, save a receiving address once, and let the backend handle eligible approved rewards. Account authentication and the destination for receiving funds are separate.

## Player flow

Sign in or create an account with a Geek passkey. The device may use fingerprint, face, screen lock, another device or a security key; actual support depends on the browser and authenticator. My HQ and Rewards expose the same receiving-address form. Select Mainnet or Testnet-10, paste a receiving address from any Kaspa wallet, check the address/network confirmation and approve the change with the account's passkey. No wallet app, message signature, seed phrase or private key is required to save receiving information. A previously linked wallet remains an optional account-recovery method.

Receiving addresses cannot sign in, claim wallet ownership, search another player or recover a lost account. Legacy wallet-only players need an existing account credential or their existing wallet recovery proof before adding a passkey; this change does not weaken account-management proof. Unsupported passkey browsers retain guest learning and the existing same-player device-access route; device acceptance remains separate.

## Server controls

`/api/rewards?service=addresses` reads the current session's settings. A begin request binds a five-minute, single-use WebAuthn challenge to the session/player, exact origin/RP, network, destination, operation, current account/identity and prior receiving settings. Finish accepts only a registered credential for that account, verifies the assertion and user verification, and commits the address, authenticator counter and hashed audit evidence together. The final transaction compares the exact live session, account, identity and receiving record; concurrent logout, revocation or settings changes cannot commit stale authority. No signature is retained. The browser does not persist a management grant.

Durable settings are in `geek:reward-addresses:v1:<player>`. Mainnet and TN10 are independently checksum- and SDK-validated. The prior profile Mainnet address is read through until the first account-confirmed save, then retained in the address book. Game profiles, legacy payout review/cooldown records and prior identity bindings remain intact. New Mainnet settings retain a 72-hour future cooldown. Neither an elapsed cooldown, a saved address nor a passkey proof enables Mainnet settlement; future payment activation must separately apply all existing review and settlement rules. Temporary `geek:reward-address-proof:v1:*` records are removed by offline restore cleanup; durable addresses remain.

## Automatic test rewards

A saved TN10 recipient is eligible only if it matches an existing enabled bounded owner approval or the private `TESTNET_AUTO_APPROVED_WALLETS` list. A changed unapproved destination pauses future admission instead of silently paying the old address. An explicit owner pause blocks admission. Without a saved address book, the prior manual or verified-wallet fallback remains compatible. Removing a saved TN10 address prevents that fallback from silently restoring payments.

The same ranked-result transaction compares the exact receiving book, manual enrollment and selected source snapshots. A concurrent settings change skips stale admission while preserving the learning result. Existing per-recipient UTC-day, global daily, capacity and run replay bounds remain. Jobs already queued or signed keep their original recipient, amount and transaction journal. No production approval list, sender, credential or payment is changed by this implementation. Mainnet, CCE and collection ownership holds remain.

## Evidence limits

Real-Redis/real-WebAuthn tests cover account-only save and recovery, independent recipients/networks, wrong keys/UV/origin/session, stale or replayed proofs, concurrent logout/revocation, legacy settings preservation and restore cleanup. Admission tests cover saved recipients without wallet identities, pauses, concurrent changes and retained payment destinations. Shipped-client tests cover explicit confirmation, cancellation, duplicate taps, network separation and failure guidance. These checks do not prove an actual phone's passkey support or a live automatic transfer. Release results belong in the continuity worklog.
