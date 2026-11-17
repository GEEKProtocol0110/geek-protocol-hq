# Atomic fixed-window rate limiting — SEC-003

November 17, 2026. Internal source candidate based on main `b7521c6db2087d0c40580afa443104f33f4cd212`. Implements the shared rate-counter follow-up identified during the Claude review of PR #306. This change does not enable privileged access, payouts or other economic gates.

## Failure and boundary

The previous `rateLimit` implementation sent `INCR` followed by `EXPIRE ... NX` through a non-atomic provider pipeline. An accepted increment with a rejected or unexecuted expiry could create a persistent counter. Once over budget, that counter could continue blocking its caller until a later request successfully attached an expiry. The normal path already repaired missing TTLs; the issue was the failure window, not the absence of any expiry handling.

The original code also coerced a returned count with `Number(...)` without requiring a valid positive integer. Some malformed successful provider replies could therefore be treated as an available budget. Stored negative counters or invalid internal policy arguments also needed explicit rejection.

## Transition

`server/redis.js` now issues one single-key `EVAL` using `RATE_LIMIT_LUA`:

1. Validate the configured duration before any write. Read the existing counter, rejecting wrong types, noncanonical/negative values and counts that cannot be safely incremented.
2. Read its millisecond TTL.
3. For an absent key or a valid legacy counter without an expiry, use one `SET ... EX` operation to write the incremented count and bounded lifetime together. A rejected write does not leave an earlier increment to repair.
4. For a counter with an existing expiry, use `INCR`, preserving its original deadline. Rejected over-budget requests are counted and do not extend the window.
5. Accept only a positive safe-integer count response. A count above the unchanged caller budget raises `RATE_LIMITED`; a malformed reply raises `REDIS_INVALID_RESPONSE` and follows the existing generic service-unavailable path.

Lua serializes competing requests, but does not provide automatic rollback after an arbitrary script error. This design avoids a second write after a successful increment: new/repair transitions have one expiring write; healthy counters have one increment with an already-established expiry. It does not claim provider crash durability, backup safety or distributed failover correctness.

The shared function requires positive safe-integer limits and whole-second durations of 1–2,147,483,647. Existing call sites use valid bounded constants. Key names, scope/identity selection, default limits, configured budgets and public API response contracts remain unchanged. No keys are scanned or deleted, no retry is added, and no production records are read or modified by this development session.

## Compatibility and recovery

Existing expiring counters retain their count and absolute deadline. A valid missing-expiry counter retains its consumed count and starts a bounded repair window on the next request; the lost original expiry cannot be reconstructed from a count alone. Repair does not grant a fresh budget. Corrupt records fail closed and are preserved rather than silently reset.

When a response is lost after the provider executed the transition, the attempt may already be counted. The function reports failure and does not retry automatically. A later explicit request is a new counted attempt. Rate-limit calls are request budgets, not idempotent payment or reward events.

The script uses one Redis key and `GET`, `PTTL`, `SET ... EX`, and `INCR`; provider credentials must permit the script and these commands for the existing rate namespace. Do not fall back to the split pipeline if script execution is unavailable. Application routes map storage failures to their existing unavailable response.

## Evidence

`tests/rate-limit.test.js` exercises the actual server function against an isolated real Redis instance and covers:

- 100 concurrent requests admit exactly seven when the budget is seven; the counter records all attempts and expires.
- Allowed and rejected requests preserve the exact existing expiry timestamp.
- Missing-expiry repair preserves an already-exhausted budget.
- A rejected transition leaves no new persistent counter.
- A lost acknowledgment preserves one counted expiring attempt, without an automatic retry.
- Missing, malformed, noninteger or unsafe provider counts fail closed.
- Corrupt counter values and wrong types remain unchanged and unavailable.
- Invalid internal policy arguments fail before storage access.
- A real Redis ACL that denies separate `EXPIRE` still permits the atomic expiring write and repair.
- A real Redis ACL that rejects `SET` leaves absent and legacy counters unchanged; restoring permission allows repair.
- Expired windows restart and independent scopes/identities retain their separate budgets.

Six of the eleven tests fail on the original implementation; all eleven pass on the candidate. The baseline was temporarily restored only in the isolated checkout and the exact candidate bytes restored afterward. Limiter plus transport tests pass 28/28. The complete application suite passed 976 tests with real Redis, zero failures/skips, using test concurrency two. An earlier default-concurrency run was interrupted without a completion summary and is not counted as passed. Both isolated signer suites also passed (nine testnet and six mainnet checks), for 991 application/signer checks in total. All other verify components passed, including 329 security assertions, continuity, generated/content checks, economy and whitepaper checks.

Three older in-memory domain fixtures recognize the new command without attempting to model Redis expiry; the real-Redis suite provides that evidence. MFA outage injection is narrowed to its actual replay-claim script so the new rate-limit script cannot accidentally satisfy the wrong failure test.

## Integration and release

This candidate is independent of PR #306 (owner/MFA enforcement) and PR #307 (exact origins). Preserve their security controls when integrating. Their overlapping continuity records require combining the maintained JSON and regenerating Markdown views rather than choosing one branch's generated backlog. A disposable runtime overlay combined this candidate with the local equivalents of #306 at b7eaff0 and #307 at 99603f3, preserving the targeted MFA failure hook. It passed 104 focused limiter, Operations, origin, Royale, wallet, passkey and transport tests with real Redis, zero failures/skips. This is runtime compatibility evidence only: no branch was merged and the combined continuity documents were not regenerated or accepted.

#306 remains held for dedicated owner/MFA provisioning and external bot caller confirmation. Private-bank acceptance, adversarial balance/answer/recovery reviews and independent security assessment remain open. No branch pruning, secret provisioning, environment mutation, merge or production deployment is performed by this candidate.

Before release, inspect exact-head required checks, review the provider command compatibility and integration diff, and obtain founder merge authorization. The development fixtures establish internal behavior, not an independent audit or production fault-injection result.

Primary references: [Redis rate-limiter patterns](https://redis.io/docs/latest/commands/incr/), [expiry preservation](https://redis.io/docs/latest/commands/expire/), [TTL states](https://redis.io/docs/latest/commands/ttl/) and [SET expiration options](https://redis.io/docs/latest/commands/set/).
