import { avatarCatalog, collectibleProfile } from './collectibles.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { loadProfile, saveProfile, saveProfileWithAudit } from './profile.js';
import { buildJourneyProfile, deriveProgression } from './progression.js';
import { rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';
import { acceptStickerTrade, cancelStickerTrade, createStickerTrade, listStickerTrades } from './sticker-trades.js';

const collectibleResponseFor = async (session) => {
  const playerId = playerIdFor(session);
  const trades = await listStickerTrades(playerId);
  const profile = await loadProfile(playerId);
  return {
    collection: collectibleProfile(profile, { progression: deriveProgression(profile), walletProtected: Boolean(session.identityVersion) }),
    trades
  };
};

export const profileHandler = async (req, res) => {
  setApiHeaders(res, 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET, OPTIONS');
  try {
    const session = await requireSession(req);
    const profile = await loadProfile(playerIdFor(session));
    return sendJson(res, 200, { ok: true, verified: true, profile: buildJourneyProfile(profile, session) });
  } catch (error) {
    return handleApiError(res, error);
  }
};

export const collectiblesHandler = async (req, res) => {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    const playerId = playerIdFor(session);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, verified: true, ...(await collectibleResponseFor(session)) });
    if (req.method !== 'POST') return methodNotAllowed(res);
    const body = parseBody(req);
    const action = String(body.action || '');
    await rateLimit('collectibles', playerId, 40, 60 * 5);
    await rateLimit('collectibles-ip', clientFingerprint(req), 80, 60 * 10);

    if (action === 'select-avatar') {
      const profile = await loadProfile(playerId);
      const progression = deriveProgression(profile);
      const avatar = avatarCatalog.find((item) => item.id === body.avatarId);
      if (!avatar || !avatar.unlock({ progression, walletProtected: Boolean(session.identityVersion) })) throw new Error('AVATAR_LOCKED');
      profile.avatarId = avatar.id;
      await saveProfileWithAudit(playerId, profile, {
        type: 'collectible.avatar-selected', severity: 'info', objectType: 'avatar', objectId: avatar.id,
        outcome: 'success', reason: 'player-selected-owned-avatar', details: { avatarId: avatar.id, collectionStatus: 'off-chain-alpha' }
      });
    } else if (action === 'create-trade') {
      const profile = await loadProfile(playerId);
      await saveProfile(playerId, profile);
      await createStickerTrade({ playerId, sellerName: session.name, giveSticker: body.giveSticker, giveQuantity: body.giveQuantity, wantSticker: body.wantSticker, wantQuantity: body.wantQuantity });
    } else if (action === 'accept-trade') {
      const profile = await loadProfile(playerId);
      await saveProfile(playerId, profile);
      await acceptStickerTrade({ playerId, buyerName: session.name, tradeId: body.tradeId });
    } else if (action === 'cancel-trade') {
      await cancelStickerTrade({ playerId, tradeId: body.tradeId });
    } else {
      throw new Error('INVALID_REQUEST');
    }

    return sendJson(res, 200, { ok: true, verified: true, ...(await collectibleResponseFor(session)) });
  } catch (error) {
    return handleApiError(res, error);
  }
};
