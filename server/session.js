import { cleanName, createSessionId, readSessionId, sessionTtl, setSessionCookie } from './http.js';
import { identityPlayerKey } from './identity-keys.js';
import { redis } from './redis.js';
import { decodePasskeyAccount } from './passkey-records.js';
import { passkeyAccountKey } from './passkey-grants.js';
import { decodeIdentityRecord, decodeSessionRecord, validateSessionRecord } from './identity-records.js';

const keyFor = (id) => `geek:session:${id}`;
// Keep names separate from game profiles so concurrent score writes cannot undo an edit.
const nameKeyFor = (id) => `geek:player-name:${id}`;
// Keep the exact validated storage snapshot private to this request object.
const snapshots = new WeakMap();
const SAVE_SESSION = `-- geek-session-save-v1
local current = redis.call('GET', KEYS[1])
if ARGV[1] == '' then
  if current then return 'CHANGED' end
else
  if not current then return 'MISSING' end
  if current ~= ARGV[1] then return 'CHANGED' end
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
if ARGV[5] == 'rename' then
  redis.call('SET', KEYS[2], ARGV[4])
else
  redis.call('SET', KEYS[2], ARGV[4], 'NX')
end
return 'OK'`;

export const readSession = async (req) => {
  const id = readSessionId(req);
  if (!id) return null;
  const stored = await redis('GET', keyFor(id));
  const session = decodeSessionRecord(stored, id);
  if (!session) return null;
  if (session.passkeyEpoch) {
    const account = decodePasskeyAccount(await redis('GET', passkeyAccountKey(playerIdFor(session))), playerIdFor(session));
    if (!account || account.epoch !== session.passkeyEpoch || !account.credentials.length) return null;
    const wallet = decodeIdentityRecord(await redis('GET', identityPlayerKey(playerIdFor(session))), playerIdFor(session));
    if (account.walletVersion !== (wallet?.sessionVersion || 0)) return null;
  }
  if (session.identityVersion) {
    const identity = decodeIdentityRecord(await redis('GET', identityPlayerKey(session.playerId)), session.playerId);
    if (!identity) throw new Error('IDENTITY_STATE_INVALID');
    if (identity.sessionVersion !== session.identityVersion) return null;
  }
  const savedName = await redis('GET', nameKeyFor(playerIdFor(session)));
  if (savedName) session.name = cleanName(savedName, session.name);
  snapshots.set(session, stored);
  return session;
};

export const playerIdFor = (session) => String(session?.playerId || session?.id || '');

export const requireSession = async (req) => {
  const session = await readSession(req);
  if (!session) throw new Error('SESSION_REQUIRED');
  return session;
};

export const upsertSession = async (req, res, requestedName) => {
  const existing = await readSession(req);
  const now = Date.now();
  const session = {
    id: existing?.id || createSessionId(),
    playerId: existing?.playerId || existing?.id || '',
    identityVersion: Number(existing?.identityVersion || 0),
    ...(existing?.passkeyEpoch ? { passkeyEpoch: existing.passkeyEpoch } : {}),
    name: cleanName(requestedName, existing?.name || 'Guest Geek'),
    createdAt: existing?.createdAt || now,
    lastSeen: now
  };
  if (!session.playerId) session.playerId = session.id;
  validateSessionRecord(session, session.id);
  const previous = existing ? snapshots.get(existing) : '';
  if (existing && typeof previous !== 'string') throw new Error('SESSION_STATE_INVALID');
  // Session and name commit together, only against the exact validated snapshot.
  // Never overwrite newer wallet/passkey protection or resurrect a revoked cookie.
  const saved = await redis('EVAL', SAVE_SESSION, 2, keyFor(session.id), nameKeyFor(session.playerId),
    previous, JSON.stringify(session), sessionTtl, session.name,
    typeof requestedName === 'string' && cleanName(requestedName, '') ? 'rename' : 'refresh');
  if (saved !== 'OK') throw new Error(saved === 'MISSING' ? 'SESSION_REQUIRED' : 'SESSION_CHANGED');
  setSessionCookie(res, session.id);
  return session;
};
