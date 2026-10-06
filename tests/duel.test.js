import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import lobbiesHandler from '../api/lobbies.js';
import sessionHandler from '../api/session.js';
import { collectiblesHandler, profileHandler } from '../server/player-api.js';
import { duelKey, DUEL_GRACE_MS } from '../server/duel.js';
import { personalGeek } from '../public/assets/geek-avatar.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) {
  if (process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error;
}
const run = fixture ? test : (name, fn) => test(name, { skip: 'Install redis-server to run real Duel transactions; required in CI.' }, fn);
const originalFetch = globalThis.fetch;
if (fixture) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.duel.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture-token';
  process.env.AUDIT_LOG_SECRET = 'synthetic-duel-audit-secret-32-characters';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/redis\.duel\.test/);
    const values = JSON.parse(options.body);
    let payload;
    if (String(url).endsWith('/multi-exec')) {
      const results = await fixture.commands([['MULTI'], ...values, ['EXEC']]);
      payload = results.at(-1).map(result => ({ result }));
    } else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
    else payload = { result: await fixture.command(...values) };
    return new Response(JSON.stringify(payload), { headers: { 'Content-Type': 'application/json' } });
  };
}
after(async () => { globalThis.fetch = originalFetch; if (fixture) await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, end() {} });
const request = (method, body, cookie = '', query = {}) => ({ method, body, headers: { cookie, 'x-forwarded-for': '127.0.0.1', 'user-agent': 'duel-test' }, query });
const call = async (cookie, action, data = {}) => {
  const res = response();
  await lobbiesHandler(request(action === 'view' ? 'GET' : 'POST', action === 'view' ? undefined : { action, ...data }, cookie, { service: 'duel', ...(action === 'view' ? { code: data.code } : {}) }), res);
  return res;
};
const session = async name => { const res = response(); await sessionHandler(request('POST', { displayName: name }), res); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const pid = cookie => cookie.split('=')[1];
const clock = async () => { const t = await fixture.command('TIME'); return Number(t[0]) * 1000 + Math.floor(Number(t[1]) / 1000); };
const stored = async code => JSON.parse(await fixture.command('GET', duelKey(code)));
const mutate = async (code, fn) => { const d = await stored(code); await fn(d, await clock()); await fixture.command('SET', duelKey(code), JSON.stringify(d), 'EX', 3600); return d; };
const pair = async () => {
  await fixture.command('FLUSHDB');
  const a = await session('First Geek'), b = await session('Second Geek'), c = await session('Third Geek');
  const created = await call(a, 'create', { category: 'kaspa' }); assert.equal(created.statusCode, 201);
  const code = created.body.duel.code, id = created.body.duel.id;
  assert.equal((await call(b, 'join', { code })).statusCode, 200);
  return { a, b, c, code, matchId: id };
};
const start = async p => {
  assert.equal((await call(p.a, 'ready', p)).body.duel.state, 'waiting');
  assert.equal((await call(p.b, 'ready', p)).body.duel.state, 'starting');
  await mutate(p.code, (d, now) => { d.startsAt = now - 100; });
};

run('full player flow retains a saved personal Geek, ranked XP and profile through Duel', async () => {
  const p = await pair();
  const profileKey = `geek:profile:${pid(p.a)}`;
  await fixture.command('SET', profileKey, JSON.stringify({ xp: 500, balance: 25, bestScore: 123, avatarId: 'giga-builder', avatarCustomization: personalGeek }));
  const custom = response();
  await collectiblesHandler(request('POST', { action: 'customize-avatar', customization: { ...personalGeek, hair: 'curls' } }, p.a), custom);
  assert.equal(custom.statusCode, 200);
  const before = await fixture.command('GET', profileKey);
  const created = await call(p.a, 'create', { category: 'kaspa' });
  const d = created.body.duel;
  assert.equal(d.players[0].avatar.customization.hair, 'curls');
  assert.equal(d.players[0].avatar.id, 'giga-builder');
  const profile = response(); await profileHandler(request('GET', undefined, p.a), profile);
  assert.equal(profile.body.profile.progression.level, 3);
  assert.equal(profile.body.profile.stats.xp, 500);
  const local = { code: d.code, matchId: d.id };
  assert.equal((await call(p.b, 'join', local)).statusCode, 200);
  await call(p.a, 'ready', local); await call(p.b, 'ready', local);
  await mutate(d.code, (stored, now) => { stored.startsAt = now - 100; });
  assert.equal((await call(p.a, 'answer', { ...local, questionNumber: 1, selectedIndex: 0 })).statusCode, 200);
  await mutate(d.code, (stored, now) => { stored.startsAt = now - 150_001; });
  assert.equal((await call(p.a, 'view', local)).body.duel.state, 'finished');
  assert.equal(await fixture.command('GET', profileKey), before);
});
run('simultaneous joins reserve exactly two seats; roster, identity and answers remain private', async () => {
  await fixture.command('FLUSHDB');
  const a = await session('Host'), b = await session('Same Name'), c = await session('Same Name');
  const created = await call(a, 'create', { category: 'kaspa' }); const code = created.body.duel.code;
  const results = await Promise.all([call(b, 'join', { code }), call(c, 'join', { code })]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  const loser = results[0].statusCode === 409 ? b : c;
  assert.equal((await call(loser, 'view', { code })).statusCode, 403);
  const view = (await call(a, 'view', { code })).body.duel;
  assert.equal(view.players.length, 2); assert.equal(view.question, null);
  const json = JSON.stringify(view);
  for (const value of [pid(a), pid(b), pid(c), 'correctIndex', '"answers"', '"questions"']) assert.equal(json.includes(value), false);
  assert.equal((await call('', 'view', { code })).statusCode, 401);
});
run('both players ready up on the same clock; simultaneous answers can score only once', async () => {
  const p = await pair(); await start(p);
  const raw = await stored(p.code), correct = raw.questions[0].correctIndex;
  const aView = (await call(p.a, 'view', p)).body.duel, bView = (await call(p.b, 'view', p)).body.duel;
  assert.deepEqual(aView.question, bView.question); assert.equal(aView.questionEndsAt, bView.questionEndsAt);
  assert.equal(aView.startsAt, bView.startsAt);
  const results = await Promise.all([call(p.a, 'answer', { ...p, questionNumber: 1, selectedIndex: correct, score: 999999, xp: 999999 }), call(p.a, 'answer', { ...p, questionNumber: 1, selectedIndex: correct })]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  const answer = results.find(r => r.statusCode === 200).body.duel;
  assert.equal(answer.yourAnswer.correct, true); assert.equal(answer.players[0].correct, 1);
  assert.ok(answer.players[0].score >= 1000 && answer.players[0].score <= 1450);
  assert.equal((await call(p.c, 'answer', { ...p, questionNumber: 1, selectedIndex: correct })).statusCode, 403);
  assert.equal(JSON.stringify(answer).includes('correctIndex'), false);
});
run('reload restores the seat and recorded answer; stale matches and closed questions cannot score', async () => {
  const p = await pair(); await start(p);
  await call(p.a, 'answer', { ...p, questionNumber: 1, selectedIndex: 0 });
  const joined = await call(p.a, 'join', p);
  assert.equal(joined.body.duel.yourSlot, 1); assert.equal(joined.body.duel.yourAnswer.selectedIndex, 0);
  for (const data of [{ questionNumber: 1, selectedIndex: '0' }, { questionNumber: 1, selectedIndex: -1 }, { questionNumber: 11, selectedIndex: 0 }]) assert.equal((await call(p.b, 'answer', { ...p, ...data })).statusCode, 400);
  assert.equal((await call(p.b, 'answer', { ...p, matchId: 'a'.repeat(32), questionNumber: 1, selectedIndex: 0 })).statusCode, 409);
  await mutate(p.code, (d, now) => { d.startsAt = now - 15_001; });
  assert.equal((await call(p.b, 'answer', { ...p, questionNumber: 1, selectedIndex: 0 })).statusCode, 409);
  assert.equal((await call(p.b, 'answer', { ...p, questionNumber: 2, selectedIndex: 0 })).statusCode, 200);
});
run('elapsed matches finalize with deterministic win or draw and persist on subsequent reads', async () => {
  for (const [scores, winner] of [[[1000, 1000], 0], [[2000, 1000], 1], [[0, 1000], 2]]) {
    const p = await pair(); await start(p);
    await mutate(p.code, (d, now) => { d.startsAt = now - 150_001; d.players[pid(p.a)].score = scores[0]; d.players[pid(p.b)].score = scores[1]; });
    const first = (await call(p.a, 'view', p)).body.duel;
    assert.equal(first.state, 'finished'); assert.equal(first.result.reason, 'completed'); assert.equal(first.result.winner, winner); assert.equal(first.question, null);
    const next = (await call(p.b, 'view', p)).body.duel;
    assert.deepEqual(next.result, first.result);
  }
});
run('connection grace allows reconnection, resolves one disconnect, and cancels when both expire', async () => {
  let p = await pair(); await start(p);
  await mutate(p.code, (d, now) => { d.players[pid(p.a)].lastSeen = now - DUEL_GRACE_MS + 1000; });
  assert.equal((await call(p.a, 'join', p)).body.duel.state, 'playing');
  await mutate(p.code, (d, now) => { d.players[pid(p.a)].lastSeen = now - DUEL_GRACE_MS - 1; });
  const disconnected = (await call(p.b, 'view', p)).body.duel;
  assert.equal(disconnected.result.reason, 'disconnect'); assert.equal(disconnected.result.winner, 2);
  assert.equal((await call(p.c, 'join', p)).statusCode, 409);
  p = await pair(); await start(p);
  await mutate(p.code, (d, now) => { for (const v of Object.values(d.players)) v.lastSeen = now - DUEL_GRACE_MS - 1; });
  const abandoned = (await call(p.a, 'view', p)).body.duel;
  assert.equal(abandoned.result.reason, 'abandoned'); assert.equal(abandoned.result.winner, 0);
});
run('explicit leave cancels waiting rooms or forfeits active play, and never permits a replacement', async () => {
  for (const playing of [false, true]) {
    const p = await pair(); if (playing) await start(p);
    const result = (await call(p.a, 'leave', p)).body.duel;
    assert.equal(result.result.reason, playing ? 'forfeit' : 'cancelled');
    assert.equal(result.result.winner, playing ? 2 : 0);
    assert.equal((await call(p.c, 'join', p)).statusCode, 409);
    assert.equal((await call(p.b, 'rematch', p)).statusCode, 409);
    assert.equal((await call(p.a, 'leave', p)).statusCode, 200);
  }
});
run('a rematch requires both current players and concurrent consent starts exactly one new match', async () => {
  const p = await pair(); await start(p);
  await mutate(p.code, (d, now) => { d.startsAt = now - 150_001; });
  const final = (await call(p.a, 'view', p)).body.duel;
  assert.equal((await call(p.c, 'rematch', p)).statusCode, 403);
  const first = (await call(p.a, 'rematch', p)).body.duel;
  assert.equal(first.state, 'finished'); assert.equal(first.id, final.id); assert.equal(first.players[0].rematch, true);
  const results = await Promise.all([call(p.b, 'rematch', p), call(p.b, 'rematch', p)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  const next = results.find(r => r.statusCode === 200).body.duel;
  assert.equal(next.generation, 2); assert.notEqual(next.id, final.id); assert.equal(next.state, 'starting'); assert.equal(next.result, null);
  assert.deepEqual(next.players.map(p => p.score), [0, 0]);
  assert.equal((await call(p.a, 'answer', { ...p, questionNumber: 1, selectedIndex: 0 })).statusCode, 409);
});
run('stale ready and rematch votes cannot start without the opponent returning', async () => {
  const p = await pair();
  await call(p.a, 'ready', p);
  await mutate(p.code, (d, now) => { d.players[pid(p.a)].lastSeen = now - DUEL_GRACE_MS - 1; });
  const waiting = (await call(p.b, 'ready', p)).body.duel;
  assert.equal(waiting.state, 'waiting'); assert.equal(waiting.players[0].ready, false);
  assert.equal((await call(p.a, 'ready', p)).body.duel.state, 'starting');
  await mutate(p.code, (d, now) => { d.startsAt = now - 150_001; });
  await call(p.a, 'view', p); await call(p.a, 'rematch', p);
  await mutate(p.code, (d, now) => { d.players[pid(p.a)].lastSeen = now - DUEL_GRACE_MS - 1; });
  const consent = (await call(p.b, 'rematch', p)).body.duel;
  assert.equal(consent.state, 'finished'); assert.equal(consent.players[0].rematch, false);
  assert.equal((await call(p.a, 'view', p)).body.duel.players[0].rematch, false);
  assert.equal((await call(p.a, 'rematch', p)).body.duel.state, 'starting');
});

run('recovered sessions share one durable seat and cannot become their own opponent', async () => {
  const p = await pair();
  const replacement = await session('Recovered First Geek');
  const sessionKey = `geek:session:${pid(replacement)}`;
  const record = JSON.parse(await fixture.command('GET', sessionKey));
  record.playerId = pid(p.a);
  await fixture.command('SET', sessionKey, JSON.stringify(record));
  const joined = (await call(replacement, 'join', p)).body.duel;
  assert.equal(joined.yourSlot, 1); assert.equal(joined.players.length, 2);
  await start(p);
  assert.equal((await call(replacement, 'view', p)).body.duel.yourSlot, 1);
  assert.equal((await call(replacement, 'answer', { ...p, questionNumber: 1, selectedIndex: 0 })).statusCode, 200);
  assert.equal((await call(p.a, 'answer', { ...p, questionNumber: 1, selectedIndex: 0 })).statusCode, 409);
});

run('A.C.E. creation reserves a simulated seat, validates difficulty and hides future plans', async () => {
  await fixture.command('FLUSHDB');
  const a = await session('Solo Geek'), outsider = await session('Visitor');
  for (const difficulty of ['cadet', 'operator', 'vanguard']) {
    const response = await call(a, 'create', { category: 'kaspa', opponent: 'ace', difficulty, score: 999999, acePlans: [{ selectedIndex: 0 }] });
    assert.equal(response.statusCode, 201);
    const view = response.body.duel, d = await stored(view.code);
    assert.equal(view.opponent, 'ace'); assert.equal(view.difficulty, difficulty);
    assert.equal(view.players[1].simulated, true); assert.equal(view.players[1].ready, true);
    assert.equal(view.state, 'waiting'); assert.equal(view.question, null);
    assert.equal(d.acePlans.length, 10);
    assert(d.acePlans.every(p => Number.isInteger(p.selectedIndex) && p.selectedIndex >= 0 && p.selectedIndex <= 3 && p.delayMs >= 2000 && p.delayMs < 15000));
    for (const value of ['acePlans', 'correctIndex', 'delayMs', 'simulated-ace', pid(a)]) assert(!JSON.stringify(view).includes(value));
    assert.equal((await call(outsider, 'join', { code: view.code })).statusCode, 409);
    assert.equal((await call(outsider, 'view', { code: view.code })).statusCode, 403);
  }
  assert.equal((await call(a, 'create', { category: 'kaspa', opponent: 'ace', difficulty: '__proto__' })).statusCode, 400);
  assert.equal((await call(a, 'create', { category: 'kaspa', opponent: 'fake' })).statusCode, 400);
  assert.equal((await call(a, 'create', { category: 'kaspa', difficulty: 'cadet' })).statusCode, 400);
});
run('A.C.E. answers settle once on Redis time and scores do not depend on polling or client fields', async () => {
  await fixture.command('FLUSHDB'); const a = await session('Solo Geek');
  const view = (await call(a, 'create', { category: 'kaspa', opponent: 'ace' })).body.duel;
  const p = { code: view.code, matchId: view.id };
  await mutate(p.code, d => { d.acePlans = d.questions.map((q, i) => ({ delayMs: 6000, selectedIndex: i % 2 ? (q.correctIndex + 1) % 4 : q.correctIndex })); });
  assert.equal((await call(a, 'view', p)).body.duel.players[1].score, 0);
  assert.equal((await call(a, 'ready', p)).body.duel.state, 'starting');
  await mutate(p.code, (d, now) => { d.startsAt = now - 7000; d.players['simulated-ace'].lastSeen = now - 999999; });
  const reads = await Promise.all([call(a, 'view', p), call(a, 'view', p), call(a, 'view', p)]);
  for (const r of reads) { assert.equal(r.body.duel.players[1].score, 1270); assert.equal(r.body.duel.players[1].correct, 1); }
  assert.equal(Object.keys((await stored(p.code)).players['simulated-ace'].answers).length, 1);
  const correct = (await stored(p.code)).questions[0].correctIndex;
  const answers = await Promise.all([0,1].map(() => call(a, 'answer', { ...p, questionNumber: 1, selectedIndex: correct, score: 99999, botCorrect: false })));
  assert.deepEqual(answers.map(r => r.statusCode).sort(), [200, 409]);
  assert.equal((await stored(p.code)).players['simulated-ace'].score, 1270);
  const profileBefore = await fixture.command('GET', `geek:profile:${pid(a)}`);
  await mutate(p.code, (d, now) => { d.startsAt = now - 150001; });
  const final = (await call(a, 'view', p)).body.duel;
  assert.equal(final.state, 'finished'); assert.equal(final.result.reason, 'completed');
  assert.equal(final.players[1].score, 6350); assert.equal(final.players[1].correct, 5);
  assert.equal((await call(a, 'view', p)).body.duel.players[1].score, 6350);
  assert.equal(await fixture.command('GET', `geek:profile:${pid(a)}`), profileBefore);
  const replay = (await call(a, 'rematch', p)).body.duel;
  assert.equal(replay.generation, 2); assert.equal(replay.state, 'starting'); assert.notEqual(replay.id, p.matchId);
  assert(replay.players.every(player => player.score === 0)); assert.equal(replay.difficulty, 'operator');
  assert.equal((await call(a, 'answer', { ...p, questionNumber: 1, selectedIndex: correct })).statusCode, 409);
});
run('A.C.E. uses human disconnect/forfeit rules and cannot be impersonated by a second player', async () => {
  await fixture.command('FLUSHDB'); const a = await session('Solo Geek'), b = await session('A.C.E.');
  const d = (await call(a, 'create', { category: 'kaspa', opponent: 'ace', difficulty: 'cadet' })).body.duel;
  const p = { code: d.code, matchId: d.id };
  assert.equal((await call(b, 'ready', p)).statusCode, 403);
  await call(a, 'ready', p);
  await mutate(p.code, (d, now) => { d.startsAt = now - 46000; d.players[pid(a)].lastSeen = now - DUEL_GRACE_MS - 1; });
  const gone = (await call(a, 'view', p)).body.duel;
  assert.equal(gone.result.reason, 'disconnect'); assert.equal(gone.result.winner, 2);
  const next = (await call(a, 'rematch', p)).body.duel;
  const forfeit = (await call(a, 'leave', { code: next.code, matchId: next.id })).body.duel;
  assert.equal(forfeit.result.reason, 'forfeit'); assert.equal(forfeit.result.winner, 2);
  assert.equal((await call(a, 'rematch', { code: next.code, matchId: next.id })).statusCode, 409);
});
run('career effects reject forged unlocks, preserve concurrent profile data, and survive prestige resets', async () => {
  await fixture.command('FLUSHDB'); const a = await session('Character Geek'); const key = `geek:profile:${pid(a)}`;
  const save = async design => { const res = response(); await collectiblesHandler(request('POST', { action: 'customize-avatar', customization: design, progression: { prestige: 25, level: 50 } }, a), res); return res; };
  await fixture.command('SET', key, JSON.stringify({ xp: 0, balance: 23, categoryStats: { kaspa: { rounds: 2 } }, avatarId: 'giga-genesis' }));
  const before = await fixture.command('GET', key);
  assert.equal((await save({ ...personalGeek, fx: 'pulse' })).statusCode, 403);
  assert.equal((await save({ ...personalGeek, fx: 'crown' })).statusCode, 403);
  assert.equal(await fixture.command('GET', key), before);
  const profile = JSON.parse(before); profile.xp = 1000; await fixture.command('SET', key, JSON.stringify(profile));
  const pulse = await save({ ...personalGeek, fx: 'pulse', head: 'cap', outfit: 'vest', hair: 'braids' });
  assert.equal(pulse.statusCode, 200); assert.equal(pulse.body.collection.effects.find(e => e.id === 'pulse').owned, true);
  const stored = JSON.parse(await fixture.command('GET', key)); assert.equal(stored.xp, 1000); assert.equal(stored.balance, 23); assert.deepEqual(stored.categoryStats, profile.categoryStats);
  assert.equal((await save({ ...personalGeek, fx: 'crown' })).statusCode, 403);
  stored.xp = 12250; await fixture.command('SET', key, JSON.stringify(stored));
  const prestige = response(); await sessionHandler(request('POST', { action: 'prestige', expectedPrestige: 0, confirm: true }, a, { service: 'prestige' }), prestige);
  assert.equal(prestige.statusCode, 200); assert.equal(prestige.body.profile.progression.level, 1);
  const crown = await save({ ...personalGeek, fx: 'crown' }); assert.equal(crown.statusCode, 200);
  assert(crown.body.collection.effects.every(e => e.owned));
  const summary = response(); await profileHandler(request('GET', undefined, a), summary);
  assert.equal(summary.body.profile.progression.level, 1); assert(summary.body.profile.milestones.every(m => m.unlocked));
});
