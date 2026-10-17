import { loadProfile, saveProfileWithAudit } from './profile.js';
import { deriveProgression } from './progression.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

// Stable IDs are permanent claim receipts, independent of the bounded journey log.
const words = [
  { id: 'grid-word-1', word: 'curiosity', name: 'The first spark', hint: 'Begin where your first steps into Kaspa start.', href: '/', xp: 25 },
  { id: 'grid-word-2', word: 'verify', name: 'Check the signal', hint: 'A quiet signal waits after the guided lessons.', href: '/study/', xp: 25 },
  { id: 'grid-word-3', word: 'blockdag', name: 'Follow the branches', hint: 'Explore the Kaspa field guide, right to its last signal.', href: '/kaspa/', xp: 25 },
  { id: 'grid-word-4', word: 'connect', name: 'Useful connections', hint: 'Look among the tools built for curious Geeks.', href: '/tools/', xp: 25 },
  { id: 'grid-word-5', word: 'hope', name: 'A grateful signal', hint: 'Find the place where we thank the builders.', href: '/thanks/', xp: 25 }
];
const tasks = [
  { id: 'first-scored-round', name: 'Make your first move', detail: 'Complete a scored Gauntlet, Daily or Speed round.', href: '/play/', xp: 50, eligible: p => Object.values(p.categoryStats).some(s => Number.isSafeInteger(s?.rounds) && s.rounds > 0), progress: p => Object.values(p.categoryStats).some(s => s?.rounds > 0) ? 1 : 0, target: 1 },
  { id: 'kaspa-25-correct', name: 'Build your Kaspa knowledge', detail: 'Answer 25 Kaspa questions correctly in scored rounds.', href: '/play/?mode=daily&category=kaspa#timed-games', xp: 75, eligible: p => Number.isSafeInteger(p.categoryStats.kaspa?.correct) && p.categoryStats.kaspa.correct >= 25, progress: p => Math.min(25, p.categoryStats.kaspa?.correct || 0), target: 25 }
];
const bonus = { id: 'grid-five-bonus', name: 'Omniscient explorer', xp: 75 };
const claimed = (p, id) => Object.hasOwn(p.challengeClaims, id);
export const rewardChallengeStatus = p => ({
  words: words.map(({ word, ...item }) => ({ ...item, claimed: claimed(p, item.id), ...(claimed(p, item.id) ? { word: word.toUpperCase() } : {}) })),
  tasks: tasks.map(({ eligible, progress, ...item }) => ({ ...item, eligible: eligible(p), progress: progress(p), claimed: claimed(p, item.id) })),
  bonus: { ...bonus, claimed: claimed(p, bonus.id) },
  found: words.filter(w => claimed(p, w.id)).length,
  earnedXp: Object.values(p.challengeClaims).reduce((sum, c) => sum + c.xp, 0),
  progression: deriveProgression(p)
});

const resolveReward = body => {
  if (body.action === 'word' && Object.keys(body).every(k => ['action', 'word'].includes(k))) {
    if (typeof body.word !== 'string' || body.word.length > 32 || !/^[a-z]+$/i.test(body.word.trim())) throw new Error('INVALID_REQUEST');
    const found = words.find(w => w.word === body.word.trim().toLowerCase());
    if (!found) throw new Error('DISCOVERY_WORD_UNKNOWN');
    return found;
  }
  if (body.action === 'claim' && Object.keys(body).every(k => ['action', 'id'].includes(k))) {
    const task = tasks.find(t => t.id === body.id);
    if (task) return task;
  }
  throw new Error('INVALID_REQUEST');
};

export const claimChallenge = async (playerId, body) => {
  const item = resolveReward(body);
  for (let attempt = 0; attempt < 6; attempt++) {
    const profile = await loadProfile(playerId);
    if (claimed(profile, item.id)) return { ...rewardChallengeStatus(profile), awards: [], alreadyClaimed: true };
    if (item.eligible && !item.eligible(profile)) throw new Error('CHALLENGE_NOT_READY');
    const at = Date.now(), awards = [{ id: item.id, name: item.name, xp: item.xp }];
    profile.challengeClaims[item.id] = { at, xp: item.xp };
    if (words.every(w => claimed(profile, w.id)) && !claimed(profile, bonus.id)) {
      profile.challengeClaims[bonus.id] = { at, xp: bonus.xp }; awards.push(bonus);
    }
    const xp = awards.reduce((sum, award) => sum + award.xp, 0);
    if (!Number.isSafeInteger(profile.xp + xp)) throw new Error('PROFILE_STATE_INVALID');
    profile.xp += xp;
    profile.journey = [...awards.map(a => ({ id: `challenge:${a.id}`, type: 'challenge', at, name: a.name, xp: a.xp })), ...profile.journey].slice(0, 80);
    try {
      await saveProfileWithAudit(playerId, profile, { type: 'player.challenge-claimed', severity: 'info', objectType: 'challenge', objectId: item.id,
        outcome: 'success', reason: 'one-time-server-verified-challenge', details: { xp, challenges: awards.map(a => a.id), settlement: 'disabled' } });
      return { ...rewardChallengeStatus(profile), awards, alreadyClaimed: false };
    } catch (error) { if (error.message !== 'PROFILE_STATE_CHANGED') throw error; }
  }
  throw new Error('PROFILE_BUSY');
};

export default async function rewardedChallengesHandler(req, res) {
  setApiHeaders(res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST, OPTIONS');
  try {
    if (req.headers?.['sec-fetch-site'] === 'cross-site') return sendJson(res, 403, { ok: false, error: 'Open challenges on Geek Protocol before claiming XP.' });
    const session = await requireSession(req), playerId = playerIdFor(session), body = parseBody(req);
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('INVALID_REQUEST');
    await rateLimit('discovery-ip', clientFingerprint(req), 120, 300);
    await rateLimit('discovery-player', playerId, 60, 300);
    if (body.action === 'status' && Object.keys(body).length === 1) return sendJson(res, 200, { ok: true, ...rewardChallengeStatus(await loadProfile(playerId)) });
    return sendJson(res, 200, { ok: true, ...await claimChallenge(playerId, body) });
  } catch (error) { return handleApiError(res, error); }
}
