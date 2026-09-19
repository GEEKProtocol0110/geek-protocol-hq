import { auditWriteCommands, createAuditRecord } from './audit.js';
import { pipeline, redis } from './redis.js';

const keyFor = (sessionId) => `geek:profile:${sessionId}`;

export const defaultProfile = () => ({
  balance: 0,
  xp: 0,
  bestRound: 0,
  bestScore: 0,
  bestDailyScore: 0,
  bestSpeedScore: 0,
  totalRuns: 0,
  totalCorrect: 0,
  payoutAddress: '',
  payoutAddressSetAt: 0,
  payoutAddressVersion: 0,
  payoutAddressEligibleAt: 0
});

export const loadProfile = async (sessionId) => {
  const raw = await redis('GET', keyFor(sessionId));
  if (!raw) return defaultProfile();
  try {
    return { ...defaultProfile(), ...JSON.parse(raw) };
  } catch {
    return defaultProfile();
  }
};

export const saveProfile = async (sessionId, profile) => {
  await redis('SET', keyFor(sessionId), JSON.stringify(profile));
  return profile;
};

export const saveProfileWithAudit = async (sessionId, profile, auditInput) => {
  const record = await createAuditRecord({
    actorType: 'alpha-session',
    actorId: sessionId,
    interactionId: sessionId,
    ...auditInput
  });
  await pipeline([
    ['SET', keyFor(sessionId), JSON.stringify(profile)],
    ...auditWriteCommands(record)
  ], true);
  return { profile, audit: record };
};
