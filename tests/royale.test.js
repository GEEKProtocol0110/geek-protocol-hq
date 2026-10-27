import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import lobbiesHandler from '../api/lobbies.js';
import identityHandler from '../api/identity.js';
import kaspa from '@dfns/kaspa-wasm';
import { royaleKey, royaleQuestionsKey, royalePublicKey, buildRoyaleQuestions } from '../server/royale.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
let rejectRepeatedTables = false;
// Compatibility model of encoders that mark every visited table, including
// sibling aliases, as recursive (e.g. layeh/gopher-json jsonValue.MarshalJSON).
// This is not a claim about provider internals.
const strictEncoder = `
local nativeEncode = cjson.encode
local function encode(value)
  local seen = {}
  local function visit(item)
    if type(item) ~= 'table' then return end
    if seen[item] then error('cannot encode recursively nested tables to JSON') end
    seen[item] = true
    for _, child in pairs(item) do visit(child) end
  end
  visit(value)
  return nativeEncode(value)
end
local cjson = {decode = cjson.decode, encode = encode, null = cjson.null}
`;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.royale.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-royale-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-royale-audit-key-32-characters';
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/redis\.royale\.test/);
  const values = JSON.parse(options.body); let payload;
  if (rejectRepeatedTables && values[0] === 'EVAL' && values[1].startsWith('-- geek-royale-transition-v1')) values[1] = strictEncoder + values[1];
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else {
    try { payload = { result: await fixture.command(...values) }; }
    catch (error) {
      if (!rejectRepeatedTables) throw error;
      return new Response(JSON.stringify({error:'Synthetic encoder rejected repeated table reference'}),{status:400});
    }
  }
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end() {} });
const request = (method, body, cookie = '', query = {}) => ({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', 'x-forwarded-proto': 'https', 'user-agent': 'shared-royale-network', 'x-forwarded-for': '192.0.2.1' } });
const session = async name => { const res = response(); await sessionHandler(request('POST', { displayName: name }), res); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const pid = cookie => cookie.split('=')[1];
const call = async (cookie, action, fields = {}) => { const res = response(); await lobbiesHandler(request(action === 'view' ? 'GET' : 'POST', action === 'view' ? undefined : { action, ...fields }, cookie, { service: 'royale', ...(action === 'view' ? { code: fields.code } : {}) }), res); return res; };
const clock = async () => { const t = await fixture.command('TIME'); return Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000); };
const stored = async code => JSON.parse(await fixture.command('GET', royaleKey(code)));
const mutate = async (code, fn) => { const r = await stored(code); fn(r, await clock()); await fixture.command('SET', royaleKey(code), JSON.stringify(r), 'EX', 86400); return r; };
const pack = async code => JSON.parse(await fixture.command('GET', royaleQuestionsKey(code)));
const group = async (count = 3) => {
  await fixture.command('FLUSHDB'); const cookies = [];
  for (let n = 0; n < count; n++) cookies.push(await session(`Geek ${n + 1}`));
  const created = await call(cookies[0], 'create', { category: 'kaspa' }); assert.equal(created.statusCode, 201);
  const { code, id: eventId } = created.body.royale, fields = { code, eventId };
  for (const cookie of cookies.slice(1)) assert.equal((await call(cookie, 'join', fields)).statusCode, 200);
  return { cookies, fields };
};
const start = async g => {
  for (const cookie of g.cookies) assert.equal((await call(cookie, 'ready', { ...g.fields, ready: true })).statusCode, 200);
  assert.equal((await call(g.cookies[0], 'start', g.fields)).body.royale.state, 'starting');
  await mutate(g.fields.code, (r, now) => { r.startsAt = now - 1000; });
};
const answer = async (g, index, selectedIndex) => call(g.cookies[index], 'answer', { ...g.fields, questionNumber: 1, selectedIndex });

const discover = async () => {
  const res = response();
  await lobbiesHandler(request('GET', undefined, '', { service: 'royale', discover: '1' }), res);
  return res;
};
test('public discovery is opt-in, anonymous, bounded and reveals no names, identities or questions', async () => {
  await fixture.command('FLUSHDB'); const host = await session('Private Host'), guest = await session('Joining Guest');
  const privateRoom = (await call(host, 'create', { category: 'kaspa', capacity: 2 })).body.royale;
  assert.equal(privateRoom.visibility, 'private');
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  assert.equal((await call(host, 'create', { category: 'kaspa', visibility: 'yes' })).statusCode, 400);
  const publicRoom = (await call(host, 'create', { category: 'technology', capacity: 2, visibility: 'public' })).body.royale;
  const first = await discover(); assert.equal(first.statusCode, 200);
  assert.equal(first.headers['Set-Cookie'], undefined);
  assert.deepEqual(Object.keys(first.body.discovery.rooms[0]).sort(), ['capacity', 'category', 'code', 'createdAt', 'expiresAt', 'online', 'seats']);
  assert.equal(first.body.discovery.rooms[0].code, publicRoom.code);
  assert.equal(first.body.discovery.rooms[0].seats, 1);
  for (const secret of ['Private Host', pid(host), 'prompt', 'correctIndex', 'questionHash']) assert.equal(JSON.stringify(first.body).includes(secret), false);
  const fields = { code: publicRoom.code, eventId: publicRoom.id };
  assert.equal((await call(guest, 'join', fields)).statusCode, 200);
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  await call(guest, 'leave', fields);
  assert.equal((await discover()).body.discovery.rooms.length, 1);
  await mutate(publicRoom.code, (r, now) => { r.players[r.hostId].lastSeen = now - 61000; });
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  await call(host, 'view', fields);
  assert.equal((await discover()).body.discovery.rooms.length, 1);
  await call(host, 'cancel', fields);
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  assert.equal(await fixture.command('ZCARD', royalePublicKey), 0);
});
test('discovery filters started and expired rooms and fails closed for damaged room records', async () => {
  await fixture.command('FLUSHDB'); const host = await session('Discovery Host');
  const room = (await call(host, 'create', { category: 'kaspa', visibility: 'public' })).body.royale;
  await mutate(room.code, r => { r.phase = 'starting'; });
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  await mutate(room.code, r => { r.phase = 'waiting'; });
  await fixture.command('ZADD', royalePublicKey, Date.now() + 86400000, room.code);
  await fixture.command('SET', royaleKey(room.code), '{damaged', 'EX', 86400);
  assert.equal((await discover()).statusCode, 503);
  await fixture.command('ZADD', royalePublicKey, 1, room.code);
  assert.deepEqual((await discover()).body.discovery.rooms, []);
  assert.equal(await fixture.command('ZCARD', royalePublicKey), 0);
});
test('discovery keeps a bounded index and returns at most twenty room summaries', async () => {
  await fixture.command('FLUSHDB'); const host = await session('Bounded Host');
  const first = (await call(host, 'create', { category: 'kaspa', visibility: 'public' })).body.royale;
  const template = await stored(first.code), commands = [];
  for (let n = 0; n < 260; n++) {
    const code = `ROY-${String.fromCharCode(65 + Math.floor(n / 26))}${String.fromCharCode(65 + n % 26)}AAAAAA`;
    const room = { ...template, code, expiresAt: template.expiresAt + n + 1 };
    commands.push(['SET', royaleKey(code), JSON.stringify(room), 'EX', 86400], ['ZADD', royalePublicKey, room.expiresAt, code]);
  }
  await fixture.commands(commands);
  assert.equal((await call(host, 'create', { category: 'kaspa', visibility: 'public' })).statusCode, 201);
  assert.equal(await fixture.command('ZCARD', royalePublicKey), 250);
  const listing = await discover(); assert.equal(listing.statusCode, 200);
  assert.equal(listing.body.discovery.rooms.length, 20);
  assert.ok(listing.body.discovery.rooms.every(r => r.seats === 1 && r.online === 1));
});

test('all eight active banks provide a frozen 100-question Royale pack', () => {
  for (const category of ['kaspa', 'video-games', 'science-fiction', 'technology', 'movies', 'history', 'comics', 'pop-culture']) {
    const questions = buildRoyaleQuestions(category);
    assert.equal(questions.length, 100); assert.equal(new Set(questions.map(q => q.prompt)).size, 100);
    assert.ok(questions.every(q => q.options.length === 4 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4));
  }
});
test('100 shared-network players reserve exactly 100 seats and submit simultaneous private answers', async () => {
  await fixture.command('FLUSHDB');
  const cookies = await Promise.all(Array.from({ length: 102 }, (_, n) => session(`Crowd Geek ${n}`)));
  // Model the separate name save after guest initialization, on the same IP and user-agent.
  for (const cookie of cookies.slice(0, 100)) { const res = response(); await sessionHandler(request('POST', { action: 'rename', displayName: 'Crowd Geek' }, cookie), res); assert.equal(res.statusCode, 200); }
  const created = (await call(cookies[0], 'create', { category: 'kaspa' })).body.royale;
  const fields = { code: created.code, eventId: created.id }, joined = await Promise.all(cookies.slice(1).map(cookie => call(cookie, 'join', fields)));
  assert.equal(joined.filter(r => r.statusCode === 200).length, 99);
  assert.equal(joined.filter(r => r.body.code === 'ROYALE_FULL').length, 2);
  const admitted = [cookies[0], ...cookies.slice(1).filter((_, i) => joined[i].statusCode === 200)];
  await Promise.all(admitted.map(cookie => call(cookie, 'ready', { ...fields, ready: true })));
  const before = await stored(fields.code); assert.equal(Object.keys(before.players).length, 100);
  const begun = await call(cookies[0], 'start', fields); assert.equal(begun.statusCode, 200);
  await mutate(fields.code, (r, now) => { r.startsAt = now - 1000; });
  const correct = (await pack(fields.code))[0].correctIndex;
  const began = performance.now();
  const results = await Promise.all(admitted.map(async cookie => { const since = performance.now(); const r = await call(cookie, 'answer', { ...fields, questionNumber: 1, selectedIndex: correct, score: 999999, elapsedMs: -100 }); return { r, ms: performance.now() - since }; }));
  assert.ok(results.every(v => v.r.statusCode === 200));
  assert.equal(Object.values((await stored(fields.code)).players).filter(p => p.answer?.questionNumber === 1).length, 100);
  for (const { r } of results) { const json = JSON.stringify(r.body); assert.equal(json.includes('correctIndex'), false); assert.equal(json.includes('questionHash'), false); for (const cookie of cookies) assert.equal(json.includes(pid(cookie)), false); }
  const sorted = results.map(r => r.ms).sort((a, b) => a - b);
  console.log(`Local real-Redis Royale: 100 concurrent answers in ${Math.round(performance.now() - began)}ms; p95 ${Math.round(sorted[94])}ms. Not a production load result.`);
  const refreshed = (await call(admitted[99], 'join', fields)).body.royale;
  assert.ok(refreshed.yourAnswer); assert.equal(refreshed.players.length, 100);
  const outsider = cookies.find(cookie => !admitted.includes(cookie)); assert.equal((await call(outsider, 'view', fields)).statusCode, 403);
});
test('the host chooses a 2–100 seat limit and can start a partially filled room', async () => {
  await fixture.command('FLUSHDB'); const host = await session('Small Host'), guest = await session('Small Guest'), extra = await session('Extra Guest');
  for (const capacity of [0, 1, 101, 2.5, '8']) assert.equal((await call(host, 'create', { category: 'kaspa', capacity })).statusCode, 400);
  let created = (await call(host, 'create', { category: 'kaspa', capacity: 2 })).body.royale;
  let fields = { code: created.code, eventId: created.id }; assert.equal(created.capacity, 2);
  const joins = await Promise.all([call(guest, 'join', fields), call(extra, 'join', fields)]);
  assert.deepEqual(joins.map(r => r.statusCode).sort(), [200, 409]);
  created = (await call(host, 'create', { category: 'kaspa', capacity: 8 })).body.royale;
  fields = { code: created.code, eventId: created.id };
  assert.equal((await call(guest, 'join', fields)).statusCode, 200);
  await call(host, 'ready', { ...fields, ready: true }); await call(guest, 'ready', { ...fields, ready: true });
  const begun = (await call(host, 'start', fields)).body.royale;
  assert.equal(begun.state, 'starting'); assert.equal(begun.capacity, 8); assert.equal(begun.players.length, 2);
});
test('host controls, ready gates, event identity and roster lock reject forged actions', async () => {
  const g = await group(), [host, guest] = g.cookies;
  assert.equal((await call('', 'create', { category: 'kaspa' })).statusCode, 401);
  assert.equal((await call(host, 'create', { category: 'bogus' })).statusCode, 400);
  assert.equal((await call(guest, 'start', g.fields)).statusCode, 403);
  assert.equal((await call(guest, 'cancel', g.fields)).statusCode, 403);
  assert.equal((await call(guest, 'kick', { ...g.fields, slot: 3 })).statusCode, 403);
  for (const headers of [{ origin: 'https://evil.example' }, { 'sec-fetch-site': 'cross-site' }, { 'content-type': 'text/plain' }]) {
    const req = request('POST', { action: 'cancel', ...g.fields }, host, { service: 'royale' }); Object.assign(req.headers, headers);
    const res = response(); await lobbiesHandler(req, res); assert.ok([400, 403].includes(res.statusCode));
  }
  assert.equal((await call(host, 'view', g.fields)).body.royale.state, 'waiting');
  assert.equal((await call(host, 'start', g.fields)).body.code, 'ROYALE_NOT_READY');
  assert.equal((await call(host, 'ready', { ...g.fields, ready: 'true' })).statusCode, 400);
  assert.equal((await call(host, 'ready', { ...g.fields, eventId: '0'.repeat(32), ready: true })).body.code, 'ROYALE_CHANGED');
  assert.equal((await call(host, 'kick', { ...g.fields, slot: 1 })).statusCode, 400);
  await start(g); const outsider = await session('Late Geek');
  assert.equal((await call(outsider, 'join', g.fields)).body.code, 'ROYALE_CLOSED');
  assert.equal((await call(host, 'kick', { ...g.fields, slot: 2 })).body.code, 'ROYALE_CLOSED');
});
test('a first answer locks and identical retries are safe; correctness waits for the shared deadline', async () => {
  const g = await group(); await start(g); const correct = (await pack(g.fields.code))[0].correctIndex;
  const responses = await Promise.all([answer(g, 0, correct), answer(g, 0, (correct + 1) % 4)]);
  assert.deepEqual(responses.map(r => r.statusCode).sort(), [200, 409]);
  const saved = (await stored(g.fields.code)).players[pid(g.cookies[0])].answer;
  const retry = await answer(g, 0, saved.selectedIndex); assert.equal(retry.statusCode, 200);
  assert.deepEqual((await stored(g.fields.code)).players[pid(g.cookies[0])].answer, saved);
  assert.deepEqual(retry.body.royale.yourAnswer, { selectedIndex: saved.selectedIndex });
  assert.equal(retry.body.royale.review, null);
  for (const data of [{ selectedIndex: '0' }, { selectedIndex: 4 }, { selectedIndex: 0, questionNumber: 0 }]) assert.equal((await call(g.cookies[1], 'answer', { ...g.fields, questionNumber: 1, ...data })).statusCode, 400);
  await mutate(g.fields.code, (r, now) => { r.startsAt = now - 15001; });
  assert.equal((await answer(g, 1, correct)).body.code, 'ROYALE_QUESTION_CLOSED');
  const view = (await call(g.cookies[0], 'view', g.fields)).body.royale;
  assert.equal(view.state, 'review'); assert.equal(view.review.correctIndex, correct);
  assert.equal(view.yourAnswer.correct, saved.selectedIndex === correct);
});
test('wrong and slowest correct answers eliminate; the survivor wins only after review', async () => {
  const g = await group(); await start(g); const correct = (await pack(g.fields.code))[0].correctIndex;
  const profileKey = `geek:profile:${pid(g.cookies[0])}`; await fixture.command('SET', profileKey, '{"xp":500,"balance":25}');
  await answer(g, 0, correct); await answer(g, 1, correct); await answer(g, 2, (correct + 1) % 4);
  await mutate(g.fields.code, (r, now) => { r.players[pid(g.cookies[0])].answer.elapsedMs = 100; r.players[pid(g.cookies[1])].answer.elapsedMs = 900; r.startsAt = now - 15001; });
  const review = (await call(g.cookies[0], 'view', g.fields)).body.royale;
  assert.equal(review.state, 'review'); assert.equal(review.remaining, 1); assert.equal(review.result, null);
  assert.equal(review.players[1].eliminationReason, 'slowest'); assert.equal(review.players[2].eliminationReason, 'wrong');
  await mutate(g.fields.code, (r, now) => { r.startsAt = now - 20001; });
  const final = (await call(g.cookies[0], 'view', g.fields)).body.royale;
  assert.equal(final.state, 'finished'); assert.deepEqual(final.result.winners, [1]); assert.equal(final.result.reason, 'last-mind');
  assert.deepEqual((await call(g.cookies[2], 'view', g.fields)).body.royale.result, final.result);
  assert.equal(await fixture.command('GET', profileKey), '{"xp":500,"balance":25}');
  assert.equal((await call(g.cookies[0], 'cancel', g.fields)).body.code, 'ROYALE_CLOSED');
});
test('the whole slowest tied group goes out; all-equal correct times survive and can share a final victory', async () => {
  let g = await group(4); await start(g); const correct = (await pack(g.fields.code))[0].correctIndex;
  for (let n = 0; n < 4; n++) await answer(g, n, correct);
  await mutate(g.fields.code, (r, now) => { for (let n = 0; n < 4; n++) r.players[pid(g.cookies[n])].answer.elapsedMs = n < 2 ? 100 : 500; r.startsAt = now - 15001; });
  const review = (await call(g.cookies[0], 'view', g.fields)).body.royale; assert.equal(review.remaining, 2); assert.deepEqual(review.players.filter(p => !p.alive).map(p => p.slot), [3, 4]);
  g = await group(2); await start(g);
  const finalCorrect = (await pack(g.fields.code))[99].correctIndex;
  await mutate(g.fields.code, (r, now) => { r.questionNumber = 100; r.reviewedQuestion = 99; r.startsAt = now - 99 * 20000 - 15001; for (const p of Object.values(r.players)) p.answer = { questionNumber: 100, selectedIndex: finalCorrect, elapsedMs: 100 }; });
  const tied = (await call(g.cookies[0], 'view', g.fields)).body.royale; assert.equal(tied.remaining, 2); assert.equal(tied.review.speedTie, true);
  await mutate(g.fields.code, (r, now) => { r.startsAt = now - 100 * 20000 - 1; });
  const final = (await call(g.cookies[0], 'view', g.fields)).body.royale; assert.equal(final.state, 'finished'); assert.equal(final.result.reason, 'shared-victory'); assert.deepEqual(final.result.winners, [1, 2]);
});
test('timeouts create no winner; leaving removes a waiting seat or eliminates an active player', async () => {
  let g = await group(2); await start(g); await mutate(g.fields.code, (r, now) => { r.startsAt = now - 20001; });
  const final = (await call(g.cookies[0], 'view', g.fields)).body.royale; assert.equal(final.result.reason, 'no-survivors'); assert.deepEqual(final.result.winners, []);
  g = await group(); assert.equal((await call(g.cookies[2], 'leave', g.fields)).statusCode, 200); g.cookies.pop(); assert.equal((await call(g.cookies[0], 'view', g.fields)).body.royale.players.length, 2);
  await start(g); await call(g.cookies[1], 'leave', g.fields); const view = (await call(g.cookies[1], 'view', g.fields)).body.royale; assert.equal(view.players[1].alive, false); assert.equal(view.players[1].eliminationReason, 'left');
  assert.equal((await answer(g, 1, 0)).body.code, 'ROYALE_ELIMINATED');
});
for (const outcome of ['no-survivors', 'last-mind', 'shared-victory']) test(`final ${outcome} result survives an encoder that rejects repeated table references`, async () => {
  const g = await group(2); await start(g);
  const questionNumber = outcome === 'shared-victory' ? 100 : 1;
  const correct = (await pack(g.fields.code))[questionNumber - 1].correctIndex;
  await mutate(g.fields.code, (r, now) => {
    r.questionNumber = questionNumber; r.reviewedQuestion = questionNumber - 1;
    r.startsAt = now - (questionNumber - 1) * 20000 - 15001;
    for (const [index,p] of Object.values(r.players).entries()) {
      p.answer = outcome === 'no-survivors' || (outcome === 'last-mind' && index === 1) ? null : {questionNumber,selectedIndex:correct,elapsedMs:100};
    }
  });
  rejectRepeatedTables = true;
  try {
    const review = await call(g.cookies[0], 'view', g.fields);
    assert.equal(review.statusCode,200); assert.equal(review.body.royale.state,'review'); assert.equal(review.body.royale.result,null);
    const before = await stored(g.fields.code), snapshot = await fixture.command('GET',royaleQuestionsKey(g.fields.code));
    const ttlBefore = await fixture.command('PTTL',royaleKey(g.fields.code));
    // Cross only the existing shared review deadline; preserve stored TTL.
    await fixture.command('SET',royaleKey(g.fields.code),JSON.stringify({...before,startsAt:before.startsAt-5000}),'KEEPTTL');
    const final = await call(g.cookies[0], 'view', g.fields);
    assert.equal(final.statusCode,200); assert.equal(final.body.royale.state,'finished');
    assert.equal(final.body.royale.result.reason,outcome);
    assert.deepEqual(final.body.royale.result.winners,outcome==='no-survivors'?[]:outcome==='last-mind'?[1]:[1,2]);
    const saved = await stored(g.fields.code);
    assert.ok(saved.pendingResult == null); assert.equal(saved.expiresAt,before.expiresAt);
    assert.equal(saved.id,before.id); assert.equal(saved.questionHash,before.questionHash);
    assert.deepEqual(saved.players,before.players);
    assert.equal(await fixture.command('GET',royaleQuestionsKey(g.fields.code)),snapshot);
    assert.ok(await fixture.command('PTTL',royaleKey(g.fields.code)) <= ttlBefore);
    const returned = await call(g.cookies[1],'view',g.fields);
    assert.equal(returned.statusCode,200); assert.deepEqual(returned.body.royale.result,final.body.royale.result);
  } finally { rejectRepeatedTables = false; }
});
test('offline readiness, missing snapshots and expired rooms fail without accepting an answer', async () => {
  const g = await group(); for (const cookie of g.cookies) await call(cookie, 'ready', { ...g.fields, ready: true });
  await mutate(g.fields.code, (r, now) => { r.players[pid(g.cookies[2])].lastSeen = now - 60001; });
  assert.equal((await call(g.cookies[0], 'start', g.fields)).body.code, 'ROYALE_NOT_READY');
  assert.equal((await call(g.cookies[0], 'kick', { ...g.fields, slot: 3 })).statusCode, 200); g.cookies.pop(); await start(g);
  const before = await fixture.command('GET', royaleKey(g.fields.code));
  await fixture.command('SET', royaleQuestionsKey(g.fields.code), '[]');
  assert.equal((await answer(g, 0, 0)).body.code, 'ROYALE_SNAPSHOT_INVALID'); assert.equal(await fixture.command('GET', royaleKey(g.fields.code)), before);
  await mutate(g.fields.code, (r, now) => { r.expiresAt = now - 1; }); assert.equal((await call(g.cookies[0], 'view', g.fields)).statusCode, 404);
});
test('a recovered wallet identity retains its Royale seat and locked answer while its old session is revoked', async () => {
  const g = await group(2), first = g.cookies[0], privateKey = '9'.padStart(64, '0'), key = new kaspa.PrivateKey(privateKey);
  const address = key.toAddress(kaspa.NetworkType.Mainnet).toString(), publicKey = key.toPublicKey().toString();
  const proof = async cookie => { const challenge = response(); await identityHandler(request('POST', { action: 'challenge', intent: 'identity', address, publicKey }, cookie), challenge); assert.equal(challenge.statusCode, 201); const verified = response(); await identityHandler(request('POST', { action: 'verify', challengeId: challenge.body.challenge.challengeId, signature: kaspa.signMessage({ message: challenge.body.challenge.message, privateKey }) }, cookie), verified); assert.equal(verified.statusCode, 200); };
  await proof(first); await start(g); await answer(g, 0, 0);
  const fresh = await session('Recovery Geek'); await proof(fresh);
  const restored = (await call(fresh, 'join', g.fields)).body.royale; assert.equal(restored.yourSlot, 1); assert.equal(restored.isHost, true); assert.deepEqual(restored.yourAnswer, { selectedIndex: 0 });
  assert.equal((await call(first, 'view', g.fields)).statusCode, 401);
});
