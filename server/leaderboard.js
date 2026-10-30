import { parseStoredJson, pipeline, redis } from './redis.js';
import { cleanName } from './http.js';
import { playerIdFor } from './session.js';
import { parseProfile } from './profile.js';
import { deriveProgression } from './progression.js';
import { prestigeKeyFor, migrateLegacyPrestige } from './prestige-state.js';

const validModes = new Set(['gauntlet', 'daily', 'speed']);
const cleanMode = (mode) => validModes.has(mode) ? mode : 'gauntlet';
// Season 0 — Public-bank Alpha keeps the original (legacy) keys so history and
// XP are preserved. Each private-bank season gets its own separate board.
const validSeasons = new Set(['legacy', 'season-1']);
const cleanSeason = (season) => validSeasons.has(season) ? season : 'legacy';
const seasonPrefix = (season) => cleanSeason(season) === 'legacy' ? 'geek:leaderboard' : `geek:leaderboard:${cleanSeason(season)}`;
export const SEASON_LABELS = Object.freeze({ legacy: 'Season 0 — Public-bank Alpha', 'season-1': 'Season 1 — Private-bank' });
const boardKey = (category, mode = 'gauntlet', season = 'legacy') => cleanMode(mode) === 'gauntlet' ? `${seasonPrefix(season)}:${category}` : `${seasonPrefix(season)}:${cleanMode(mode)}:${category}`;
const metaKey = (category, mode = 'gauntlet', season = 'legacy') => `${boardKey(category, mode, season)}:meta`;
const boardKeyFor = boardKey, metaKeyFor = metaKey;

export const listLeaderboard = async (category, mode = 'gauntlet', limit = 10, season = 'legacy') => {
  const selectedMode = cleanMode(mode);
  const boardKey = (c, m) => boardKeyFor(c, m, season), metaKey = (c, m) => metaKeyFor(c, m, season);
  const raw = await redis('ZREVRANGE', boardKey(category, selectedMode), 0, Math.min(50, Math.max(1, limit)) - 1, 'WITHSCORES');
  if (!Array.isArray(raw) || !raw.length) return [];
  const ids = raw.filter((_, index) => index % 2 === 0);
  const scores = raw.filter((_, index) => index % 2 === 1);
  const meta = await pipeline(ids.map((id) => ['HGET', metaKey(category, selectedMode), id]));
  const ranks = await pipeline(scores.map(score => ['ZCOUNT', boardKey(category, selectedMode), Number(score) + 1, '+inf']));
  const profiles = await pipeline(ids.flatMap(id => [['GET', `geek:profile:${id}`], ['GET', prestigeKeyFor(id)], ['GET', `geek:player-name:${id}`]]));
  return ids.map((id, index) => {
    const details = parseStoredJson(meta[index]) || {};
    let progression = null;
    try { if (profiles[index * 3] === null) throw new Error('PROFILE_STATE_INVALID'); const profile = parseProfile(profiles[index * 3]); progression = deriveProgression({ ...profile, prestigeState: parseStoredJson(profiles[index * 3 + 1]) || migrateLegacyPrestige(profile) }); } catch { /* A damaged rank must not fabricate progression. */ }
    return {
      rank: Number(ranks[index]) + 1,
      name: cleanName(profiles[index * 3 + 2] || details.name),
      score: Number(scores[index] || 0),
      round: Number(details.round || 1),
      mode: selectedMode,
      season: cleanSeason(season),
      seasonLabel: SEASON_LABELS[cleanSeason(season)],
      level: progression?.level ?? null,
      prestige: progression?.prestige ?? null,
      updatedAt: Number(details.updatedAt || 0)
    };
  });
};

export const leaderboardStanding = async (category, mode, playerId, season = 'legacy') => {
  const score = await redis('ZSCORE', boardKeyFor(category, mode, season), playerId);
  if (score === null) return null;
  return { score: Number(score), rank: Number(await redis('ZCOUNT', boardKeyFor(category, mode, season), Number(score) + 1, '+inf')) + 1 };
};

export const VERIFIED_SCORE_LUA = `-- geek-verified-score-v1
local previous = tonumber(redis.call('ZSCORE', KEYS[1], ARGV[1]) or '0')
if tonumber(ARGV[2]) <= previous then return 0 end
redis.call('ZADD', KEYS[1], ARGV[2], ARGV[1])
redis.call('HSET', KEYS[2], ARGV[1], ARGV[3])
return 1`;

export const recordVerifiedScore = async ({ session, category, score, round, mode = 'gauntlet', season = 'legacy' }) => {
  const selectedMode = cleanMode(mode);
  const boardKey = (c, m) => boardKeyFor(c, m, season), metaKey = (c, m) => metaKeyFor(c, m, season);
  if (!Number.isInteger(score) || score <= 0) return { improved: false, season: cleanSeason(season), entries: await listLeaderboard(category, selectedMode, 10, season) };
  const playerId = playerIdFor(session);
  const improved = Number(await redis('EVAL', VERIFIED_SCORE_LUA, 2, boardKey(category, selectedMode), metaKey(category, selectedMode), playerId, score, JSON.stringify({ name: session.name, round, mode: selectedMode, updatedAt: Date.now(), verified: true }))) === 1;
  return { improved, season: cleanSeason(season), entries: await listLeaderboard(category, selectedMode, 10, season) };
};
