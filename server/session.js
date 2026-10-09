import { cleanName, createSessionId, readSessionId, sessionTtl, setSessionCookie } from './http.js';
import { identityPlayerKey } from './identity-keys.js';
import { redis } from './redis.js';
import { decodeIdentityRecord, decodeSessionRecord, validateSessionRecord } from './identity-records.js';

const keyFor = (id) => `geek:session:${id}`;
// Keep names separate from game profiles so concurrent score writes cannot undo an edit.
const nameKeyFor = (id) => `geek:player-name:${id}`;

export const readSession = async (req) => {
  const id = readSessionId(req);
  if (!id) return null;
  const stored = await redis('GET', keyFor(id));
  const session = decodeSessionRecord(stored, id);
  if (!session) return null;
  if (session.identityVersion) {
    const identity = decodeIdentityRecord(await redis('GET', identityPlayerKey(session.playerId)), session.playerId);
    if (!identity) throw new Error('IDENTITY_STATE_INVALID');
    if (identity.sessionVersion !== session.identityVersion) return null;
  }
  const savedName = await redis('GET', nameKeyFor(playerIdFor(session)));
  if (savedName) session.name = cleanName(savedName, session.name);
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
    name: cleanName(requestedName, existing?.name || 'Guest Geek'),
    createdAt: existing?.createdAt || now,
    lastSeen: now
  };
  if (!session.playerId) session.playerId = session.id;
  validateSessionRecord(session, session.id);
  if (typeof requestedName === 'string' && cleanName(requestedName, '')) {
    await redis('SET', nameKeyFor(session.playerId), session.name);
  } else {
    // Migrate an older session name without letting a stale tab overwrite a chosen name.
    await redis('SET', nameKeyFor(session.playerId), session.name, 'NX');
  }
  await redis('SET', keyFor(session.id), JSON.stringify(session), 'EX', sessionTtl);
  setSessionCookie(res, session.id);
  return session;
};
