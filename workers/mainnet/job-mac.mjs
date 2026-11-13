import { createHmac, timingSafeEqual } from 'node:crypto';

// Production-only. HQ and the later worker project read the same name from the secret UI.
// No value belongs in the repository.
export const JOB_HMAC_ENV = 'MAINNET_PAYOUT_JOB_HMAC';

const text = value => value === undefined || value === null ? '' : String(value);

// Explicit field order. Do not use JSON.stringify's array replacer: it drops nested keys.
// State and the journal stay out so the same earning can be reconciled without a new mac.
export function payableCanonical(job) {
  const proof = job?.proof || {};
  return [
    'geek-mainnet-job-mac-v2',
    text(job?.id),
    text(job?.amount),
    text(job?.recipient),
    text(job?.sender),
    text(job?.playerId),
    text(job?.network),
    text(job?.protocol),
    text(job?.ticker),
    text(job?.decimals),
    text(job?.deploymentHash),
    text(job?.configFingerprint),
    text(proof.kind),
    text(proof.round),
    text(proof.correctCount),
    text(proof.runId),
    text(proof.answered),
    text(proof.bankVersion),
    text(proof.season)
  ].join('\n');
}

export function jobMacSecret(env = process.env) {
  const secret = env[JOB_HMAC_ENV] || '';
  return /^[a-f0-9]{64}$/.test(secret) ? secret : '';
}

export function jobMac(job, secret) {
  if (!/^[a-f0-9]{64}$/.test(secret || '')) return null;
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(payableCanonical(job)).digest('hex');
}

export function jobMacMatches(job, secret) {
  const expected = jobMac(job, secret);
  const given = job?.mac;
  if (!expected || typeof given !== 'string' || !/^[a-f0-9]{64}$/.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'));
}
