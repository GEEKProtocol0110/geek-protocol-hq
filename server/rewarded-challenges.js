import { loadProfile, saveProfileWithAudit } from './profile.js';
import { deriveProgression } from './progression.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';
import { careerCatalog, careerSeries, careerChallengeState } from './career-challenges.js';

// Stable IDs are permanent claim receipts, independent of the bounded journey log.
const words = [
  { id: 'grid-word-1', word: 'curiosity', name: 'The first spark', hint: 'Begin where your first steps into Kaspa start.', href: '/', xp: 25 },
  { id: 'grid-word-2', word: 'verify', name: 'Check the signal', hint: 'A quiet signal waits after the guided lessons.', href: '/study/', xp: 25 },
  { id: 'grid-word-3', word: 'blockdag', name: 'Follow the branches', hint: 'Explore the Kaspa field guide, right to its last signal.', href: '/kaspa/', xp: 25 },
  { id: 'grid-word-4', word: 'connect', name: 'Useful connections', hint: 'Look among the tools built for curious Geeks.', href: '/tools/', xp: 25 },
  { id: 'grid-word-5', word: 'hope', name: 'A grateful signal', hint: 'Find the place where we thank the builders.', href: '/thanks/', xp: 25 }
];
const bonus = { id: 'grid-five-bonus', name: 'Omniscient explorer', xp: 75 };
const claimed = (p, id) => Object.hasOwn(p.challengeClaims, id);
export const rewardChallengeStatus = p => {
  const {tasks,...career}=careerChallengeState(p);
  return {
  words: words.map(({ word, ...item }) => ({ ...item, claimed: claimed(p, item.id), ...(claimed(p, item.id) ? { word: word.toUpperCase() } : {}) })),
  tasks, career,
  bonus: { ...bonus, claimed: claimed(p, bonus.id) },
  found: words.filter(w => claimed(p, w.id)).length,
  earnedXp: Object.values(p.challengeClaims).reduce((sum, c) => sum + c.xp, 0),
  progression: deriveProgression(p)
}; };

const resolveReward = body => {
  if (body.action === 'word' && Object.keys(body).every(k => ['action', 'word'].includes(k))) {
    if (typeof body.word !== 'string' || body.word.length > 32 || !/^[a-z]+$/i.test(body.word.trim())) throw new Error('INVALID_REQUEST');
    const found = words.find(w => w.word === body.word.trim().toLowerCase());
    if (!found) throw new Error('DISCOVERY_WORD_UNKNOWN');
    return found;
  }
  if (body.action === 'claim' && Object.keys(body).every(k => ['action', 'id'].includes(k))) {
    const task = careerCatalog.find(t => t.id === body.id);
    if (task) return task;
  }
  throw new Error('INVALID_REQUEST');
};

const commitChallenges = async (playerId, select) => {
  for (let attempt = 0; attempt < 6; attempt++) {
    const profile = await loadProfile(playerId), items=select(profile).filter(item=>!claimed(profile,item.id));
    if (!items.length) return { ...rewardChallengeStatus(profile), awards: [], alreadyClaimed: true };
    const state=careerChallengeState(profile);
    for(const item of items) if(item.metric&&!state.tasks.find(t=>t.id===item.id).eligible)throw new Error('CHALLENGE_NOT_READY');
    const at=Date.now(), awards=items.map(item=>({id:item.id,name:item.name,xp:item.xp}));
    for(const item of items)profile.challengeClaims[item.id]={at,xp:item.xp};
    if (words.every(w=>claimed(profile,w.id))&&!claimed(profile,bonus.id)) { profile.challengeClaims[bonus.id]={at,xp:bonus.xp};awards.push(bonus); }
    const xp=awards.reduce((sum,a)=>sum+a.xp,0);
    if (!Number.isSafeInteger(profile.xp+xp))throw new Error('PROFILE_STATE_INVALID');
    profile.xp+=xp;
    profile.journey=[...awards.map(a=>({id:`challenge:${a.id}`,type:'challenge',at,name:a.name,xp:a.xp})),...profile.journey].slice(0,80);
    try {
      await saveProfileWithAudit(playerId,profile,{type:'player.challenge-claimed',severity:'info',objectType:'challenge',objectId:items[0].id,outcome:'success',reason:'one-time-server-verified-challenge',details:{xp,challenges:awards.map(a=>a.id),settlement:'disabled'}});
      return {...rewardChallengeStatus(profile),awards,alreadyClaimed:false};
    } catch(error){if(error.message!=='PROFILE_STATE_CHANGED')throw error;}
  }
  throw new Error('PROFILE_BUSY');
};
export const claimChallenge = async (playerId, body) => { const item=resolveReward(body);return commitChallenges(playerId,()=>[item]); };
export const claimReadyChallenges = async (playerId, ids) => {
  if(!Array.isArray(ids)||ids.length<1||ids.length>8||new Set(ids).size!==ids.length||ids.some(id=>typeof id!=='string'||!careerCatalog.some(t=>t.id===id)))throw new Error('INVALID_REQUEST');
  const items=ids.map(id=>careerCatalog.find(t=>t.id===id));return commitChallenges(playerId,()=>items);
};

export const trackCareerChallenge = async (playerId, id, tracked) => {
  if (typeof tracked!=='boolean' || !careerSeries.some(s=>s.id===id)) throw new Error('INVALID_REQUEST');
  for(let attempt=0;attempt<6;attempt++) {
    const profile=await loadProfile(playerId), tracks=profile.challengeTracks;
    if (tracks.includes(id)===tracked) return {...rewardChallengeStatus(profile),awards:[],trackingUpdated:true};
    if (tracked && tracks.length>=3) throw new Error('CHALLENGE_TRACK_LIMIT');
    profile.challengeTracks=tracked?[...tracks,id]:tracks.filter(x=>x!==id);
    try {
      await saveProfileWithAudit(playerId,profile,{type:'player.challenge-tracked',severity:'info',objectType:'challenge-track',objectId:id,outcome:'success',reason:'player-selected-career-goal',details:{tracked:profile.challengeTracks.length}});
      return {...rewardChallengeStatus(profile),awards:[],trackingUpdated:true};
    } catch(error) { if(error.message!=='PROFILE_STATE_CHANGED') throw error; }
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
    if (body.action === 'claim-ready' && Object.keys(body).every(k=>['action','ids'].includes(k))) return sendJson(res,200,{ok:true,...await claimReadyChallenges(playerId,body.ids)});
    if (body.action === 'track' && Object.keys(body).every(k=>['action','id','tracked'].includes(k))) return sendJson(res,200,{ok:true,...await trackCareerChallenge(playerId,body.id,body.tracked)});
    return sendJson(res, 200, { ok: true, ...await claimChallenge(playerId, body) });
  } catch (error) { return handleApiError(res, error); }
}
