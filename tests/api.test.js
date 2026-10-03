import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import sessionHandler from '../api/session.js';
import lobbiesHandler from '../api/lobbies.js';
import leaderboardHandler from '../api/leaderboard.js';
import rankedHandler from '../api/ranked.js';
import contentHandler from '../api/content.js';
import moderationHandler from '../api/moderation.js';
import rewardsHandler from '../api/rewards.js';
import payoutReviewHandler from '../api/payout-review.js';
import auditHandler from '../api/audit.js';
import identityHandler from '../api/identity.js';
import { collectiblesHandler, profileHandler } from '../server/player-api.js';
import kaspa from '@dfns/kaspa-wasm';
import { isValidKaspaMainnetAddress } from '../server/kaspa-address.js';
import { defaultProfile } from '../server/profile.js';
import { deriveProgression, recordRoundJourney } from '../server/progression.js';
import { loadQuestionBank } from '../server/questions.js';
import { studyQuestionById, studyBank } from '../server/study-curriculum.js';
import { challengePeriod, CHALLENGE_CAP } from '../server/challenge-periods.js';
import { vaultDay, vaultKey, vaultSeals } from '../server/vault.js';

const lobbyGameHandler = lobbiesHandler;

process.env.UPSTASH_REDIS_REST_URL = 'https://redis.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
process.env.CCE_ADMIN_TOKEN = 'test-cce-admin-token-123456789';
process.env.CCE_REWARD_AMOUNT = '25';
process.env.AUDIT_LOG_SECRET = 'test-audit-hmac-secret-with-at-least-32-characters';
process.env.AUDIT_ADMIN_TOKEN = 'test-audit-admin-token-123456789';
process.env.AUDIT_KEY_ID = 'test-key';
process.env.PAYOUT_REVIEW_ADMIN_TOKEN = 'test-payout-review-token-123456789';
process.env.IDENTITY_ENV = 'test';

const strings = new Map();
const hashes = new Map();
const sorted = new Map();
let vaultRedisNow = null;
let avatarRace = null;

const execute = (command) => {
  const [rawName, ...args] = command;
  const name = String(rawName).toUpperCase();
  if (name === 'PING') return 'PONG';
  if (name === 'GET') return strings.get(args[0]) ?? null;
  if (name === 'EXISTS') return strings.has(args[0]) ? 1 : 0;
  if (name === 'GETDEL') {
    const value = strings.get(args[0]) ?? null;
    strings.delete(args[0]);
    return value;
  }
  if (name === 'SET') {
    const [key, value] = args;
    const nx = args.some((item) => String(item).toUpperCase() === 'NX');
    if (nx && strings.has(key)) return null;
    strings.set(key, String(value));
    return 'OK';
  }
  if (name === 'INCR') {
    const value = Number(strings.get(args[0]) || 0) + 1;
    strings.set(args[0], String(value));
    return value;
  }
  if (name === 'EXPIRE') return 1;
  if (name === 'HSET') {
    const map = hashes.get(args[0]) || new Map();
    map.set(String(args[1]), String(args[2]));
    hashes.set(args[0], map);
    return 1;
  }
  if (name === 'HSETNX') {
    const map = hashes.get(args[0]) || new Map();
    if (map.has(String(args[1]))) return 0;
    map.set(String(args[1]), String(args[2]));
    hashes.set(args[0], map);
    return 1;
  }
  if (name === 'HINCRBY') {
    const map = hashes.get(args[0]) || new Map();
    const value = Number(map.get(String(args[1])) || 0) + Number(args[2]);
    map.set(String(args[1]), String(value));
    hashes.set(args[0], map);
    return value;
  }
  if (name === 'HGET') return hashes.get(args[0])?.get(String(args[1])) ?? null;
  if (name === 'HGETALL') return [...(hashes.get(args[0]) || new Map())].flat();
  if (name === 'HDEL') return hashes.get(args[0])?.delete(String(args[1])) ? 1 : 0;
  if (name === 'ZADD') {
    const map = sorted.get(args[0]) || new Map();
    for (let index = 1; index < args.length; index += 2) map.set(String(args[index + 1]), Number(args[index]));
    sorted.set(args[0], map);
    return 1;
  }
  if (name === 'ZSCORE') {
    const value = sorted.get(args[0])?.get(String(args[1]));
    return value === undefined ? null : String(value);
  }
  if (name === 'ZREM') return sorted.get(args[0])?.delete(String(args[1])) ? 1 : 0;
  if (name === 'ZCARD') return sorted.get(args[0])?.size || 0;
  if (name === 'ZCOUNT') {
    const min = args[1] === '-inf' ? -Infinity : Number(args[1]);
    const max = args[2] === '+inf' ? Infinity : Number(args[2]);
    return [...(sorted.get(args[0])?.values() || [])].filter((score) => score >= min && score <= max).length;
  }
  if (name === 'ZRANGEBYSCORE') {
    const min = args[1] === '-inf' ? -Infinity : Number(args[1]);
    const max = args[2] === '+inf' ? Infinity : Number(args[2]);
    return [...(sorted.get(args[0])?.entries() || [])].filter(([, score]) => score >= min && score <= max).sort((a, b) => a[1] - b[1]).map(([member]) => member);
  }
  if (name === 'ZREVRANGE') {
    const withScores = String(args[3] || '').toUpperCase() === 'WITHSCORES';
    const entries = [...(sorted.get(args[0])?.entries() || [])].sort((a, b) => b[1] - a[1]).slice(Number(args[1]), Number(args[2]) + 1);
    return withScores ? entries.flatMap(([member, score]) => [member, String(score)]) : entries.map(([member]) => member);
  }
  if (name === 'EVAL') {
    if (String(args[0]).includes('geek-avatar-patch-v1')) {
      const [key, eventKey, auditIndex, previous, next, record, sequence, eventId] = args.slice(2);
      if (avatarRace) { const update = avatarRace; avatarRace = null; update(key); }
      if ((strings.get(key) || '') !== previous) return 0;
      strings.set(key, next); execute(['SET', eventKey, record, 'NX']); execute(['ZADD', auditIndex, sequence, eventId]); return 1;
    }

    if (String(args[0]).includes('geek-vault-claim-v1')) {
      const [key, opensAt, closesAt, day, seal, id] = args.slice(2);
      const now = vaultRedisNow ?? Date.now();
      if (now < Number(opensAt) || now >= Number(closesAt)) return ['DAY_CHANGED'];
      const raw = strings.get(key);
      const state = raw ? JSON.parse(raw) : { version: 1, total: 0, lastDay: '', inventory: {}, history: [] };
      if (state.version !== 1 || !Number.isSafeInteger(state.total) || state.total < 0 || state.total >= Number.MAX_SAFE_INTEGER || typeof state.lastDay !== 'string' || !state.inventory || !state.history || Object.values(state.inventory).some(q => !Number.isSafeInteger(q) || q < 0 || q >= Number.MAX_SAFE_INTEGER) || state.lastDay > day) return ['STATE_INVALID'];
      if (state.lastDay === day) return ['ALREADY_CLAIMED', raw];
      state.total++; state.lastDay = day;
      state.inventory[seal] = Number(state.inventory[seal] || 0) + 1;
      state.history.unshift({ id, day, sealId: seal, quantity: 1, claimedAt: now });
      state.history = state.history.slice(0, 14);
      const encoded = JSON.stringify(state); strings.set(key, encoded);
      return ['CLAIMED', encoded];
    }

    if (String(args[0]).includes('geek-challenge-start-v1')) {
      const [key, starts, run, ttl, capacity, now, closesAt] = args.slice(2);
      if (strings.has(key)) return 0;
      if (Number(now) >= Number(closesAt)) return -2;
      if (Number(strings.get(starts) || 0) >= Number(capacity)) return -1;
      strings.set(key, run); execute(['INCR', starts]); return 1;
    }
    if (String(args[0]).includes('geek-challenge-transition-v1')) {
      const [key, board, meta, previous, next, ttl, now, closesAt, complete, score, playerId, details] = args.slice(2);
      if (strings.get(key) !== previous) return 0;
      if (Number(now) >= Number(closesAt)) return -1;
      strings.set(key, next);
      if (complete === '1') { execute(['ZADD', board, score, playerId]); execute(['HSET', meta, playerId, details]); }
      return 1;
    }
    if (String(args[0]).includes('geek-study-state-v2')) {
      const [key, progressKey, previous, next, ttl, concept, correct, runId, now, retention] = args.slice(2);
      if (strings.get(key) !== previous) return 0;
      if (concept) {
        const record = JSON.parse(execute(['HGET', progressKey, concept]) || '{"attempts":0,"correctAttempts":0,"streak":0}');
        record.attempts++;
        record.correctAttempts += correct === '1' ? 1 : 0;
        if (correct !== '1') record.streak = 0;
        else if (record.lastRunId !== runId) record.streak++;
        record.lastCorrect = correct === '1'; record.lastRunId = runId; record.lastAnsweredAt = Number(now);
        execute(['HSET', progressKey, concept, JSON.stringify(record)]);
      }
      strings.set(key, next);
      return 1;
    }
    if (String(args[0]).includes('geek-lobby-join-v1')) {
      const keys = args.slice(2, 6);
      const values = args.slice(6);
      if (!strings.has(keys[0])) return 'ROOM_NOT_FOUND';
      const previousPresence = execute(['ZSCORE', keys[1], values[0]]);
      const count = execute(['ZCOUNT', keys[1], values[3], '+inf']);
      if ((previousPresence === null || Number(previousPresence) < Number(values[3])) && count >= Number(values[6])) return 'ROOM_FULL';
      const previous = execute(['HGET', keys[2], values[0]]);
      const joinedAt = previous ? JSON.parse(previous).joinedAt : Number(values[1]);
      execute(['ZADD', keys[1], values[1], values[0]]);
      execute(['HSET', keys[2], values[0], JSON.stringify({ name: values[2], joinedAt, host: values[7] === '1' })]);
      execute(['ZADD', keys[3], values[1], values[5]]);
      return 'OK';
    }
    if (String(args[0]).includes('geek-lobby-heartbeat-v1')) {
      const keys = args.slice(2, 5);
      const values = args.slice(5);
      const presence = execute(['ZSCORE', keys[1], values[0]]);
      if (!strings.has(keys[0])) return 'ROOM_NOT_FOUND';
      if (presence === null || Number(presence) < Number(values[3]) || !execute(['HGET', keys[2], values[0]])) return 'ROOM_NOT_MEMBER';
      execute(['ZADD', keys[1], values[1], values[0]]);
      return 'OK';
    }
    if (String(args[0]).includes('geek-lobby-answer-v1')) {
      const key = args[2];
      const values = args.slice(3);
      const match = JSON.parse(strings.get(key) || 'null');
      if (!match) return 'MATCH_NOT_FOUND';
      const index = Number(values[1]);
      const now = Number(values[2]);
      if (match.id !== values[0]) return 'MATCH_CHANGED';
      if (index < 0 || index >= match.questions.length || now < match.startsAt + index * match.questionMs || now >= match.startsAt + (index + 1) * match.questionMs) return 'MATCH_QUESTION_CLOSED';
      const player = match.players[values[3]];
      if (!player) return 'MATCH_NOT_PLAYER';
      if (player.answers[String(index)]) return 'MATCH_ANSWER_RECORDED';
      const correct = Number(values[4]) === match.questions[index].correctIndex;
      const scoreAdded = correct ? 1000 + Math.floor((match.startsAt + (index + 1) * match.questionMs - now) / 1000) * 30 : 0;
      player.score += scoreAdded;
      player.answers[String(index)] = { correct, scoreAdded };
      strings.set(key, JSON.stringify(match));
      return JSON.stringify({ correct, scoreAdded, score: player.score });
    }
    if (String(args[0]).includes('geek-sticker-trade-create-v1')) {
      const keyCount = Number(args[1]);
      const keys = args.slice(2, 2 + keyCount);
      const values = args.slice(2 + keyCount);
      const profile = JSON.parse(strings.get(keys[0]) || 'null');
      if (!profile) return 'PROFILE_MISSING';
      profile.stickerInventory ||= {};
      profile.stickerReserved ||= {};
      const owned = Number(profile.stickerInventory[values[0]] || 0);
      const reserved = Number(profile.stickerReserved[values[0]] || 0);
      if (owned - reserved < Number(values[1])) return 'INSUFFICIENT_STICKERS';
      profile.stickerReserved[values[0]] = reserved + Number(values[1]);
      strings.set(keys[0], JSON.stringify(profile));
      strings.set(keys[1], String(values[2]));
      execute(['ZADD', keys[2], values[4], values[5]]);
      return 'OK';
    }
    if (String(args[0]).includes('geek-sticker-trade-accept-v1')) {
      const keyCount = Number(args[1]);
      const keys = args.slice(2, 2 + keyCount);
      const values = args.slice(2 + keyCount);
      const offer = JSON.parse(strings.get(keys[0]) || 'null');
      if (!offer) return 'TRADE_NOT_FOUND';
      if (offer.status !== 'open') return 'TRADE_CLOSED';
      if (Number(offer.expiresAt) <= Number(values[0])) return 'TRADE_EXPIRED';
      if (offer.sellerId === String(values[1])) return 'OWN_TRADE';
      const seller = JSON.parse(strings.get(keys[1]) || 'null');
      const buyer = JSON.parse(strings.get(keys[2]) || 'null');
      if (!seller || !buyer) return 'PROFILE_MISSING';
      seller.stickerInventory ||= {}; seller.stickerReserved ||= {};
      buyer.stickerInventory ||= {}; buyer.stickerReserved ||= {};
      const sellerOwned = Number(seller.stickerInventory[offer.giveSticker] || 0);
      const sellerReserved = Number(seller.stickerReserved[offer.giveSticker] || 0);
      if (sellerOwned < offer.giveQuantity || sellerReserved < offer.giveQuantity) return 'SELLER_INVENTORY_CHANGED';
      const buyerOwned = Number(buyer.stickerInventory[offer.wantSticker] || 0);
      const buyerReserved = Number(buyer.stickerReserved[offer.wantSticker] || 0);
      if (buyerOwned - buyerReserved < offer.wantQuantity) return 'INSUFFICIENT_STICKERS';
      seller.stickerInventory[offer.giveSticker] = sellerOwned - offer.giveQuantity;
      seller.stickerReserved[offer.giveSticker] = sellerReserved - offer.giveQuantity;
      seller.stickerInventory[offer.wantSticker] = Number(seller.stickerInventory[offer.wantSticker] || 0) + offer.wantQuantity;
      buyer.stickerInventory[offer.wantSticker] = buyerOwned - offer.wantQuantity;
      buyer.stickerInventory[offer.giveSticker] = Number(buyer.stickerInventory[offer.giveSticker] || 0) + offer.giveQuantity;
      offer.status = 'accepted';
      strings.set(keys[1], JSON.stringify(seller));
      strings.set(keys[2], JSON.stringify(buyer));
      strings.set(keys[0], JSON.stringify(offer));
      execute(['ZREM', keys[3], offer.id]);
      return 'OK';
    }
    if (String(args[0]).includes('geek-sticker-trade-cancel-v1')) {
      const keyCount = Number(args[1]);
      const keys = args.slice(2, 2 + keyCount);
      const values = args.slice(2 + keyCount);
      const offer = JSON.parse(strings.get(keys[0]) || 'null');
      if (!offer) return 'TRADE_NOT_FOUND';
      if (offer.status !== 'open') return 'TRADE_CLOSED';
      if (offer.sellerId !== String(values[0])) return 'TRADE_FORBIDDEN';
      const profile = JSON.parse(strings.get(keys[1]) || 'null');
      if (!profile) return 'PROFILE_MISSING';
      profile.stickerReserved ||= {};
      profile.stickerReserved[offer.giveSticker] = Math.max(0, Number(profile.stickerReserved[offer.giveSticker] || 0) - offer.giveQuantity);
      offer.status = 'cancelled';
      strings.set(keys[1], JSON.stringify(profile));
      strings.set(keys[0], JSON.stringify(offer));
      execute(['ZREM', keys[2], offer.id]);
      return 'OK';
    }
    if (String(args[0]).includes('geek-identity-bind-v1')) {
      const keyCount = Number(args[1]);
      const keys = args.slice(2, 2 + keyCount);
      const values = args.slice(2 + keyCount);
      const wallet = strings.get(keys[0]);
      const player = strings.get(keys[1]);
      if (wallet && wallet !== String(values[0])) return 'WALLET_BOUND';
      if ((!values[1] && player) || (values[1] && player !== String(values[1]))) return 'PLAYER_CONFLICT';
      if (strings.has(keys[3])) return 'AUDIT_CONFLICT';
      strings.set(keys[0], String(values[0]));
      strings.set(keys[1], String(values[2]));
      strings.set(keys[2], String(values[3]));
      strings.set(keys[3], String(values[5]));
      const index = sorted.get(keys[4]) || new Map();
      index.set(String(values[7]), Number(values[6]));
      sorted.set(keys[4], index);
      return 'OK';
    }
    const keyCount = Number(args[1]);
    const keys = args.slice(2, 2 + keyCount);
    const values = args.slice(2 + keyCount);
    const added = execute(['HSETNX', keys[0], values[0], values[1]]);
    if (added === 1) {
      execute(['HINCRBY', keys[1], 'earned', values[2]]);
      execute(['HINCRBY', keys[1], 'used', 1]);
      const stored = strings.get(keys[2]);
      if (stored) {
        const submission = JSON.parse(stored);
        submission.firstUsedAt = Number(values[3]);
        submission.updatedAt = Number(values[3]);
        submission.reward.status = 'earned';
        strings.set(keys[2], JSON.stringify(submission));
      }
    }
    return added;
  }
  throw new Error(`Unsupported Redis command: ${name}`);
};

global.fetch = async (url, options) => {
  const body = JSON.parse(options.body);
  const isBatch = url.endsWith('/pipeline') || url.endsWith('/multi-exec');
  const payload = isBatch ? body.map((command) => ({ result: execute(command) })) : { result: execute(body) };
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

const request = (method, body = undefined, cookie = '', query = {}, headers = {}) => ({
  method,
  body,
  query,
  headers: { cookie, ...headers }
});

const response = () => ({
  statusCode: 200,
  headers: {},
  body: undefined,
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
  end() { return this; }
});

const startSession = async (displayName) => {
  const res = response();
  await sessionHandler(request('POST', { displayName }, '', {}, { 'user-agent': `test-session:${displayName}` }), res);
  assert.equal(res.statusCode, 200);
  return res.headers['set-cookie'].split(';')[0];
};

const sessionIdFromCookie = (cookie) => cookie.split('=')[1];

test('levels, prestige, category mastery, and journey history derive from server XP', () => {
  const profile = defaultProfile();
  profile.xp = 6_250;
  profile.totalCorrect = 10;
  recordRoundJourney(profile, {
    runId: 'server-run', mode: 'gauntlet', category: 'kaspa', round: 1,
    correct: 10, answered: 10, score: 14_000, xpEarned: 250, reward: 100, maxStreak: 10
  });
  const progression = deriveProgression(profile);
  assert.equal(progression.prestige, 1);
  assert.equal(progression.level, 1);
  assert.equal(profile.categoryStats.kaspa.correct, 10);
  assert.equal(profile.totalQuestions, 10);
  assert.equal(profile.longestStreak, 10);
  assert.deepEqual(profile.journey.map((event) => event.type), ['prestige', 'sticker', 'sticker', 'sticker', 'round']);

  for (let round = 2; round <= 100; round += 1) {
    profile.xp += 10;
    recordRoundJourney(profile, {
      runId: `server-run-${round}`, mode: 'daily', category: 'technology', round,
      correct: 1, answered: 1, score: 1_000, xpEarned: 10, reward: 0, maxStreak: 1
    });
  }
  assert.equal(profile.journey.length, 80);
});

test('the 500-Geek blueprint and avatar unlocks are honest and server-controlled', async () => {
  const cookie = await startSession('Collector Geek');
  const getRes = response();
  await collectiblesHandler(request('GET', undefined, cookie), getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.collection.blueprint.supply, 500);
  assert.equal(getRes.body.collection.blueprint.tiers.reduce((sum, tier) => sum + tier.count, 0), 500);
  assert.deepEqual(getRes.body.collection.blueprint.anchors.map((anchor) => anchor.name), ['GIGA', 'A.C.E.']);
  assert.equal(getRes.body.collection.onChainTransfersEnabled, false);
  assert.equal(getRes.body.collection.avatars[0].owned, true);
  assert.equal(getRes.body.collection.avatars[1].owned, false);

  const lockedRes = response();
  await collectiblesHandler(request('POST', { action: 'select-avatar', avatarId: 'protocol-core' }, cookie), lockedRes);
  assert.equal(lockedRes.statusCode, 403);
  assert.equal(lockedRes.body.code, 'AVATAR_LOCKED');
});

test('sticker offers reserve inventory and settle both players atomically', async () => {
  const sellerCookie = await startSession('Sticker Seller');
  const buyerCookie = await startSession('Sticker Buyer');
  const sellerId = sessionIdFromCookie(sellerCookie);
  const buyerId = sessionIdFromCookie(buyerCookie);
  strings.set(`geek:profile:${sellerId}`, JSON.stringify({ ...defaultProfile(), stickerInventory: { 'giga-core': 2 } }));
  strings.set(`geek:profile:${buyerId}`, JSON.stringify({ ...defaultProfile(), stickerInventory: { 'kaspa-k': 2 } }));

  const createRes = response();
  await collectiblesHandler(request('POST', { action: 'create-trade', giveSticker: 'giga-core', giveQuantity: 2, wantSticker: 'kaspa-k', wantQuantity: 1 }, sellerCookie), createRes);
  assert.equal(createRes.statusCode, 200);
  assert.equal(createRes.body.trades.length, 1);
  assert.equal(createRes.body.collection.stickers.find((item) => item.id === 'giga-core').available, 0);
  const tradeId = createRes.body.trades[0].id;

  const oversellRes = response();
  await collectiblesHandler(request('POST', { action: 'create-trade', giveSticker: 'giga-core', giveQuantity: 1, wantSticker: 'kaspa-k', wantQuantity: 1 }, sellerCookie), oversellRes);
  assert.equal(oversellRes.statusCode, 409);
  assert.equal(oversellRes.body.code, 'STICKER_INSUFFICIENT_STICKERS');

  const ownRes = response();
  await collectiblesHandler(request('POST', { action: 'accept-trade', tradeId }, sellerCookie), ownRes);
  assert.equal(ownRes.statusCode, 409);
  assert.equal(ownRes.body.code, 'STICKER_OWN_TRADE');

  const acceptRes = response();
  await collectiblesHandler(request('POST', { action: 'accept-trade', tradeId }, buyerCookie), acceptRes);
  assert.equal(acceptRes.statusCode, 200);
  assert.equal(acceptRes.body.trades.length, 0);
  const seller = JSON.parse(strings.get(`geek:profile:${sellerId}`));
  const buyer = JSON.parse(strings.get(`geek:profile:${buyerId}`));
  assert.equal(seller.stickerInventory['giga-core'], 0);
  assert.equal(seller.stickerReserved['giga-core'], 0);
  assert.equal(seller.stickerInventory['kaspa-k'], 1);
  assert.equal(buyer.stickerInventory['kaspa-k'], 1);
  assert.equal(buyer.stickerInventory['giga-core'], 2);
});

test('cancelling a sticker offer releases the reserved inventory', async () => {
  const cookie = await startSession('Cancel Geek');
  const playerId = sessionIdFromCookie(cookie);
  strings.set(`geek:profile:${playerId}`, JSON.stringify({ ...defaultProfile(), stickerInventory: { 'dag-node': 1 } }));
  const createRes = response();
  await collectiblesHandler(request('POST', { action: 'create-trade', giveSticker: 'dag-node', giveQuantity: 1, wantSticker: 'ace-eye', wantQuantity: 1 }, cookie), createRes);
  const cancelRes = response();
  await collectiblesHandler(request('POST', { action: 'cancel-trade', tradeId: createRes.body.trades[0].id }, cookie), cancelRes);
  assert.equal(cancelRes.statusCode, 200);
  assert.equal(cancelRes.body.trades.length, 0);
  assert.equal(cancelRes.body.collection.stickers.find((item) => item.id === 'dag-node').available, 1);
});

test('expired sticker offers release reservations instead of stranding inventory', async () => {
  const cookie = await startSession('Expiry Geek');
  const playerId = sessionIdFromCookie(cookie);
  strings.set(`geek:profile:${playerId}`, JSON.stringify({ ...defaultProfile(), stickerInventory: { 'signal-verified': 1 } }));
  const createRes = response();
  await collectiblesHandler(request('POST', { action: 'create-trade', giveSticker: 'signal-verified', giveQuantity: 1, wantSticker: 'toccata', wantQuantity: 1 }, cookie), createRes);
  const tradeId = createRes.body.trades[0].id;
  const tradeKey = `geek:sticker-trade:${tradeId}`;
  const offer = JSON.parse(strings.get(tradeKey));
  offer.expiresAt = Date.now() - 1;
  strings.set(tradeKey, JSON.stringify(offer));
  sorted.get('geek:sticker-trades:open').set(tradeId, offer.expiresAt);

  const getRes = response();
  await collectiblesHandler(request('GET', undefined, cookie), getRes);
  assert.equal(getRes.statusCode, 200);
  assert.equal(getRes.body.trades.length, 0);
  assert.equal(getRes.body.collection.stickers.find((item) => item.id === 'signal-verified').available, 1);
});

test('sessions, live rooms, and server-authoritative leaderboard work together', async () => {
  const hostCookie = await startSession('Host Geek');
  const guestCookie = await startSession('Guest Geek');

  const createRes = response();
  await lobbiesHandler(request('POST', { action: 'create', name: 'Kaspa Lab', category: 'kaspa', seats: 4 }, hostCookie), createRes);
  assert.equal(createRes.statusCode, 201);
  assert.match(createRes.body.room.code, /^GEEK-[A-Z2-9]{6}$/);
  assert.equal(createRes.body.room.online, 1);
  assert.equal('hostId' in createRes.body.room, false);

  const code = createRes.body.room.code;
  const joinRes = response();
  await lobbiesHandler(request('POST', { action: 'join', code }, guestCookie), joinRes);
  assert.equal(joinRes.body.room.online, 2);
  assert.deepEqual(joinRes.body.room.members.map((member) => member.name).sort(), ['Guest Geek', 'Host Geek']);

  const listRes = response();
  await lobbiesHandler(request('GET'), listRes);
  assert.equal(listRes.body.rooms[0].code, code);
  assert.equal(listRes.body.rooms[0].online, 2);

  const startRes = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa' }, hostCookie), startRes);
  assert.equal(startRes.statusCode, 201);
  assert.equal(startRes.body.verified, true);
  assert.equal('answer' in startRes.body.question, false);
  assert.equal('correctIndex' in startRes.body.question, false);
  assert.equal(existsSync(new URL('../public/play/assets/kaspa-questions.json', import.meta.url)), false);

  let rankedPayload = startRes.body;
  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    const privateQuestion = loadQuestionBank('kaspa').questions.find((item) => item.prompt === rankedPayload.question.prompt);
    const correctAnswer = privateQuestion.options[privateQuestion.correctIndex];
    const selectedIndex = rankedPayload.question.options.indexOf(correctAnswer);
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
    }, hostCookie), answerRes);
    assert.equal(answerRes.statusCode, 200);
    assert.equal(answerRes.body.result.correct, true);
    rankedPayload = answerRes.body;
    if (questionNumber === 1) {
      const retryRes = response();
      await rankedHandler(request('POST', {
        action: 'answer', runId: rankedPayload.run.id, questionToken: startRes.body.question.token, selectedIndex: (selectedIndex + 1) % 4
      }, hostCookie), retryRes);
      assert.equal(retryRes.statusCode, 200);
      assert.equal(retryRes.body.result.correct, true);
      assert.equal(retryRes.body.run.roundScore, rankedPayload.run.roundScore);
    }
    if (questionNumber < 10) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: rankedPayload.run.id }, hostCookie), nextRes);
      assert.equal(nextRes.statusCode, 200);
      rankedPayload = nextRes.body;
    }
  }
  assert.equal(rankedPayload.roundResult.correct, 10);
  assert.equal(rankedPayload.run.status, 'between-rounds');
  assert.equal(rankedPayload.profile.journey.some((event) => event.type === 'round'), true);
  assert.equal(rankedPayload.profile.categoryStats.kaspa.correct, 10);
  assert.equal(rankedPayload.profile.totalQuestions, 10);
  assert.equal(rankedPayload.profile.progression.level >= 1, true);

  const finishRes = response();
  await rankedHandler(request('POST', { action: 'finish', runId: rankedPayload.run.id }, hostCookie), finishRes);
  assert.equal(finishRes.statusCode, 200);
  assert.equal(finishRes.body.leaderboard.entries[0].name, 'Host Geek');
  assert.ok(finishRes.body.leaderboard.entries[0].score > 0);

  const profileRes = response();
  await profileHandler(request('GET', undefined, hostCookie), profileRes);
  assert.equal(profileRes.statusCode, 200);
  assert.equal(profileRes.body.verified, true);
  assert.equal(profileRes.body.profile.player.name, 'Host Geek');
  assert.equal(profileRes.body.profile.stats.totalRuns, 1);
  assert.equal(profileRes.body.profile.stats.totalQuestions, 10);
  assert.equal(profileRes.body.profile.categories.find((category) => category.key === 'kaspa').correct, 10);
  assert.equal(profileRes.body.profile.journey.at(-1).type, 'round');

  const boardRes = response();
  await leaderboardHandler(request('GET', undefined, '', { category: 'kaspa' }), boardRes);
  assert.equal(boardRes.body.entries.length, 1);
  assert.equal(boardRes.body.verified, true);
  assert.equal(boardRes.body.entries[0].round, 1);

  const forgedScoreRes = response();
  await leaderboardHandler(request('POST', { category: 'kaspa', score: 250000, round: 10 }, hostCookie), forgedScoreRes);
  assert.equal(forgedScoreRes.statusCode, 405);
});

test('shared lobby round locks its roster and answers, with scores decided by the server', async () => {
  const hostCookie = await startSession('Match Host');
  const guestCookie = await startSession('Match Guest');
  const outsiderCookie = await startSession('Late Visitor');
  const created = response();
  await lobbiesHandler(request('POST', { action: 'create', seats: 2, category: 'kaspa' }, hostCookie), created);
  assert.equal(created.statusCode, 201);
  const code = created.body.room.code;

  const earlyStart = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-start' }, hostCookie), earlyStart);
  assert.equal(earlyStart.statusCode, 409);
  const unjoinedHeartbeat = response();
  await lobbiesHandler(request('POST', { code, action: 'heartbeat' }, outsiderCookie), unjoinedHeartbeat);
  assert.equal(unjoinedHeartbeat.statusCode, 403);

  const joined = response();
  await lobbiesHandler(request('POST', { code, action: 'join' }, guestCookie), joined);
  assert.equal(joined.body.room.isHost, false);
  const full = response();
  await lobbiesHandler(request('POST', { code, action: 'join' }, outsiderCookie), full);
  assert.equal(full.statusCode, 409);

  const nonHostStart = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-start' }, guestCookie), nonHostStart);
  assert.equal(nonHostStart.statusCode, 403);
  const started = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-start' }, hostCookie), started);
  assert.equal(started.statusCode, 201);
  assert.equal(started.body.match.state, 'starting');
  assert.equal(started.body.match.question, null);
  assert.equal(started.body.match.scores.length, 2);
  assert.equal('correctIndex' in started.body.match, false);

  const replayStart = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-start' }, hostCookie), replayStart);
  assert.equal(replayStart.statusCode, 409);

  const key = `geek:lobby:${code}:match`;
  const privateMatch = JSON.parse(strings.get(key));
  privateMatch.startsAt = Date.now() - 1_000;
  strings.set(key, JSON.stringify(privateMatch));
  const questionView = response();
  await lobbyGameHandler(request('GET', undefined, guestCookie, { code, game: '1' }), questionView);
  assert.equal(questionView.statusCode, 200);
  assert.equal(questionView.body.match.state, 'playing');
  assert.equal(questionView.body.match.questionNumber, 1);
  assert.equal('correctIndex' in questionView.body.match.question, false);
  const correct = privateMatch.questions[0].correctIndex;

  const outsiderAnswer = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-answer', questionNumber: 1, selectedIndex: correct }, outsiderCookie), outsiderAnswer);
  assert.equal(outsiderAnswer.statusCode, 403);
  const attempts = [response(), response()];
  await Promise.all(attempts.map((res) => lobbyGameHandler(request('POST', { code, action: 'game-answer', questionNumber: 1, selectedIndex: correct, score: 1_000_000 }, guestCookie), res)));
  assert.deepEqual(attempts.map((res) => res.statusCode).sort(), [200, 409]);
  assert.equal(attempts.find((res) => res.statusCode === 200).body.result.correct, true);
  const updated = JSON.parse(strings.get(key));
  assert.ok(updated.players[sessionIdFromCookie(guestCookie)].score > 0);
  assert.ok(updated.players[sessionIdFromCookie(guestCookie)].score < 2_000);

  updated.startsAt = Date.now() - updated.questionMs * updated.questions.length - 100;
  strings.set(key, JSON.stringify(updated));
  const expired = response();
  await lobbyGameHandler(request('POST', { code, action: 'game-answer', questionNumber: 1, selectedIndex: correct }, hostCookie), expired);
  assert.equal(expired.statusCode, 409);
  const final = response();
  await lobbyGameHandler(request('GET', undefined, hostCookie, { code, game: '1' }), final);
  assert.equal(final.body.match.state, 'finished');
  assert.equal(final.body.match.scores[0].name, 'Match Guest');
});

test('community questions move through review, enter ranked play, and earn once on first use', async () => {
  const contributorCookie = await startSession('Question Smith');
  const playerCookie = await startSession('CCE Tester');
  const question = {
    action: 'submit',
    displayName: 'Question Smith',
    category: 'kaspa',
    difficulty: 'easy',
    topic: 'Consensus',
    prompt: 'What does GHOSTDAG preserve when Kaspa receives parallel blocks?',
    options: ['Useful proof-of-work', 'Only the oldest block', 'Private account balances', 'A validator committee'],
    correctIndex: 0,
    explanation: 'GHOSTDAG orders parallel blocks so useful proof-of-work can remain in the blockDAG.',
    source: 'https://docs.kaspa.org/',
    original: true
  };

  const submitRes = response();
  await contentHandler(request('POST', question, contributorCookie), submitRes);
  assert.equal(submitRes.statusCode, 201);
  assert.equal(submitRes.body.submission.status, 'submitted');
  assert.equal(submitRes.body.stats.submitted, 1);
  assert.equal(submitRes.body.stats.earned, 0);
  const submissionId = submitRes.body.submission.id;

  const deniedRes = response();
  await moderationHandler(request('GET', undefined, '', {}, { 'x-cce-admin': 'wrong-token' }), deniedRes);
  assert.equal(deniedRes.statusCode, 403);

  const moderatorHeaders = { 'x-cce-admin': process.env.CCE_ADMIN_TOKEN };
  const approveRes = response();
  await moderationHandler(request('POST', { action: 'approve', id: submissionId, note: 'Source and wording checked.' }, '', {}, moderatorHeaders), approveRes);
  assert.equal(approveRes.body.submission.status, 'approved');

  const publishRes = response();
  await moderationHandler(request('POST', { action: 'publish', id: submissionId }, '', {}, moderatorHeaders), publishRes);
  assert.equal(publishRes.body.submission.status, 'published');

  const startRes = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa' }, playerCookie), startRes);
  assert.equal(startRes.statusCode, 201);
  let rankedPayload = startRes.body;
  let communityWasUsed = false;
  for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
    const isCommunityQuestion = rankedPayload.question.prompt === question.prompt;
    const privateQuestion = isCommunityQuestion
      ? question
      : loadQuestionBank('kaspa').questions.find((item) => item.prompt === rankedPayload.question.prompt);
    const correctAnswer = privateQuestion.options[privateQuestion.correctIndex];
    const selectedIndex = rankedPayload.question.options.indexOf(correctAnswer);
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
    }, playerCookie), answerRes);
    assert.equal(answerRes.statusCode, 200);
    if (isCommunityQuestion) {
      communityWasUsed = true;
      assert.equal(answerRes.body.result.contributorCredit, true);
      assert.equal(answerRes.body.result.sourceState, 'Community-reviewed contribution');
      const retryRes = response();
      await rankedHandler(request('POST', {
        action: 'answer', runId: rankedPayload.run.id, questionToken: rankedPayload.question.token, selectedIndex
      }, playerCookie), retryRes);
      assert.equal(retryRes.body.result.contributorCredit, true);
    }
    rankedPayload = answerRes.body;
    if (questionNumber < 10) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: rankedPayload.run.id }, playerCookie), nextRes);
      rankedPayload = nextRes.body;
    }
  }
  assert.equal(communityWasUsed, true);

  const dashboardRes = response();
  await contentHandler(request('GET', undefined, contributorCookie), dashboardRes);
  assert.equal(dashboardRes.body.stats.accepted, 1);
  assert.equal(dashboardRes.body.stats.used, 1);
  assert.equal(dashboardRes.body.stats.earned, 25);
  assert.equal(dashboardRes.body.stats.paid, 0);
  assert.equal(dashboardRes.body.stats.settlement, 'launch-gated');
  assert.equal(dashboardRes.body.submissions[0].reward.status, 'earned');
});

test('a player can register any valid Kaspa mainnet payout address without exposing wallet secrets', async () => {
  const cookie = await startSession('Open Wallet Geek');
  const address = 'kaspa:qrahfynex4wsv6u283mvr77yc65ks9ze3assz3w4zegashgwupu6umagljg84';
  assert.equal(isValidKaspaMainnetAddress(address), true);
  assert.equal(isValidKaspaMainnetAddress(address.replace(/.$/, 'q')), false);
  assert.equal(isValidKaspaMainnetAddress(address.replace('kaspa:', 'kaspatest:')), false);

  const rejectedRes = response();
  await rewardsHandler(request('POST', { address, acknowledged: false }, cookie), rejectedRes);
  assert.equal(rejectedRes.statusCode, 400);

  const saveRes = response();
  await rewardsHandler(request('POST', { address, acknowledged: true }, cookie), saveRes);
  assert.equal(saveRes.statusCode, 200);
  assert.equal(saveRes.body.payout.address, address);
  assert.equal(saveRes.body.payout.withdrawalsEnabled, false);
  assert.equal(saveRes.body.payout.ownershipVerified, false);
  assert.equal(saveRes.body.payout.settlementEligible, false);
  assert.equal(saveRes.body.payout.review.required, true);
  assert.deepEqual(saveRes.body.payout.review.reasons, ['identity-not-linked', 'destination-ownership-unverified']);
  assert.equal(saveRes.body.payout.notification.reviewRequired, true);
  assert.match(saveRes.body.payout.notification.id, /^pnot_[a-f0-9]{20}$/);
  assert.equal(saveRes.body.payout.version, 1);
  assert.ok(saveRes.body.payout.changeCooldownUntil > saveRes.body.payout.configuredAt);
  assert.match(saveRes.body.auditReceipt.eventId, /^aud_[a-f0-9]{24}$/);
  assert.equal(saveRes.body.auditReceipt.integrity, 'hmac-sha256');
  assert.equal('privateKey' in saveRes.body, false);
  assert.equal('mnemonic' in saveRes.body, false);

  const getRes = response();
  await rewardsHandler(request('GET', undefined, cookie), getRes);
  assert.equal(getRes.body.payout.address, address);
  assert.equal(getRes.body.payout.network, 'kaspa-mainnet');
  assert.equal(getRes.body.payout.review.reference, saveRes.body.payout.review.reference);

  const deniedReview = response();
  await payoutReviewHandler(request('GET', undefined, '', {}, { 'x-payout-review-admin': 'wrong-token' }), deniedReview);
  assert.equal(deniedReview.statusCode, 403);

  const reviewerHeaders = { 'x-payout-review-admin': process.env.PAYOUT_REVIEW_ADMIN_TOKEN };
  const queueRes = response();
  await payoutReviewHandler(request('GET', undefined, '', {}, reviewerHeaders), queueRes);
  assert.equal(queueRes.statusCode, 200);
  const queued = queueRes.body.queue.find((item) => item.id === saveRes.body.payout.review.reference);
  assert.equal(queued.status, 'pending');
  assert.equal('playerId' in queued, false);
  assert.equal('addressHash' in queued, false);

  const decisionRes = response();
  await payoutReviewHandler(request('POST', {
    action: 'approve',
    id: queued.id,
    note: 'Destination reviewed for Alpha evidence only.'
  }, '', {}, reviewerHeaders), decisionRes);
  assert.equal(decisionRes.statusCode, 200);
  assert.equal(decisionRes.body.review.status, 'approved');
  assert.equal(decisionRes.body.settlementEnabled, false);

  const reviewedProfile = response();
  await rewardsHandler(request('GET', undefined, cookie), reviewedProfile);
  assert.equal(reviewedProfile.body.payout.review.status, 'approved');
  assert.equal(reviewedProfile.body.payout.review.required, false);
  assert.equal(reviewedProfile.body.payout.settlementEligible, false);
});

test('wallet proof challenges are bound to the exact requesting origin', async () => {
  const key = new kaspa.PrivateKey('5'.padStart(64, '0'));
  const privateKey = key.toString();
  const publicKey = key.toPublicKey().toString();
  const address = key.toAddress(kaspa.NetworkType.Mainnet).toString();
  const cookie = await startSession('Origin Bound Geek');
  const identityRequest = (method, body, host) => request(method, body, cookie, {}, { host, origin: `https://${host}`, 'user-agent': 'origin-test' });

  const issued = response();
  await identityHandler(identityRequest('POST', { action: 'challenge', intent: 'identity', address, publicKey }, 'www.geekprotocol.xyz'), issued);
  assert.equal(issued.statusCode, 201);
  assert.match(issued.body.challenge.message, /Origin: https:\/\/www\.geekprotocol\.xyz/);

  const crossOrigin = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: issued.body.challenge.challengeId,
    signature: kaspa.signMessage({ message: issued.body.challenge.message, privateKey })
  }, 'geekprotocol.xyz'), crossOrigin);
  assert.equal(crossOrigin.statusCode, 409);
  assert.equal(crossOrigin.body.code, 'IDENTITY_ORIGIN_MISMATCH');

  const fresh = response();
  await identityHandler(identityRequest('POST', { action: 'challenge', intent: 'identity', address, publicKey }, 'www.geekprotocol.xyz'), fresh);
  const verified = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: fresh.body.challenge.challengeId,
    signature: kaspa.signMessage({ message: fresh.body.challenge.message, privateKey })
  }, 'www.geekprotocol.xyz'), verified);
  assert.equal(verified.statusCode, 200);
  assert.equal(verified.body.identity.address, address);
});

test('a server-verified wallet proof links and recovers one durable player identity', async () => {
  const privateKey = '1'.padStart(64, '0');
  const key = new kaspa.PrivateKey(privateKey);
  const publicKey = key.toPublicKey().toString();
  const address = key.toAddress(kaspa.NetworkType.Mainnet).toString();
  const firstCookie = await startSession('Recoverable Geek');
  const identityRequest = (method, body, cookie) => request(method, body, cookie, {}, { host: 'geekprotocol.xyz', 'user-agent': 'identity-test' });
  const sign = (message) => kaspa.signMessage({ message, privateKey });

  const challengeRes = response();
  await identityHandler(identityRequest('POST', { action: 'challenge', intent: 'identity', address, publicKey }, firstCookie), challengeRes);
  assert.equal(challengeRes.statusCode, 201);
  assert.equal(challengeRes.body.challenge.intent, 'link');
  assert.equal(challengeRes.body.challenge.transactionRequested, false);
  assert.match(challengeRes.body.challenge.message, /does not authorize a transaction/i);

  const linkRes = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: challengeRes.body.challenge.challengeId,
    signature: sign(challengeRes.body.challenge.message)
  }, firstCookie), linkRes);
  assert.equal(linkRes.statusCode, 200);
  assert.equal(linkRes.body.identity.linked, true);
  assert.equal(linkRes.body.identity.address, address);
  assert.equal(linkRes.body.identity.settlementEnabled, false);
  assert.equal(linkRes.body.recovered, false);

  const unrelatedKey = new kaspa.PrivateKey('2'.padStart(64, '0'));
  const unrelatedPublicKey = unrelatedKey.toPublicKey().toString();
  const unrelatedAddress = unrelatedKey.toAddress(kaspa.NetworkType.Mainnet).toString();
  const rotationChallenge = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge', intent: 'identity', address: unrelatedAddress, publicKey: unrelatedPublicKey
  }, firstCookie), rotationChallenge);
  assert.equal(rotationChallenge.statusCode, 409);
  assert.equal(rotationChallenge.body.code, 'IDENTITY_ROTATION_UNAVAILABLE');

  const cleanCookie = await startSession('Unbound Geek');
  const unboundChallenge = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge', intent: 'identity', address: unrelatedAddress, publicKey: unrelatedPublicKey
  }, cleanCookie), unboundChallenge);
  assert.equal(unboundChallenge.body.challenge.intent, 'link');

  const replayRes = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: challengeRes.body.challenge.challengeId,
    signature: sign(challengeRes.body.challenge.message)
  }, firstCookie), replayRes);
  assert.equal(replayRes.statusCode, 409);

  const authChallenge = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge', intent: 'payout', operation: 'set', payoutAddress: address, address, publicKey
  }, firstCookie), authChallenge);
  assert.equal(authChallenge.body.challenge.intent, 'payout-set');
  const authProof = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: authChallenge.body.challenge.challengeId,
    signature: sign(authChallenge.body.challenge.message)
  }, firstCookie), authProof);
  assert.match(authProof.body.authorization.token, /^[a-f0-9]{64}$/);
  assert.equal(authProof.body.authorization.oneTime, true);

  const protectedSave = response();
  await rewardsHandler(request('POST', {
    address,
    acknowledged: true,
    authorizationToken: authProof.body.authorization.token
  }, firstCookie), protectedSave);
  assert.equal(protectedSave.statusCode, 200);
  assert.equal(protectedSave.body.payout.ownershipVerified, true);
  assert.equal(protectedSave.body.payout.settlementEligible, false);

  const scopedChallenge = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge', intent: 'payout', operation: 'set', payoutAddress: unrelatedAddress, address, publicKey
  }, firstCookie), scopedChallenge);
  const scopedProof = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: scopedChallenge.body.challenge.challengeId,
    signature: sign(scopedChallenge.body.challenge.message)
  }, firstCookie), scopedProof);
  const wrongDestination = response();
  await rewardsHandler(request('POST', {
    address,
    acknowledged: true,
    authorizationToken: scopedProof.body.authorization.token
  }, firstCookie), wrongDestination);
  assert.equal(wrongDestination.statusCode, 401);

  const reusedAuthorization = response();
  await rewardsHandler(request('POST', {
    address,
    acknowledged: true,
    authorizationToken: authProof.body.authorization.token
  }, firstCookie), reusedAuthorization);
  assert.equal(reusedAuthorization.statusCode, 401);

  const learningStart = (await studyCall({ action: 'start', topic: 'wallets', level: 'foundations' }, firstCookie)).body;
  const learningSaved = (await studyAnswer(learningStart, firstCookie, false)).body.progress;
  assert.equal(learningSaved.review, 1);
  const challengeStarted = (await challengeStart(firstCookie, 'weekly')).body;
  const vaultClaimed = (await vaultCall('POST', { action: 'claim', dayId: vaultDay().id }, firstCookie)).body;
  const secondCookie = await startSession('Recovered Geek');
  const recoveryChallenge = response();
  await identityHandler(identityRequest('POST', { action: 'challenge', intent: 'identity', address, publicKey }, secondCookie), recoveryChallenge);
  assert.equal(recoveryChallenge.body.challenge.intent, 'recover');

  const rejectedRecovery = response();
  const recoverySignature = sign(recoveryChallenge.body.challenge.message);
  const badSignature = `${recoverySignature[0] === '0' ? '1' : '0'}${recoverySignature.slice(1)}`;
  await identityHandler(identityRequest('POST', {
    action: 'verify', challengeId: recoveryChallenge.body.challenge.challengeId, signature: badSignature
  }, secondCookie), rejectedRecovery);
  assert.equal(rejectedRecovery.statusCode, 401);

  const freshRecoveryChallenge = response();
  await identityHandler(identityRequest('POST', { action: 'challenge', intent: 'identity', address, publicKey }, secondCookie), freshRecoveryChallenge);
  const recoveryRes = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: freshRecoveryChallenge.body.challenge.challengeId,
    signature: sign(freshRecoveryChallenge.body.challenge.message)
  }, secondCookie), recoveryRes);
  assert.equal(recoveryRes.statusCode, 200);
  assert.equal(recoveryRes.body.recovered, true);
  assert.deepEqual((await studyCall({ action: 'progress' }, secondCookie)).body.progress, learningSaved);
  assert.equal((await studyCall({ action: 'progress' }, firstCookie)).statusCode, 401);
  assert.equal((await studyCall({ action: 'resume', runId: learningStart.run.id }, secondCookie)).statusCode, 404);
  const challengeRecovered = (await challengeCall({ action: 'resume', periodId: challengeStarted.run.periodId, runId: challengeStarted.run.id }, secondCookie)).body;
  assert.equal(challengeRecovered.run.id, challengeStarted.run.id);
  assert.equal(challengeRecovered.run.overallDeadline, challengeStarted.run.overallDeadline);
  assert.equal((await challengeStart(secondCookie, 'weekly')).body.run.id, challengeStarted.run.id);
  const recoveredVault = (await vaultCall('GET', undefined, secondCookie)).body.vault;
  assert.deepEqual(recoveredVault.history, vaultClaimed.vault.history);
  assert.equal(recoveredVault.totalClaimed, 1);
  assert.equal((await vaultCall('POST', { action: 'claim', dayId: vaultDay().id }, secondCookie)).body.claimStatus, 'already-claimed');
  assert.equal((await vaultCall('GET', undefined, firstCookie)).statusCode, 401);
  assert.equal(recoveryRes.body.previousSessionsInvalidated, true);

  const restoredProfile = response();
  await rewardsHandler(request('GET', undefined, secondCookie), restoredProfile);
  assert.equal(restoredProfile.statusCode, 200);
  assert.equal(restoredProfile.body.payout.address, address);
  assert.equal(restoredProfile.body.identity.recoveryCount, 1);

  const removeChallenge = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge', intent: 'payout', operation: 'remove', address, publicKey
  }, secondCookie), removeChallenge);
  const removeProof = response();
  await identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: removeChallenge.body.challenge.challengeId,
    signature: sign(removeChallenge.body.challenge.message)
  }, secondCookie), removeProof);
  const protectedRemoval = response();
  await rewardsHandler(request('DELETE', {
    authorizationToken: removeProof.body.authorization.token
  }, secondCookie), protectedRemoval);
  assert.equal(protectedRemoval.statusCode, 200);
  assert.equal(protectedRemoval.body.payout.address, '');

  const invalidatedOldSession = response();
  await rewardsHandler(request('GET', undefined, firstCookie), invalidatedOldSession);
  assert.equal(invalidatedOldSession.statusCode, 401);
});

test('parallel identity claims leave one binding and no orphaned wallet mapping', async () => {
  const keys = ['3', '4'].map((value) => new kaspa.PrivateKey(value.padStart(64, '0')));
  const wallets = keys.map((key) => ({
    privateKey: key.toString(),
    publicKey: key.toPublicKey().toString(),
    address: key.toAddress(kaspa.NetworkType.Mainnet).toString()
  }));
  const cookie = await startSession('Race Test Geek');
  const identityRequest = (method, body, sessionCookie) => request(method, body, sessionCookie, {}, { host: 'geekprotocol.xyz', 'user-agent': 'identity-race-test' });
  const challenges = [];
  for (const wallet of wallets) {
    const issued = response();
    await identityHandler(identityRequest('POST', {
      action: 'challenge', intent: 'identity', address: wallet.address, publicKey: wallet.publicKey
    }, cookie), issued);
    assert.equal(issued.statusCode, 201);
    challenges.push(issued.body.challenge);
  }

  const results = [response(), response()];
  await Promise.all(challenges.map((challenge, index) => identityHandler(identityRequest('POST', {
    action: 'verify',
    challengeId: challenge.challengeId,
    signature: kaspa.signMessage({ message: challenge.message, privateKey: wallets[index].privateKey })
  }, cookie), results[index])));
  assert.deepEqual(results.map((item) => item.statusCode).sort(), [200, 409]);

  const losingIndex = results.findIndex((item) => item.statusCode === 409);
  const cleanCookie = await startSession('Race Mapping Check');
  const orphanCheck = response();
  await identityHandler(identityRequest('POST', {
    action: 'challenge',
    intent: 'identity',
    address: wallets[losingIndex].address,
    publicKey: wallets[losingIndex].publicKey
  }, cleanCookie), orphanCheck);
  assert.equal(orphanCheck.statusCode, 201);
  assert.equal(orphanCheck.body.challenge.intent, 'link');
});

test('sensitive changes create private, pseudonymous, integrity-verified audit evidence', async () => {
  const cookie = await startSession('Audit Geek');
  const address = 'kaspa:qrahfynex4wsv6u283mvr77yc65ks9ze3assz3w4zegashgwupu6umagljg84';
  const saveRes = response();
  await rewardsHandler(request('POST', { address, acknowledged: true }, cookie), saveRes);
  assert.equal(saveRes.statusCode, 200);

  const denied = response();
  await auditHandler(request('GET', undefined, '', {}, { 'x-audit-admin': 'wrong-token' }), denied);
  assert.equal(denied.statusCode, 403);

  const exported = response();
  await auditHandler(request('GET', undefined, '', { limit: '100' }, { 'x-audit-admin': process.env.AUDIT_ADMIN_TOKEN }), exported);
  assert.equal(exported.statusCode, 200);
  assert.equal(exported.body.status.integrityMode, 'hmac-sha256');
  assert.equal(exported.body.integrity.verified, true);
  const event = exported.body.events.find((item) => item.eventId === saveRes.body.auditReceipt.eventId);
  assert.equal(event.type, 'payout.destination.created');
  assert.equal(event.actor.type, 'alpha-session');
  assert.match(event.actor.idHash, /^[a-f0-9]{64}$/);
  assert.equal(JSON.stringify(event).includes(address), false);
});

test('Daily and Speed modes keep answers and timing under server control', async () => {
  const dailyCookie = await startSession('Daily Geek');
  const dailyStart = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'daily' }, dailyCookie), dailyStart);
  assert.equal(dailyStart.statusCode, 201);
  assert.equal(dailyStart.body.run.mode, 'daily');
  assert.equal(dailyStart.body.run.questionCount, 5);
  assert.equal('correctIndex' in dailyStart.body.question, false);

  let dailyPayload = dailyStart.body;
  for (let number = 1; number <= 5; number += 1) {
    const answerRes = response();
    await rankedHandler(request('POST', {
      action: 'answer', runId: dailyPayload.run.id, questionToken: dailyPayload.question.token, selectedIndex: 0
    }, dailyCookie), answerRes);
    dailyPayload = answerRes.body;
    if (number < 5) {
      const nextRes = response();
      await rankedHandler(request('POST', { action: 'next', runId: dailyPayload.run.id }, dailyCookie), nextRes);
      dailyPayload = nextRes.body;
    }
  }
  assert.equal(dailyPayload.roundResult.modeComplete, true);
  assert.equal(dailyPayload.roundResult.questionCount, 5);
  assert.equal(dailyPayload.roundResult.reward, 0);

  const dailyRetry = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'daily' }, dailyCookie), dailyRetry);
  assert.equal(dailyRetry.statusCode, 409);
  assert.equal(dailyRetry.body.code, 'DAILY_ALREADY_PLAYED');

  const speedCookie = await startSession('Speed Geek');
  const speedStart = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'speed' }, speedCookie), speedStart);
  assert.equal(speedStart.statusCode, 201);
  assert.equal(speedStart.body.run.mode, 'speed');
  assert.ok(speedStart.body.question.durationMs <= 30_000);

  const storedKey = `geek:run:${speedStart.body.run.id}`;
  const storedRun = JSON.parse(strings.get(storedKey));
  storedRun.overallDeadline = Date.now() - 1_000;
  storedRun.current.deadline = Date.now() - 1_000;
  strings.set(storedKey, JSON.stringify(storedRun));
  const speedAnswer = response();
  await rankedHandler(request('POST', {
    action: 'answer', runId: speedStart.body.run.id, questionToken: speedStart.body.question.token, selectedIndex: -1
  }, speedCookie), speedAnswer);
  assert.equal(speedAnswer.body.result.timedOut, true);
  assert.equal(speedAnswer.body.roundResult.modeComplete, true);
  assert.equal(speedAnswer.body.roundResult.reward, 0);
});

const studyCall = async (body, cookie = '', method = 'POST') => {
  const res = response();
  await rankedHandler(request(method, body, cookie, { service: 'study' }), res);
  return res;
};
const storedStudy = payload => JSON.parse(strings.get(`geek:study:${payload.run.id}`));
const studyChoice = payload => {
  const run = storedStudy(payload);
  const q = studyQuestionById(run.ids[run.index]);
  return payload.question.options.indexOf(q.options[q.correctIndex]);
};
const studyAnswer = (payload, cookie, correct = true) => studyCall({ action: 'answer', runId: payload.run.id, questionToken: payload.question.token, selectedIndex: correct ? studyChoice(payload) : (studyChoice(payload) + 1) % 4 }, cookie);
const studyNext = (payload, cookie) => studyCall({ action: 'next', runId: payload.run.id, questionToken: payload.result.questionToken }, cookie);

test('Study catalog exposes eight lessons and 80 distinct concepts without answer keys', async () => {
  const res = await studyCall(undefined, '', 'GET');
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.topics.length, 8);
  assert.equal(res.body.topics.reduce((n, t) => n + t.count, 0), 80);
  assert.equal(studyBank().length, 80);
  assert.equal(new Set(studyBank().map(q => q.conceptId)).size, 80);
  for (const topic of res.body.topics) {
    assert.ok(topic.lesson.length > 100);
    assert.equal(topic.count, 10);
    assert.ok(topic.sources.every(source => new URL(source).protocol === 'https:'));
  }
  assert.equal('questions' in res.body, false);
  assert.equal(JSON.stringify(res.body).includes('correctIndex'), false);
  assert.equal(res.body.ranked, false);
  assert.equal(res.body.rewardsEnabled, false);
});

test('Study is untimed, session-bound, private before commitment, and isolated from ranked progress', async () => {
  assert.equal((await studyCall({ action: 'start', topic: 'origins' })).statusCode, 401);
  const cookie = await startSession('Study Isolation');
  const foreign = await startSession('Study Stranger');
  const start = await studyCall({ action: 'start', topic: 'origins' }, cookie);
  assert.equal(start.statusCode, 201);
  const payload = start.body;
  assert.equal(payload.run.total, 5);
  assert.equal(new Set(storedStudy(payload).ids).size, 5);
  for (const field of ['correctIndex', 'answer', 'explanation', 'source', 'deadline', 'durationMs']) assert.equal(field in payload.question, false);
  assert.equal((await studyCall({ action: 'resume', runId: payload.run.id }, foreign)).statusCode, 404);
  assert.equal((await studyCall({ action: 'answer', runId: payload.run.id, questionToken: payload.question.token, selectedIndex: 0 }, foreign)).statusCode, 404);
  assert.equal((await studyCall({ action: 'next', runId: payload.run.id, questionToken: payload.question.token }, cookie)).statusCode, 409);
  for (const selectedIndex of ['0', -1, 4, 1.5, null]) assert.equal((await studyCall({ action: 'answer', runId: payload.run.id, questionToken: payload.question.token, selectedIndex }, cookie)).statusCode, 400);
  assert.equal(storedStudy(payload).answers.length, 0);
  const before = new Map([...strings].filter(([key]) => !key.startsWith('geek:rate:') && !key.startsWith('geek:study:')));
  const sortedBefore = JSON.stringify([...sorted].map(([key, value]) => [key, [...value]]));
  const clock = Date.now;
  let answer;
  try { Date.now = () => clock() + 60 * 60 * 1000; answer = await studyAnswer(payload, cookie); } finally { Date.now = clock; }
  assert.equal(answer.statusCode, 200);
  assert.equal(answer.body.result.correct, true);
  assert.ok(answer.body.result.explanation);
  assert.ok(answer.body.result.source.startsWith('https://'));
  assert.deepEqual(new Map([...strings].filter(([key]) => !key.startsWith('geek:rate:') && !key.startsWith('geek:study:'))), before);
  assert.equal(JSON.stringify([...sorted].map(([key, value]) => [key, [...value]])), sortedBefore);
  const rankedResponse = response();
  await rankedHandler(request('POST', { action: 'answer', runId: payload.run.id, questionToken: payload.question.token, selectedIndex: 0 }, cookie), rankedResponse);
  assert.equal(rankedResponse.statusCode, 404);
  const rankedStart = response();
  await rankedHandler(request('POST', { action: 'start', category: 'kaspa', mode: 'gauntlet' }, cookie), rankedStart);
  assert.equal(rankedStart.statusCode, 201);
  assert.equal((await studyCall({ action: 'resume', runId: rankedStart.body.run.id }, cookie)).statusCode, 404);
  strings.delete(`geek:study:${payload.run.id}`);
  assert.equal((await studyCall({ action: 'resume', runId: payload.run.id }, cookie)).statusCode, 404);
});

test('concurrent Study answers commit once; answer and next retries cannot change or skip results', async () => {
  const cookie = await startSession('Study Race');
  const payload = (await studyCall({ action: 'start', topic: 'blockdag' }, cookie)).body;
  const answers = await Promise.all([studyAnswer(payload, cookie, true), studyAnswer(payload, cookie, false)]);
  assert.deepEqual(answers.map(res => res.statusCode), [200, 200]);
  assert.deepEqual(answers[0].body.result, answers[1].body.result);
  assert.equal(storedStudy(payload).answers.length, 1);
  const resumed = await studyCall({ action: 'resume', runId: payload.run.id }, cookie);
  assert.deepEqual(resumed.body.result, answers[0].body.result);
  assert.equal('question' in resumed.body, false);
  const nexts = await Promise.all([studyNext(answers[0].body, cookie), studyNext(answers[0].body, cookie)]);
  assert.deepEqual(nexts.map(res => res.statusCode), [200, 200]);
  assert.equal(nexts[0].body.run.number, 2);
  assert.equal(nexts[0].body.question.token, nexts[1].body.question.token);
  assert.equal(storedStudy(payload).index, 1);
  assert.equal((await studyCall({ action: 'answer', runId: payload.run.id, questionToken: payload.question.token, selectedIndex: 0 }, cookie)).statusCode, 409);
});

test('Study summary retries exactly the missed concepts and rejects unauthorized or incomplete practice', async () => {
  const cookie = await startSession('Study Review');
  const foreign = await startSession('Study Review Stranger');
  let payload = (await studyCall({ action: 'start', topic: 'wallets' }, cookie)).body;
  const runId = payload.run.id;
  assert.equal((await studyCall({ action: 'start', topic: 'wallets', practiceRunId: runId }, cookie)).statusCode, 400);
  for (let index = 0; index < 5; index++) {
    const res = await studyAnswer(payload, cookie, ![0, 3].includes(index));
    assert.equal(res.statusCode, 200);
    payload = res.body;
    if (index < 4) payload = (await studyNext(payload, cookie)).body;
  }
  assert.equal(payload.run.status, 'complete');
  assert.equal(payload.summary.correct, 3);
  assert.equal(payload.summary.missed.length, 2);
  assert.equal(payload.summary.recommendation.topic, 'wallets');
  assert.equal((await studyCall({ action: 'start', topic: 'wallets', practiceRunId: runId }, foreign)).statusCode, 404);
  assert.equal((await studyCall({ action: 'start', topic: 'mining', practiceRunId: runId }, cookie)).statusCode, 400);
  const missed = storedStudy(payload).answers.filter(a => !a.correct).map(a => a.questionId);
  const practice = await studyCall({ action: 'start', topic: 'wallets', practiceRunId: runId }, cookie);
  assert.equal(practice.statusCode, 201);
  assert.equal(practice.body.run.total, 2);
  assert.deepEqual(storedStudy(practice.body).ids, missed);
  let focused = practice.body;
  for (let index = 0; index < 2; index++) {
    focused = (await studyAnswer(focused, cookie)).body;
    if (index < 1) focused = (await studyNext(focused, cookie)).body;
  }
  assert.equal(focused.summary.correct, 2);
  assert.equal(focused.summary.missed.length, 0);
  assert.equal(focused.summary.recommendation.topic, 'wallets');
  assert.equal((await studyCall({ action: 'start', topic: 'wallets', practiceRunId: focused.run.id }, cookie)).statusCode, 400);
});

test('Study levels use distinct concepts, validate selection, and cover unseen concepts first', async () => {
  const cookie = await startSession('Learning Levels');
  for (const level of ['expert', 1, null]) assert.equal((await studyCall({ action: 'start', topic: 'origins', level }, cookie)).statusCode, 400);
  assert.equal((await studyCall({ action: 'start', topic: 'origins', review: 'yes' }, cookie)).statusCode, 400);
  for (const [level, tier] of [['foundations', 'easy'], ['connections', 'medium']]) {
    let payload = (await studyCall({ action: 'start', topic: 'origins', level }, cookie)).body;
    assert.equal(payload.run.level, level);
    const ids = storedStudy(payload).ids;
    assert.equal(ids.length, level === 'foundations' ? 5 : 3);
    assert.ok(ids.every(id => studyQuestionById(id).difficulty === tier));
    for (let i = 0; i < ids.length; i++) {
      payload = (await studyAnswer(payload, cookie)).body;
      if (i < ids.length - 1) payload = (await studyNext(payload, cookie)).body;
    }
  }
  const mixed = (await studyCall({ action: 'start', topic: 'origins', level: 'mixed' }, cookie)).body;
  assert.deepEqual(new Set(storedStudy(mixed).ids.slice(0, 2)), new Set(['KASPA-0005', 'KASPA-0010']));
  assert.equal(mixed.progress.explored, 8);
  assert.equal(mixed.progress.confidence, 0);
});

test('saved Study progress is private, survives run expiry, and cannot be written by the browser', async () => {
  assert.equal((await studyCall({ action: 'progress' })).statusCode, 401);
  const cookie = await startSession('Saved Practice');
  const foreign = await startSession('Other Practice');
  const start = (await studyCall({ action: 'start', topic: 'origins', level: 'foundations' }, cookie)).body;
  const missedId = storedStudy(start).ids[0];
  const missed = (await studyAnswer(start, cookie, false)).body;
  assert.equal(missed.progress.review, 1);
  assert.equal((await studyCall({ action: 'progress', playerId: 'forged', progress: { explored: 80 } }, foreign)).body.progress.explored, 0);
  strings.delete(`geek:study:${start.run.id}`);
  const saved = (await studyCall({ action: 'progress' }, cookie)).body.progress;
  assert.equal(saved.explored, 1);
  assert.equal(saved.concepts[0].stage, 'review');
  assert.equal(JSON.stringify(saved).includes('correctIndex'), false);
  assert.equal((await studyCall({ action: 'start', topic: 'origins', review: true }, foreign)).statusCode, 400);
  const review = (await studyCall({ action: 'start', topic: 'origins', review: true }, cookie)).body;
  assert.deepEqual(storedStudy(review).ids, [missedId]);
  assert.equal(review.run.review, true);
  assert.equal((await studyAnswer(review, cookie)).body.progress.review, 0);
});

test('Study progress counts atomic answers once and requires separate runs for confidence', async () => {
  const cookie = await startSession('Practice Confidence');
  let payload = (await studyCall({ action: 'start', topic: 'origins', level: 'connections' }, cookie)).body;
  const firstId = storedStudy(payload).ids[0];
  const race = await Promise.all([studyAnswer(payload, cookie), studyAnswer(payload, cookie)]);
  assert.equal(race[0].body.progress.concepts.find(c => c.id === firstId).attempts, 1);
  assert.equal((await studyAnswer(payload, cookie)).body.progress.concepts.find(c => c.id === firstId).attempts, 1);
  payload = race[0].body;
  for (let i = 1; i < 3; i++) { payload = (await studyNext(payload, cookie)).body; payload = (await studyAnswer(payload, cookie)).body; }
  assert.equal(payload.progress.confidence, 0);
  assert.match(payload.summary.recommendation.message, /more concepts/);
  payload = (await studyCall({ action: 'start', topic: 'origins', level: 'connections' }, cookie)).body;
  for (let i = 0; i < 3; i++) { payload = (await studyAnswer(payload, cookie)).body; if (i < 2) payload = (await studyNext(payload, cookie)).body; }
  assert.equal(payload.progress.confidence, 3);
  const bad = (await studyCall({ action: 'start', topic: 'origins', level: 'connections' }, cookie)).body;
  const reset = (await studyAnswer(bad, cookie, false)).body;
  assert.equal(reset.progress.confidence, 2);
  assert.equal(reset.progress.review, 1);
  assert.equal(reset.progress.explored, 3);
  const practice = (await studyCall({ action: 'start', topic: 'origins', review: true }, cookie)).body;
  const once = (await studyAnswer(practice, cookie)).body;
  assert.equal(once.progress.confidence, 2);
  assert.equal(once.progress.review, 0);
});

test('parallel Study runs preserve each concept record without losing attempts', async () => {
  const cookie = await startSession('Parallel Learning');
  const first = (await studyCall({ action: 'start', topic: 'origins', level: 'connections' }, cookie)).body;
  const second = (await studyCall({ action: 'start', topic: 'origins', level: 'connections' }, cookie)).body;
  const complete = async start => {
    let payload = start;
    for (let i = 0; i < 3; i++) { payload = (await studyAnswer(payload, cookie)).body; if (i < 2) payload = (await studyNext(payload, cookie)).body; }
  };
  await Promise.all([complete(first), complete(second)]);
  const progress = (await studyCall({ action: 'progress' }, cookie)).body.progress;
  assert.equal(progress.explored, 3);
  assert.equal(progress.confidence, 3);
  assert.ok(progress.concepts.every(c => c.attempts === 2 && c.correctAttempts === 2));
});

const challengeCall = async (body, cookie = '', method = 'POST', query = {}) => {
  const res = response();
  await rankedHandler(request(method, body, cookie, { service: 'challenges', ...query }, { 'user-agent': `challenge-test-${cookie}` }), res);
  return res;
};
const challengeStart = (cookie, kind) => challengeCall({ action: 'start', kind, periodId: challengePeriod(kind).id }, cookie);
const challengeStored = (payload, cookie) => {
  const session = JSON.parse(strings.get(`geek:session:${sessionIdFromCookie(cookie)}`));
  return JSON.parse(strings.get(`geek:challenge:attempt:${payload.run.periodId}:${session.playerId}`));
};
const challengeAnswer = (payload, cookie, correct = true) => {
  const run = challengeStored(payload, cookie);
  const q = JSON.parse(strings.get(`geek:challenge:pack:${run.period.id}`)).questions[run.index];
  const right = payload.question.options.indexOf(q.options[q.correctIndex]);
  return challengeCall({ action: 'answer', periodId: payload.run.periodId, runId: payload.run.id, questionToken: payload.question.token, selectedIndex: correct ? right : (right + 1) % 4, score: 999999, correct: 20 }, cookie);
};
const challengeNext = (payload, cookie) => challengeCall({ action: 'next', periodId: payload.run.periodId, runId: payload.run.id, questionToken: payload.result.questionToken }, cookie);
const challengeFinish = (payload, cookie) => challengeCall({ action: 'finish', periodId: payload.run.periodId, runId: payload.run.id }, cookie);

test('challenge starts are one-per-player, shared, private, and immutable under concurrent retries', async () => {
  const cookie = await startSession('Challenge Shared'); const foreign = await startSession('Challenge Other');
  const starts = await Promise.all([challengeStart(cookie, 'monthly'), challengeStart(cookie, 'monthly')]);
  assert.deepEqual(starts.map(r => r.statusCode).sort(), [200, 201]);
  assert.equal(starts[0].body.run.id, starts[1].body.run.id);
  const payload = starts[0].body;
  assert.equal(payload.run.total, 20);
  assert.equal(payload.run.overallDeadline, starts[1].body.run.overallDeadline);
  for (const key of ['correctIndex', 'answer', 'source', 'explanation']) assert.equal(key in payload.question, false);
  const other = (await challengeStart(foreign, 'monthly')).body;
  assert.equal(other.question.prompt, payload.question.prompt);
  assert.deepEqual([...other.question.options].sort(), [...payload.question.options].sort());
  assert.equal((await challengeCall({ action: 'resume', periodId: payload.run.periodId, runId: payload.run.id }, foreign)).statusCode, 404);
  assert.equal((await challengeStart('', 'weekly')).statusCode, 401);
  for (const selectedIndex of [null, '0', 4, -2, 0.5]) assert.equal((await challengeCall({ action: 'answer', periodId: payload.run.periodId, runId: payload.run.id, questionToken: payload.question.token, selectedIndex }, cookie)).statusCode, 400);
  assert.equal(challengeStored(payload, cookie).answers.length, 0);
  assert.equal((await challengeCall({ action: 'next', periodId: payload.run.periodId, runId: payload.run.id, questionToken: payload.question.token }, cookie)).statusCode, 409);
  const profileBefore = strings.get(`geek:profile:${sessionIdFromCookie(cookie)}`);
  const answers = await Promise.all([challengeAnswer(payload, cookie), challengeAnswer(payload, cookie, false)]);
  assert.deepEqual(answers.map(r => r.statusCode), [200, 200]);
  assert.deepEqual(answers[0].body.result, answers[1].body.result);
  assert.equal(challengeStored(payload, cookie).answers.length, 1);
  assert.equal(answers[0].body.run.score, 100);
  const nexts = await Promise.all([challengeNext(answers[0].body, cookie), challengeNext(answers[0].body, cookie)]);
  assert.equal(nexts[0].body.question.token, nexts[1].body.question.token);
  assert.equal(nexts[0].body.run.number, 2);
  assert.equal(strings.get(`geek:profile:${sessionIdFromCookie(cookie)}`), profileBefore);
  assert.equal(answers[0].body.rewardsEnabled, false); assert.equal(answers[0].body.xpEnabled, false);
});

test('weekly challenge completes once with server scores, answer review, and isolated standings', async () => {
  const clock = Date.now; const now = Date.parse('2029-01-17T12:00:00Z'); Date.now = () => now;
  try {
    const cookie = await startSession('Verified Circuit'); let payload = (await challengeStart(cookie, 'weekly')).body;
    const initial = payload;
    assert.equal((await challengeCall(undefined, '', 'GET')).body.periods.find(p => p.kind === 'weekly').completed, 0);
    for (let i = 0; i < 10; i++) { payload = (await challengeAnswer(payload, cookie, i !== 3)).body; if (i < 9) payload = (await challengeNext(payload, cookie)).body; }
    assert.equal(payload.run.status, 'complete'); assert.equal(payload.run.score, 900); assert.equal(payload.summary.correct, 9); assert.equal(payload.summary.review.length, 10);
    const finishes = await Promise.all([challengeFinish(payload, cookie), challengeFinish(payload, cookie)]);
    assert.ok(finishes.every(r => r.body.summary.score === 900));
    const catalog = (await challengeCall(undefined, '', 'GET')).body;
    const board = catalog.periods.find(p => p.kind === 'weekly');
    assert.equal(board.completed, 1); assert.equal(board.entries[0].score, 900); assert.equal(board.entries[0].rank, 1);
    assert.equal(board.entries[0].name, 'Verified Circuit'); assert.equal(catalog.periods.find(p => p.kind === 'monthly').completed, 0);
    assert.equal(JSON.stringify(catalog).includes('correctIndex'), false); assert.equal(JSON.stringify(catalog).includes(initial.run.id), false);
    assert.equal((await challengeStart(cookie, 'weekly')).body.run.id, initial.run.id);
    const ranked = response(); await rankedHandler(request('POST', { action: 'answer', runId: initial.run.id, selectedIndex: 0 }, cookie), ranked); assert.equal(ranked.statusCode, 404);
  } finally { Date.now = clock; }
});

test('challenge clocks survive resume; late answers and expired budgets cannot create points', async () => {
  const clock = Date.now; let now = Date.parse('2029-02-14T12:00:00Z'); Date.now = () => now;
  try {
    const cookie = await startSession('Clock Signal'); let payload = (await challengeStart(cookie, 'weekly')).body;
    const deadline = payload.question.expiresAt;
    now = deadline;
    const late = await challengeAnswer(payload, cookie);
    assert.equal(late.body.result.timedOut, true); assert.equal(late.body.run.score, 0);
    payload = (await challengeNext(late.body, cookie)).body;
    const resumed = (await challengeCall({ action: 'resume', periodId: payload.run.periodId, runId: payload.run.id }, cookie)).body;
    assert.equal(resumed.question.expiresAt, payload.question.expiresAt);
    now = payload.run.overallDeadline;
    const expired = (await challengeCall({ action: 'resume', periodId: payload.run.periodId, runId: payload.run.id }, cookie)).body;
    assert.equal(expired.run.status, 'complete'); assert.equal(expired.run.score, 0); assert.equal(expired.summary.reason, 'time-limit');
    assert.equal(expired.summary.answered, 1);
    assert.equal((await challengeCall(undefined, '', 'GET')).body.periods.find(p => p.kind === 'weekly').completed, 1);
  } finally { Date.now = clock; }
});

test('UTC period rollover rejects stale starts and closes unsubmitted attempts while retaining previous boards', async () => {
  const clock = Date.now; let now = Date.parse('2029-03-31T23:59:50Z'); Date.now = () => now;
  try {
    const cookie = await startSession('Old Period'); const unfinishedCookie = await startSession('Unsubmitted');
    let payload = (await challengeStart(cookie, 'monthly')).body;
    payload = (await challengeAnswer(payload, cookie)).body; payload = (await challengeFinish(payload, cookie)).body;
    const unfinished = (await challengeStart(unfinishedCookie, 'monthly')).body;
    now = Date.parse('2029-04-01T00:00:00Z');
    assert.equal((await challengeCall({ action: 'start', kind: 'monthly', periodId: unfinished.run.periodId }, unfinishedCookie)).statusCode, 409);
    assert.equal((await challengeAnswer(unfinished, unfinishedCookie)).statusCode, 409);
    const closed = (await challengeCall({ action: 'resume', periodId: unfinished.run.periodId, runId: unfinished.run.id }, unfinishedCookie)).body;
    assert.equal(closed.run.status, 'closed'); assert.equal(closed.summary.ranked, false);
    assert.equal((await challengeCall(undefined, '', 'GET')).body.periods.find(p => p.kind === 'monthly').completed, 0);
    const previous = (await challengeCall(undefined, '', 'GET', { previous: '1' })).body.periods.find(p => p.kind === 'monthly');
    assert.equal(previous.completed, 1); assert.equal(previous.entries[0].score, 100);
    assert.equal((await challengeFinish(payload, cookie)).body.summary.score, 100);
    assert.equal((await challengeStart(cookie, 'monthly')).statusCode, 201);
  } finally { Date.now = clock; }
});

test('challenge boards include zero scores, share tie ranks, expose no identities, and bound the public listing', async () => {
  const clock = Date.now; const now = Date.parse('2029-05-15T12:00:00Z'); Date.now = () => now;
  try {
    const own = [];
    for (let n = 0; n < 14; n++) {
      const cookie = await startSession(`Circuit ${n}`); let payload = (await challengeStart(cookie, 'weekly')).body;
      if (n !== 13) payload = (await challengeAnswer(payload, cookie)).body;
      if (n < 2) { payload = (await challengeNext(payload, cookie)).body; payload = (await challengeAnswer(payload, cookie)).body; }
      payload = (await challengeFinish(payload, cookie)).body; own.push(payload);
    }
    const board = (await challengeCall(undefined, '', 'GET')).body.periods.find(p => p.kind === 'weekly');
    assert.equal(board.completed, 14); assert.equal(board.entries.length, 10);
    assert.equal(board.entries[0].rank, 1); assert.equal(board.entries[1].rank, 1); assert.equal(board.entries[2].rank, 3);
    assert.equal(own[13].summary.score, 0); assert.equal(own[13].summary.rank, 14);
    assert.ok(board.entries.every(e => !('playerId' in e) && !('address' in e) && !('runId' in e)));
  } finally { Date.now = clock; }
});

test('period capacity is atomic and retries of an existing attempt remain available', async () => {
  const clock = Date.now; const now = Date.parse('2029-06-18T12:00:00Z'); Date.now = () => now;
  try {
    const cookie = await startSession('Last Seat'); const period = challengePeriod('weekly');
    strings.set(`geek:challenge:starts:${period.id}`, String(CHALLENGE_CAP - 1));
    const attempts = await Promise.all([challengeStart(cookie, 'weekly'), challengeStart(cookie, 'weekly')]);
    assert.deepEqual(attempts.map(a => a.statusCode).sort(), [200, 201]);
    assert.equal(strings.get(`geek:challenge:starts:${period.id}`), String(CHALLENGE_CAP));
    const stranger = await startSession('Over Capacity'); assert.equal((await challengeStart(stranger, 'weekly')).body.code, 'CHALLENGE_FULL');
    assert.equal((await challengeStart(cookie, 'weekly')).statusCode, 200);
  } finally { Date.now = clock; }
});

test('active challenge grading fails closed on missing or substituted snapshots', async () => {
  const clock = Date.now; const now = Date.parse('2029-07-18T12:00:00Z'); Date.now = () => now;
  try {
    const cookie = await startSession('Snapshot Signal'); const payload = (await challengeStart(cookie, 'weekly')).body;
    const key = `geek:challenge:pack:${payload.run.periodId}`; const original = strings.get(key);
    const q = JSON.parse(original).questions[0]; const right = payload.question.options.indexOf(q.options[q.correctIndex]);
    const answer = () => challengeCall({ action: 'answer', periodId: payload.run.periodId, runId: payload.run.id, questionToken: payload.question.token, selectedIndex: right }, cookie);
    strings.delete(key);
    assert.equal((await answer()).statusCode, 503); assert.equal(strings.has(key), false);
    const changed = JSON.parse(original); changed.questions[0].correctIndex = (changed.questions[0].correctIndex + 1) % 4; strings.set(key, JSON.stringify(changed));
    assert.equal((await answer()).statusCode, 503); assert.equal(challengeStored(payload, cookie).answers.length, 0);
    strings.set(key, original); assert.equal((await answer()).body.run.score, 100);
  } finally { Date.now = clock; }
});


const vaultCall = async (method, body, cookie = '') => {
  const res = response();
  await sessionHandler(request(method, body, cookie, { service: 'vault' }, { 'user-agent': `vault-test:${cookie}` }), res);
  return res;
};

test('daily vault is private, explicit and isolated from learning, credits and trading', async () => {
  assert.equal((await vaultCall('GET')).statusCode, 401);
  assert.equal((await vaultCall('POST', { action: 'claim', dayId: vaultDay().id })).statusCode, 401);
  const cookie = await startSession('Vault privacy');
  const player = sessionIdFromCookie(cookie);
  const profile = { ...defaultProfile(), xp: 400, balance: 75 };
  strings.set(`geek:profile:${player}`, JSON.stringify(profile));
  const before = strings.get(`geek:profile:${player}`);
  const status = (await vaultCall('GET', undefined, cookie)).body.vault;
  assert.equal(status.claimed, false); assert.equal(status.totalClaimed, 0);
  assert.equal(status.collection.length, 7); assert.equal(status.day.quantity, 1);
  assert.equal(status.xpEnabled, false); assert.equal(status.creditsEnabled, false);
  assert.equal(status.tokensEnabled, false); assert.equal(status.transferable, false);
  assert.equal(strings.has(vaultKey(player)), false); // Viewing never opens a vault.
  for (const body of [{ action: 'claim' }, { action: 'claim', dayId: '2000-01-01' }, { action: 'award', dayId: vaultDay().id }]) {
    assert.ok([400, 409].includes((await vaultCall('POST', body, cookie)).statusCode));
  }
  const result = await vaultCall('POST', { action: 'claim', dayId: vaultDay().id, playerId: 'other', quantity: 100, sealId: 'all-hope', xp: 999, claimedAt: 0 }, cookie);
  assert.equal(result.statusCode, 200);
  assert.equal(result.body.vault.totalClaimed, 1);
  assert.equal(result.body.claimReceipt.quantity, 1);
  assert.equal(result.body.claimReceipt.sealId, vaultDay().seal.id);
  assert.equal(result.body.vault.collection.reduce((n, item) => n + item.quantity, 0), 1);
  assert.equal(strings.get(`geek:profile:${player}`), before);
  assert.equal(strings.has(vaultKey('other')), false);
  assert.equal(Object.hasOwn(result.body.vault, 'playerId'), false);
  const stranger = await startSession('Separate vault');
  assert.equal((await vaultCall('GET', undefined, stranger)).body.vault.totalClaimed, 0);
  assert.equal((await vaultCall('DELETE', undefined, cookie)).statusCode, 405);
});

test('concurrent vault claims and lost-response retries return one receipt and one seal', async () => {
  const cookie = await startSession('Vault race');
  const body = { action: 'claim', dayId: vaultDay().id };
  const results = await Promise.all(Array.from({ length: 8 }, () => vaultCall('POST', body, cookie)));
  assert.equal(results.filter(res => res.body.claimStatus === 'claimed').length, 1);
  assert.equal(results.filter(res => res.body.claimStatus === 'already-claimed').length, 7);
  const receipt = results[0].body.claimReceipt;
  for (const result of results) {
    assert.equal(result.statusCode, 200); assert.equal(result.body.vault.totalClaimed, 1);
    assert.deepEqual(result.body.claimReceipt, receipt);
  }
  assert.deepEqual((await vaultCall('GET', undefined, cookie)).body.vault.receipt, receipt);
  assert.deepEqual((await vaultCall('POST', body, cookie)).body.claimReceipt, receipt);
});

test('vault UTC rollover uses Redis time and rejects delayed or future claims without writes', async () => {
  const cookie = await startSession('Vault UTC');
  const now = Date.now;
  try {
    Date.now = () => Date.parse('2026-12-31T23:59:59.900Z');
    const day = vaultDay();
    assert.equal(day.id, '2026-12-31');
    vaultRedisNow = day.closesAt;
    const closed = await vaultCall('POST', { action: 'claim', dayId: day.id }, cookie);
    assert.equal(closed.statusCode, 409); assert.equal(closed.body.code, 'VAULT_DAY_CHANGED');
    assert.equal(strings.has(vaultKey(sessionIdFromCookie(cookie))), false);
    vaultRedisNow = day.opensAt - 1;
    assert.equal((await vaultCall('POST', { action: 'claim', dayId: day.id }, cookie)).statusCode, 409);
    vaultRedisNow = null;
    const first = await vaultCall('POST', { action: 'claim', dayId: day.id }, cookie);
    assert.equal(first.body.vault.totalClaimed, 1);
    Date.now = () => day.closesAt;
    const status = (await vaultCall('GET', undefined, cookie)).body.vault;
    assert.equal(status.day.id, '2027-01-01'); assert.equal(status.claimed, false);
    assert.equal((await vaultCall('POST', { action: 'claim', dayId: day.id }, cookie)).statusCode, 409);
    const second = await vaultCall('POST', { action: 'claim', dayId: status.day.id }, cookie);
    assert.equal(second.body.vault.totalClaimed, 2);
    assert.equal(second.body.vault.history.length, 2);
    assert.notEqual(second.body.claimReceipt.id, first.body.claimReceipt.id);
  } finally { Date.now = now; vaultRedisNow = null; }
});

test('vault schedule repeats without streak multipliers; history stays bounded and totals persist', async () => {
  const cookie = await startSession('Vault history'); const now = Date.now;
  try {
    let timestamp = Date.parse('2028-02-28T12:00:00Z');
    for (let i = 0; i < 18; i++) {
      Date.now = () => timestamp + i * 86400000;
      const day = vaultDay();
      const result = (await vaultCall('POST', { action: 'claim', dayId: day.id }, cookie)).body;
      assert.equal(result.vault.totalClaimed, i + 1);
      assert.equal(result.vault.history.length, Math.min(i + 1, 14));
      assert.equal(result.vault.collection.reduce((n, s) => n + s.quantity, 0), i + 1);
      assert.equal(result.claimReceipt.quantity, 1);
    }
    const before = JSON.parse(strings.get(vaultKey(sessionIdFromCookie(cookie))));
    Date.now = () => timestamp + 25 * 86400000; // A missed week creates no catch-up or penalty.
    assert.equal((await vaultCall('GET', undefined, cookie)).body.vault.totalClaimed, 18);
    assert.equal((await vaultCall('POST', { action: 'claim', dayId: vaultDay().id }, cookie)).body.vault.totalClaimed, 19);
    assert.equal(before.history.length, 14);
    assert.equal(vaultDay(timestamp).seal.id, vaultDay(timestamp + 7 * 86400000).seal.id);
    assert.equal(new Set(vaultSeals.map(s => s.id)).size, 7);
    assert.equal(vaultDay(Date.parse('2028-02-29T00:00:00Z')).id, '2028-02-29');
  } finally { Date.now = now; }
});

test('future or incompatible vault records fail closed instead of granting another claim', async () => {
  const cookie = await startSession('Vault invalid'); const key = vaultKey(sessionIdFromCookie(cookie));
  for (const state of [ { version: 2, total: 1, lastDay: '', inventory: {}, history: [] }, { version: 1, total: 1, lastDay: '9999-01-01', inventory: {}, history: [] }, { version: 1, total: -1, lastDay: '', inventory: {}, history: [] }, { version: 1, total: 1, lastDay: '', inventory: { signal: '2' }, history: [] } ]) {
    const raw = JSON.stringify(state); strings.set(key, raw);
    const result = await vaultCall('POST', { action: 'claim', dayId: vaultDay().id }, cookie);
    assert.equal(result.statusCode, 503); assert.equal(strings.get(key), raw);
  }
});


test('custom Geek saves only allowed cosmetics and preserves concurrent progress and wallet fields', async () => {
  const { defaultGeek } = await import('../public/assets/geek-avatar.js');
  const cookie = await startSession('Custom Geek'); const playerId = sessionIdFromCookie(cookie), key = `geek:profile:${playerId}`;
  const initial = { ...defaultProfile(), xp: 123, balance: 77, payoutAddress: 'existing-setting', journey: [] };
  strings.set(key, JSON.stringify(initial));
  const customization = {...defaultGeek, palette: 'cyan', head: 'headphones', back: 'pack'};
  avatarRace = key => {const current = JSON.parse(strings.get(key)); strings.set(key, JSON.stringify({...current, xp: 456, payoutAddressVersion: 4}));};
  const saved = response(); await collectiblesHandler(request('POST', {action: 'customize-avatar', customization, xp: 99999, balance: 99999, avatarId: 'geek-499'}, cookie), saved);
  assert.equal(saved.statusCode, 200); assert.equal(saved.body.collection.avatar.id, 'giga-builder'); assert.deepEqual(saved.body.collection.customization, customization);
  const current = JSON.parse(strings.get(key)); assert.equal(current.xp, 456); assert.equal(current.balance, 77); assert.equal(current.payoutAddress, 'existing-setting'); assert.equal(current.payoutAddressVersion, 4); assert.deepEqual(current.journey, []);
  const reload = response(); await collectiblesHandler(request('GET', undefined, cookie), reload); assert.deepEqual(reload.body.collection.customization, customization);
  const switched = response(); await collectiblesHandler(request('POST', {action: 'select-avatar', avatarId: 'giga-genesis'}, cookie), switched); assert.equal(switched.statusCode, 200); assert.deepEqual(switched.body.collection.customization, customization);
  for (const invalid of [null, [], {...customization, palette: '<script>'}, {...customization, edition: 500}, {...customization, version: 2}, {...customization, head: null}]) {
    const bad = response(); await collectiblesHandler(request('POST', {action: 'customize-avatar', customization: invalid}, cookie), bad); assert.equal(bad.statusCode, 400); assert.equal(bad.body.code, 'INVALID_AVATAR_CUSTOMIZATION');
  }
  assert.equal(JSON.parse(strings.get(key)).avatarId, 'giga-genesis');
  const unauthenticated = response(); await collectiblesHandler(request('POST', {action: 'customize-avatar', customization}), unauthenticated); assert.equal(unauthenticated.statusCode, 401);
  const fakeOwned = response(); await collectiblesHandler(request('POST', {action: 'select-avatar', avatarId: 'geek-499'}, cookie), fakeOwned); assert.equal(fakeOwned.statusCode, 403);
  const other = await startSession('Separate Custom Geek'); const foreign = response(); await collectiblesHandler(request('GET', undefined, other), foreign); assert.equal(foreign.body.collection.avatar.id, 'giga-genesis'); assert.deepEqual(foreign.body.collection.customization, defaultGeek);
});
