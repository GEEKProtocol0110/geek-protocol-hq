import { expectedRaw } from './schedule.mjs';

// Defense in depth for a future reviewed private-ranked release. These fields
// come from saved server state, never from a client's requested payout/score.
const privateBank = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const liveSeason = value => typeof value === 'string' && /^season-[1-9]\d{0,3}$/.test(value);
export const privateRankedContext = value => Boolean(value && !value.unranked &&
  privateBank(value.bankVersion) && liveSeason(value.season));

// Every accepted proof field is in the v2 MAC. Unknown fields cannot silently
// introduce an unsigned eligibility or amount claim.
const proofFields = 'answered,bankVersion,correctCount,kind,round,runId,season';
export const privateRankedProof = proof => Boolean(privateRankedContext(proof) &&
  Object.keys(proof).sort().join(',') === proofFields &&
  typeof proof.runId === 'string' && /^[a-f0-9]{40}$/.test(proof.runId) && expectedRaw(proof) &&
  (proof.kind === 'daily' ? proof.answered === 5 : proof.kind === 'gauntlet' && proof.answered === 10));
