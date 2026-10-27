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
