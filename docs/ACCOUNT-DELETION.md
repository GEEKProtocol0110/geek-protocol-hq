# Player account deletion (PRIV-001)

Founder decision, November 19, 2026: players can delete their own Geek account. Recommendations accepted: keep payout/test-reward accounting and the audit log, keep shared multiplayer games, and require the same fresh proof used for recovery changes.

## Flow

`/sign-in/` → **Delete my Geek account**. The player types `DELETE`; the browser sends `POST /api/passkeys {action:'delete-account', confirm:'DELETE', token}`. The existing origin check, session/client rate limits and error mapping of the passkey API apply.

- **Protected accounts** (a passkey account or a linked wallet) must present a fresh five-minute grant from a passkey sign-in or wallet verification (`consumePasskeyGrant`), so a copied session cookie alone cannot delete them.
- **Guest players** have no stronger proof than their session; the typed confirmation guards against accidental deletion.

## What one Lua transition does (`server/account-deletion.js`)

1. Aborts with `ACCOUNT_DELETE_CHANGED` if the passkey account or identity record changed since it was read; aborts if the player is already deleted.
2. Deletes owned records: player name, profile, prestige, vault, economy ledger, Study progress, receiving addresses, Testnet auto-reward enrollment, device list, CCE contributor index/stats, today's Daily slot, the active ranked run and every Quest chapter.
3. Releases bindings only when they still point at this player: each passkey credential index and the wallet → player binding, so the passkey cannot sign in to the deleted player and the wallet can start a new one.
4. Removes the player from every leaderboard (all categories × gauntlet/daily/speed) and from the current and previous weekly/monthly challenge boards, with their name metadata.
5. Deletes the passkey account, identity record and current session; writes `geek:player-deleted:v1:<player>` (no personal data, TTL = session TTL + 15 days); appends an `identity.account.deleted` audit event whose identifiers are hashed.

`readSession` checks the tombstone before any identity or passkey lookup, so every other session for the player, including device-approved sessions that have no index, returns signed out rather than a recovery error.

## Kept, and why

- **Audit log**: integrity-chained; records hold only hashed identifiers.
- **Payout and Testnet reward records** (`mainnet-payout`, `testnet-reward`, `testnet-auto` jobs, `payout-review`): accounting evidence. They reference the random player ID, which no longer links to a name, wallet binding or account.
- **Multiplayer games** (classic online, Duel, Royale, lobbies): the other player's history. Unaccepted invitations and short rooms expire on their existing TTLs; accepted classic games keep the display name shown when they were played.
- **Expiring run state** (Study runs, past challenge attempts, past Daily slots, rate counters) expires on existing TTLs.
- **Geek Mini** standings use their own cookie identity and existing self-removal.
- **Backups** age out on the provider's retention schedule.

## Evidence and remaining work

`tests/account-deletion.test.js` (real Redis) covers typed confirmation, guest deletion and cross-device revocation, standings removal that leaves other players intact, the hashed audit event, the fresh-grant requirement and credential release for passkey accounts, and a concurrent change that aborts without deleting anything. Wallet-linked deletion, rendered/browser acceptance and an independent security review remain open. Replacing names inside accepted classic games is a possible follow-up.
