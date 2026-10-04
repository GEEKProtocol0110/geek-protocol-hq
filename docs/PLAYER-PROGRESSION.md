# Player dashboard and manual prestige

Founder rule, October 4, 2026: levels 1–50, optional reset at level 50, maximum 25 prestige ranks. Each reset starts level 1 with zero cycle XP. Prestige 25 can complete one final 50-level cycle to earn Prestige Master. There is no Prestige 26.

The existing 250-XP level step is retained. Level 1 starts at zero; reaching level 50 requires 49 increments, or 12,250 cycle XP. The existing server-scored Gauntlet/Daily/Speed XP formula is unchanged. XP beyond level 50 continues in lifetime totals but is discarded from cycle progress when the player chooses prestige. Prestige confers no scoring, reward or payout multiplier.

## Persistence and migration

`geek:prestige:v1:<player>` stores the prestige count, lifetime XP baseline at the reset, and at most 25 new prestige events. Profile reads initialize this separate record once. Existing players retain earned ranks under the previous 6,250-XP automatic cycle, capped at 25; migration records the legacy rank. New players start Prestige 0. Ordinary profile writes omit the attached prestige state and cannot reset or overwrite the authoritative ledger.

`POST /api/session/?service=prestige` accepts only `{ action: "prestige", confirm: true, expectedPrestige: <integer> }`. It requires a player session and rate limits. The server checks level 50 and the cap; the browser cannot provide XP, level, rank, player ID or reset baseline. A Redis compare-and-set checks both current profile and prestige JSON before writing the reset and audit record atomically. Repeated/concurrent clicks with the old rank cannot produce a second prestige. Corrupt prestige records fail closed. The endpoint writes no profile, wallet, financial, study, inventory or leaderboard data.

Lifetime XP, best scores, question totals, accuracy, achievements, avatar/customization, sticker inventory, Alpha practice ledger and Study feedback survive reset. New prestige events are merged with the existing bounded journey log for display. Existing unlocked avatars remain available through the prestige-based unlock rules.

## Dashboard

`/profile/` exposes career, prestige path, challenge cards, mode/category standings, achievements and avatar customization. A confirmation dialog explains the exact reset and carryover. Errors require refreshing authoritative state before retry. Loading/unavailable progression cannot enable prestige.

Leaderboards show up to 50 best verified scores, with equal scores sharing rank, a private current-player standing and public level/prestige badges. Existing calls default to ten entries. Atomic conditional score writes prevent a concurrent lower score from replacing a higher score. No player IDs, wallet addresses or question data are published. Prestige does not erase scores.

Weekly/monthly challenges retain their existing score-only periods and one-attempt rules; they award no career XP, credits or tokens. Their dashboard cards show current attempts and local closing times. Gauntlet, Daily Signal and Speed Signal links clearly identify XP modes. Untimed Study, assisted practice and Memory Grid remain outside ranked XP and standings. Payments and payouts remain disabled.
