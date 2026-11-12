import { createHmac, timingSafeEqual } from 'node:crypto';

// Production-only. HQ and the later worker project read the same name from the secret UI.
// No value belongs in the repository.
export const JOB_HMAC_ENV = 'MAINNET_PAYOUT_JOB_HMAC';

const canonical = value => JSON.stringify(value, Object.keys(value).sort());

// Fields that choose who is paid, how much, and for which earning. State, version,
// and the journal are excluded so a later confirmation can keep the same mac.
export function payableIdentity(job) {
  const proof = job?.proof || {};
  return {
    amount: job?.amount,
    configFingerprint: job?.configFingerprint,
    decimals: job?.decimals,
    deploymentHash: job?.deploymentHash,
    id: job?.id,
    network: job?.network,
    playerId: job?.playerId,
    proof: { correctCount: proof.correctCount, kind: proof.kind, round: proof.round, runId: proof.runId },
    protocol: job?.protocol,
    recipient: job?.recipient,
    sender: job?.sender,
    ticker: job?.ticker
  };
}

export function jobMacSecret(env = process.env) {
  const secret = env[JOB_HMAC_ENV] || '';
  return /^[a-f0-9]{64}$/.test(secret) ? secret : '';
}

export function jobMac(job, secret) {
  if (!/^[a-f0-9]{64}$/.test(secret || '')) return null;
  return createHmac('sha256', Buffer.from(secret, 'hex')).update(canonical(payableIdentity(job))).digest('hex');
}

export function jobMacMatches(job, secret) {
  const expected = jobMac(job, secret);
  const given = job?.mac;
  if (!expected || typeof given !== 'string' || !/^[a-f0-9]{64}$/.test(given)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(given, 'hex'));
}
