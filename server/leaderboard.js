import { parseStoredJson, pipeline, redis } from './redis.js';

const boardKey = (category) => `geek:leaderboard:${category}`;
const metaKey = (category) => `geek:leaderboard:${category}:meta`;

export const listLeaderboard = async (category) => {
  const raw = await redis('ZREVRANGE', boardKey(category), 0, 9, 'WITHSCORES');
  if (!Array.isArray(raw) || !raw.length) return [];
  const ids = raw.filter((_, index) => index % 2 === 0);
  const scores = raw.filter((_, index) => index % 2 === 1);
  const meta = await pipeline(ids.map((id) => ['HGET', metaKey(category), id]));
  return ids.map((id, index) => {
    const details = parseStoredJson(meta[index]) || {};
    return {
      rank: index + 1,
      name: details.name || 'Guest Geek',
      score: Number(scores[index] || 0),
      round: Number(details.round || 1),
      updatedAt: Number(details.updatedAt || 0)
    };
  });
};

export const recordVerifiedScore = async ({ session, category, score, round }) => {
  if (!Number.isInteger(score) || score <= 0) return { improved: false, entries: await listLeaderboard(category) };
  const previous = Number(await redis('ZSCORE', boardKey(category), session.id) || 0);
  if (score > previous) {
    await pipeline([
      ['ZADD', boardKey(category), score, session.id],
      ['HSET', metaKey(category), session.id, JSON.stringify({ name: session.name, round, updatedAt: Date.now(), verified: true })]
    ], true);
  }
  return { improved: score > previous, entries: await listLeaderboard(category) };
};
