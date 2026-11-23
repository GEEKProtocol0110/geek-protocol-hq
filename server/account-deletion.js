// Player-requested account deletion (PRIV-001).
//
// One Lua transition removes the player's saved records, releases the wallet and
// passkey bindings, removes leaderboard and current challenge standings, writes a
// tombstone and appends an audit event. The tombstone makes readSession reject
// every remaining session for the player, including sessions on other devices
// that have no index. It holds no personal data and outlives the 30-day session
// cookie. Payout and test-reward ledgers, the integrity-protected audit log and
// shared game rooms are kept; see docs/ACCOUNT-DELETION.md.
import { createHash } from 'node:crypto';
import { auditWriteCommands, createAuditRecord, hashAuditIdentifier } from './audit.js';
import { categories, sessionTtl } from './http.js';
import { redis } from './redis.js';
import { identityPlayerKey, identityWalletKey } from './identity-keys.js';
import { decodeIdentityRecord } from './identity-records.js';
import { decodePasskeyAccount } from './passkey-records.js';
import { consumePasskeyGrant, passkeyAccountKey } from './passkey-grants.js';
import { profileKeyFor } from './profile.js';
import { prestigeKeyFor } from './prestige-state.js';
import { vaultKey } from './vault.js';
import { rewardAddressKey } from './reward-addresses.js';
import { enrollmentKey } from './testnet-automatic.js';
import { questKey } from './quest.js';
import { questChapters } from '../public/quest/assets/chapter.js';
import { challengeConfigs, challengePeriod } from './challenge-periods.js';

export const deletedPlayerKey = playerId => `geek:player-deleted:v1:${playerId}`;
export const DELETION_CONFIRMATION = 'DELETE';
// Longer than the session cookie, so no surviving cookie can outlive the tombstone.
export const TOMBSTONE_TTL = sessionTtl + 60 * 60 * 24 * 15;

const sessionKey = id => `geek:session:${id}`;
const credentialKey = id => `geek:passkey:credential:v1:${createHash('sha256').update(id).digest('hex')}`;
const boardKey = (category, mode) => mode === 'gauntlet' ? `geek:leaderboard:${category}` : `geek:leaderboard:${mode}:${category}`;
const LEADERBOARD_MODES = ['gauntlet', 'daily', 'speed'];

// Records that belong only to this player and are removed outright.
export const ownedPlayerKeys = (playerId, sessionId, now = Date.now()) => [
  `geek:player-name:${playerId}`,
  profileKeyFor(playerId),
  prestigeKeyFor(playerId),
  vaultKey(playerId),
  `geek:economy:v1:${playerId}`,
  `geek:study-progress:${playerId}`,
  rewardAddressKey(playerId),
  enrollmentKey(playerId),
  `geek:device:list:v1:${playerId}`,
  `geek:cce:contributor:${playerId}:submissions`,
  `geek:cce:contributor:${playerId}:stats`,
  `geek:daily:${playerId}:${new Date(now).toISOString().slice(0, 10)}`,
  `geek:ranked:active:${sessionId}`,
  ...questChapters.map(chapter => questKey(playerId, chapter.id))
];

// Sorted sets whose member is the player ID, each paired with a name/metadata hash.
export const standingKeys = (now = Date.now()) => {
  const pairs = [];
  for (const category of categories) for (const mode of LEADERBOARD_MODES) {
    const board = boardKey(category, mode);
    pairs.push([board, `${board}:meta`]);
  }
  for (const kind of Object.keys(challengeConfigs)) for (const previous of [false, true]) {
    const period = challengePeriod(kind, now, previous);
    pairs.push([`geek:challenge:board:${period.id}`, `geek:challenge:meta:${period.id}`]);
  }
  return pairs;
};

const DELETE_ACCOUNT = `-- geek-account-delete-v1
if redis.call('EXISTS', KEYS[2]) == 1 then return 'DELETED' end
if (redis.call('GET', KEYS[5]) or '') ~= ARGV[7] then return 'CHANGED' end
if (redis.call('GET', KEYS[6]) or '') ~= ARGV[8] then return 'CHANGED' end
local owned, bound, boards = tonumber(ARGV[9]), tonumber(ARGV[10]), tonumber(ARGV[11])
local i = 7
for _ = 1, owned do redis.call('DEL', KEYS[i]); i = i + 1 end
for _ = 1, bound do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]) end
  i = i + 1
end
for _ = 1, boards do
  redis.call('ZREM', KEYS[i], ARGV[1]); redis.call('HDEL', KEYS[i + 1], ARGV[1]); i = i + 2
end
redis.call('DEL', KEYS[5], KEYS[6], KEYS[1])
redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
redis.call('SET', KEYS[3], ARGV[4])
redis.call('ZADD', KEYS[4], ARGV[5], ARGV[6])
return 'OK'`;

export const deleteAccount = async (res, session, body = {}) => {
  if (body.confirm !== DELETION_CONFIRMATION) throw new Error('ACCOUNT_DELETE_CONFIRM_REQUIRED');
  const playerId = String(session.playerId || session.id);
  const [passkeyRaw, identityRaw] = await Promise.all([redis('GET', passkeyAccountKey(playerId)), redis('GET', identityPlayerKey(playerId))]);
  const account = decodePasskeyAccount(passkeyRaw, playerId);
  const identity = decodeIdentityRecord(identityRaw, playerId);
  const walletVersion = identity?.sessionVersion || 0;
  // A saved passkey or linked wallet means the account is protected: deletion
  // needs the same fresh proof as changing recovery methods, so a copied
  // session cookie alone cannot erase it. Guest progress has no stronger proof.
  if (walletVersion || account) await consumePasskeyGrant(session, body.token, walletVersion);

  const now = Date.now();
  const owned = ownedPlayerKeys(playerId, session.id, now);
  const bound = [
    ...(account?.credentials || []).map(credential => credentialKey(credential.id)),
    ...(identity?.address ? [identityWalletKey(hashAuditIdentifier(identity.address))] : [])
  ];
  const boards = standingKeys(now);
  const audit = await createAuditRecord({
    type: 'identity.account.deleted', severity: 'warning',
    actorType: walletVersion || account ? 'verified-player' : 'guest-player', actorId: playerId,
    objectType: 'player-access', objectId: playerId, reason: 'player-requested-deletion', interactionId: session.id,
    details: { passkeyCount: account?.credentials.length || 0, walletLinked: walletVersion > 0 }
  });
  const [event, index] = auditWriteCommands(audit);
  const keys = [sessionKey(session.id), deletedPlayerKey(playerId), event[1], index[1], passkeyAccountKey(playerId), identityPlayerKey(playerId),
    ...owned, ...bound, ...boards.flat()];
  const result = await redis('EVAL', DELETE_ACCOUNT, keys.length, ...keys,
    playerId, JSON.stringify({ version: 1, deletedAt: now }), TOMBSTONE_TTL, JSON.stringify(audit), audit.sequence, audit.eventId,
    passkeyRaw || '', identityRaw || '', owned.length, bound.length, boards.length);
  if (result === 'DELETED') throw new Error('SESSION_REQUIRED');
  if (result !== 'OK') throw new Error('ACCOUNT_DELETE_CHANGED');
  res.setHeader('Set-Cookie', 'geek_session=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax');
  return { deleted: true };
};
