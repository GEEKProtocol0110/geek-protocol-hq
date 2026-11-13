import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import { appearanceKey } from '../server/appearance.js';
import { verifyAuditRecord } from '../server/audit.js';
import { HOLIDAYS, automaticHoliday, compareHolidayWindows, effectiveHoliday, holidayById, holidayWindows, easterDay } from '../public/assets/holiday-calendar.js';
import { GEEK_DEPLOYMENT } from '../server/geek-deployment.js';

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
  assert.equal(windows['presidents-day'].start, '2026-02-16');
  assert.equal(windows['mlk-day'], undefined); assert.equal(windows.juneteenth, undefined);
  assert.equal(automaticHoliday(Date.parse('2026-01-19T17:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-06-19T17:00:00Z')), null);
  assert.equal(windows['memorial-day'].end, '2026-05-25'); assert.equal(windows['labor-day'].end, '2026-09-07');
  assert.equal(windows.thanksgiving.start, '2026-11-23'); assert.equal(windows.thanksgiving.end, '2026-11-29');
  assert.equal(automaticHoliday(Date.parse('2026-12-31T17:00:00Z')).id, 'new-year');
  assert.equal(automaticHoliday(Date.parse('2027-01-03T04:59:59Z')).id, 'new-year');
  assert.equal(automaticHoliday(Date.parse('2027-01-03T05:00:00Z')).id, 'bitcoin-genesis');
  assert.equal(automaticHoliday(Date.parse('2026-10-24T03:59:59Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-10-24T04:00:00Z')).id, 'halloween');
  assert.equal(automaticHoliday(Date.parse('2027-02-15T17:00:00Z')).id, 'presidents-day');
  assert.equal(effectiveHoliday({ mode: 'off', holiday: 'christmas' }), null);
});

test('all holiday palettes retain readable accent text and dark primary-button text', () => {
  const css = readFileSync(new URL('../public/assets/holiday-theme.css', import.meta.url), 'utf8');
  const luminance = hex => { const values = hex.match(/[a-f0-9]{2}/gi).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4); return .2126 * values[0] + .7152 * values[1] + .0722 * values[2]; };
  for (const holiday of HOLIDAYS) {
    assert.ok(css.includes(`[data-holiday-theme='${holiday.id}']`), holiday.id);
    assert.equal(holiday.marks?.length, 3, holiday.id);
    for (const token of [holiday.tokens.gold, holiday.tokens.goldBright, holiday.tokens.cyan, holiday.tokens.glow, holiday.tokens.cool, holiday.tokens.fringe]) assert.ok(css.includes(token), `${holiday.id} ${token}`);
  }
  const marks = readFileSync(new URL('../public/assets/holiday-marks.js', import.meta.url), 'utf8');
  assert.doesNotMatch(marks, /url\(|https?:\/\/(?!www\.w3\.org\/2000\/svg)/);
  for (const match of css.matchAll(/--(?:gold|cyan):#([a-f0-9]{6})/gi)) assert.ok((luminance(match[1]) + .05) / (luminance('151b1b') + .05) >= 4.5, match[0]);
  assert.doesNotMatch(css, /animation:|@keyframes|url\(/);
  assert.doesNotMatch(css, /giga-portrait|hq-holiday-greeting/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)\{\.holiday-atmosphere span\{transform:none\}\}/);
  assert.match(css, /body\.is-playing \.holiday-atmosphere/);
  const atmosphere = readFileSync(new URL('../public/assets/atmosphere.css', import.meta.url), 'utf8');
  assert.doesNotMatch(atmosphere, /hq-holiday-greeting|hq-seasonal-note/);
});

test('public appearance is read-only, defaults Off, caches briefly and returns no owner configuration', async () => {
  const view = await publicView(); assert.equal(view.statusCode, 200); assert.deepEqual(view.body, { ok: true, theme: null });
  assert.equal(view.headers['Cache-Control'], 'public, max-age=30, s-maxage=30'); assert.equal(view.headers['Set-Cookie'], undefined);
  assert.equal((await publicView('POST')).statusCode, 405); assert.equal((await publicView('HEAD')).body, undefined);
  const cookie = await login(); assert.equal((await save(cookie, 0)).statusCode, 200);
  const published = await publicView();
  assert.deepEqual(published.body, { ok: true, theme: { id: 'christmas' } });
  assert.deepEqual(Object.keys(published.body.theme), ['id']);
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
  assert.equal((await save(cookie, 0)).statusCode, 503);
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

test('retired stored holidays render Off without rewriting data and can be replaced through an audited owner save', async () => {
  const cookie = await login();
  for (const holiday of ['mlk-day', 'juneteenth']) {
    const raw = JSON.stringify({ version: 1, revision: 7, mode: 'manual', holiday, updatedAt: Date.now() });
    await fixture.command('SET', appearanceKey(), raw);
    assert.deepEqual((await publicView()).body, { ok: true, theme: null });
    const ownerView = await call({ cookie }); assert.equal(ownerView.statusCode, 200);
    assert.equal(ownerView.body.config.mode, 'off'); assert.equal(ownerView.body.config.holiday, null);
    assert.equal(ownerView.body.config.revision, 7); assert.equal(await fixture.command('GET', appearanceKey()), raw);
    assert.equal((await save(cookie, 7, 'manual', holiday)).statusCode, 400);
    const replacement = await save(cookie, 7, 'manual', 'christmas');
    assert.equal(replacement.statusCode, 200); assert.equal(replacement.body.config.revision, 8);
    assert.equal((await publicView()).body.theme.id, 'christmas');
  }
});

test('the catalog is allowlisted, and uncertain dates stay manual', () => {
  const ids = HOLIDAYS.map(holiday => holiday.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const holiday of HOLIDAYS) {
    assert.match(holiday.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    for (const key of ['label', 'group', 'icon', 'greeting', 'when', 'motifs', 'window']) assert.ok(holiday[key], `${holiday.id} ${key}`);
    assert.equal(Number.isInteger(holiday.priority), true, holiday.id);
    assert.ok(['seasonal', 'civic', 'kaspa', 'bitcoin', 'ethereum', 'geek'].includes(holiday.group), holiday.id);
    assert.doesNotMatch(`${holiday.label} ${holiday.greeting}`, /\$|price|market|pump|moon|\bath\b|hype|valuation|million|billion|\bUSD\b|10,000|10000/i);
  }
  assert.deepEqual(HOLIDAYS.filter(holiday => holiday.group === 'geek').map(holiday => holiday.id), ['geek-birthday']);
  assert.equal(holidayById('geek-protocol-day'), null);
  const geekBirthday = holidayById('geek-birthday');
  assert.equal(geekBirthday.priority, 90);
  assert.equal(geekBirthday.manualOnly, undefined);
  assert.deepEqual(geekBirthday.window, { type: 'annual', start: [6, 21], end: [6, 23] });
  assert.equal(geekBirthday.deploymentHash, GEEK_DEPLOYMENT.deploymentHash);
  assert.equal(geekBirthday.deploymentHash, 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1');
  const satoshi = holidayById('satoshi-birthday');
  assert.equal(satoshi.manualOnly, true);
  assert.equal(satoshi.priority, 0);
  assert.deepEqual([satoshi.window.type, satoshi.window.month, satoshi.window.day], ['one-day', 4, 5]);
  assert.equal(holidayWindows(2026).some(window => window.id === 'satoshi-birthday'), false);
  assert.equal(holidayById('mlk-day'), null);
  assert.equal(holidayById('not-a-theme'), null);
  assert.equal(effectiveHoliday({ mode: 'manual', holiday: 'satoshi-birthday' }).id, 'satoshi-birthday');
  assert.equal(effectiveHoliday({ mode: 'manual', holiday: 'not-a-theme' }), null);
});

test('overlap ties resolve by priority, then shortest window, then id', () => {
  const ranked = [
    { id: 'b-long', priority: 40, start: '2026-05-01', end: '2026-05-20' },
    { id: 'm-b', priority: 40, start: '2026-05-05', end: '2026-05-06' },
    { id: 'short-low', priority: 10, start: '2026-05-05', end: '2026-05-05' },
    { id: 'm-a', priority: 40, start: '2026-05-05', end: '2026-05-06' }
  ].sort(compareHolidayWindows).map(window => window.id);
  assert.deepEqual(ranked, ['m-a', 'm-b', 'b-long', 'short-low']);
});

test('every 2026 Detroit date selects the priority winner, including the new boundaries', () => {
  const expected = new Map();
  const fill = (start, end, id) => {
    for (let day = Date.parse(`${start}T00:00:00Z`); day <= Date.parse(`${end}T00:00:00Z`); day += 86_400_000) expected.set(new Date(day).toISOString().slice(0, 10), id);
  };
  for (const [start, end, id] of [
    ['2026-01-01', '2026-01-02', 'new-year'],
    ['2026-01-03', '2026-01-03', 'bitcoin-genesis'],
    ['2026-02-12', '2026-02-15', 'valentines'],
    ['2026-02-16', '2026-02-16', 'presidents-day'],
    ['2026-03-16', '2026-03-18', 'st-patricks'],
    ['2026-03-29', '2026-04-06', 'easter'],
    ['2026-05-04', '2026-05-06', 'crescendo'],
    ['2026-05-22', '2026-05-22', 'bitcoin-pizza-day'],
    ['2026-05-23', '2026-05-25', 'memorial-day'],
    ['2026-06-21', '2026-06-23', 'geek-birthday'],
    ['2026-06-29', '2026-06-30', 'toccata'],
    ['2026-07-01', '2026-07-05', 'independence-day'],
    ['2026-07-29', '2026-07-31', 'ethereum-launch'],
    ['2026-09-04', '2026-09-07', 'labor-day'],
    ['2026-09-14', '2026-09-16', 'krc20-launch'],
    ['2026-10-24', '2026-10-30', 'halloween'],
    ['2026-10-31', '2026-10-31', 'bitcoin-whitepaper'],
    ['2026-11-06', '2026-11-08', 'kaspa-birthday'],
    ['2026-11-10', '2026-11-12', 'veterans-day'],
    ['2026-11-23', '2026-11-29', 'thanksgiving'],
    ['2026-12-01', '2026-12-26', 'christmas'],
    ['2026-12-29', '2026-12-31', 'new-year']
  ]) fill(start, end, id);
  assert.equal(expected.size, [...expected.keys()].length);
  const openOn = iso => holidayWindows(2026).filter(window => window.start <= iso && window.end >= iso).map(window => window.id).sort();
  assert.deepEqual(openOn('2026-04-05'), ['easter']);
  assert.deepEqual(openOn('2026-05-22'), ['bitcoin-pizza-day', 'memorial-day']);
  assert.deepEqual(openOn('2026-05-23'), ['memorial-day']);
  assert.deepEqual(openOn('2026-06-20'), []);
  assert.deepEqual(openOn('2026-06-21'), ['geek-birthday']);
  assert.deepEqual(openOn('2026-06-22'), ['geek-birthday']);
  assert.deepEqual(openOn('2026-06-23'), ['geek-birthday']);
  assert.deepEqual(openOn('2026-06-24'), []);
  assert.deepEqual(openOn('2026-06-29'), ['toccata']);
  assert.deepEqual(openOn('2026-06-30'), ['toccata']);
  assert.deepEqual(openOn('2026-07-01'), ['independence-day']);
  assert.deepEqual(openOn('2026-10-30'), ['halloween']);
  assert.deepEqual(openOn('2026-10-31'), ['bitcoin-whitepaper']);
  assert.deepEqual(openOn('2026-11-08'), ['kaspa-birthday']);
  assert.deepEqual(openOn('2026-11-09'), []);
  assert.deepEqual(openOn('2026-11-10'), ['veterans-day']);
  assert.deepEqual(openOn('2026-12-27'), []);
  assert.deepEqual(openOn('2026-12-28'), []);
  for (let month = 1; month <= 12; month += 1) {
    const last = new Date(Date.UTC(2026, month, 0)).getUTCDate();
    for (let day = 1; day <= last; day += 1) {
      const iso = `${2026}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const instant = Date.UTC(2026, month - 1, day, 17, 0, 0);
      const civil = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Detroit', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant));
      assert.equal(civil, iso, iso);
      assert.equal(automaticHoliday(instant)?.id ?? null, expected.get(iso) ?? null, iso);
    }
  }
  assert.equal(automaticHoliday(Date.parse('2026-01-03T04:59:59Z')).id, 'new-year');
  assert.equal(automaticHoliday(Date.parse('2026-01-03T05:00:00Z')).id, 'bitcoin-genesis');
  assert.equal(automaticHoliday(Date.parse('2026-01-04T05:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-04-05T16:00:00Z')).id, 'easter');
  assert.equal(automaticHoliday(Date.parse('2026-05-22T04:00:00Z')).id, 'bitcoin-pizza-day');
  assert.equal(automaticHoliday(Date.parse('2026-05-23T03:59:59Z')).id, 'bitcoin-pizza-day');
  assert.equal(automaticHoliday(Date.parse('2026-05-23T04:00:00Z')).id, 'memorial-day');
  assert.equal(automaticHoliday(Date.parse('2026-06-21T03:59:59Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-06-21T04:00:00Z')).id, 'geek-birthday');
  assert.equal(automaticHoliday(Date.parse('2026-06-22T16:00:00Z')).id, 'geek-birthday');
  assert.equal(automaticHoliday(Date.parse('2026-06-24T03:59:59Z')).id, 'geek-birthday');
  assert.equal(automaticHoliday(Date.parse('2026-06-24T04:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-06-29T04:00:00Z')).id, 'toccata');
  assert.equal(automaticHoliday(Date.parse('2026-07-01T03:59:59Z')).id, 'toccata');
  assert.equal(automaticHoliday(Date.parse('2026-07-01T04:00:00Z')).id, 'independence-day');
  assert.equal(automaticHoliday(Date.parse('2026-10-31T03:59:59Z')).id, 'halloween');
  assert.equal(automaticHoliday(Date.parse('2026-10-31T04:00:00Z')).id, 'bitcoin-whitepaper');
  assert.equal(automaticHoliday(Date.parse('2026-11-01T03:59:59Z')).id, 'bitcoin-whitepaper');
  assert.equal(automaticHoliday(Date.parse('2026-11-01T04:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-11-09T04:59:59Z')).id, 'kaspa-birthday');
  assert.equal(automaticHoliday(Date.parse('2026-11-09T05:00:00Z')), null);
  assert.equal(automaticHoliday(Date.parse('2026-11-10T05:00:00Z')).id, 'veterans-day');
});

test('a manual-only holiday saves by id, and citation URLs stay out of appearance responses', async () => {
  const cookie = await login();
  assert.equal((await save(cookie, 0, 'manual', 'satoshi-birthday')).statusCode, 200);
  const published = await publicView();
  assert.deepEqual(published.body, { ok: true, theme: { id: 'satoshi-birthday' } });
  assert.deepEqual(Object.keys(published.body.theme), ['id']);
  const ownerView = await call({ cookie });
  const raw = JSON.stringify(ownerView.body);
  assert.equal(raw.includes('http'), false);
  assert.equal(raw.includes('source'), false);
  assert.equal(ownerView.body.active.manualOnly, true);
  assert.equal((await save(cookie, 1, 'manual', 'geek-protocol-day')).statusCode, 400);
  assert.equal((await record()).holiday, 'satoshi-birthday');
});
