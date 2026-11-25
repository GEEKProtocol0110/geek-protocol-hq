# Wallet-link deletion guard — AUTH-007

Prepared November 25, 2026 against combined candidate #324 at `0f356360980851228670303cd1322a02be1b1351`. This is a separately reviewed follow-up, not a change to #324's published head, a main merge or a production release.

## Reproduced failure

The wallet-binding transition did not check account-deletion tombstones. Deleting a guest account on another device can leave the first device's stored session intact. A wallet verification already past session validation could therefore recreate a deleted identity and bind a wallet to it. Subsequent requests reject the deleted player until the tombstone expires (45 days), leaving a durable binding that cannot be used normally.

The same boundary also permits two recovery races: deleting the requester on another device after validation, or deleting the target before verification reads its identity and wallet snapshots. In the latter case both snapshots are absent, so the existing comparison does not distinguish a deleted target from a fresh player.

The [November 23 handoff](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/225#issuecomment-7102354863) reported the missing deletion-marker check. The [November 24 handoff](https://github.com/GEEKProtocol0110/geek-protocol-hq/issues/225#issuecomment-7132620799) reports Security Bot's READY-for-Preview review of #324 at `0f35636`, retaining this LOW finding. This is an attributed review report for the parent head, not independent review of AUTH-007.

## Scoped change

Pass the existing target-player and requester-player deletion keys to the binding Lua script. Before any wallet, identity, passkey, session or successful-audit write, reject if either tombstone exists. The check and binding remain one Redis transition, so deletion cannot interleave between them. Same-player linking safely checks the same marker twice.

Reuse `deletedPlayerKey` from account deletion and the existing `IDENTITY_STATE_CONFLICT` HTTP 409 response. The wallet challenge remains consumed; no automatic retry, tombstone removal, TTL extension or identity resurrection is introduced. Existing exact-origin, fresh-proof, credential-set and requester-session comparisons remain intact. If linking wins first, the existing deletion snapshot comparison still requires the player to obtain fresh authorization against the newly linked account.

## Regression evidence

`tests/account-deletion.test.js` exercises the shipped identity/deletion handlers, cryptographically signed synthetic Kaspa proofs and isolated real Redis. It deterministically places actual deletion at the relevant transition boundary; it does not rely on scheduler timing or production records.

1. Guest deletion on another device immediately before first-link commit: refuse, retain the tombstone and original stored session, create no wallet/identity/passkey/success-audit record, and permit fresh linking to a new player.
2. Requester deletion during cross-player recovery: refuse without switching its session, changing the owner's identity version, invalidating the owner's access or recording successful recovery. A fresh requester can still recover.
3. Target deletion before identity snapshots are read: refuse without recreating the target or binding its wallet. A fresh proof can link to a new player afterward.
4. The reverse ordering, where linking wins first: reject the older deletion snapshot; retain the linked account; a freshly authorized deletion releases it normally.

All three new refusal tests fail against unchanged parent `0f35636`, each returning HTTP 200 rather than the expected conflict. The reverse-order control and six existing deletion tests pass there. All ten deletion tests pass with the guard. The in-memory API fixture mirrors the new key list; it is not the evidence for Redis atomicity.

Full local verification passes 1,006 application tests with required isolated Redis 7.2.5 and concurrency two, plus nine Testnet and nine Mainnet offline signer checks: 1,024 total, zero failures/skips. Every remaining `verify` component passes, including 340 security assertions, question/content, collection/archive, repository, economy, continuity, site and whitepaper checks. Exact published source/tree, hosted results and release disposition are recorded in the follow-up PR and continuity worklog; parent results are not substituted.

## Remaining boundaries

Independent review of this delta, owner/provider confirmation that Preview and Production Redis are separate, actual account/device acceptance and founder release approval remain separate. No real account, wallet signature, provider configuration, secret, payout, migration or private-ranked-bank change is made here. The original combined candidate and its earlier component PRs remain intact and unmerged.
