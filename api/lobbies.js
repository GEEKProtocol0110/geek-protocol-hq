import { randomBytes } from 'node:crypto';
import { categories, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { parseStoredJson, pipeline, rateLimit, redis } from '../server/redis.js';
import { requireSession } from '../server/session.js';

const LOBBY_TTL = 60 * 60 * 24;
const PRESENCE_WINDOW = 45_000;
const INDEX_KEY = 'geek:lobbies';
const codePattern = /^GEEK-[A-Z2-9]{6}$/;
const roomKey = (code) => `geek:lobby:${code}`;
const presenceKey = (code) => `geek:lobby:${code}:presence`;
const membersKey = (code) => `geek:lobby:${code}:members`;
const cleanCode = (value) => String(value || '').trim().toUpperCase();
const publicRoom = ({ hostId, ...room }) => room;

const generateCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return `GEEK-${[...randomBytes(6)].map((value) => alphabet[value % alphabet.length]).join('')}`;
};

const cleanRoomInput = (body) => {
  const category = categories.has(body.category) ? body.category : 'kaspa';
  const seats = [2, 4, 8].includes(Number(body.seats)) ? Number(body.seats) : 4;
  const focus = ['ghostdag', 'builders'].includes(body.focus) ? body.focus : '';
  const mode = ['gauntlet', 'daily', 'speed'].includes(body.mode) ? body.mode : 'gauntlet';
  return {
    name: String(body.name || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 36) || 'Kaspa Study Hall',
    category,
    seats,
    focus,
    mode
  };
};

const activeMembers = async (code, room) => {
  const now = Date.now();
  const cutoff = now - PRESENCE_WINDOW;
  const [rawMembers] = await pipeline([
    ['ZRANGEBYSCORE', presenceKey(code), cutoff, '+inf']
  ]);
  const ids = Array.isArray(rawMembers) ? rawMembers.slice(0, room.seats) : [];
  if (!ids.length) return [];
  const details = await pipeline(ids.map((id) => ['HGET', membersKey(code), id]));
  return details.map(parseStoredJson).filter(Boolean).map(({ name, joinedAt, host }) => ({ name, joinedAt, host: Boolean(host) }));
};

const getRoom = async (code) => {
  if (!codePattern.test(code)) throw new Error('ROOM_NOT_FOUND');
  const room = parseStoredJson(await redis('GET', roomKey(code)));
  if (!room) throw new Error('ROOM_NOT_FOUND');
  const members = await activeMembers(code, room);
  return { ...publicRoom(room), members, online: members.length };
};

const touchMember = async (code, room, session, host = false) => {
  const now = Date.now();
  const [existingPresence, onlineCount, storedMember] = await pipeline([
    ['ZSCORE', presenceKey(code), session.id],
    ['ZCOUNT', presenceKey(code), now - PRESENCE_WINDOW, '+inf'],
    ['HGET', membersKey(code), session.id]
  ]);
  if (existingPresence === null && Number(onlineCount) >= room.seats) throw new Error('ROOM_FULL');
  const previous = parseStoredJson(storedMember);
  const member = { name: session.name, joinedAt: previous?.joinedAt || now, host };
  await pipeline([
    ['ZADD', presenceKey(code), now, session.id],
    ['HSET', membersKey(code), session.id, JSON.stringify(member)],
    ['EXPIRE', presenceKey(code), LOBBY_TTL],
    ['EXPIRE', membersKey(code), LOBBY_TTL],
    ['EXPIRE', roomKey(code), LOBBY_TTL],
    ['ZADD', INDEX_KEY, now, code]
  ]);
  return getRoom(code);
};

const listRooms = async () => {
  const codes = await redis('ZREVRANGE', INDEX_KEY, 0, 19);
  if (!Array.isArray(codes) || !codes.length) return [];
  const values = await pipeline(codes.map((code) => ['GET', roomKey(code)]));
  const rooms = values.map(parseStoredJson).filter(Boolean);
  const counts = await pipeline(rooms.map((room) => ['ZCOUNT', presenceKey(room.code), Date.now() - PRESENCE_WINDOW, '+inf']));
  return rooms.map((room, index) => ({ ...publicRoom(room), online: Number(counts[index] || 0) })).filter((room) => room.online > 0).slice(0, 8);
};

const createRoom = async (session, body) => {
  const input = cleanRoomInput(body);
  const now = Date.now();
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const code = generateCode();
    const room = { ...input, code, hostName: session.name, hostId: session.id, createdAt: now };
    const stored = await redis('SET', roomKey(code), JSON.stringify(room), 'EX', LOBBY_TTL, 'NX');
    if (stored === 'OK') return touchMember(code, room, session, true);
  }
  throw new Error('ROOM_CODE_UNAVAILABLE');
};

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      const code = cleanCode(req.query?.code);
      return sendJson(res, 200, { ok: true, ...(code ? { room: await getRoom(code) } : { rooms: await listRooms() }) });
    }
    if (req.method !== 'POST') return methodNotAllowed(res);
    const session = await requireSession(req);
    await rateLimit('lobby', session.id, 45, 60);
    const body = parseBody(req);
    const action = String(body.action || '');
    if (action === 'create') return sendJson(res, 201, { ok: true, room: await createRoom(session, body) });
    const code = cleanCode(body.code);
    if (!codePattern.test(code)) throw new Error('ROOM_NOT_FOUND');
    if (action === 'join') {
      const room = parseStoredJson(await redis('GET', roomKey(code)));
      if (!room) throw new Error('ROOM_NOT_FOUND');
      return sendJson(res, 200, { ok: true, room: await touchMember(code, room, session, room.hostId === session.id) });
    }
    if (action === 'heartbeat') {
      const room = parseStoredJson(await redis('GET', roomKey(code)));
      if (!room) throw new Error('ROOM_NOT_FOUND');
      await pipeline([
        ['ZADD', presenceKey(code), Date.now(), session.id],
        ['EXPIRE', presenceKey(code), LOBBY_TTL],
        ['EXPIRE', roomKey(code), LOBBY_TTL]
      ]);
      return sendJson(res, 200, { ok: true, room: await getRoom(code) });
    }
    if (action === 'leave') {
      await pipeline([
        ['ZREM', presenceKey(code), session.id],
        ['HDEL', membersKey(code), session.id]
      ]);
      return sendJson(res, 200, { ok: true });
    }
    throw new Error('INVALID_REQUEST');
  } catch (error) {
    return handleApiError(res, error);
  }
}
