import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import { firstSignal, questChecks } from '../public/quest/assets/chapter.js';
import { decodeQuest, questKey } from '../server/quest.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) { if (process.env.QUEST_REQUIRE_REDIS === '1' || process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error; }
const run = fixture ? test : (name, fn) => test(name, { skip: 'Install redis-server; required in CI for Quest transactions.' }, fn);
const originalFetch = globalThis.fetch;
if (fixture) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.quest.test'; process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/redis\.quest\.test/);
    const values = JSON.parse(options.body);
    const payload = String(url).endsWith('/pipeline') ? (await fixture.commands(values)).map(result => ({ result })) : { result: await fixture.command(...values) };
    return new Response(JSON.stringify(payload));
  };
}
after(async () => { globalThis.fetch = originalFetch; if (fixture) await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end() {} });
const request = (method, body, cookie, query = {}) => ({ method, body, headers: { cookie, 'x-forwarded-for': '127.0.0.1', 'user-agent': 'quest-fixture' }, query });
const session = async name => { const r = response(); await sessionHandler(request('POST', { displayName: name }, ''), r); assert.equal(r.statusCode, 200); return r.headers['Set-Cookie'].split(';')[0]; };
const id = cookie => cookie.split('=')[1];
const call = async (cookie, body, query = {}) => { const r = response(); await rankedHandler(request(body ? 'POST' : 'GET', body, cookie, { service: 'quest', ...query }), r); return r; };
const key = cookie => questKey(id(cookie));
const current = async cookie => (await call(cookie)).body.quest;
const actionFor = (q, action, extra = {}) => ({ action, revision: q.revision, ...(action !== 'begin' ? { attemptId: q.attempt.id, stepToken: q.attempt.token } : {}), ...extra });
const act = async (cookie, action, extra = {}) => {
  const q = await current(cookie), r = await call(cookie, actionFor(q, action, extra)); assert.equal(r.statusCode, 200, JSON.stringify(r.body)); return r.body.quest;
};
const fresh = async () => { await fixture.command('FLUSHDB'); return session('Explorer'); };
const answer = async (cookie, correct = true) => {
  const state = JSON.parse(await fixture.command('GET', key(cookie))), q = questChecks[state.run.index];
  const choice = correct ? q.correctIndex : (q.correctIndex + 1) % 4;
  return act(cookie, 'answer', { selectedIndex: state.run.orders[state.run.index].indexOf(choice) });
};
const complete = async (cookie, wrongAt = [0, 4]) => {
  if (!(await current(cookie)).attempt) await act(cookie, 'begin');
  for (let i = 0; i < 25; i++) {
    const q = await current(cookie); if (q.attempt.status === 'complete') return q;
    if (q.attempt.status === 'question') await answer(cookie, !wrongAt.includes(q.attempt.index));
    else await act(cookie, 'continue');
  }
  throw new Error('Chapter did not complete within its fixed transition count');
};

test('First Signal has three sourced scenes, six distinct checks, and no ranked question IDs', () => {
  assert.equal(firstSignal.scenes.length, 3); assert.equal(questChecks.length, 6);
  assert.equal(new Set(questChecks.map(q => q.id)).size, 6);
  for (const scene of firstSignal.scenes) {
    assert.ok(scene.story && scene.giga && scene.objective && scene.example); assert.equal(scene.notes.length, 3);
    assert.equal(scene.checkpoints.length, 2); assert.equal(new URL(scene.source.url).protocol, 'https:');
    for (const q of scene.checkpoints) { assert.equal(new Set(q.choices).size, 4); assert.ok(q.choices[q.correctIndex] && q.explanation); }
  }
  const source = readFileSync(new URL('../public/quest/assets/chapter.js', import.meta.url), 'utf8');
  assert.equal(/kaspa-questions|ranked|questionToken/.test(source.replace('// Public teaching content, separate from private ranked question banks.', '')), false);
});
run('reading Quest is private and write-free until explicit begin; completed steps resume', async () => {
  const cookie = await fresh(), other = await session('Other');
  assert.equal((await call('', undefined)).statusCode, 401);
  const q = await current(cookie); assert.equal(q.attempt, null); assert.equal(q.revision, 0); assert.equal(await fixture.command('EXISTS', key(cookie)), 0);
  const start = await act(cookie, 'begin'); assert.equal(start.attempt.status, 'lesson'); assert.equal(start.attempt.answered, 0);
  await act(cookie, 'continue'); const feedback = await answer(cookie, false);
  assert.equal(feedback.attempt.status, 'feedback'); assert.equal(feedback.review.length, 1); assert.equal(feedback.feedback.correct, false);
  assert.deepEqual(await current(cookie), feedback);
  const privateView = await call(other, undefined, { playerId: id(cookie), attemptId: feedback.attempt.id });
  assert.equal(privateView.body.quest.attempt, null);
  const serialized = JSON.stringify(feedback); assert.equal(serialized.includes(id(cookie)), false); assert.equal(serialized.includes('orders'), false);
});
run('skips, forged badge/score fields, wrong tokens and premature replay cannot advance progress', async () => {
  const cookie = await fresh(); let q = await current(cookie);
  assert.equal((await call(cookie, { ...actionFor(q, 'begin'), badge: { id: 'first-signal' } })).statusCode, 400);
  q = await act(cookie, 'begin'); const before = await fixture.command('GET', key(cookie));
  assert.equal((await call(cookie, actionFor(q, 'answer', { selectedIndex: 0 }))).statusCode, 409);
  assert.equal((await call(cookie, actionFor(q, 'replay'))).statusCode, 409);
  assert.equal((await call(cookie, { ...actionFor(q, 'continue'), stepToken: 'a'.repeat(32) })).statusCode, 409);
  assert.equal((await call(cookie, { ...actionFor(q, 'continue'), index: 5, complete: true })).statusCode, 400);
  assert.equal(await fixture.command('GET', key(cookie)), before);
  q = await act(cookie, 'continue');
  for (const selectedIndex of [-1, 4, 0.5, '0']) assert.equal((await call(cookie, actionFor(q, 'answer', { selectedIndex }))).statusCode, 400);
});
run('concurrent different answers accept only one; exact retries are idempotent', async () => {
  const cookie = await fresh(); await act(cookie, 'begin'); await act(cookie, 'continue');
  let q = await current(cookie), one = actionFor(q, 'answer', { selectedIndex: 0 }), two = actionFor(q, 'answer', { selectedIndex: 1 });
  const results = await Promise.all([call(cookie, one), call(cookie, two)]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]);
  q = results.find(r => r.statusCode === 200).body.quest;
  const accepted = results[0].statusCode === 200 ? one : two;
  const before = await fixture.command('GET', key(cookie));
  assert.deepEqual((await call(cookie, accepted)).body.quest, q); assert.equal(await fixture.command('GET', key(cookie)), before);
  const next = actionFor(q, 'continue'); const advances = await Promise.all([call(cookie, next), call(cookie, next)]);
  assert.deepEqual(advances.map(r => r.statusCode), [200, 200]); assert.equal(advances[0].body.quest.revision, q.revision + 1);
  assert.equal((await call(cookie, accepted)).statusCode, 409);
  assert.equal((await current(cookie)).attempt.answered, 1);
});
run('chapter completion and one-time badge are atomic, server-timed, and independent of accuracy', async () => {
  const cookie = await fresh(); await act(cookie, 'begin');
  for (let i = 0; i < 25; i++) {
    const q = await current(cookie);
    if (q.attempt.status === 'feedback' && q.attempt.index === 5) break;
    if (q.attempt.status === 'question') await answer(cookie, false); else await act(cookie, 'continue');
  }
  const before = await current(cookie); assert.equal(before.badge, null); assert.equal(before.lastCompleted, null); assert.equal(before.attempt.answered, 6);
  const finish = actionFor(before, 'continue'), results = await Promise.all([call(cookie, finish), call(cookie, finish)]);
  assert.deepEqual(results.map(r => r.statusCode), [200, 200]);
  const q = results[0].body.quest;
  assert.equal(q.attempt.status, 'complete'); assert.equal(q.attempt.correct, 0); assert.equal(q.review.length, 6);
  assert.equal(q.badge.id, 'first-signal'); assert.equal(q.badge.awardedAt, q.lastCompleted.completedAt);
  assert.equal(q.badge.attemptId, q.attempt.id); assert.equal(q.badge.transferable, false);
  assert.equal(await fixture.command('TTL', key(cookie)), -1);
});
run('replays preserve the original badge and completed review while new progress is saved', async () => {
  const cookie = await fresh(), first = await complete(cookie), badge = first.badge;
  const replay = await act(cookie, 'replay'); assert.equal(replay.attempt.status, 'lesson'); assert.notEqual(replay.attempt.id, first.attempt.id);
  assert.deepEqual(replay.badge, badge); assert.equal(replay.review.length, 2); assert.deepEqual(replay.lastCompleted, first.lastCompleted);
  assert.equal((await call(cookie, actionFor(first, 'continue'))).statusCode, 409);
  const second = await complete(cookie, []); assert.deepEqual(second.badge, badge); assert.equal(second.review.length, 0); assert.equal(second.attempt.correct, 6);
});
run('Quest never changes ranked XP, prestige, balances, collectibles or Study records', async () => {
  const cookie = await fresh(), playerId = id(cookie);
  const values = { [`geek:profile:${playerId}`]: '{"xp":900,"balance":50,"avatarId":"giga-builder","stickerInventory":{"giga-core":3}}', [`geek:prestige:${playerId}`]: '{"version":1,"prestige":1,"xpBaseline":500,"history":[]}', [`geek:study-progress:${playerId}`]: 'saved-study-fixture' };
  for (const [k, v] of Object.entries(values)) await fixture.command('SET', k, v);
  await complete(cookie); await act(cookie, 'replay'); await complete(cookie);
  for (const [k, v] of Object.entries(values)) assert.equal(await fixture.command('GET', k), v);
  const q = await current(cookie); assert.equal(q.xpEnabled, false); assert.equal(q.creditsEnabled, false); assert.equal(q.tokensEnabled, false); assert.equal(q.ranked, false);
});
run('durable identity recovery resumes the same chapter and badge in a new session', async () => {
  const cookie = await fresh(), done = await complete(cookie), recovered = await session('Recovered');
  const k = `geek:session:${id(recovered)}`, record = JSON.parse(await fixture.command('GET', k)); record.playerId = id(cookie); await fixture.command('SET', k, JSON.stringify(record));
  assert.deepEqual((await current(recovered)).badge, done.badge); assert.equal((await current(recovered)).attempt.id, done.attempt.id);
  await act(recovered, 'replay'); assert.equal((await current(cookie)).attempt.status, 'lesson');
});
run('corrupt chapter records fail closed without replacing progress or granting a badge', async () => {
  const cookie = await fresh(); await act(cookie, 'begin');
  const good = await fixture.command('GET', key(cookie));
  for (const change of [s => { s.version = 2; }, s => { s.run.answers = 12; }, s => { s.run.answers = [null]; }, s => { s.run.orders[0] = ['0','1','2','3']; }, s => { s.run.index = 5; }, s => { s.badge = {id:'fake'}; }, s => { delete s.lastCompleted; }]) {
    const s = JSON.parse(good); change(s); const corrupt = JSON.stringify(s); await fixture.command('SET', key(cookie), corrupt);
    const result = await call(cookie); assert.equal(result.statusCode, 503, JSON.stringify(result.body)); assert.equal(result.body.code, 'QUEST_STATE_INVALID');
    assert.equal(await fixture.command('GET', key(cookie)), corrupt);
    assert.throws(() => decodeQuest(corrupt), /QUEST_STATE_INVALID/);
  }
});
