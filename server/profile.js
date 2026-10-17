import { auditWriteCommands, createAuditRecord } from './audit.js';
import { pipeline, redis } from './redis.js';
import { initialPrestigeState, migrateLegacyPrestige, prestigeKeyFor, validatePrestigeState } from './prestige-state.js';

export const profileKeyFor = (sessionId) => `geek:profile:${sessionId}`;
const snapshots = new WeakMap();
export const profileSnapshot = profile => snapshots.get(profile);

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
  challengeClaims: {},
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

export const parseProfile = raw => {
  if (raw === null || raw === undefined) return defaultProfile();
  let value;
  try { value = JSON.parse(raw); } catch { throw new Error('PROFILE_STATE_INVALID'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('PROFILE_STATE_INVALID');
  // Missing legacy fields get their defaults; damaged counters never become zero.
  for (const key of ['xp', 'balance', 'bestRound', 'bestScore', 'bestDailyScore', 'bestSpeedScore', 'totalRuns', 'totalCorrect', 'totalQuestions', 'longestStreak', 'gauntletsCompleted']) {
    if (Object.hasOwn(value, key) && (!Number.isSafeInteger(value[key]) || value[key] < 0)) throw new Error('PROFILE_STATE_INVALID');
  }
  for (const key of ['categoryStats', 'stickerInventory', 'stickerReserved']) {
    if (Object.hasOwn(value, key) && (!value[key] || typeof value[key] !== 'object' || Array.isArray(value[key]))) throw new Error('PROFILE_STATE_INVALID');
  }
  for (const key of ['journey', 'payoutMutationHistory']) {
    if (Object.hasOwn(value, key) && !Array.isArray(value[key])) throw new Error('PROFILE_STATE_INVALID');
  }
  if (Object.hasOwn(value, 'challengeClaims')) {
    const claims = value.challengeClaims;
    if (!claims || typeof claims !== 'object' || Array.isArray(claims) || Object.keys(claims).length > 32) throw new Error('PROFILE_STATE_INVALID');
    for (const [id, claim] of Object.entries(claims)) {
      if (!/^[a-z0-9-]{1,64}$/.test(id) || !claim || typeof claim !== 'object' || Array.isArray(claim)
        || !Number.isSafeInteger(claim.xp) || claim.xp < 0 || claim.xp > 1000
        || !Number.isSafeInteger(claim.at) || claim.at <= 0) throw new Error('PROFILE_STATE_INVALID');
    }
  }
  return { ...defaultProfile(), ...value };
};

export const loadProfile = async (sessionId) => {
  const [raw, prestigeRaw] = await pipeline([['GET', profileKeyFor(sessionId)], ['GET', prestigeKeyFor(sessionId)]]);
  const profile = parseProfile(raw);
  let stateRaw = prestigeRaw;
  if (!stateRaw) {
    await redis('SET', prestigeKeyFor(sessionId), JSON.stringify(raw ? migrateLegacyPrestige(profile) : initialPrestigeState()), 'NX');
    stateRaw = await redis('GET', prestigeKeyFor(sessionId));
  }
  profile.prestigeState = validatePrestigeState(JSON.parse(stateRaw));
  snapshots.set(profile, { raw: raw ?? '', prestigeRaw: stateRaw });
  return profile;
};

// Prestige is authoritative in its own ledger; stale profile writes cannot reset it.
export const profileJson = profile => { const { prestigeState, ...stored } = profile; return JSON.stringify(stored); };

export const saveProfile = async (sessionId, profile) => {
  await redis('SET', profileKeyFor(sessionId), profileJson(profile));
  return profile;
};

export const saveProfileWithAudit = async (sessionId, profile, auditInput, extraCommands = []) => {
  const snapshot = profileSnapshot(profile);
  if (!snapshot) throw new Error('PROFILE_STATE_INVALID');
  const next = profileJson(profile); parseProfile(next);
  const record = await createAuditRecord({
    actorType: 'alpha-session',
    actorId: sessionId,
    interactionId: sessionId,
    ...auditInput
  });
  const commands = [...extraCommands, ...auditWriteCommands(record)];
  // Only server-created review/audit commands are accepted by this helper.
  for (const command of commands) {
    if (!['SET', 'ZADD', 'ZREM'].includes(command[0])) throw new Error('AUDIT_STATE_INVALID');
  }
  const result = Number(await redis('EVAL', PROFILE_AUDIT_CAS_LUA, 2 + commands.length,
    profileKeyFor(sessionId), prestigeKeyFor(sessionId), ...commands.map(command => command[1]),
    snapshot.raw, snapshot.prestigeRaw, next, JSON.stringify(commands)));
  if (result === -1) throw new Error('AUDIT_STATE_INVALID');
  if (result !== 1) throw new Error('PROFILE_STATE_CHANGED');
  return { profile, audit: record };
};

export const PROFILE_AUDIT_CAS_LUA = `-- geek-profile-audit-cas-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if (redis.call('GET', KEYS[2]) or '') ~= ARGV[2] then return 0 end
local commands = cjson.decode(ARGV[4])
for _, command in ipairs(commands) do
  if command[1] == 'ZADD' or command[1] == 'ZREM' then
    local kind = redis.call('TYPE', command[2]).ok
    if kind ~= 'none' and kind ~= 'zset' then return -1 end
  end
end
redis.call('SET', KEYS[1], ARGV[3])
for _, command in ipairs(commands) do redis.call(unpack(command)) end
return 1`;

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
    const stored = parseProfile(previous);
    const next = { ...stored, avatarId, ...(customization ? { avatarCustomization: customization } : {}) };
    const saved = await redis('EVAL', AVATAR_PATCH_LUA, 3, profileKeyFor(playerId), event[1], index[1], previous || '', JSON.stringify(next), event[2], index[2], index[3]);
    if (Number(saved) === 1) return;
  }
  throw new Error('PROFILE_BUSY');
};
