import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { redisFixture } from './helpers/redis-fixture.js';
import { clientFixture, json } from './helpers/client-fixture.js';
import {
  SEASON_ZERO, assertWritableLeaderboardSeason, currentSeasonNumber, leaderboardSeasonIds, leaderboardSeasonLabel,
  parseRunSeasonId, privateSeason, seasonConfig, seasonForRun
} from '../server/seasons.js';
import { resetRankedSourceCache } from '../server/question-source.js';
import { rankedRunBinding, seasonFor } from '../server/questions.js';
import { recordVerifiedScore } from '../server/leaderboard.js';
import sessionHandler from '../api/session.js';
import rankedHandler from '../api/ranked.js';
import leaderboardHandler from '../api/leaderboard.js';

// ---------------------------------------------------------------------------
// Synthetic environment: real local Redis, a fake private bank, a movable clock.
// No real questions, upstreams or production data are used.
// ---------------------------------------------------------------------------
const START = '2026-11';
const env = { GEEK_SEASON_1_START_MONTH: START };
const at = iso => Date.parse(iso);

const fixture = await redisFixture(), originalFetch = globalThis.fetch, realNow = Date.now.bind(Date);
const bankDir = mkdtempSync(join(tmpdir(), 'geek-monthly-bank-'));
for (const category of ['kaspa', 'history']) {
  const questions = ['easy', 'medium', 'hard'].flatMap(tier => Array.from({ length: 15 }, (_, i) => {
    const options = ['Fake wrong A', 'Fake wrong B', 'Fake wrong C']; options.splice(i % 4, 0, 'Fake right');
    return { id: `FAKE-MS-${category}-${tier}-${i}`, category, subcategory: `Fake topic ${i % 5}`, difficulty: tier, prompt: `Fake ${category} ${tier} prompt ${i}?`, options, correctIndex: i % 4 };
  }));
  writeFileSync(join(bankDir, `${category}-fake.json`), JSON.stringify({ questions }));
}
const ENV_KEYS = ['GEEK_SEASON_BANK_VERSIONS', 'GEEK_PRIVATE_QUESTION_DIR', 'GEEK_PRIVATE_QUESTION_URL', 'GEEK_PRIVATE_QUESTION_REF', 'GEEK_RANKED_QUESTION_SOURCE', 'GEEK_SEASON_1_START_MONTH', 'VERCEL_ENV', 'NODE_ENV'];
const savedEnv = Object.fromEntries(ENV_KEYS.map(k => [k, process.env[k]]));
ENV_KEYS.forEach(k => delete process.env[k]);
Object.assign(process.env, {
  GEEK_PRIVATE_QUESTION_DIR: bankDir, GEEK_SEASON_1_START_MONTH: START,
  UPSTASH_REDIS_REST_URL: 'https://redis.monthly-seasons.test', UPSTASH_REDIS_REST_TOKEN: 'synthetic-monthly-token',
  AUDIT_LOG_SECRET: 'synthetic-monthly-audit-secret-32-chars'
});
resetRankedSourceCache();

let failCommit = false, clockBase = null, clockStartedAt = 0;
const setClock = iso => { clockBase = at(iso); clockStartedAt = realNow(); };
Date.now = () => clockBase === null ? realNow() : clockBase + (realNow() - clockStartedAt);

globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith(process.env.UPSTASH_REDIS_REST_URL), 'only the synthetic Redis endpoint');
  const values = JSON.parse(options.body); let payload;
  if (failCommit && values[0] === 'EVAL' && String(values[1]).includes('geek-ranked-commit-v1')) { failCommit = false; throw new TypeError('Synthetic commit failure'); }
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else payload = { result: await fixture.command(...values) };
  return new Response(JSON.stringify(payload));
};
after(async () => {
  globalThis.fetch = originalFetch; Date.now = realNow;
  ENV_KEYS.forEach(k => savedEnv[k] === undefined ? delete process.env[k] : process.env[k] = savedEnv[k]);
  resetRankedSourceCache(); await fixture.close();
});
beforeEach(async () => { await fixture.command('FLUSHDB'); clockBase = null; failCommit = false; delete process.env.VERCEL_ENV; delete process.env.GEEK_SEASON_BANK_VERSIONS; });

let ipCounter = 0;
const call = async (handler, method, body, cookie = '', query = {}) => {
  const res = { headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end() {} };
  await handler({ method, body, query, headers: { cookie, host: 'www.geekprotocol.xyz', origin: 'https://www.geekprotocol.xyz', 'x-forwarded-proto': 'https', 'content-type': 'application/json', 'user-agent': `synthetic-monthly-${cookie || ipCounter++}`, 'x-forwarded-for': `10.9.0.${(ipCounter++ % 200) + 1}` }, socket: {} }, res);
  return res;
};
const session = async (name = 'Monthly fixture') => { const res = await call(sessionHandler, 'POST', { displayName: name }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const ranked = (cookie, action, fields = {}) => call(rankedHandler, 'POST', { action, ...fields }, cookie);
const resume = (cookie, runId) => call(rankedHandler, 'GET', undefined, cookie, { runId });
const board = (season, mode = 'speed', category = 'kaspa') => call(leaderboardHandler, 'GET', undefined, '', { category, mode, season, limit: '50' });
const right = payload => payload.question.options.indexOf('Fake right');
const noCorrectness = body => {
  const text = JSON.stringify({ result: body.result, run: body.run });
  for (const field of ['"correctIndex"', '"answer"', '"scoreAdded"', '"roundScore"', '"streak"']) assert.equal(text.includes(field), false, `deferred response leaked ${field}`);
};
// Plays a full Speed run with correct answers; returns the payload before finish.
const playSpeed = async cookie => {
  let res = await ranked(cookie, 'start', { category: 'kaspa', mode: 'speed' }); assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  const start = res.body; let payload = start;
  for (let i = 0; i < start.run.questionCount; i++) {
    res = await ranked(cookie, 'answer', { runId: start.run.id, questionToken: payload.question.token, selectedIndex: right(payload) });
    assert.equal(res.statusCode, 200);
    if (res.body.roundResult) return { start, last: res.body };
    noCorrectness(res.body);
    res = await ranked(cookie, 'next', { runId: start.run.id }); assert.equal(res.statusCode, 200); payload = res.body;
  }
  throw new Error('round did not lock');
};
const boardKeys = async () => (await fixture.command('KEYS', 'geek:*leaderboard*')).filter(k => !k.endsWith(':meta') && /^geek:([a-z0-9-]+:)?leaderboard:/.test(k)).sort();

// ---------------------------------------------------------------------------
// Pure season arithmetic
// ---------------------------------------------------------------------------
test('season number follows the configured UTC start month with exact month boundaries', () => {
  const cases = [
    ['2026-10-31T23:59:59.999Z', 1], // before Season 1 starts: clamps to Season 1
    ['2026-11-01T00:00:00.000Z', 1],
    ['2026-11-30T23:59:59.999Z', 1],
    ['2026-12-01T00:00:00.000Z', 2],
    ['2026-12-31T23:59:59.999Z', 2],
    ['2027-01-01T00:00:00.000Z', 3], // year rollover
    ['2027-02-28T23:59:59.999Z', 4],
    ['2027-03-01T00:00:00.000Z', 5]
  ];
  for (const [iso, number] of cases) assert.equal(currentSeasonNumber(at(iso), env), number, iso);
  // UTC, not local time: 2026-11-30 20:00 in UTC-4 is already December in UTC.
  assert.equal(currentSeasonNumber(Date.parse('2026-11-30T20:00:00-04:00'), env), 2);
  assert.equal(currentSeasonNumber(Date.parse('2026-11-30T19:59:59-04:00'), env), 1);
});

test('without a configured start month rollover is off and everything stays Season 1', () => {
  assert.deepEqual(seasonConfig({}), { monthly: false });
  for (const iso of ['2026-01-01T00:00:00Z', '2030-06-15T12:00:00Z']) assert.equal(currentSeasonNumber(at(iso), {}), 1);
  assert.equal(privateSeason(1, {}).label, 'Season 1 — Private-bank');
  assert.deepEqual(leaderboardSeasonIds(at('2030-06-15T12:00:00Z'), {}), ['legacy', 'season-1']);
});

test('invalid start-month configuration fails closed for new runs but keeps boards readable', () => {
  for (const raw of ['2026-13', '2026-1', '26-11', 'nov', '2026-11-01', '1999-12']) {
    assert.throws(() => currentSeasonNumber(at('2026-12-01T00:00:00Z'), { GEEK_SEASON_1_START_MONTH: raw }), /SEASON_CONFIG_INVALID/, raw);
    assert.deepEqual(leaderboardSeasonIds(at('2026-12-01T00:00:00Z'), { GEEK_SEASON_1_START_MONTH: raw }), ['legacy', 'season-1']);
  }
});

test('season labels and months are derived from the season number', () => {
  assert.deepEqual({ ...privateSeason(1, env) }, { id: 'season-1', number: 1, label: 'Season 1 — Private-bank · Nov 2026', leaderboard: 'season-1', month: '2026-11' });
  assert.equal(privateSeason(3, env).month, '2027-01');
  assert.equal(privateSeason(3, env).label, 'Season 3 — Private-bank · Jan 2027');
  assert.equal(leaderboardSeasonLabel('legacy', env), 'Season 0 — Public-bank Alpha');
  assert.equal(leaderboardSeasonLabel('season-2', env), 'Season 2 — Private-bank · Dec 2026');
  assert.deepEqual(leaderboardSeasonIds(at('2027-01-01T00:00:00Z'), env), ['legacy', 'season-1', 'season-2', 'season-3']);
  assert.deepEqual(leaderboardSeasonIds(at('2026-12-31T23:59:59.999Z'), env), ['legacy', 'season-1', 'season-2']);
});

test('unknown or malformed season values are rejected, never coerced to Season 0', () => {
  assert.equal(seasonForRun({}), SEASON_ZERO, 'runs from before seasons existed are Season 0');
  assert.equal(seasonForRun({ season: 'season-0' }), SEASON_ZERO);
  assert.equal(seasonForRun({ season: 'season-7' }, env).leaderboard, 'season-7');
  for (const bad of ['legacy', 'season-01', 'season--1', 'Season-1', ' season-1', 'season-1 ', 'season-10000', 'season-x', '', 7, {}, []]) {
    assert.equal(parseRunSeasonId(bad), bad === '' ? null : null);
    assert.throws(() => seasonForRun({ season: bad }), /SEASON_UNSUPPORTED/, JSON.stringify(bad));
    assert.throws(() => seasonFor({ season: bad }), /SEASON_UNSUPPORTED/);
  }
  for (const bad of ['season-0', 'season-x', 'current', '', null, 'geek:leaderboard', 'season-1:kaspa']) assert.throws(() => assertWritableLeaderboardSeason(bad), /SEASON_UNSUPPORTED/, String(bad));
  assert.equal(assertWritableLeaderboardSeason('legacy'), 'legacy');
  assert.equal(assertWritableLeaderboardSeason('season-12'), 'season-12');
});

test('recordVerifiedScore rejects unsupported seasons without writing any board', async () => {
  for (const season of ['season-x', 'current', 'season-0', '', null]) {
    await assert.rejects(recordVerifiedScore({ session: { id: 'bad-season', name: 'Bad' }, category: 'kaspa', mode: 'speed', score: 999, round: 1, season }), /SEASON_UNSUPPORTED/);
  }
  assert.deepEqual(await boardKeys(), []);
  await recordVerifiedScore({ session: { id: 'iso-a', name: 'Iso A' }, category: 'kaspa', mode: 'speed', score: 500, round: 1, season: 'season-2' });
  assert.deepEqual(await boardKeys(), ['geek:development:leaderboard:season-2:speed:kaspa']);
});

// ---------------------------------------------------------------------------
// Server binding at run start and the month rollover
// ---------------------------------------------------------------------------
test('run start binds season, month and bank version on the server', async () => {
  setClock('2026-12-31T23:59:59.000Z');
  const binding = await rankedRunBinding(Date.now());
  assert.equal(binding.season, 'season-2'); assert.equal(binding.seasonMonth, '2026-12'); assert.ok(binding.bankVersion);
  assert.equal((await rankedRunBinding(at('2027-01-01T00:00:00.000Z'))).season, 'season-3');
  const cookie = await session();
  const res = await ranked(cookie, 'start', { category: 'kaspa', mode: 'speed', season: 'season-9', bankVersion: 'forged' });
  assert.equal(res.statusCode, 201);
  assert.equal(res.body.run.season, 'season-2', 'client-supplied season is ignored');
  const stored = JSON.parse(await fixture.command('GET', `geek:run:${res.body.run.id}`));
  assert.equal(stored.season, 'season-2'); assert.equal(stored.seasonMonth, '2026-12'); assert.equal(stored.bankVersion, binding.bankVersion);
});

test('a run started at 23:59:59 UTC that finishes after rollover scores into its original season, through reload, reconnect and retry', async () => {
  setClock('2026-11-30T23:59:30.000Z');
  const cookie = await session('Rollover Geek');
  const { start, last } = await playSpeed(cookie);
  assert.equal(start.run.season, 'season-1');
  // Month rolls over before the player finishes.
  setClock('2026-12-01T00:00:05.000Z');
  // Reload / reconnect: the run still reports its bound season.
  const reloaded = await resume(cookie, start.run.id);
  assert.equal(reloaded.statusCode, 200); assert.equal(reloaded.body.run.season, 'season-1');
  assert.match(reloaded.body.run.seasonLabel, /^Season 1 — Private-bank/);
  const finished = await ranked(cookie, 'finish', { runId: start.run.id });
  assert.equal(finished.statusCode, 200); assert.equal(finished.body.leaderboard.season, 'season-1');
  // Retry of the same finish (lost reply) is idempotent and stays in Season 1.
  const retry = await ranked(cookie, 'finish', { runId: start.run.id });
  assert.equal(retry.statusCode, 200); assert.equal(retry.body.leaderboard.season, 'season-1');
  const total = last.run.totalScore;
  assert.ok(total > 0);
  assert.deepEqual((await board('season-1')).body.entries.map(e => e.score), [total]);
  assert.deepEqual((await board('season-2')).body.entries, []);
  assert.deepEqual((await board('legacy')).body.entries, []);
  assert.equal((await board('current')).body.season, 'season-2');
});

test('scores are isolated per season and Season 0 history stays viewable', async () => {
  await recordVerifiedScore({ session: { id: 'alpha-veteran', name: 'Alpha Veteran' }, category: 'kaspa', mode: 'speed', score: 777, round: 1 }); // Season 0 history
  setClock('2026-11-15T12:00:00.000Z');
  const novCookie = await session('November');
  const nov = await playSpeed(novCookie); await ranked(novCookie, 'finish', { runId: nov.start.run.id });
  setClock('2026-12-15T12:00:00.000Z');
  const decCookie = await session('December');
  const dec = await playSpeed(decCookie);
  assert.equal(dec.start.run.season, 'season-2');
  const decFinish = await ranked(decCookie, 'finish', { runId: dec.start.run.id });
  assert.equal(decFinish.body.leaderboard.season, 'season-2');
  const names = async season => (await board(season)).body.entries.map(e => e.name);
  assert.deepEqual(await names('legacy'), ['Alpha Veteran']);
  assert.deepEqual(await names('season-1'), ['November']);
  assert.deepEqual(await names('season-2'), ['December']);
  assert.deepEqual(await boardKeys(), ['geek:development:leaderboard:season-1:speed:kaspa', 'geek:development:leaderboard:season-2:speed:kaspa', 'geek:leaderboard:speed:kaspa']);
});

test('leaderboard lists Season 0 plus past and current seasons only; future and malformed picks show Season 0', async () => {
  setClock('2027-01-01T00:00:00.000Z');
  const res = await board('current');
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body.seasons, ['current', 'legacy', 'season-1', 'season-2', 'season-3']);
  assert.equal(res.body.season, 'season-3');
  assert.equal(res.body.seasonLabels['season-2'], 'Season 2 — Private-bank · Dec 2026');
  assert.equal(res.body.seasonLabels.legacy, 'Season 0 — Public-bank Alpha');
  for (const pick of ['season-4', 'season-99', 'season-x', 'season-01']) {
    const stale = await board(pick);
    assert.equal(stale.body.season, 'legacy', pick); assert.equal(stale.body.seasons.includes(pick), false);
  }
  setClock('2026-12-31T23:59:59.000Z');
  assert.deepEqual((await board('current')).body.seasons, ['current', 'legacy', 'season-1', 'season-2']);
});

test('a stored run with a tampered season cannot finish into Season 0', async () => {
  setClock('2026-11-10T00:00:00.000Z');
  const cookie = await session('Tamper');
  const { start } = await playSpeed(cookie);
  const key = `geek:run:${start.run.id}`;
  const stored = JSON.parse(await fixture.command('GET', key));
  stored.season = 'season-x';
  await fixture.command('SET', key, JSON.stringify(stored), 'KEEPTTL');
  const res = await ranked(cookie, 'finish', { runId: start.run.id });
  assert.notEqual(res.statusCode, 200);
  assert.deepEqual(await boardKeys(), []);
});

// ---------------------------------------------------------------------------
// Royale, Duel and Lobby stay outside ranked seasons
// ---------------------------------------------------------------------------
test('Royale, Duel and Lobby code does not touch ranked season boards', () => {
  for (const file of ['server/royale.js', 'server/royale-api.js', 'server/duel.js', 'server/duel-api.js', 'server/lobby-game.js', 'api/lobbies.js']) {
    const source = readFileSync(join(process.cwd(), file), 'utf8');
    assert.doesNotMatch(source, /recordVerifiedScore|seasons\.js|rankedRunBinding|geek:leaderboard/, file);
  }
});

// ---------------------------------------------------------------------------
// Client season picker with a dynamic list
// ---------------------------------------------------------------------------
const playSource = readFileSync(new URL('../public/play/assets/game.js', import.meta.url), 'utf8');
const storageKey = 'geek_hq_board_season_v1';
const picker = async (seasonsFor, preset = {}) => {
  const storage = new Map(Object.entries(preset)), requests = [];
  const ui = clientFixture(async (path, options = {}) => {
    requests.push(path);
    if (path.startsWith('/api/leaderboard')) {
      const season = new URL(path, 'https://example.test').searchParams.get('season');
      const seasons = seasonsFor();
      const listed = seasons.includes(season) && season !== 'current';
      return json({ entries: [], seasons, seasonLabels: Object.fromEntries(seasons.filter(s => s !== 'current').map(s => [s, `Label ${s}`])), season: listed ? season : 'season-x', seasonLabel: listed ? `Label ${season}` : 'Current' });
    }
    if (path === '/api/session') return json({ ok: true });
    return json({ profile: { xp: 0, balance: 0, bestRound: 0, bestScore: 0, totalRuns: 0, progression: { level: 1, prestige: 0 } } });
  }, { localStorage: { getItem: k => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, v), removeItem: k => storage.delete(k) } });
  ui.window.location = { search: '' }; ui.window.GEEK_QUESTION_COUNTS = { kaspa: 100 };
  ui.window.scrollTo = () => {}; ui.window.setInterval = () => 1; ui.window.clearInterval = () => {};
  ui.window.setTimeout = ui.context.setTimeout; ui.window.clearTimeout = ui.context.clearTimeout;
  // A minimal <select> with real option handling.
  const select = ui.node('[data-board-season]'); let value = 'current';
  const makeOption = (v, label) => { const option = { value: v, textContent: label, remove() { const i = select.options.indexOf(option); if (i >= 0) select.options.splice(i, 1); } }; return option; };
  select.options = [makeOption('current', 'Current season'), makeOption('legacy', 'Season 0 — Public-bank Alpha'), makeOption('season-1', 'Season 1 — Private-bank')];
  Object.defineProperty(select, 'value', { get: () => value, set: v => { value = select.options.some(o => o.value === v) ? v : value; }, configurable: true });
  select.append = option => select.options.push(option);
  ui.document.createElement = () => makeOption('', '');
  ui.run(playSource.replace('  initialize();\n})();', '  globalThis.actions = { loadLeaderboard }; globalThis.startup = initialize();\n})();'));
  await ui.context.startup;
  await ui.context.actions.loadLeaderboard();
  return { ui, select, storage, requests };
};

test('Play picker grows with the server list and restores a remembered newer season after reload', async () => {
  let seasons = ['current', 'legacy', 'season-1', 'season-2', 'season-3'];
  const first = await picker(() => seasons);
  assert.deepEqual(first.select.options.map(o => o.value), ['current', 'legacy', 'season-1', 'season-2', 'season-3']);
  assert.equal(first.select.options.find(o => o.value === 'season-2').textContent, 'Label season-2');
  first.select.value = 'season-2'; await first.select.emit('change');
  assert.equal(first.storage.get(storageKey), 'season-2');
  assert.match(first.requests.at(-1), /season=season-2/);
  // Reload: the static HTML lacks season-2; the first reply adds it and restores the pick.
  const reload = await picker(() => seasons, { [storageKey]: 'season-2' });
  assert.equal(reload.select.value, 'season-2');
  assert.match(reload.requests.at(-1), /season=season-2/);
});

test('Play picker drops stale picks the server no longer lists and falls back to Current', async () => {
  const seasons = ['current', 'legacy', 'season-1'];
  const stale = await picker(() => seasons, { [storageKey]: 'season-5' });
  assert.equal(stale.select.value, 'current');
  assert.match(stale.requests.at(-1), /season=current/);
  const listedOnce = await picker(() => ['current', 'legacy', 'season-1', 'season-2'], { [storageKey]: 'season-2' });
  assert.equal(listedOnce.select.value, 'season-2');
  // The server stops listing it (e.g. clock/config change): the pick resets and is forgotten.
  const gone = await picker(() => seasons, { [storageKey]: 'season-2' });
  assert.equal(gone.select.value, 'current'); assert.equal(gone.storage.has(storageKey), false);
  assert.deepEqual(gone.select.options.map(o => o.value), ['current', 'legacy', 'season-1']);
});

// ---------------------------------------------------------------------------
// Error mapping: clear season errors, fail-closed bank errors with code-only logs
// ---------------------------------------------------------------------------
import { cpSync } from 'node:fs';
import { handleApiError } from '../server/http.js';
import { seasonBankKey } from '../server/questions.js';

const captureLogs = async fn => {
  const lines = [], original = console.error;
  console.error = (...args) => lines.push(args);
  try { await fn(); } finally { console.error = original; }
  return lines;
};
const assertCleanLogs = (lines, forbidden) => {
  for (const args of lines) {
    for (const arg of args) assert.equal(typeof arg, 'string', 'only strings (no Error objects / stacks) are logged');
    const text = args.join(' ');
    for (const bad of forbidden) assert.equal(text.includes(bad), false, `log leaked ${bad}`);
    assert.doesNotMatch(text, /\/|\\|\bat\s|Fake|prompt/);
  }
};
const fakeRes = () => ({ statusCode: 0, body: null, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(n) { this.statusCode = n; return this; }, json(v) { this.body = v; return this; }, end() {} });
const withBankDir = async (dir, fn) => {
  process.env.GEEK_PRIVATE_QUESTION_DIR = dir; resetRankedSourceCache();
  try { return await fn(); } finally { process.env.GEEK_PRIVATE_QUESTION_DIR = bankDir; resetRankedSourceCache(); }
};

test('season errors map to 409 SEASON_UNSUPPORTED and 503 SEASON_CONFIG_INVALID', async () => {
  const logs = await captureLogs(() => {
    let res = fakeRes(); handleApiError(res, new Error('SEASON_UNSUPPORTED'));
    assert.equal(res.statusCode, 409); assert.equal(res.body.code, 'SEASON_UNSUPPORTED'); assert.equal(res.body.error, 'This season is not accepting scores.'); assert.equal(res.body.message, 'This season is not accepting scores');
    res = fakeRes(); handleApiError(res, new Error('SEASON_CONFIG_INVALID'));
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'SEASON_CONFIG_INVALID'); assert.match(res.body.error, /temporarily unavailable/);
    res = fakeRes(); handleApiError(res, new Error('SEASON_CLOCK_INVALID'));
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'SEASON_CLOCK_INVALID'); assert.match(res.body.error, /temporarily unavailable/);
  });
  assert.deepEqual(logs, [['Geek API error code', 'SEASON_UNSUPPORTED'], ['Geek API error code', 'SEASON_CONFIG_INVALID'], ['Geek API error code', 'SEASON_CLOCK_INVALID']]);
});

test('private-bank fail-closed errors map to a generic 503 and log only the code', async () => {
  const codes = ['PRIVATE_BANK_INVALID', 'PRIVATE_BANK_ID_COLLISION', 'PRIVATE_BANK_URL_INVALID', 'PRIVATE_BANK_REF_INVALID', 'PRIVATE_BANK_REF_REQUIRED', 'PRIVATE_BANK_TIMEOUT', 'PRIVATE_BANK_UNREACHABLE', 'PRIVATE_BANK_TOO_LARGE', 'RANKED_SOURCE_INVALID', 'RANKED_BANK_UNAVAILABLE', 'RANKED_BANK_SEASON_MISMATCH'];
  const logs = await captureLogs(() => {
    for (const code of codes) {
      const error = new Error(code); error.stack = `${code}\n    at /secret/private-bank/kaspa.json:1:1`;
      const res = fakeRes(); handleApiError(res, error);
      assert.equal(res.statusCode, 503, code);
      assert.deepEqual(res.body, { ok: false, code: 'RANKED_BANK_UNAVAILABLE', error: 'Ranked play is temporarily unavailable. Practice remains open.' });
    }
  });
  assert.deepEqual(logs, codes.map(code => ['Geek API error code', code]));
  assertCleanLogs(logs, ['/secret', 'kaspa.json']);
  // A version change mid-run is still the existing 409, not a bank outage.
  const res = fakeRes(); handleApiError(res, new Error('RANKED_BANK_VERSION_CHANGED')); assert.equal(res.statusCode, 409);
});

test('a missing private dir fails closed at run start with 503 and no path in logs or body', async () => {
  const missing = join(tmpdir(), 'geek-monthly-missing-bank-dir-xyz');
  setClock('2026-11-10T00:00:00.000Z');
  const cookie = await session();
  let res;
  const logs = await captureLogs(() => withBankDir(missing, async () => { res = await ranked(cookie, 'start', { category: 'kaspa', mode: 'speed' }); }));
  assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'RANKED_BANK_UNAVAILABLE');
  assert.equal(JSON.stringify(res.body).includes(missing), false);
  assert.ok(logs.length >= 1); assertCleanLogs(logs, [missing, 'geek-monthly-missing']);
  assert.equal(await fixture.command('GET', seasonBankKey('season-1')), null, 'no season pin from a failed load');
});

test('a private-bank id collision fails closed with 503 and code-only logs', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'geek-monthly-collide-'));
  cpSync(bankDir, dir, { recursive: true });
  const dup = JSON.parse(readFileSync(join(dir, 'kaspa-fake.json'), 'utf8'));
  dup.questions[1].id = dup.questions[0].id;
  writeFileSync(join(dir, 'kaspa-fake.json'), JSON.stringify(dup));
  setClock('2026-11-10T00:00:00.000Z');
  const cookie = await session();
  let res;
  const logs = await captureLogs(() => withBankDir(dir, async () => { res = await ranked(cookie, 'start', { category: 'kaspa', mode: 'speed' }); }));
  assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'RANKED_BANK_UNAVAILABLE');
  assertCleanLogs(logs, [dir, 'FAKE-MS', 'Fake kaspa']);
});

// ---------------------------------------------------------------------------
// Bank version pinned per monthly season
// ---------------------------------------------------------------------------
test('production: the first saved run of a season pins its bank version; later runs reuse it', async () => {
  process.env.VERCEL_ENV = 'production';
  setClock('2026-11-10T00:00:00.000Z');
  const first = await ranked(await session('Pin A'), 'start', { category: 'kaspa', mode: 'speed' });
  assert.equal(first.statusCode, 201);
  const pinned = await fixture.command('GET', seasonBankKey('season-1'));
  const binding = await rankedRunBinding(Date.now());
  assert.equal(pinned, binding.bankVersion);
  const second = await ranked(await session('Pin B'), 'start', { category: 'kaspa', mode: 'speed' });
  assert.equal(second.statusCode, 201);
  assert.equal(await fixture.command('GET', seasonBankKey('season-1')), pinned);
  assert.equal(JSON.parse(await fixture.command('GET', `geek:run:${second.body.run.id}`)).bankVersion, pinned);
});

test('production: a live bank that differs from the season pin refuses new runs (503) but the next season pins the new bank', async () => {
  process.env.VERCEL_ENV = 'production';
  setClock('2026-11-20T00:00:00.000Z');
  assert.equal((await ranked(await session('Old bank'), 'start', { category: 'kaspa', mode: 'speed' })).statusCode, 201);
  const oldVersion = await fixture.command('GET', seasonBankKey('season-1'));
  const dir = mkdtempSync(join(tmpdir(), 'geek-monthly-rotated-'));
  cpSync(bankDir, dir, { recursive: true });
  const changed = JSON.parse(readFileSync(join(dir, 'kaspa-fake.json'), 'utf8'));
  changed.questions[0].prompt = 'Fake kaspa rotated prompt?';
  writeFileSync(join(dir, 'kaspa-fake.json'), JSON.stringify(changed));
  await withBankDir(dir, async () => {
    let res;
    const logs = await captureLogs(async () => { res = await ranked(await session('New bank'), 'start', { category: 'kaspa', mode: 'speed' }); });
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'RANKED_BANK_UNAVAILABLE');
    assert.deepEqual(logs, [['Geek API error code', 'RANKED_BANK_SEASON_MISMATCH']]);
    assert.equal(await fixture.command('GET', seasonBankKey('season-1')), oldVersion, 'pin never overwritten');
    assert.equal((await fixture.command('KEYS', 'geek:run:*')).length, 1, 'no run created on the mismatched bank');
    // Next month: Season 2 pins the new bank and plays normally.
    setClock('2026-12-01T00:00:01.000Z');
    res = await ranked(await session('December bank'), 'start', { category: 'kaspa', mode: 'speed' });
    assert.equal(res.statusCode, 201); assert.equal(res.body.run.season, 'season-2');
    const newVersion = await fixture.command('GET', seasonBankKey('season-2'));
    assert.ok(newVersion); assert.notEqual(newVersion, oldVersion);
  });
});

test('with GEEK_SEASON_1_START_MONTH unset no season bank pin is written (behavior unchanged)', async () => {
  delete process.env.GEEK_SEASON_1_START_MONTH;
  try {
    setClock('2026-12-15T00:00:00.000Z');
    const res = await ranked(await session('Unset'), 'start', { category: 'kaspa', mode: 'speed' });
    assert.equal(res.statusCode, 201); assert.equal(res.body.run.season, 'season-1');
    assert.deepEqual(await fixture.command('KEYS', 'geek:season-bank:*'), []);
  } finally { process.env.GEEK_SEASON_1_START_MONTH = START; }
});

// ---------------------------------------------------------------------------
// Security review fixes: env namespaces, pin only in production after save,
// config-pinned versions, operator reset CLI
// ---------------------------------------------------------------------------
import { configuredSeasonBankVersion, seasonKeyNamespace } from '../server/seasons.js';
import { main as resetMain, parseArgs as resetArgs } from '../scripts/season-bank-reset.mjs';

const fakeBankDirWithChange = () => {
  const dir = mkdtempSync(join(tmpdir(), 'geek-monthly-cfg-'));
  cpSync(bankDir, dir, { recursive: true });
  const changed = JSON.parse(readFileSync(join(dir, 'kaspa-fake.json'), 'utf8'));
  changed.questions[0].prompt = 'Fake kaspa changed prompt?';
  writeFileSync(join(dir, 'kaspa-fake.json'), JSON.stringify(changed));
  return dir;
};

test('season key namespace: production unchanged, every other environment prefixed', () => {
  assert.equal(seasonKeyNamespace({ VERCEL_ENV: 'production' }), 'geek:');
  assert.equal(seasonKeyNamespace({ VERCEL_ENV: 'preview' }), 'geek:preview:');
  assert.equal(seasonKeyNamespace({}), 'geek:development:');
  assert.equal(seasonKeyNamespace({ VERCEL_ENV: 'Bad Env!' }), 'geek:development:');
  assert.equal(seasonBankKey('season-3', { VERCEL_ENV: 'production' }), 'geek:season-bank:season-3');
  assert.equal(seasonBankKey('season-3', { VERCEL_ENV: 'preview' }), 'geek:preview:season-bank:season-3');
  assert.throws(() => seasonBankKey('season-0'), /SEASON_UNSUPPORTED/);
});

test('preview runs and scores never land on production season keys; Season 0 keys unchanged', async () => {
  process.env.VERCEL_ENV = 'preview';
  setClock('2026-11-10T00:00:00.000Z');
  const cookie = await session('Preview player');
  const { start } = await playSpeed(cookie);
  assert.equal((await ranked(cookie, 'finish', { runId: start.run.id })).statusCode, 200);
  await recordVerifiedScore({ session: { id: 'preview-legacy', name: 'Legacy' }, category: 'kaspa', mode: 'speed', score: 10, round: 1 });
  assert.deepEqual(await boardKeys(), ['geek:leaderboard:speed:kaspa', 'geek:preview:leaderboard:season-1:speed:kaspa']);
  assert.deepEqual(await fixture.command('KEYS', 'geek:leaderboard:season-*'), [], 'no production season board written');
  assert.deepEqual(await fixture.command('KEYS', '*season-bank*'), [], 'preview never writes a pin');
  assert.equal((await board('season-1')).body.entries.length, 1, 'preview reads its own board');
  process.env.VERCEL_ENV = 'production';
  assert.equal((await board('season-1')).body.entries.length, 0, 'production board untouched');
});

test('non-production never writes a pin but still enforces one in its own namespace', async () => {
  process.env.VERCEL_ENV = 'preview';
  setClock('2026-11-10T00:00:00.000Z');
  assert.equal((await ranked(await session('No pin'), 'start', { category: 'kaspa', mode: 'speed' })).statusCode, 201);
  assert.deepEqual(await fixture.command('KEYS', '*season-bank*'), []);
  await fixture.command('SET', 'geek:preview:season-bank:season-1', 'some-other-version');
  const logs = await captureLogs(async () => {
    const res = await ranked(await session('Enforced'), 'start', { category: 'kaspa', mode: 'speed' });
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'RANKED_BANK_UNAVAILABLE');
  });
  assert.deepEqual(logs, [['Geek API error code', 'RANKED_BANK_SEASON_MISMATCH']]);
  // A production-namespace pin does not affect preview.
  await fixture.command('DEL', 'geek:preview:season-bank:season-1');
  await fixture.command('SET', 'geek:season-bank:season-1', 'some-other-version');
  assert.equal((await ranked(await session('Other ns'), 'start', { category: 'kaspa', mode: 'speed' })).statusCode, 201);
});

test('production pins only after the run is saved; a failed save leaves no pin', async () => {
  process.env.VERCEL_ENV = 'production';
  setClock('2026-11-10T00:00:00.000Z');
  failCommit = true;
  const cookie = await session('Failed save');
  const failed = await captureLogs(async () => { const res = await ranked(cookie, 'start', { category: 'kaspa', mode: 'speed' }); assert.notEqual(res.statusCode, 201); });
  assert.ok(failed.length >= 0);
  assert.equal(await fixture.command('GET', seasonBankKey('season-1')), null, 'no pin from an unsaved run');
  const ok = await ranked(await session('Saved'), 'start', { category: 'kaspa', mode: 'speed' });
  assert.equal(ok.statusCode, 201);
  assert.equal(await fixture.command('GET', seasonBankKey('season-1')), JSON.parse(await fixture.command('GET', `geek:run:${ok.body.run.id}`)).bankVersion);
});

test('GEEK_SEASON_BANK_VERSIONS overrides first-run-wins and is validated', async () => {
  assert.equal(configuredSeasonBankVersion('season-2', { GEEK_SEASON_BANK_VERSIONS: '{"season-2":"v-abc"}' }), 'v-abc');
  assert.equal(configuredSeasonBankVersion('season-3', { GEEK_SEASON_BANK_VERSIONS: '{"season-2":"v-abc"}' }), null);
  assert.equal(configuredSeasonBankVersion('season-3', {}), null);
  for (const raw of ['nope', '[]', '{"legacy":"v"}', '{"season-2":""}', '{"season-2":5}']) assert.throws(() => configuredSeasonBankVersion('season-2', { GEEK_SEASON_BANK_VERSIONS: raw }), /SEASON_CONFIG_INVALID/, raw);
  process.env.VERCEL_ENV = 'production';
  setClock('2026-11-10T00:00:00.000Z');
  const live = (await rankedRunBinding(Date.now())).bankVersion;
  // A stale first-run pin is overridden by the configured version; no pin is written.
  await fixture.command('SET', seasonBankKey('season-1'), 'stale-first-run');
  process.env.GEEK_SEASON_BANK_VERSIONS = JSON.stringify({ 'season-1': live });
  assert.equal((await ranked(await session('Configured'), 'start', { category: 'kaspa', mode: 'speed' })).statusCode, 201);
  assert.equal(await fixture.command('GET', seasonBankKey('season-1')), 'stale-first-run');
  // A configured version that differs from the live bank refuses new runs.
  await withBankDir(fakeBankDirWithChange(), async () => {
    const res = await ranked(await session('Configured mismatch'), 'start', { category: 'kaspa', mode: 'speed' });
    assert.equal(res.statusCode, 503); assert.equal(res.body.code, 'RANKED_BANK_UNAVAILABLE');
  });
  process.env.GEEK_SEASON_BANK_VERSIONS = 'not json';
  const bad = await ranked(await session('Bad config'), 'start', { category: 'kaspa', mode: 'speed' });
  assert.equal(bad.statusCode, 503); assert.equal(bad.body.code, 'SEASON_CONFIG_INVALID');
});

test('season-bank reset CLI: explicit args, dry run by default, deletes only with --confirm', async () => {
  for (const argv of [[], ['--season', 'season-1'], ['--env', 'production'], ['--season', 'season-0', '--env', 'production'], ['--season', 'legacy', '--env', 'production'], ['--season', 'season-1', '--env', 'Prod!'], ['--season', 'season-1', '--env', 'production', '--force']]) {
    assert.throws(() => resetArgs(argv), /USAGE/, argv.join(' '));
    assert.equal(await resetMain(argv, { redis: async () => assert.fail('no Redis call on usage error'), log: () => {}, error: () => {} }), 2);
  }
  await fixture.command('SET', 'geek:season-bank:season-4', 'v-prod');
  await fixture.command('SET', 'geek:preview:season-bank:season-4', 'v-preview');
  const redis = (...args) => fixture.command(...args), out = [];
  assert.equal(await resetMain(['--season', 'season-4', '--env', 'production'], { redis, log: l => out.push(l), error: l => out.push(l) }), 0);
  assert.equal(await fixture.command('GET', 'geek:season-bank:season-4'), 'v-prod', 'dry run keeps the pin');
  assert.equal(await resetMain(['--season', 'season-4', '--env', 'preview', '--confirm'], { redis, log: l => out.push(l), error: l => out.push(l) }), 0);
  assert.equal(await fixture.command('GET', 'geek:preview:season-bank:season-4'), null);
  assert.equal(await fixture.command('GET', 'geek:season-bank:season-4'), 'v-prod', 'other namespace untouched');
  assert.equal(await resetMain(['--confirm', '--env', 'production', '--season', 'season-4'], { redis, log: l => out.push(l), error: l => out.push(l) }), 0);
  assert.equal(await fixture.command('GET', 'geek:season-bank:season-4'), null);
  assert.ok(out.some(l => l.includes('Dry run')));
});

test('no HTTP route exposes the season-bank reset', () => {
  for (const file of ['api/ranked.js', 'api/leaderboard.js', 'server/http.js']) assert.doesNotMatch(readFileSync(join(process.cwd(), file), 'utf8'), /season-bank-reset|DEL['"]?,\s*seasonBankKey/);
});
