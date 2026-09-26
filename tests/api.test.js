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
  await sessionHandler(request('POST', { displayName }), res);
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
