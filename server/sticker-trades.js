import { randomBytes } from 'node:crypto';
import { recordAuditEvent } from './audit.js';
import { isStickerId, stickerCatalog } from './collectibles.js';
import { profileKeyFor } from './profile.js';
import { parseStoredJson, pipeline, redis } from './redis.js';

const TRADE_INDEX = 'geek:sticker-trades:open';
const TRADE_TTL_SECONDS = 60 * 60 * 24 * 7;
const tradeKey = (id) => `geek:sticker-trade:${id}`;
const tradeIdPattern = /^[a-f0-9]{32}$/;
const stickerMap = new Map(stickerCatalog.map((sticker) => [sticker.id, sticker]));

const CREATE_TRADE_LUA = `-- geek-sticker-trade-create-v1
local profileRaw = redis.call('GET', KEYS[1])
if not profileRaw then return 'PROFILE_MISSING' end
local profile = cjson.decode(profileRaw)
profile.stickerInventory = profile.stickerInventory or {}
profile.stickerReserved = profile.stickerReserved or {}
local owned = tonumber(profile.stickerInventory[ARGV[1]] or 0)
local reserved = tonumber(profile.stickerReserved[ARGV[1]] or 0)
local quantity = tonumber(ARGV[2])
if owned - reserved < quantity then return 'INSUFFICIENT_STICKERS' end
profile.stickerReserved[ARGV[1]] = reserved + quantity
redis.call('SET', KEYS[1], cjson.encode(profile))
redis.call('SET', KEYS[2], ARGV[3])
redis.call('ZADD', KEYS[3], ARGV[5], ARGV[6])
return 'OK'`;

const ACCEPT_TRADE_LUA = `-- geek-sticker-trade-accept-v1
local offerRaw = redis.call('GET', KEYS[1])
if not offerRaw then return 'TRADE_NOT_FOUND' end
local offer = cjson.decode(offerRaw)
if offer.status ~= 'open' then return 'TRADE_CLOSED' end
if tonumber(offer.expiresAt) <= tonumber(ARGV[1]) then return 'TRADE_EXPIRED' end
if offer.sellerId == ARGV[2] then return 'OWN_TRADE' end
local sellerRaw = redis.call('GET', KEYS[2])
local buyerRaw = redis.call('GET', KEYS[3])
if not sellerRaw or not buyerRaw then return 'PROFILE_MISSING' end
local seller = cjson.decode(sellerRaw)
local buyer = cjson.decode(buyerRaw)
seller.stickerInventory = seller.stickerInventory or {}
seller.stickerReserved = seller.stickerReserved or {}
buyer.stickerInventory = buyer.stickerInventory or {}
buyer.stickerReserved = buyer.stickerReserved or {}
local sellerReserved = tonumber(seller.stickerReserved[offer.giveSticker] or 0)
local sellerOwned = tonumber(seller.stickerInventory[offer.giveSticker] or 0)
if sellerReserved < tonumber(offer.giveQuantity) or sellerOwned < tonumber(offer.giveQuantity) then return 'SELLER_INVENTORY_CHANGED' end
local buyerOwned = tonumber(buyer.stickerInventory[offer.wantSticker] or 0)
local buyerReserved = tonumber(buyer.stickerReserved[offer.wantSticker] or 0)
if buyerOwned - buyerReserved < tonumber(offer.wantQuantity) then return 'INSUFFICIENT_STICKERS' end
seller.stickerReserved[offer.giveSticker] = sellerReserved - tonumber(offer.giveQuantity)
seller.stickerInventory[offer.giveSticker] = sellerOwned - tonumber(offer.giveQuantity)
seller.stickerInventory[offer.wantSticker] = tonumber(seller.stickerInventory[offer.wantSticker] or 0) + tonumber(offer.wantQuantity)
buyer.stickerInventory[offer.wantSticker] = buyerOwned - tonumber(offer.wantQuantity)
buyer.stickerInventory[offer.giveSticker] = tonumber(buyer.stickerInventory[offer.giveSticker] or 0) + tonumber(offer.giveQuantity)
offer.status = 'accepted'
offer.buyerName = ARGV[3]
offer.acceptedAt = tonumber(ARGV[1])
redis.call('SET', KEYS[2], cjson.encode(seller))
redis.call('SET', KEYS[3], cjson.encode(buyer))
redis.call('SET', KEYS[1], cjson.encode(offer), 'EX', ARGV[4])
redis.call('ZREM', KEYS[4], offer.id)
return 'OK'`;

const CANCEL_TRADE_LUA = `-- geek-sticker-trade-cancel-v1
local offerRaw = redis.call('GET', KEYS[1])
if not offerRaw then return 'TRADE_NOT_FOUND' end
local offer = cjson.decode(offerRaw)
if offer.status ~= 'open' then return 'TRADE_CLOSED' end
if offer.sellerId ~= ARGV[1] then return 'TRADE_FORBIDDEN' end
local profileRaw = redis.call('GET', KEYS[2])
if not profileRaw then return 'PROFILE_MISSING' end
local profile = cjson.decode(profileRaw)
profile.stickerReserved = profile.stickerReserved or {}
profile.stickerReserved[offer.giveSticker] = math.max(0, tonumber(profile.stickerReserved[offer.giveSticker] or 0) - tonumber(offer.giveQuantity))
offer.status = 'cancelled'
offer.cancelledAt = tonumber(ARGV[2])
redis.call('SET', KEYS[2], cjson.encode(profile))
redis.call('SET', KEYS[1], cjson.encode(offer), 'EX', ARGV[3])
redis.call('ZREM', KEYS[3], offer.id)
return 'OK'`;

const throwForResult = (result) => {
  if (result === 'OK') return;
  if (['INSUFFICIENT_STICKERS', 'OWN_TRADE', 'TRADE_CLOSED', 'TRADE_EXPIRED', 'SELLER_INVENTORY_CHANGED'].includes(result)) throw new Error(`STICKER_${result}`);
  if (result === 'TRADE_NOT_FOUND') throw new Error('STICKER_TRADE_NOT_FOUND');
  if (result === 'TRADE_FORBIDDEN') throw new Error('STICKER_TRADE_FORBIDDEN');
  throw new Error('STICKER_TRADE_FAILED');
};

const safeOffer = (offer, playerId) => {
  const give = stickerMap.get(offer.giveSticker);
  const want = stickerMap.get(offer.wantSticker);
  if (!give || !want) return null;
  return {
    id: offer.id,
    sellerName: offer.sellerName,
    give: { ...give, quantity: offer.giveQuantity },
    want: { ...want, quantity: offer.wantQuantity },
    status: offer.status,
    createdAt: offer.createdAt,
    expiresAt: offer.expiresAt,
    own: offer.sellerId === playerId
  };
};

const auditTrade = async (type, playerId, offer, reason) => {
  try {
    await recordAuditEvent({
      type,
      actorType: 'alpha-player',
      actorId: playerId,
      objectType: 'sticker-trade',
      objectId: offer.id,
      interactionId: offer.id,
      outcome: 'success',
      reason,
      details: { giveSticker: offer.giveSticker, giveQuantity: offer.giveQuantity, wantSticker: offer.wantSticker, wantQuantity: offer.wantQuantity, settlement: 'off-chain-alpha' }
    });
  } catch (error) {
    console.error('Sticker trade audit event failed', error);
  }
};

export const listStickerTrades = async (playerId, limit = 30) => {
  const expiredIds = await redis('ZRANGEBYSCORE', TRADE_INDEX, '-inf', Date.now(), 'LIMIT', 0, 50);
  for (const id of expiredIds) {
    const expired = parseStoredJson(await redis('GET', tradeKey(id)));
    if (!expired) {
      await redis('ZREM', TRADE_INDEX, id);
      continue;
    }
    try {
      const result = await redis('EVAL', CANCEL_TRADE_LUA, 3, tradeKey(id), profileKeyFor(expired.sellerId), TRADE_INDEX, expired.sellerId, Date.now(), TRADE_TTL_SECONDS);
      throwForResult(result);
      await auditTrade('collectible.trade-expired', expired.sellerId, expired, 'expired-offer-released-reserved-inventory');
    } catch (error) {
      if (!['STICKER_TRADE_CLOSED', 'STICKER_TRADE_NOT_FOUND'].includes(error?.message)) console.error('Expired sticker trade cleanup failed', error);
    }
  }
  const ids = await redis('ZREVRANGE', TRADE_INDEX, 0, Math.max(0, Math.min(50, limit) - 1));
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', tradeKey(id)])) : [];
  const now = Date.now();
  return stored.map(parseStoredJson).filter((offer) => offer?.status === 'open' && Number(offer.expiresAt) > now).map((offer) => safeOffer(offer, playerId)).filter(Boolean);
};

export const createStickerTrade = async ({ playerId, sellerName, giveSticker, giveQuantity, wantSticker, wantQuantity }) => {
  if (!isStickerId(giveSticker) || !isStickerId(wantSticker) || giveSticker === wantSticker) throw new Error('STICKER_TRADE_INVALID');
  const give = Math.floor(Number(giveQuantity));
  const want = Math.floor(Number(wantQuantity));
  if (give < 1 || give > 9 || want < 1 || want > 9) throw new Error('STICKER_TRADE_INVALID');
  const now = Date.now();
  const offer = { id: randomBytes(16).toString('hex'), sellerId: playerId, sellerName: String(sellerName || 'Guest Geek').slice(0, 24), giveSticker, giveQuantity: give, wantSticker, wantQuantity: want, status: 'open', createdAt: now, expiresAt: now + TRADE_TTL_SECONDS * 1000 };
  const result = await redis('EVAL', CREATE_TRADE_LUA, 3, profileKeyFor(playerId), tradeKey(offer.id), TRADE_INDEX, giveSticker, give, JSON.stringify(offer), TRADE_TTL_SECONDS, offer.expiresAt, offer.id);
  throwForResult(result);
  await auditTrade('collectible.trade-created', playerId, offer, 'player-created-off-chain-sticker-offer');
  return safeOffer(offer, playerId);
};

export const acceptStickerTrade = async ({ playerId, buyerName, tradeId }) => {
  if (!tradeIdPattern.test(String(tradeId || ''))) throw new Error('STICKER_TRADE_NOT_FOUND');
  const offer = parseStoredJson(await redis('GET', tradeKey(tradeId)));
  if (!offer) throw new Error('STICKER_TRADE_NOT_FOUND');
  const result = await redis('EVAL', ACCEPT_TRADE_LUA, 4, tradeKey(tradeId), profileKeyFor(offer.sellerId), profileKeyFor(playerId), TRADE_INDEX, Date.now(), playerId, String(buyerName || 'Guest Geek').slice(0, 24), TRADE_TTL_SECONDS);
  throwForResult(result);
  await auditTrade('collectible.trade-accepted', playerId, offer, 'atomic-off-chain-sticker-swap');
  return { id: tradeId, status: 'accepted' };
};

export const cancelStickerTrade = async ({ playerId, tradeId }) => {
  if (!tradeIdPattern.test(String(tradeId || ''))) throw new Error('STICKER_TRADE_NOT_FOUND');
  const result = await redis('EVAL', CANCEL_TRADE_LUA, 3, tradeKey(tradeId), profileKeyFor(playerId), TRADE_INDEX, playerId, Date.now(), TRADE_TTL_SECONDS);
  throwForResult(result);
  await auditTrade('collectible.trade-cancelled', playerId, { id: tradeId, giveSticker: '', giveQuantity: 0, wantSticker: '', wantQuantity: 0 }, 'seller-cancelled-off-chain-sticker-offer');
  return { id: tradeId, status: 'cancelled' };
};
