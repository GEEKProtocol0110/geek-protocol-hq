import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import leaderboardHandler from '../api/leaderboard.js';
import { collectiblesHandler, profileHandler } from '../server/player-api.js';
import { defaultGeek } from '../public/assets/geek-avatar.js';
import { loadQuestionBank } from '../server/questions.js';
import { loadProfile, profileKeyFor, saveProfileWithAudit } from '../server/profile.js';
import { prestigeKeyFor } from '../server/prestige-state.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.ranked-persistence.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-persistence-token';
process.env.AUDIT_LOG_SECRET = 'synthetic-persistence-audit-32-characters';
let beforeCommit = null, loseReply = false;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith(process.env.UPSTASH_REDIS_REST_URL), 'No real upstream or production data in this fixture');
  const values = JSON.parse(options.body); let payload;
  const commit = values[0] === 'EVAL' && values[1].includes('geek-ranked-commit-v1');
  if (commit && beforeCommit) { const hook = beforeCommit; beforeCommit = null; await hook(values); }
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else payload = { result: await fixture.command(...values) };
  if (commit && payload.result === 1 && loseReply) { loseReply = false; throw new TypeError('Synthetic lost commit reply'); }
  return new Response(JSON.stringify(payload));
};
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { await fixture.command('FLUSHDB'); beforeCommit = null; loseReply = false; });
const call = async (handler, method, body, cookie = '', query = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end() {} };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'x-forwarded-proto': 'https', 'content-type': 'application/json', 'user-agent': cookie || 'synthetic-persistence-player' } }, res);
  return res;
};
const session = async () => { const res = await call(sessionHandler, 'POST', { displayName: 'Journey fixture' }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const pid = cookie => cookie.split('=')[1];
const stored = async key => JSON.parse(await fixture.command('GET', key));
const ranked = (cookie, action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
const resume = (cookie, runId) => call(rankedHandler, 'GET', undefined, cookie, { runId });
const right = payload => { const q = loadQuestionBank('kaspa').questions.find(q => q.prompt === payload.question.prompt); return payload.question.options.indexOf(q.options[q.correctIndex]); };
const answer = (cookie, payload) => ranked(cookie, 'answer', { runId: payload.run.id, questionToken: payload.question.token, selectedIndex: right(payload) });
const beforeLast = async (cookie, mode = 'daily') => {
  let result = await ranked(cookie, 'start', { category: 'kaspa', mode }); assert.equal(result.statusCode, 201); let payload = result.body;
  for (let i = 0; i < payload.run.questionCount - 1; i++) {
    result = await answer(cookie, payload); assert.equal(result.statusCode, 200);
    result = await ranked(cookie, 'next', { runId: payload.run.id }); assert.equal(result.statusCode, 200); payload = result.body;
  }
  return payload;
};

test('first-player path preserves name and Geek through a saved Daily result, profile reload and score publication', async () => {
  const cookie = await session();
  const custom = await call(collectiblesHandler, 'POST', { action: 'customize-avatar', customization: { ...defaultGeek, palette: 'forest' } }, cookie);
  assert.equal(custom.statusCode, 200);
  const payload = await beforeLast(cookie), receipt = await answer(cookie, payload);
  assert.equal(receipt.statusCode, 200); assert.ok(receipt.body.roundResult.xpEarned > 0);
  const finished = await ranked(cookie, 'finish', { runId: payload.run.id }); assert.equal(finished.statusCode, 200);
  const profile = (await call(profileHandler, 'GET', undefined, cookie)).body.profile;
  assert.equal(profile.player.name, 'Journey fixture'); assert.equal(profile.stats.xp, receipt.body.roundResult.xpEarned);
  assert.equal(profile.stats.totalQuestions, 5); assert.equal(profile.stats.totalCorrect, 5); assert.equal(profile.stats.totalRuns, 1);
  assert.equal(profile.achievements.find(a => a.id === 'first-signal').unlocked, true);
  assert.equal((await call(collectiblesHandler, 'GET', undefined, cookie)).body.collection.customization.palette, 'forest');
  const board = await call(leaderboardHandler, 'GET', undefined, cookie, { category: 'kaspa', mode: 'daily', mine: '1' });
  assert.equal(board.body.mine.score, receipt.body.run.totalScore); assert.equal(board.body.entries[0].level, profile.progression.level);
});

test('a lost final-answer commit reply recovers one XP award and the full answered review without revealing a future answer', async () => {
  const cookie = await session(), payload = await beforeLast(cookie), id = pid(cookie);
  loseReply = true; assert.equal((await answer(cookie, payload)).statusCode, 503);
  const raw = await fixture.command('GET', profileKeyFor(id));
  const recovered = await resume(cookie, payload.run.id); assert.equal(recovered.statusCode, 200);
  assert.equal(recovered.body.run.status, 'between-rounds'); assert.equal(recovered.body.question, null); assert.equal(recovered.body.run.answeredReview.length, 5);
  const repeated = await answer(cookie, payload); assert.equal(repeated.statusCode, 200);
  assert.equal(repeated.body.roundResult.xpEarned, recovered.body.roundResult.xpEarned);
  assert.equal(await fixture.command('GET', profileKeyFor(id)), raw);
  assert.equal((await resume(await session(), payload.run.id)).statusCode, 404);
});

test('parallel round completions reject a stale profile and manual retry retains both career awards', async () => {
  const cookie = await session(), a = await beforeLast(cookie), b = await beforeLast(cookie, 'gauntlet');
  let release; const blocked = new Promise(resolve => { release = resolve; }); let entered;
  const waiting = new Promise(resolve => { entered = resolve; });
  beforeCommit = async () => { entered(); await blocked; };
  const pending = answer(cookie, a); await waiting;
  const winner = await answer(cookie, b); assert.equal(winner.statusCode, 200); release();
  const stale = await pending; assert.equal(stale.statusCode, 409); assert.equal(stale.body.code, 'RANKED_STATE_CHANGED');
  assert.equal((await resume(cookie, a.run.id)).body.run.status, 'question');
  const retried = await answer(cookie, a); assert.equal(retried.statusCode, 200);
  const profile = await loadProfile(pid(cookie));
  assert.equal(profile.xp, winner.body.roundResult.xpEarned + retried.body.roundResult.xpEarned);
  assert.equal(profile.totalQuestions, 15); assert.equal(profile.totalCorrect, 15); assert.equal(profile.categoryStats.kaspa.rounds, 2);
});

test('a concurrent character save survives a ranked answer, and a stale entry debit changes no run or balance', async () => {
  const cookie = await session(), payload = await beforeLast(cookie, 'gauntlet'), id = pid(cookie);
  beforeCommit = async () => {
    const response = await call(collectiblesHandler, 'POST', { action: 'customize-avatar', customization: { ...defaultGeek, palette: 'cyan' } }, cookie);
    assert.equal(response.statusCode, 200);
  };
  assert.equal((await answer(cookie, payload)).statusCode, 409);
  assert.equal((await answer(cookie, payload)).statusCode, 200);
  assert.equal((await loadProfile(id)).avatarCustomization.palette, 'cyan');
  const raw = await fixture.command('GET', `geek:run:${payload.run.id}`), before = await loadProfile(id);
  beforeCommit = async () => { const p = await stored(profileKeyFor(id)); p.avatarId = 'giga-genesis'; await fixture.command('SET', profileKeyFor(id), JSON.stringify(p)); };
  assert.equal((await ranked(cookie, 'continue', { runId: payload.run.id })).statusCode, 409);
  assert.equal(await fixture.command('GET', `geek:run:${payload.run.id}`), raw); assert.equal((await loadProfile(id)).balance, before.balance);
  const accepted = await ranked(cookie, 'continue', { runId: payload.run.id }); assert.equal(accepted.statusCode, 200);
  assert.equal((await loadProfile(id)).balance, before.balance - 40);
});

test('duplicate answer and finish clicks never double-count XP, achievements or completed runs', async () => {
  const cookie = await session(), payload = await beforeLast(cookie);
  const answers = await Promise.all([answer(cookie, payload), answer(cookie, payload)]);
  assert.ok(answers.every(r => r.statusCode === 200)); assert.deepEqual(answers[0].body.roundResult, answers[1].body.roundResult);
  const finishes = await Promise.all([ranked(cookie, 'finish', { runId: payload.run.id }), ranked(cookie, 'finish', { runId: payload.run.id })]);
  assert.ok(finishes.some(r => r.statusCode === 200));
  assert.equal((await ranked(cookie, 'finish', { runId: payload.run.id })).statusCode, 200);
  const p = await loadProfile(pid(cookie)); assert.equal(p.xp, answers[0].body.roundResult.xpEarned); assert.equal(p.totalRuns, 1);
  assert.equal(p.journey.filter(x => x.type === 'round').length, 1);
});

test('a damaged profile blocks reads, starts and cosmetic saves without replacing it or initializing a false rank', async () => {
  const cookie = await session(), id = pid(cookie), key = profileKeyFor(id);
  for (const raw of ['{broken', 'null', '[]', '0', '{"xp":-1}', '{"xp":"100"}', '{"balance":null}', '{"xp":1e300}']) {
    await fixture.command('SET', key, raw); await fixture.command('DEL', prestigeKeyFor(id));
    assert.equal((await call(profileHandler, 'GET', undefined, cookie)).body.code, 'PROFILE_STATE_INVALID');
    assert.equal((await ranked(cookie, 'start', { mode: 'daily' })).statusCode, 503);
    assert.equal((await call(collectiblesHandler, 'POST', { action: 'customize-avatar', customization: defaultGeek }, cookie)).statusCode, 503);
    assert.equal(await fixture.command('GET', key), raw); assert.equal(await fixture.command('GET', prestigeKeyFor(id)), null);
    assert.deepEqual(await fixture.command('KEYS', `geek:daily:${id}:*`), []);
  }
});

test('leaderboards report damaged progression as unavailable while keeping the verified score', async () => {
  const cookie = await session(), payload = await beforeLast(cookie); await answer(cookie, payload); await ranked(cookie, 'finish', { runId: payload.run.id });
  await fixture.command('SET', profileKeyFor(pid(cookie)), '{broken');
  const board = await call(leaderboardHandler, 'GET', undefined, '', { category: 'kaspa', mode: 'daily' });
  assert.equal(board.statusCode, 200); assert.equal(board.body.entries[0].level, null); assert.equal(board.body.entries[0].prestige, null); assert.ok(board.body.entries[0].score > 0);
});

test('a lost start reply can resume the same daily attempt without claiming a second one', async () => {
  const cookie = await session(); loseReply = true;
  assert.equal((await ranked(cookie, 'start', { category: 'kaspa', mode: 'daily' })).statusCode, 503);
  const recovered = await call(rankedHandler, 'GET', undefined, cookie, { resume: '1' });
  assert.equal(recovered.statusCode, 200); assert.equal(recovered.body.run.status, 'question');
  const raw = await fixture.command('GET', `geek:run:${recovered.body.run.id}`);
  assert.equal((await resume(cookie, recovered.body.run.id)).body.question.token, recovered.body.question.token);
  assert.equal(await fixture.command('GET', `geek:run:${recovered.body.run.id}`), raw);
  assert.equal((await ranked(cookie, 'start', { category: 'kaspa', mode: 'daily' })).statusCode, 409);
  assert.equal((await call(rankedHandler, 'GET', undefined, await session(), { resume: '1' })).statusCode, 404);
});

test('a failed start snapshot does not consume a Daily attempt', async () => {
  const cookie = await session(), id = pid(cookie);
  beforeCommit = async () => { const p = await loadProfile(id); await fixture.command('SET', profileKeyFor(id), JSON.stringify({ ...p, avatarId: 'giga-builder' })); };
  assert.equal((await ranked(cookie, 'start', { category: 'kaspa', mode: 'daily' })).statusCode, 409);
  assert.deepEqual(await fixture.command('KEYS', `geek:daily:${id}:*`), []);
  assert.equal((await ranked(cookie, 'start', { category: 'kaspa', mode: 'daily' })).statusCode, 201);
});

test('a damaged audit index rejects a round award before changing its run, balance or XP', async () => {
  const cookie = await session(), payload = await beforeLast(cookie, 'gauntlet'), id = pid(cookie);
  const raw = await fixture.command('GET', `geek:run:${payload.run.id}`), p = await fixture.command('GET', profileKeyFor(id));
  await fixture.command('SET', 'geek:audit:index', 'damaged-index');
  const rejected = await answer(cookie, payload); assert.equal(rejected.statusCode, 503); assert.equal(rejected.body.code, 'AUDIT_STATE_INVALID');
  assert.equal(await fixture.command('GET', `geek:run:${payload.run.id}`), raw);
  assert.equal(await fixture.command('GET', profileKeyFor(id)), p);
  await fixture.command('DEL', 'geek:audit:index'); assert.equal((await answer(cookie, payload)).statusCode, 200);
});

test('an old payout-settings snapshot cannot overwrite newly earned career progress', async () => {
  const cookie = await session(), payload = await beforeLast(cookie), id = pid(cookie), stale = await loadProfile(id);
  await answer(cookie, payload); const raw = await fixture.command('GET', profileKeyFor(id));
  stale.payoutAddress = 'synthetic-destination';
  await assert.rejects(() => saveProfileWithAudit(id, stale, { type: 'payout.destination.created' }), /PROFILE_STATE_CHANGED/);
  assert.equal(await fixture.command('GET', profileKeyFor(id)), raw);
  const current = await loadProfile(id); current.payoutAddress = 'synthetic-destination';
  await saveProfileWithAudit(id, current, { type: 'payout.destination.created' });
  assert.equal((await loadProfile(id)).xp, JSON.parse(raw).xp);
});
