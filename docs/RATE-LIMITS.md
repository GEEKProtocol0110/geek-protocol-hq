# Rate limits

Buckets are defined in `server/http.js` (`RATE_LIMITS`) and applied in `api/session.js` and `api/passkeys.js`.
Each endpoint class has its own bucket, so page-load reads can never use up account creation or login.

| Bucket | Before | After | Why |
|---|---|---|---|
| `session-ip` (per client) | 600 / 10 min | 600 / 10 min | Shared networks / 100-player events. Unchanged. |
| `session-create-ip` (new guest sessions per client) | 120 / 10 min | 120 / 10 min | Abuse-prone. Unchanged. |
| `session-read` (page-load session check, per session) | 40 / 60 s, shared with renames (`session`) | 240 / 10 min | About 2 checks per page load, so roughly 120 page loads every 10 min. |
| `session-write` (rename / display name, per session) | shared with reads | 20 / 10 min | Writes stay strict. |
| `passkey-read-session` (GET status) | 30 / 10 min, shared with every passkey action | 240 / 10 min | This shared bucket caused the S-05 429 after about 15 page loads. |
| `passkey-read-client` | 60 / 10 min, shared | 600 / 10 min | Matches `session-ip`. |
| `passkey-create-*` (begin/finish-register) | shared 30 / 60 | 10 per session, 20 per client / 10 min | About 5 account creations per session (2 calls each). Strict, and browsing no longer uses it up. |
| `passkey-login-*` (begin/finish-login) | shared 30 / 60 | 20 per session, 40 per client / 10 min | About 10 login attempts. Strict against guessing. |
| `passkey-write-*` (logout, delete, device-*) | shared 30 / 60 | 30 per session, 60 per client / 10 min | Same as the old numbers. |

Ranked and score-submit limits (`api/ranked.js`, `server/*`) are unchanged.

Client rule: only an explicit 401 or a successful "not signed in" response means signed out. A 429, a 5xx or a network failure keeps the last known state (from sessionStorage) and shows a fixed retry message set with textContent.
