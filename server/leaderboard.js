import { parseStoredJson, pipeline, redis } from './redis.js';
import { playerIdFor } from './session.js';
import { deriveProgression } from './progression.js';
import { prestigeKeyFor, migrateLegacyPrestige } from './prestige-state.js';

const validModes = new Set(['gauntlet', 'daily', 'speed']);
const cleanMode = (mode) => validModes.has(mode) ? mode : 'gauntlet';
const boardKey = (category, mode = 'gauntlet') => cleanMode(mode) === 'gauntlet' ? `geek:leaderboard:${category}` : `geek:leaderboard:${cleanMode(mode)}:${category}`;
const metaKey = (category, mode = 'gauntlet') => cleanMode(mode) === 'gauntlet' ? `geek:leaderboard:${category}:meta` : `geek:leaderboard:${cleanMode(mode)}:${category}:meta`;

export const listLeaderboard = async (category, mode = 'gauntlet', limit = 10) => {
  const selectedMode = cleanMode(mode);
  const raw = await redis('ZREVRANGE', boardKey(category, selectedMode), 0, Math.min(50, Math.max(1, limit)) - 1, 'WITHSCORES');
  if (!Array.isArray(raw) || !raw.length) return [];
  const ids = raw.filter((_, index) => index % 2 === 0);
  const scores = raw.filter((_, index) => index % 2 === 1);
  const meta = await pipeline(ids.map((id) => ['HGET', metaKey(category, selectedMode), id]));
  const ranks = await pipeline(scores.map(score => ['ZCOUNT', boardKey(category, selectedMode), Number(score) + 1, '+inf']));
  const profiles = await pipeline(ids.flatMap(id => [['GET', `geek:profile:${id}`], ['GET', prestigeKeyFor(id)]]));
  return ids.map((id, index) => {
    const details = parseStoredJson(meta[index]) || {};
    const profile = parseStoredJson(profiles[index * 2]) || {};
    let progression = null;
    try { progression = deriveProgression({ ...profile, prestigeState: parseStoredJson(profiles[index * 2 + 1]) || migrateLegacyPrestige(profile) }); } catch { /* A damaged rank must not fabricate progression. */ }
    return {
      rank: Number(ranks[index]) + 1,
      name: details.name || 'Guest Geek',
      score: Number(scores[index] || 0),
      round: Number(details.round || 1),
      mode: selectedMode,
      level: progression?.level ?? null,
      prestige: progression?.prestige ?? null,
      updatedAt: Number(details.updatedAt || 0)
    };
  });
};

export const leaderboardStanding = async (category, mode, playerId) => {
  const score = await redis('ZSCORE', boardKey(category, mode), playerId);
  if (score === null) return null;
  return { score: Number(score), rank: Number(await redis('ZCOUNT', boardKey(category, mode), Number(score) + 1, '+inf')) + 1 };
};

export const VERIFIED_SCORE_LUA = `-- geek-verified-score-v1
local previous = tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '0')
if tonumber(ARGV[2]) <= previous then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
return 1`;

export const recordVerifiedScore = async ({ session, category, score, round, mode = 'gauntlet' }) => {
  const selectedMode = cleanMode(mode);
  if (!Number.isInteger(score) || score <= 0) return { improved: false, entries: await listLeaderboard(category, selectedMode) };
  const playerId = playerIdFor(session);
  const improved = Number(await redis('EVAL', VERIFIED_SCORE_LUA, 2, boardKey(category, selectedMode), metaKey(category, selectedMode), playerId, score, JSON.stringify({ name: session.name, round, mode: selectedMode, updatedAt: Date.now(), verified: true }))) === 1;
  return { improved, entries: await listLeaderboard(category, selectedMode) };
};
