import { auditWriteCommands, createAuditRecord } from './audit.js';
import { pipeline, redis } from './redis.js';

export const profileKeyFor = (sessionId) => `geek:profile:${sessionId}`;

export const defaultProfile = () => ({
  balance: 0,
  xp: 0,
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
  const raw = await redis('GET', profileKeyFor(sessionId));
  if (!raw) return defaultProfile();
  try {
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultProfile();
  }
};

export const saveProfile = async (sessionId, profile) => {
  await redis('SET', profileKeyFor(sessionId), JSON.stringify(profile));
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
    ['SET', profileKeyFor(sessionId), JSON.stringify(profile)],
    ...extraCommands,
    ...auditWriteCommands(record)
  ], true);
  return { profile, audit: record };
};
