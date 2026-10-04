import { auditWriteCommands, createAuditRecord } from './audit.js';
import { loadProfile, profileKeyFor } from './profile.js';
import { buildJourneyProfile, deriveProgression } from './progression.js';
import { prestigeKeyFor, validatePrestigeState } from './prestige-state.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { pipeline, rateLimit, redis } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

export const PRESTIGE_LUA = `-- geek-prestige-v1
if (redis.call('GET', KEYS[1]) or '') ~= ARGV[1] then return 0 end
if (redis.call('GET', KEYS[2]) or '') ~= ARGV[2] then return 0 end
redis.call('SET', KEYS[2], ARGV[3])
redis.call('SET', KEYS[3], ARGV[4], 'NX')
redis.call('ZADD', KEYS[4], ARGV[5], ARGV[6])
return 1`;

export const enterPrestige = async (playerId, expectedPrestige) => {
  if (!Number.isInteger(expectedPrestige) || expectedPrestige < 0 || expectedPrestige > 25) throw new Error('INVALID_REQUEST');
  await loadProfile(playerId); // Creates the one-time legacy migration if needed.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [raw, stateRaw] = await pipeline([['GET', profileKeyFor(playerId)], ['GET', prestigeKeyFor(playerId)]]);
    const stored = raw ? JSON.parse(raw) : { xp: 0 };
    const state = validatePrestigeState(JSON.parse(stateRaw));
    const before = deriveProgression({ ...stored, prestigeState: state });
    if (state.prestige !== expectedPrestige) throw new Error('PRESTIGE_CHANGED');
    if (state.prestige === 25) throw new Error('PRESTIGE_MAXED');
    if (!before.canPrestige) throw new Error('PRESTIGE_LEVEL_REQUIRED');
    const next = { ...state, prestige: state.prestige + 1, xpBaseline: before.xp };
    const after = deriveProgression({ ...stored, prestigeState: next });
    const event = { id: `prestige:${next.prestige}`, type: 'prestige', at: Date.now(), prestige: next.prestige, title: after.title, cycleLevels: 50 };
    next.history = [event, ...state.history].slice(0, 25);
    const record = await createAuditRecord({ actorType: 'alpha-session', actorId: playerId, interactionId: event.id, type: 'player.prestiged', severity: 'info', objectType: 'player', objectId: playerId, outcome: 'success', reason: 'player-chose-level-50-reset', details: { prestige: next.prestige, lifetimeXp: before.xp, levelBefore: 50, levelAfter: 1 } });
    const [audit, index] = auditWriteCommands(record);
    const saved = await redis('EVAL', PRESTIGE_LUA, 4, profileKeyFor(playerId), prestigeKeyFor(playerId), audit[1], index[1], raw || '', stateRaw, JSON.stringify(next), audit[2], index[2], index[3]);
    if (Number(saved) === 1) return loadProfile(playerId);
  }
  throw new Error('PROFILE_BUSY');
};

export default async function prestigeHandler(req, res) {
  setApiHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');
  try {
    const session = await requireSession(req), playerId = playerIdFor(session);
    await rateLimit('prestige', playerId, 10, 300);
    await rateLimit('prestige-ip', clientFingerprint(req), 20, 300);
    const body = parseBody(req);
    if (body.action !== 'prestige' || body.confirm !== true || Object.keys(body).some(key => !['action', 'confirm', 'expectedPrestige'].includes(key))) throw new Error('INVALID_REQUEST');
    const profile = await enterPrestige(playerId, body.expectedPrestige);
    return sendJson(res, 200, { ok: true, verified: true, profile: buildJourneyProfile(profile, session) });
  } catch (error) { return handleApiError(res, error); }
}
