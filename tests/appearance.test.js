import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import { appearanceKey } from '../server/appearance.js';
import { verifyAuditRecord } from '../server/audit.js';
import { HOLIDAYS, automaticHoliday, effectiveHoliday, holidayWindows, easterDay } from '../public/assets/holiday-calendar.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.appearance.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-appearance-fixture';
const owner = 'synthetic-appearance-owner-key-with-32-characters', origin = 'https://www.geekprotocol.xyz';
let loseSaveReply = false;
globalThis.fetch = async (url, options) => {
  assert.match(String(url), /^https:\/\/redis\.appearance\.test/);
  const values = JSON.parse(options.body); let payload;
  if (String(url).endsWith('/multi-exec')) payload = (await fixture.commands([['MULTI'], ...values, ['EXEC']])).at(-1).map(result => ({ result }));
  else if (String(url).endsWith('/pipeline')) payload = (await fixture.commands(values)).map(result => ({ result }));
  else { payload = { result: await fixture.command(...values) }; if (loseSaveReply && values[0] === 'EVAL' && String(values[1]).includes('geek-appearance-save-v1')) { loseSaveReply = false; throw new Error('Synthetic lost save response'); } }
  return new Response(JSON.stringify(payload));
};
beforeEach(async () => {
  await fixture.command('FLUSHDB'); loseSaveReply = false;
  process.env.OPS_ACCESS_TOKEN = owner; process.env.CCE_ADMIN_TOKEN = 'synthetic-cce-key-with-24-characters';
  process.env.AUDIT_LOG_SECRET = 'synthetic-appearance-audit-secret-with-32-characters'; process.env.VERCEL_ENV = 'production';
});
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(s) { this.statusCode = s; return this; }, json(v) { this.body = v; return this; }, end(v) { this.body = v; return this; } });
const call = async ({ method = 'GET', action = 'appearance', service = 'operations', cookie = '', body, path, headers = {} } = {}) => {
  const res = response(); await sessionHandler({ method, query: { service, action, ...(path ? { path } : {}) }, headers: { cookie, origin, 'content-type': 'application/json', 'user-agent': 'appearance-test', 'x-forwarded-for': '192.0.2.10', ...headers }, body }, res); return res;
};
const login = async () => { const res = await call({ method: 'POST', action: 'login', body: { key: owner } }); assert.equal(res.statusCode, 200); return res.headers['Set-Cookie'].split(';')[0]; };
const save = (cookie, expectedRevision, mode = 'manual', holiday = 'christmas') => call({ method: 'POST', cookie, body: { mode, holiday, expectedRevision } });
const publicView = (method = 'GET') => call({ method, service: 'appearance', headers: { origin: undefined }, action: '' });
const record = async () => JSON.parse(await fixture.command('GET', appearanceKey()));
const iso = value => new Date(value).toISOString().slice(0, 10);

test('automatic dates cover moving holidays, Easter and the December/January boundary in Detroit time', () => {
  const windows = Object.fromEntries(holidayWindows(2026).map(w => [w.id, w]));
  assert.equal(iso(easterDay(2026)), '2026-04-05');
  assert.equal(iso(easterDay(2027)), '2027-03-28');
  assert.equal(windows['mlk-day'].start, '2026-01-19'); assert.equal(windows['presidents-day'].start, '2026-02-16');
  assert.equal(windows['memorial-day'].end, '2026-05-25'); assert.equal(windows['labor-day'].end, '2026-09-07');
  assert.equal(windows.thanksgiving.start, '2026-11-23'); assert.equal(windows.thanksgiving.end, '2026-11-29');
  assert.equal(automaticHoliday(Date.parse('2026-12-31T17:00:00Z')).id, 'new-year');
  assert.equal(automaticHoliday(Date.parse('2027-01-03T04:59:59Z')).id, 'new-year');
  assert.equal(automaticHoliday(Date.parse('2027-01-03T05:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-10-24T03:59:59Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-10-24T04:00:00Z')).id, 'halloween');
  assert.equal(automaticHoliday(Date.parse('2027-02-15T17:00:00Z')).id, 'presidents-day');
  assert.equal(effectiveHoliday({ mode: 'off', holiday: 'christmas' }), null);
});

test('all holiday palettes retain readable accent text and dark primary-button text', () => {
  const css = readFileSync(new URL('../public/assets/holiday-theme.css', import.meta.url), 'utf8');
  const luminance = hex => { const values = hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]; };
  for (const holiday of HOLIDAYS) assert.ok(css.includes(`[data-holiday-theme='${holiday.id}']`));
  for (const match of css.matchAll(/--(?:gold|cyan):#([a-f0-9]{6})/gi)) assert.ok((luminance(match[1]) + .05) / (luminance('151b1b') + .05) >= 4.5, match[0]);
  assert.doesNotMatch(css, /animation:|@keyframes|url\(/);
});

test('public appearance is read-only, defaults Off, caches briefly and returns no owner configuration', async () => {
  const view = await publicView(); assert.equal(view.statusCode, 200); assert.deepEqual(view.body, { ok: true, theme: null });
  assert.equal(view.headers['Cache-Control'], 'public, max-age=30, s-maxage=30'); assert.equal(view.headers['Set-Cookie'], undefined);
  assert.equal((await publicView('POST')).statusCode, 405); assert.equal((await publicView('HEAD')).body, undefined);
  const cookie = await login(); assert.equal((await save(cookie, 0)).statusCode, 200);
  assert.deepEqual((await publicView()).body, { ok: true, theme: { id: 'christmas' } });
  const raw = JSON.stringify((await publicView()).body); for (const forbidden of ['revision', 'updatedAt', 'key', 'permissions', 'config']) assert.equal(raw.includes(forbidden), false);
});

test('settings and private workspace require owner access; role keys, player cookies and cross-site writes cannot change the theme', async () => {
  assert.equal((await call()).statusCode, 401);
  assert.equal((await call({ cookie: 'geek_session=' + 'a'.repeat(32) })).statusCode, 401);
  assert.equal((await call({ headers: { 'x-cce-admin': process.env.CCE_ADMIN_TOKEN } })).statusCode, 401);
  assert.equal((await call({ action: '', path: 'appearance' })).statusCode, 303);
  assert.equal((await call({ action: '', path: 'assets/appearance.js' })).statusCode, 401);
  const cookie = await login(); assert.equal((await call({ cookie, action: '', path: 'appearance' })).statusCode, 200);
  for (const headers of [{ origin: 'https://evil.example' }, { origin: '' }, { 'content-type': 'text/plain' }, { 'sec-fetch-site': 'cross-site' }]) assert.equal((await call({ method: 'POST', cookie, headers, body: { mode: 'manual', holiday: 'halloween', expectedRevision: 0 } })).statusCode, 403);
  assert.equal(await fixture.command('GET', appearanceKey()), null);
});

test('owner saves are audited, unknown input cannot become CSS, and Off/Automatic restore calendar control', async () => {
  const cookie = await login();
  for (const body of [{ mode: 'manual', holiday: '<script>', expectedRevision: 0 }, { mode: 'off', holiday: 'christmas', expectedRevision: 0 }, { mode: 'manual', holiday: 'christmas', expectedRevision: '0' }, { mode: 'manual', holiday: 'christmas', expectedRevision: 0, css: 'evil' }]) assert.equal((await call({ method: 'POST', cookie, body })).statusCode, 400);
  const saved = await save(cookie, 0); assert.equal(saved.statusCode, 200); assert.equal(saved.body.active.id, 'christmas');
  const events = await fixture.command('ZREVRANGE', 'geek:audit:index', 0, -1);
  const event = JSON.parse(await fixture.command('GET', 'geek:audit:event:' + events[0])); assert.equal(event.type, 'appearance.holiday.changed'); assert.equal(verifyAuditRecord(event), true);
  assert.equal((await save(cookie, 1, 'auto', null)).body.config.mode, 'auto');
  assert.equal((await save(cookie, 2, 'off', null)).body.active, null); assert.equal((await publicView()).body.theme, null);
});

test('concurrent operator tabs cannot overwrite a newer choice and failed saves do not create a success audit', async () => {
  const cookie = await login();
  const results = await Promise.all([save(cookie, 0, 'manual', 'christmas'), save(cookie, 0, 'manual', 'halloween')]);
  assert.deepEqual(results.map(r => r.statusCode).sort(), [200, 409]); assert.equal((await record()).revision, 1);
  const ids = await fixture.command('ZREVRANGE', 'geek:audit:index', 0, -1), events = await Promise.all(ids.map(id => fixture.command('GET', 'geek:audit:event:' + id)));
  assert.equal(events.map(JSON.parse).filter(e => e.type === 'appearance.holiday.changed').length, 1);
});

test('lost save responses are recovered by reading the saved revision without repeating the write', async () => {
  const cookie = await login(); loseSaveReply = true;
  assert.equal((await save(cookie, 0)).statusCode, 500);
  const read = await call({ cookie }); assert.equal(read.body.config.revision, 1); assert.equal(read.body.config.holiday, 'christmas');
  assert.equal((await save(cookie, 0, 'manual', 'halloween')).statusCode, 409); assert.equal((await record()).holiday, 'christmas');
});

test('expired or rotated owner sessions and malformed stored settings fail closed', async () => {
  const cookie = await login(); await save(cookie, 0);
  process.env.OPS_ACCESS_TOKEN = 'rotated-synthetic-owner-key-with-32-characters'; assert.equal((await save(cookie, 1, 'off', null)).statusCode, 401); assert.equal((await record()).mode, 'manual');
  process.env.OPS_ACCESS_TOKEN = owner;
  const key = 'geek:ops:session:' + cookie.split('=')[1], session = JSON.parse(await fixture.command('GET', key)); session.expiresAt = Date.now() - 1; await fixture.command('SET', key, JSON.stringify(session)); assert.equal((await save(cookie, 1, 'off', null)).statusCode, 401);
  const fresh = await login(); await fixture.command('SET', appearanceKey(), '{broken'); assert.equal((await publicView()).statusCode, 503); assert.equal((await call({ cookie: fresh })).statusCode, 503); assert.equal((await save(fresh, 1)).statusCode, 503); assert.equal(await fixture.command('GET', appearanceKey()), '{broken');
});

test('preview settings do not change production decoration', async () => {
  const cookie = await login(); await save(cookie, 0);
  process.env.VERCEL_ENV = 'preview'; assert.equal((await publicView()).body.theme, null); await save(cookie, 0, 'manual', 'halloween'); assert.equal((await publicView()).body.theme.id, 'halloween');
  process.env.VERCEL_ENV = 'production'; assert.equal((await publicView()).body.theme.id, 'christmas');
});

test('a corrupt audit index cannot leave a partially saved appearance change', async () => {
  const cookie = await login(); await fixture.command('SET', 'geek:audit:index', 'corrupt');
  assert.equal((await save(cookie, 0)).statusCode, 503);
  assert.equal(await fixture.command('GET', appearanceKey()), null);
});
