import { createHash, randomBytes } from 'node:crypto';
import { redis } from './redis.js';

export const passkeyAccountKey = id => `geek:passkey:account:v1:${id}`;
const key = token => `geek:passkey:grant:v1:${createHash('sha256').update(token).digest('hex')}`;
export const issuePasskeyGrant = async (session, walletVersion) => {
  const token = randomBytes(32).toString('hex');
  const grant = { sessionId: session.id, playerId: session.playerId || session.id, walletVersion, expiresAt: Date.now() + 300000 };
  if (await redis('SET', key(token), JSON.stringify(grant), 'EX', 300, 'NX') !== 'OK') throw new Error('PASSKEY_UNAVAILABLE');
  return { token, expiresAt: grant.expiresAt };
};
export const consumePasskeyGrant = async (session, token, walletVersion) => {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('PASSKEY_REAUTH_REQUIRED');
  const raw = await redis('GETDEL', key(token));
  let g; try { g = JSON.parse(raw); } catch { /* reject below */ }
  if (!g || g.sessionId !== session.id || g.playerId !== (session.playerId || session.id)
    || g.walletVersion !== walletVersion || !Number.isSafeInteger(g.expiresAt) || g.expiresAt <= Date.now()) throw new Error('PASSKEY_REAUTH_REQUIRED');
};
