import { cleanName, createSessionId, readSessionId, sessionTtl, setSessionCookie } from './http.js';
import { identityPlayerKey } from './identity-keys.js';
import { parseStoredJson, redis } from './redis.js';

const keyFor = (id) => `geek:session:${id}`;

export const readSession = async (req) => {
  const id = readSessionId(req);
  if (!id) return null;
  const stored = await redis('GET', keyFor(id));
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    if (session?.id !== id) return null;
    if (session.identityVersion) {
      const identity = parseStoredJson(await redis('GET', identityPlayerKey(session.playerId)));
      if (!identity || Number(identity.sessionVersion) !== Number(session.identityVersion)) return null;
    }
    return session;
  } catch {
    return null;
  }
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
  await redis('SET', keyFor(session.id), JSON.stringify(session), 'EX', sessionTtl);
  setSessionCookie(res, session.id);
  return session;
};
