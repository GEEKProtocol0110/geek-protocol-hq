import { parseStoredJson, pipeline, redis } from './redis.js';

const validModes = new Set(['gauntlet', 'daily', 'speed']);
const cleanMode = (mode) => validModes.has(mode) ? mode : 'gauntlet';
const boardKey = (category, mode = 'gauntlet') => cleanMode(mode) === 'gauntlet' ? `geek:leaderboard:${category}` : `geek:leaderboard:${cleanMode(mode)}:${category}`;
const metaKey = (category, mode = 'gauntlet') => cleanMode(mode) === 'gauntlet' ? `geek:leaderboard:${category}:meta` : `geek:leaderboard:${cleanMode(mode)}:${category}:meta`;

export const listLeaderboard = async (category, mode = 'gauntlet') => {
  const selectedMode = cleanMode(mode);
  const raw = await redis('ZREVRANGE', boardKey(category, selectedMode), 0, 9, 'WITHSCORES');
  if (!Array.isArray(raw) || !raw.length) return [];
  const ids = raw.filter((_, index) => index % 2 === 0);
  const scores = raw.filter((_, index) => index % 2 === 1);
  const meta = await pipeline(ids.map((id) => ['HGET', metaKey(category, selectedMode), id]));
  return ids.map((id, index) => {
    const details = parseStoredJson(meta[index]) || {};
    return {
      rank: index + 1,
      name: details.name || 'Guest Geek',
      score: Number(scores[index] || 0),
      round: Number(details.round || 1),
      mode: selectedMode,
      updatedAt: Number(details.updatedAt || 0)
    };
  });
};

export const recordVerifiedScore = async ({ session, category, score, round, mode = 'gauntlet' }) => {
  const selectedMode = cleanMode(mode);
  if (!Number.isInteger(score) || score <= 0) return { improved: false, entries: await listLeaderboard(category, selectedMode) };
  const previous = Number(await redis('ZSCORE', boardKey(category, selectedMode), session.id) || 0);
  if (score > previous) {
    await pipeline([
      ['ZADD', boardKey(category, selectedMode), score, session.id],
      ['HSET', metaKey(category, selectedMode), session.id, JSON.stringify({ name: session.name, round, mode: selectedMode, updatedAt: Date.now(), verified: true })]
    ], true);
  }
  return { improved: score > previous, entries: await listLeaderboard(category, selectedMode) };
};
