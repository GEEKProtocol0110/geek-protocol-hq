# Saved-player storage diagnostics

PILOT-001, October 26, 2026. The live Royale service-unavailable observation is unresolved. This candidate adds diagnostics; it does not establish the cause or fix production storage.

Each failed Redis request emits one `Geek Redis failure` server error with five fields:

| Field | Meaning |
| --- | --- |
| `failure` | `configuration`, `network`, `timeout`, `http`, `provider`, `invalid_json` or `invalid_response` |
| `stage` | `configuration`, `headers`, `body` or `response` |
| `operation` | `command`, `pipeline` or `transaction`; never the Redis command itself |
| `status` | HTTP status integer from 100 through 599, or null before a response |
| `elapsedMs` | Monotonic request duration, rounded and capped at 8,000 milliseconds |

Successful requests emit no diagnostics. A missing single-command result is diagnosed while preserving `undefined` for the existing identity/session decoders; explicit Redis null remains an absent record. Invalid batch shapes fail closed. Batch provider errors become generic storage failures instead of reaching the generic API logger as raw errors.

Logs contain no endpoint, token, command, key, body, provider message, stack or player information. The existing eight-second cancellation deadline remains. Failures do not prove that a write was uncommitted, and no write is automatically retried. Logging failures cannot replace the storage error.

After release, record the exact deployment and inspect a bounded saved-player **read**, correlating the platform request time/route with this log and the provider's status. Start with one read and stop after the first useful failure, or after two layers provide no useful signal. A 429 or other status is evidence to investigate, not by itself proof of a specific quota or billing issue. Do not log raw provider bodies to find out more.

Do not start another match to obtain diagnostics. Reconcile the original test room before any separately authorized live retest. Do not repeat a payout, reset profiles, restore production, change credentials or upgrade billing as a diagnostic shortcut. Successful local tests and a deployed diagnostic still do not accept the live Royale result or change the Alpha label.

Regression coverage lives in `tests/redis-transport.test.js`; full-suite identity tests preserve the malformed-versus-absent record boundary. Release evidence belongs in PR #170 and the continuity worklog.

## Released checkpoint

PR #170 merged October 26 as `a235e3dc3899f493394a486c280ae31c2c46cb6b`, tree `ab1a8bbcf1346d225b62113de6bfe9240a683e81`, matching the checked candidate. Production `dpl_3naYTQPH2BZxL6kSVjw5HPMAwwVp` is READY on that merge with both canonical domains assigned. The single post-release health read returned 200 and storage connected. Recent runtime samples showed deprecation warnings and no storage failure cause. This establishes release and point-in-time connectivity, not saved-player recovery or resolution of the earlier live Royale failure.

## Original room reproduced; finalization candidate

A later original-room browser recovery reproduced saved-player unavailability, correlated with a fixed diagnostic of HTTP 400 at the body stage for a command request. This supersedes only the earlier nonreproduction, not its valid point-in-time health result. The authoritative final match result remains unverified.

The finalization script assigned the same Lua table to both pending and final result fields. Some encoders reject repeated references: for example, [gopher-json’s encoder](https://github.com/layeh/gopher-json/blob/master/json.go) tracks visited tables throughout serialization. This is a compatibility hypothesis, not evidence that the provider runs that implementation. A native-Redis test model of this behavior fails all three old finish outcomes. The candidate clears the consumed pending reference before encoding; all three outcomes then pass. It preserves the computed final result and existing shared deadline, event identity and expiry. Production confirmation requires release followed by one original-room recovery; no new game or data reset is needed for that check.

## Finalization released; original-room recovery passed

PR #171 merged as `c0a32cbb6fa66edb3ffda54c3c18fbd6b8d94b17`, matching checked tree `e08a130646d78e7d74f3b9f340c0774cfa2e4504`. Production `dpl_CFy6c1R1TjzU5ohJ47h18vwMj5sU` is READY on that merge with both canonical domains assigned. The existing temporary host session recovered the original room as finished: both test seats timed out, no survivors and no winner. The prior service-unavailable error was absent; the targeted deployment Redis diagnostic sample returned no entries. This confirms the fix resolves the observed original-room recovery failure. It does not establish the provider internal encoder, successful live answer submission, winner interaction or general capacity. No new game or record reset was needed.
