# Daily Vault

**Implemented:** October 2, 2026. **Surface:** `/vault/`. **API:** `/api/session/?service=vault`.

The daily vault gives one free, visible cosmetic seal per resolved player identity per UTC day. Claiming is explicit; visiting or logging in does not grant anything. It records attendance, not learning, mastery, or monetary eligibility.

| UTC weekday | Exact contents |
| --- | --- |
| Monday | 1 Signal seal |
| Tuesday | 1 Connection seal |
| Wednesday | 1 Curiosity seal |
| Thursday | 1 Discovery seal |
| Friday | 1 Reflection seal |
| Saturday | 1 Exploration seal |
| Sunday | 1 Possibility seal |

Everyone receives the same design on the same weekday. There are no payments, mystery odds, streak bonuses, penalties, or catch-up claims. Designs return each week. Seals are nontransferable off-chain cosmetics, separate from ranked stickers and the planned NFT collection. Claims award no XP, Alpha GEEK, credits, or tokens and cannot be withdrawn.

## Eligibility and authority

GET returns only the authenticated player's day, claim status, collection, lifetime claim count and latest 14 receipts. It never writes claim state. POST accepts `action: claim` and the displayed `dayId`. No caller-supplied player, timestamp, quantity or reward is accepted as authority. The browser may display the reset in local time, but the UTC interval is midnight inclusive to the next midnight exclusive.

The handler resolves ownership through `playerIdFor(session)`. A Redis Lua script independently checks Redis `TIME` against the server-selected UTC boundaries before reading or changing eligibility. Stale days, delayed requests crossing midnight and future or incompatible stored state fail closed. The last claimed day cannot move backwards.

The atomic script owns a single `geek:vault:<player>` record containing the last day, seven inventory counters, lifetime total and latest 14 receipts. A new grant updates eligibility, quantity and receipt together. Retrying or claiming from another tab returns the original receipt and time without another seal. A lost HTTP response is recoverable with GET or a repeated claim. There is no separate claim marker that can commit without its collection grant.

State has no expiry, matching the existing durable Alpha profile model; expiry must not reopen eligibility. Reads do not change totals. The bounded history contains day, seal ID, quantity, receipt ID and claim time, without addresses or public names. No vault record or receipts are exposed on public leaderboards. Verified identity recovery preserves the player key and invalidates previous authenticated sessions. Guests rely on their browser cookie; this is one claim per resolved identity, not proof of one unique human.

The browser holds no claim or eligibility state in local/session storage. Its monotonic countdown indicates when to refresh. It never automatically claims at midnight. Status/claims are rate limited by identity, with a separate IP limit on POST. Vault activity does not write existing profiles, sticker trades, gameplay, Study feedback, contribution rewards, or settlement settings.

## Evidence

Control **GP-INV-024** links the server, routing, integration tests and this specification. Tests cover private access, explicit claims, forged fields, concurrent requests, stable receipts, Redis-clock bounds, rollover, leap days, bounded retention, missed days, identity recovery and isolation. Internal checks are not an independent security audit.
