# Backup and recovery

**Current evidence:** the repository has an isolated native Redis snapshot/restore drill and safe restored-session cleanup. Production backup scheduling, retention, successful provider restore and recovery time have not been verified. Operations reports **Verification required**; database PING does not certify backup coverage.

## Production backup setup

The owner must verify the actual database provider and account. Vercel Pro does not itself prove that the separate Redis database is backed up. For Upstash, its [official backup guide](https://upstash.com/docs/redis/features/backup) describes immediate and daily backups from the database's Backups tab. Confirm the options and retention available for the actual database, make an initial backup and record its completed status. A restore replaces the destination's contents, so use a new isolated database for a drill.

Record the database identifier, backup identifier/time, retention, responsible owner, last successful drill and measured recovery time privately. Proposed Alpha targets are at most 24 hours of lost changes and recovery within four hours; these are objectives to measure, not achieved guarantees. Confirm retention covers the detection delay you need and arrange a separate protected copy if the provider's retention is insufficient. Do not include secrets or player data in GitHub evidence.

## Local restore drill

With Node and `redis-server` installed, run `npm run recovery:drill`. CI also runs the drill through `npm test`. It creates two disposable loopback databases, snapshots synthetic state to a native RDB, empties the source fixture, restores into the second fixture and checks profile data, names, representative identity/campaign/vault/review settings, hashes, sorted sets, signed audit records and expiration. It proves the tested native Redis data mechanics, not Upstash's managed restore implementation or complete production business recovery.

The drill also demonstrates that restored bearer sessions remain usable until revoked. A backup is therefore sensitive authentication material, not just a copy of progress. No production credentials or endpoints are used in this local drill.

## Provider restore acceptance

1. Restore a completed provider backup into a **new database**, isolated from live visitors and automated workers. Record both source and destination identifiers before starting. Keep production pointed at its current database during the drill.
2. Verify representative durable profiles/names, wallet identity mappings, career/prestige, saved Study feedback, Quest/vault records, collectible reservations/trades, CCE/review queues, deployment-scoped community applications/public credits, leaderboards, holiday settings and audit indexes. Check record integrity with the existing audit secret in a protected recovery environment. A valid record digest does not prove completeness; compare the backup point's counts and a privately recorded sample. Record any missing or malformed data rather than letting UI fallback create replacements.
3. Revoke restored player/owner bearer sessions and one-time identity proofs before exposing the restored database. Use `scripts/reset-restored-sessions.mjs` with **dedicated** `RECOVERY_REDIS_REST_URL` and `RECOVERY_REDIS_REST_TOKEN` values for that offline restore. Run `node scripts/reset-restored-sessions.mjs --restored-host YOUR_RESTORED_HOST` first; this is a dry run. After verifying the isolated target, append `--apply`. The script rejects the configured application endpoint when supplied, requires an exact host match, emits only counts and limits deletion to session/challenge/authorization prefixes. It preserves profiles, identity mappings, progress, audit and TOTP replay guards. Partial network failures require rerunning on the same offline target.
4. Verify old cookies and challenges are rejected. Verified players can sign in again and recover their durable identities; unlinked guests depend on their original sessions and may lose access after revocation. Identify this loss before real cutover. Treat active games and rooms as interrupted; do not promise their safe continuation. Preserve finalized durable receipts and inventory reservations; reconcile pending trades/reviews before accepting new mutations.
5. Rotate `OPS_ACCESS_TOKEN` before a recovery cutover. Retain the enrolled authenticator and its replay guards; do not disable MFA as a shortcut. Keep the audit integrity secret needed to check restored evidence. Source code, pinned dependency graph and Vercel environment configuration are separate recovery assets: Redis backups do not contain server secrets or deployment settings.
6. On the protected recovery deployment, check sign-in/recovery, saved name/progress, each owner workspace and its authorization, audit integrity, holiday state and representative free gameplay. Confirm payouts remain disabled. Measure elapsed time and data loss against the proposed targets.
7. Production cutover is a separate owner decision after the drill evidence is reviewed. Keep the prior database and deployment available for rollback. Identify the selected backup timestamp and communicate the lost-progress interval before reopening writes. Verify the new deployment/endpoint explicitly and monitor failures. Do not perform an in-place restore of production as a test.

## Incident sequence

Preserve relevant deployment, audit and provider evidence without exposing credentials. Restrict affected writes at the hosting boundary; do not assume this repository contains a universal maintenance switch. Revoke compromised owner credentials, secure the independent hosting/database accounts and determine whether the incident affects credentials, data or both. Restore only if needed, following the isolated acceptance procedure. Never clear the live database to troubleshoot a login problem. Publish a factual incident record after recovery, separating measured loss and recovery time from unknowns.

The owner must still complete and record the provider drill and account-access recovery. No production backup, deletion, credential rotation or restore is performed by this release.
