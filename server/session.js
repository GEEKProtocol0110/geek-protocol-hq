import { cleanName, createSessionId, readSessionId, sessionTtl, setSessionCookie } from './http.js';
import { redis } from './redis.js';

const keyFor = (id) => `geek:session:${id}`;

export const readSession = async (req) => {
  const id = readSessionId(req);
  if (!id) return null;
  const stored = await redis('GET', keyFor(id));
  if (!stored) return null;
  try {
    const session = JSON.parse(stored);
    return session?.id === id ? session : null;
  } catch {
    return null;
  }
};

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
    name: cleanName(requestedName, existing?.name || 'Guest Geek'),
    createdAt: existing?.createdAt || now,
    lastSeen: now
  };
  await redis('SET', keyFor(session.id), JSON.stringify(session), 'EX', sessionTtl);
  setSessionCookie(res, session.id);
  return session;
};
