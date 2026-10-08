import { createHmac, timingSafeEqual } from 'node:crypto';
import { redis, rateLimit } from './redis.js';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const decodeTotpSecret = value => {
  const text = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!/^[A-Z2-7]{32,104}$/.test(text)) throw new Error('OPS_NOT_CONFIGURED');
  let bits = 0, accumulator = 0; const bytes = [];
  for (const character of text) {
    accumulator = ((accumulator << 5) | alphabet.indexOf(character)) & 0xffff; bits += 5;
    while (bits >= 8) { bits -= 8; bytes.push((accumulator >>> bits) & 255); }
  }
  if (bytes.length < 20 || bytes.length > 64 || bits >= 5 || (accumulator & ((1 << bits) - 1))) throw new Error('OPS_NOT_CONFIGURED');
  return Buffer.from(bytes);
};
export const operationsMfaSecret = () => process.env.OPS_TOTP_SECRET === undefined ? null : decodeTotpSecret(process.env.OPS_TOTP_SECRET);
export const hotpCode = (secret, counter, digits = 6) => {
  if (!Number.isSafeInteger(counter) || counter < 0 || ![6, 8].includes(digits)) throw new Error('OPS_NOT_CONFIGURED');
  const message = Buffer.alloc(8); message.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac('sha1', secret).update(message).digest(), offset = mac[mac.length - 1] & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** digits).padStart(digits, '0');
};
const CLAIM = `
-- geek-ops-totp-claim-v1
local old = redis.call('GET', KEYS[1])
if old and (not tonumber(old) or tonumber(old) >= tonumber(ARGV[1])) then return 0 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', 120)
return 1
`;
export const consumeOperationsCode = async (current, value) => {
  if (!current.totpSecret) return true;
  if (typeof value !== 'string' || !/^\d{6}$/.test(value)) return false;
  // A per-owner budget cannot be reset by changing a browser's User-Agent or IP.
  await rateLimit('ops-mfa', current.totpFingerprint, 8, 60);
  const time = await redis('TIME');
  if (!Array.isArray(time) || !/^\d+$/.test(String(time[0])) || !Number.isSafeInteger(Number(time[0]))) throw new Error('OPS_MFA_UNAVAILABLE');
  const step = Math.floor(Number(time[0]) / 30); let matched = -1;
  // Compare all three candidates; the newest match wins if six-digit codes collide.
  for (const counter of [step - 1, step, step + 1]) {
    if (counter < 0) continue;
    if (timingSafeEqual(Buffer.from(value), Buffer.from(hotpCode(current.totpSecret, counter)))) matched = counter;
  }
  if (matched < 0) return false;
  return await redis('EVAL', CLAIM, 1, `geek:ops:totp:${current.totpFingerprint}`, matched) === 1;
};
