import { auditWriteCommands, createAuditRecord } from './audit.js';
import { pipeline, redis } from './redis.js';
import { initialPrestigeState, migrateLegacyPrestige, prestigeKeyFor, validatePrestigeState } from './prestige-state.js';

export const profileKeyFor = (sessionId) => `geek:profile:${sessionId}`;

export const defaultProfile = () => ({
  balance: 0,
  xp: 0,
  prestigeState: initialPrestigeState(),
  bestRound: 0,
  bestScore: 0,
  bestDailyScore: 0,
  bestSpeedScore: 0,
  totalRuns: 0,
  totalCorrect: 0,
  totalQuestions: 0,
  longestStreak: 0,
  gauntletsCompleted: 0,
  categoryStats: {},
  journey: [],
  avatarId: 'giga-genesis',
  stickerInventory: { 'giga-core': 2, 'kaspa-k': 2, 'dag-node': 1, 'signal-verified': 1 },
  stickerReserved: {},
  payoutAddress: '',
  payoutAddressSetAt: 0,
  payoutAddressVersion: 0,
  payoutAddressEligibleAt: 0,
  payoutMutationHistory: [],
  payoutReviewId: '',
  payoutReviewStatus: 'not-required',
  payoutRiskReasons: [],
  payoutNotice: null
});

export const loadProfile = async (sessionId) => {
  const [raw, prestigeRaw] = await pipeline([['GET', profileKeyFor(sessionId)], ['GET', prestigeKeyFor(sessionId)]]);
  let profile;
  try {
    profile = raw ? { ...defaultProfile(), ...JSON.parse(raw) } : defaultProfile();
  } catch {
    profile = defaultProfile();
  }
  let stateRaw = prestigeRaw;
  if (!stateRaw) {
    await redis('SET', prestigeKeyFor(sessionId), JSON.stringify(raw ? migrateLegacyPrestige(profile) : initialPrestigeState()), 'NX');
    stateRaw = await redis('GET', prestigeKeyFor(sessionId));
  }
  profile.prestigeState = validatePrestigeState(JSON.parse(stateRaw));
  return profile;
};

// Prestige is authoritative in its own ledger; stale profile writes cannot reset it.
const profileJson = profile => { const { prestigeState, ...stored } = profile; return JSON.stringify(stored); };

export const saveProfile = async (sessionId, profile) => {
  await redis('SET', profileKeyFor(sessionId), profileJson(profile));
  return profile;
};

export const saveProfileWithAudit = async (sessionId, profile, auditInput, extraCommands = []) => {
  const record = await createAuditRecord({
    actorType: 'alpha-session',
    actorId: sessionId,
    interactionId: sessionId,
    ...auditInput
  });
  await pipeline([
    ['SET', profileKeyFor(sessionId), profileJson(profile)],
    ...extraCommands,
    ...auditWriteCommands(record)
  ], true);
  return { profile, audit: record };
};

// Compare-and-set preserves JSON arrays and concurrent game/wallet updates.
export const AVATAR_PATCH_LUA = `-- geek-avatar-patch-v1
local previous = redis.call('GET', KEYS[1]) or ''
if previous ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2])
redis.call('SET', KEYS[2], ARGV[3], 'NX')
redis.call('ZADD', KEYS[3], ARGV[4], ARGV[5])
return 1
`;
export const saveAvatarWithAudit = async (playerId, avatarId, customization = null) => {
  const record = await createAuditRecord({ actorType: 'alpha-session', actorId: playerId, interactionId: playerId,
    type: customization ? 'collectible.avatar-customized' : 'collectible.avatar-selected', severity: 'info', objectType: 'avatar', objectId: avatarId,
    outcome: 'success', reason: 'player-equipped-profile-cosmetic', details: { avatarId, collectionStatus: 'off-chain-alpha' } });
  const [event, index] = auditWriteCommands(record);
  for (let attempt = 0; attempt < 5; attempt++) {
    const previous = await redis('GET', profileKeyFor(playerId));
    const stored = previous ? JSON.parse(previous) : defaultProfile();
    if (!stored || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('PROFILE_STATE_INVALID');
    const next = { ...stored, avatarId, ...(customization ? { avatarCustomization: customization } : {}) };
    const saved = await redis('EVAL', AVATAR_PATCH_LUA, 3, profileKeyFor(playerId), event[1], index[1], previous || '', JSON.stringify(next), event[2], index[2], index[3]);
    if (Number(saved) === 1) return;
  }
  throw new Error('PROFILE_BUSY');
};
