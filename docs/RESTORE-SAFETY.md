# Offline restore safety

October 16, 2026. OPS-001 candidate based on main after PR #128, commit `96a71d52d54c262f97a1f67d7c3e9de684cd1a04`.

The earlier cleanup command rejected the application database only when its URL was also configured in the recovery environment. An isolated recovery shell could lack that configuration. The updated command requires both `--production-host` and `--restored-host`, rejects equality before any request and still rejects configured application hosts. The operator must independently identify both databases in the provider console and keep the restored target offline. An incorrect confirmation or an unrecognized provider alias cannot be detected by this script.

The command defaults to dry run. Unknown/repeated flags, nonstandard endpoint ports, URL credentials/paths/queries/fragments and malformed application endpoint configuration fail closed. Redirects are rejected. Header and response-body reads have a 15-second deadline, with no automatic retry after a possibly committed deletion. Provider details, endpoint values, credentials and key names are absent from CLI output. Counts are the only success output.

Cleanup validates all scan results before deleting anything, removes only bearer-session and one-time-proof prefixes, validates deletion counts and scans again before reporting success. Pending failures require inspection and a later manual rerun on the same offline restore. Persistent player profiles, names, passkey public credentials/mappings, wallet identities, audit records and TOTP replay guards remain intact.

The native snapshot test enrolls an actual synthetic WebAuthn credential, restores its RDB into a second loopback Redis instance and empties the original fixture. A restored cookie works before cleanup and fails afterward. Old challenges and management grants are gone; fresh signed passkey login recovers the same player, name, profile bytes and membership date. Additional tests cover unsafe targets, argument mistakes, malformed provider envelopes, header/body timeouts, pagination/deduplication, unexpected keys, malformed deletion counts, leftover sessions and a lost deletion reply followed by an offline rerun.

Run the focused checks with Redis available:

```sh
node --test tests/recovery.test.js tests/recovery-safety.test.js tests/passkeys.test.js
```

See [Backup and recovery](BACKUP-RECOVERY.md) for the updated dry-run/apply command and actual provider acceptance procedure. A restore rolls durable security state back to its backup point; post-backup credential removals and replay-guard changes need reconciliation from separately preserved evidence before access reopens. Retaining durable credentials is not proof that no revoked credential was restored.

## Evidence and pickup

Focused checks: 24 tests passed. Full `npm run verify` passed 489 tests, zero failures/skips, native Redis 7.4.2, 311 security assertions and all bank/catalog/readiness, collection/archive, repository, economy and continuity checks. Production dependency audit: zero vulnerabilities. Real synthetic WebAuthn cryptography is exercised. Exact head, CI and release result belong in the associated PR; local checks alone do not establish merge or deployment.

Production database backup scheduling, retention, restore and measured recovery time remain unverified. No production database or owner credential was read, changed, revoked or restored during this work. Physical-device recovery, credential-manager sync and independent review remain separate. The founder's successful phone flow is preserved. Draft #119 needs reconciliation; artwork #120 stays paused. All settlement, CCE and ownership holds remain unchanged.
