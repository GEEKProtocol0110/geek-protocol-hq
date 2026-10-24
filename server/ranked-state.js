import { auditWriteCommands, createAuditRecord } from './audit.js';
import { profileJson, profileKeyFor, profileSnapshot, parseProfile } from './profile.js';
import { prestigeKeyFor } from './prestige-state.js';
import { redis } from './redis.js';
import { AUTO_PREFLIGHT_LUA, AUTO_COMMIT_LUA } from './testnet-automatic.js';

// Grades, career changes, entry debits and their receipt commit together.
// Exact snapshots prevent a game from overwriting an avatar, trade or prestige.
export const RANKED_COMMIT_LUA = `-- geek-ranked-commit-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if (redis.call('GET', KEYS[2]) or '') ~= ARGV[2] then return 0 end
if (redis.call('GET', KEYS[3]) or '') ~= ARGV[3] then return 0 end
if ARGV[8] ~= '' and redis.call('EXISTS', KEYS[6]) == 1 then return -1 end
if ARGV[9] ~= '' then
  local kind = redis.call('TYPE', KEYS[5]).ok
  if kind ~= 'none' and kind ~= 'zset' then return -2 end
end
${AUTO_PREFLIGHT_LUA}
redis.call('SET', KEYS[1], ARGV[4], 'EX', ARGV[6])
if ARGV[7] == '1' then redis.call('SET', KEYS[2], ARGV[5]) end
if ARGV[8] ~= '' then redis.call('SET', KEYS[6], ARGV[8], 'EX', 172800) end
if ARGV[12] ~= '' then redis.call('SET', KEYS[7], ARGV[12], 'EX', ARGV[6]) end
if ARGV[9] ~= '' then
  redis.call('SET', KEYS[4], ARGV[9], 'NX')
  redis.call('ZADD', KEYS[5], ARGV[10], ARGV[11])
end
${AUTO_COMMIT_LUA}
return 1`;

export const commitRankedState = async ({ playerId, run, previousRun = '', profile, ttl = 7200, auditInput, dailyKey, activeKey, automaticReward }) => {
  const snapshot = profileSnapshot(profile);
  if (!snapshot) throw new Error('PROFILE_STATE_INVALID');
  const next = profileJson(profile);
  parseProfile(next);
  const changed = next !== profileJson(parseProfile(snapshot.raw || null));
  const record = auditInput ? await createAuditRecord({ actorType: 'alpha-session', actorId: playerId, interactionId: run.id, ...auditInput }) : null;
  const [event, index] = record ? auditWriteCommands(record) : [];
  const result = Number(await redis('EVAL', RANKED_COMMIT_LUA, 15,
    `geek:run:${run.id}`, profileKeyFor(playerId), prestigeKeyFor(playerId), event?.[1] || profileKeyFor(playerId), index?.[1] || profileKeyFor(playerId), dailyKey || profileKeyFor(playerId),
    activeKey || profileKeyFor(playerId),
    ...(automaticReward?.keys || Array(8).fill(profileKeyFor(playerId))),
    previousRun, snapshot.raw, snapshot.prestigeRaw, JSON.stringify(run), next, ttl, changed ? '1' : '0', dailyKey ? run.id : '', event?.[2] || '', index?.[2] || 0, index?.[3] || '', activeKey ? run.id : '',
    ...(automaticReward?.args || ['', '', '', 0, 0, '', ''])));
  if (result === -3) throw new Error('TESTNET_AUTO_RECORD_INVALID');
  if (result === -2) throw new Error('AUDIT_STATE_INVALID');
  if (result === -1) throw new Error('DAILY_ALREADY_PLAYED');
  if (result !== 1) throw new Error('RANKED_STATE_CHANGED');
};
