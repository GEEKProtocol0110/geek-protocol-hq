import { createHash, randomBytes } from 'node:crypto';
import { redis } from './redis.js';
import { createAuditRecord, auditWriteCommands } from './audit.js';
import { decodePasskeyAccount } from './passkey-records.js';
import { passkeyAccountKey, consumePasskeyGrant } from './passkey-grants.js';
import { identityPlayerKey } from './identity-keys.js';
import { decodeIdentityRecord, decodeSessionRecord } from './identity-records.js';
import { cleanName, createSessionId, sessionTtl, setSessionCookie } from './http.js';

const pid = s => s.playerId || s.id;
const hex = (x, n) => typeof x === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(x);
const digest = x => createHash('sha256').update(x).digest('hex');
const requestKey = code => `geek:device:request:v1:${digest(code)}`;
const slotKey = s => `geek:device:pending:v1:${s.id}`;
const devicesKey = id => `geek:device:list:v1:${id}`;
const sessionKey = s => `geek:session:${s.id}`;
const fail = (code = 'DEVICE_REQUEST_INVALID') => { throw new Error(code); };
const codeFor = body => {
  const code = typeof body.code === 'string' ? body.code.replace(/[ -]/g, '').toLowerCase() : '';
  if (!hex(code, 24)) fail();
  return code;
};
const decode = raw => {
  let r; try { r = JSON.parse(raw); } catch { fail(); }
  const now = Date.now();
  if (!r || r.version !== 1 || !hex(r.targetId, 32) || !hex(r.targetPlayer, 32)
    || typeof r.origin !== 'string' || typeof r.label !== 'string' || r.label.length < 1 || r.label.length > 40
    || !hex(r.check, 8) || !Number.isSafeInteger(r.issuedAt) || r.issuedAt > now
    || r.expiresAt !== r.issuedAt + 300000 || r.expiresAt <= now
    || !['pending', 'approved'].includes(r.state)) fail();
  if (r.state === 'approved' && (!hex(r.playerId,32) || !hex(r.sourceId,32) || !hex(r.approvalId,32)
    || typeof r.accountRaw !== 'string' || !['string','object'].includes(typeof r.walletRaw)
    || (r.walletRaw !== null && typeof r.walletRaw !== 'string'))) fail();
  return r;
};
const decodeDevices = raw => {
  if (raw === null) return [];
  let list; try { list = JSON.parse(raw); } catch { fail('DEVICE_STATE_INVALID'); }
  if (!Array.isArray(list) || list.length > 10) fail('DEVICE_STATE_INVALID');
  const ids = new Set(), sessions = new Set();
  for (const d of list) {
    if (!d || !hex(d.id,32) || !hex(d.sessionId,32) || typeof d.label !== 'string' || !d.label.length || d.label.length > 40
      || !Number.isSafeInteger(d.createdAt) || d.createdAt < 1 || ids.has(d.id) || sessions.has(d.sessionId)) fail('DEVICE_STATE_INVALID');
    ids.add(d.id); sessions.add(d.sessionId);
  }
  return list;
};
const snapshot = async session => {
  const raw = await redis('GET', sessionKey(session));
  const current = decodeSessionRecord(raw, session.id);
  if (!current || pid(current) !== pid(session) || current.passkeyEpoch !== session.passkeyEpoch
    || (current.identityVersion || 0) !== (session.identityVersion || 0)) throw new Error('SESSION_CHANGED');
  return raw;
};
const protection = async session => {
  const id = pid(session), accountRaw = await redis('GET', passkeyAccountKey(id));
  const account = decodePasskeyAccount(accountRaw, id);
  const walletRaw = await redis('GET', identityPlayerKey(id));
  const wallet = decodeIdentityRecord(walletRaw,id);
  if (!session.passkeyEpoch || !account?.credentials.length || account.epoch !== session.passkeyEpoch
    || account.walletVersion !== (wallet?.sessionVersion || 0)) fail('DEVICE_REAUTH_REQUIRED');
  return { account, accountRaw, walletRaw, walletVersion: wallet?.sessionVersion || 0 };
};
const readRequest = async (session, body, origin, target = false) => {
  const code = codeFor(body), key = requestKey(code), raw = await redis('GET',key), record = decode(raw);
  if (record.origin !== origin || (target && (record.targetId !== session.id || record.targetPlayer !== pid(session)))) fail();
  if (await redis('GET', `geek:device:pending:v1:${record.targetId}`) !== key) fail();
  return { key, raw, record };
};
const audit = async (session, action) => auditWriteCommands(await createAuditRecord({
  type: `identity.device.${action}`, actorType: 'player', actorId: pid(session),
  objectType: 'player-access', objectId: pid(session), reason: 'Explicit trusted-device action', details: { action }
}));
// All successful writes compare the exact records read above. Codes and bearer
// session IDs never enter audit details or public device lists.
const checkAudit = `local auditType = redis.call('TYPE', KEYS[#KEYS]).ok
if auditType ~= 'none' and auditType ~= 'zset' then return 'CHANGED' end`;
const writeAudit = `redis.call('SET', KEYS[#KEYS-1], ARGV[#ARGV-1], 'NX')
redis.call('ZADD', KEYS[#KEYS], ARGV[#ARGV], ARGV[#ARGV-2])`;

export const deviceAccessAction = async (res, session, body, origin) => {
  const action = body.action;
  if (action === 'device-start') {
    if (session.passkeyEpoch || session.identityVersion || pid(session) !== session.id || body.acknowledge !== true) fail('DEVICE_GUEST_REQUIRED');
    const previous = await snapshot(session), code = randomBytes(12).toString('hex'), key = requestKey(code), now = Date.now();
    const record = { version:1, state:'pending', targetId:session.id, targetPlayer:pid(session), origin,
      label: cleanName(body.label,'My other device').slice(0,40), check:randomBytes(4).toString('hex'), issuedAt:now, expiresAt:now+300000 };
    const saved = await redis('EVAL', `-- geek-device-start-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('EXISTS',KEYS[2]) == 1 then return 'CHANGED' end
redis.call('SET',KEYS[2],ARGV[2],'EX',300)
redis.call('SET',KEYS[3],KEYS[2],'EX',300)
return 'OK'`,3,sessionKey(session),key,slotKey(session),previous,JSON.stringify(record));
    if (saved !== 'OK') throw new Error('SESSION_CHANGED');
    return { code:code.match(/.{6}/g).join('-'), check:record.check, label:record.label, expiresAt:record.expiresAt };
  }
  if (action === 'device-list') {
    await protection(session);
    return { devices:decodeDevices(await redis('GET',devicesKey(pid(session)))).map(({id,label,createdAt})=>({id,label,createdAt})) };
  }
  if (action === 'device-review') {
    await protection(session);
    const { record } = await readRequest(session,body,origin);
    if (record.state !== 'pending' || record.targetId === session.id) fail();
    return { label:record.label, check:record.check, expiresAt:record.expiresAt, playerName:session.name, playerId:pid(session) };
  }
  if (action === 'device-cancel') {
    const { key,raw } = await readRequest(session,body,origin,true);
    const result = await redis('EVAL', `if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('GET',KEYS[2]) ~= KEYS[1] then return 0 end
redis.call('DEL',KEYS[1],KEYS[2]); return 1`,2,key,slotKey(session),raw);
    if (result !== 1) fail();
    return { cancelled:true };
  }
  if (action === 'device-approve') {
    const p = await protection(session), sourceRaw = await snapshot(session);
    const { key,raw,record } = await readRequest(session,body,origin);
    if (record.state !== 'pending' || record.targetId === session.id || body.check !== record.check || body.confirm !== true || body.playerId !== pid(session)) fail();
    await consumePasskeyGrant(session,body.token,p.walletVersion);
    const next = { ...record,state:'approved',playerId:pid(session),sourceId:session.id,approvalId:createSessionId(),accountRaw:p.accountRaw,walletRaw:p.walletRaw };
    const saved = await redis('EVAL', `-- geek-device-approve-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('GET',KEYS[2]) ~= KEYS[1]
 or redis.call('GET',KEYS[3]) ~= ARGV[2] or redis.call('GET',KEYS[4]) ~= ARGV[3]
 or (redis.call('GET',KEYS[5]) or '') ~= ARGV[4] then return 'CHANGED' end
redis.call('SET',KEYS[1],ARGV[5],'KEEPTTL'); return 'OK'`,5,key,`geek:device:pending:v1:${record.targetId}`,sessionKey(session),passkeyAccountKey(pid(session)),identityPlayerKey(pid(session)),
      raw,sourceRaw,p.accountRaw,p.walletRaw||'',JSON.stringify(next));
    if (saved !== 'OK') fail();
    return { approved:true };
  }
  if (action === 'device-status' || action === 'device-finish') {
    const { key,raw,record:r } = await readRequest(session,body,origin,true);
    if (r.state !== 'approved') return { approved:false };
    const account = decodePasskeyAccount(r.accountRaw,r.playerId);
    const wallet = decodeIdentityRecord(r.walletRaw,r.playerId);
    if (!account?.credentials.length || account.walletVersion !== (wallet?.sessionVersion||0)) fail();
    const name = cleanName(await redis('GET',`geek:player-name:${r.playerId}`),'Saved Geek');
    if (action === 'device-status') return { approved:true,playerName:name,approvalId:r.approvalId };
    if (body.confirm !== true || body.approvalId !== r.approvalId) fail();
    if (session.passkeyEpoch || session.identityVersion || pid(session) !== session.id) fail('DEVICE_GUEST_REQUIRED');
    const previous = await snapshot(session), id = createSessionId();
    const listRaw = await redis('GET',devicesKey(r.playerId)), devices = decodeDevices(listRaw);
    if (devices.length >= 10) fail('DEVICE_LIMIT');
    const fresh = { id,playerId:r.playerId,identityVersion:account.walletVersion,passkeyEpoch:account.epoch,name,createdAt:account.createdAt,lastSeen:Date.now() };
    const device = { id:createSessionId(),sessionId:id,label:r.label,createdAt:Date.now() };
    const event = await audit({...fresh},'linked');
    const saved = await redis('EVAL', `-- geek-device-finish-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('GET',KEYS[2]) ~= KEYS[1]
 or redis.call('GET',KEYS[3]) ~= ARGV[2] or redis.call('GET',KEYS[4]) ~= ARGV[3]
 or (redis.call('GET',KEYS[5]) or '') ~= ARGV[4]
 or (redis.call('GET',KEYS[6]) or '') ~= ARGV[5]
 or redis.call('EXISTS',KEYS[7]) == 1 or redis.call('EXISTS',KEYS[8]) == 0
 or redis.call('EXISTS',KEYS[9]) == 1 then return 'CHANGED' end
${checkAudit}
redis.call('SET',KEYS[7],ARGV[6],'EX',ARGV[7])
redis.call('SET',KEYS[6],ARGV[8])
redis.call('DEL',KEYS[1],KEYS[2],KEYS[3])
${writeAudit}
return 'OK'`,10,key,slotKey(session),sessionKey(session),passkeyAccountKey(r.playerId),identityPlayerKey(r.playerId),devicesKey(r.playerId),sessionKey(fresh),`geek:session:${r.sourceId}`,event[0][1],event[1][1],
      raw,previous,r.accountRaw,r.walletRaw||'',listRaw||'',JSON.stringify(fresh),sessionTtl,JSON.stringify([...devices,device]),event[0][1].split(':').at(-1),event[0][2],event[1][2]);
    if (saved !== 'OK') fail();
    setSessionCookie(res,id);
    return { signedIn:true,playerName:name };
  }
  if (action === 'device-revoke') {
    const p = await protection(session), previous = await snapshot(session);
    const listRaw = await redis('GET',devicesKey(pid(session))), devices = decodeDevices(listRaw);
    const device = devices.find(d => d.id === body.deviceId);
    if (!device) fail();
    await consumePasskeyGrant(session,body.token,p.walletVersion);
    const event = await audit(session,'revoked');
    const saved = await redis('EVAL', `-- geek-device-revoke-v1
if redis.call('GET',KEYS[1]) ~= ARGV[1] or redis.call('GET',KEYS[2]) ~= ARGV[2]
 or redis.call('GET',KEYS[3]) ~= ARGV[3] or (redis.call('GET',KEYS[4]) or '') ~= ARGV[4]
 or redis.call('EXISTS',KEYS[6]) == 1 then return 'CHANGED' end
${checkAudit}
redis.call('SET',KEYS[1],ARGV[5]); redis.call('DEL',KEYS[5])
${writeAudit}
return 'OK'`,7,devicesKey(pid(session)),sessionKey(session),passkeyAccountKey(pid(session)),identityPlayerKey(pid(session)),`geek:session:${device.sessionId}`,event[0][1],event[1][1],
      listRaw,previous,p.accountRaw,p.walletRaw||'',JSON.stringify(devices.filter(d=>d.id!==device.id)),event[0][1].split(':').at(-1),event[0][2],event[1][2]);
    if (saved !== 'OK') fail();
    return { revoked:true };
  }
  fail();
};
