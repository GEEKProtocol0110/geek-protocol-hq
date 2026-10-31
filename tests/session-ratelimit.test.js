import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, json } from './helpers/client-fixture.js';
import { redisFixture } from './helpers/redis-fixture.js';
import sessionHandler from '../api/session.js';
import passkeysHandler from '../api/passkeys.js';
import { RATE_LIMITS } from '../server/http.js';

// Synthetic data only: fake sessions against a local throwaway Redis fixture.
const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.ratelimit.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-ratelimit-fixture';
process.env.AUDIT_LOG_SECRET = 'synthetic-ratelimit-audit-32-characters';
const redisFetch = async (url, options) => {
  const command = JSON.parse(options.body);
  const payload = String(url).endsWith('/multi-exec') ? (await fixture.commands([['MULTI'], ...command, ['EXEC']])).at(-1).map(result => ({ result }))
    : String(url).endsWith('/pipeline') ? (await fixture.commands(command)).map(result => ({ result })) : { result: await fixture.command(...command) };
  return new Response(JSON.stringify(payload));
};
globalThis.fetch = redisFetch;
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
beforeEach(async () => { await fixture.command('FLUSHDB'); });
const origin = 'https://www.geekprotocol.xyz';
const response = () => ({ headers: {}, statusCode: 0, body: null, setHeader(k, v) { this.headers[k] = v; }, status(v) { this.statusCode = v; return this; }, json(v) { this.body = v; return this; }, end() {} });
const call = async (handler, cookie, body, method = 'POST') => {
  const res = response(); await handler({ method, body, headers: { cookie, host: 'www.geekprotocol.xyz', origin, 'user-agent': 'synthetic-ratelimit-tests' } }, res); return res;
};
const newSession = async () => (await call(sessionHandler, '', {})).headers['Set-Cookie'].split(';')[0];

test('40 page loads of session checks and passkey status are not rate limited', async () => {
  const cookie = await newSession();
  for (let i = 0; i < 40; i++) {
    assert.equal((await call(sessionHandler, cookie, {})).statusCode, 200, `session check ${i}`);
    assert.equal((await call(passkeysHandler, cookie, undefined, 'GET')).statusCode, 200, `passkey status ${i}`);
  }
});

test('account creation stays limited, and browsing does not consume its bucket', async () => {
  const cookie = await newSession();
  for (let i = 0; i < 40; i++) await call(passkeysHandler, cookie, undefined, 'GET');
  const first = await call(passkeysHandler, cookie, { action: 'begin-register' });
  assert.notEqual(first.statusCode, 429, 'browsing must not block account creation');
  let limited = 0;
  for (let i = 1; i < RATE_LIMITS.passkeyCreateSession.maximum + 5; i++) {
    if ((await call(passkeysHandler, cookie, { action: 'begin-register' })).statusCode === 429) limited++;
  }
  assert.ok(limited >= 4, 'repeated account-creation attempts are still limited');
  const blocked = await call(passkeysHandler, cookie, { action: 'begin-register' });
  assert.equal(blocked.statusCode, 429);
  assert.ok(Number(blocked.headers['Retry-After']) > 0 && Number(blocked.headers['Retry-After']) <= RATE_LIMITS.passkeyCreateSession.seconds);
  assert.equal(blocked.body.retryAfter, Number(blocked.headers['Retry-After']));
  assert.ok(blocked.body.reset > Date.now());
  assert.equal((await call(passkeysHandler, cookie, undefined, 'GET')).statusCode, 200, 'a limited create bucket leaves status reads working');
  assert.ok(RATE_LIMITS.passkeyCreateSession.maximum <= 10 && RATE_LIMITS.passkeyLoginSession.maximum <= 20);
});

// ---- client: session-access.js ----
const accessSource = readFileSync(new URL('../public/assets/session-access.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
const storage = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const mountAccess = async (reply, store) => {
  const ui = clientFixture(async () => reply());
  ui.window.sessionStorage = store;
  ui.document.addEventListener = () => {};
  const button = ui.node('[data-sign-out]', 'button'); button.hidden = true; ui.node('[data-sign-out-status]');
  ui.run(accessSource); await settle(); return { ...ui, button };
};

const limitedReply = (seconds = 42) => new Response(JSON.stringify({ ok: false, code: 'RATE_LIMITED', retryAfter: seconds, error: '<b>Slow down</b>' }), { status: 429, headers: { 'Retry-After': String(seconds) } });

test('hitting the limit while signed in keeps the signed-in UI and shows the retry time from Retry-After', async () => {
  const store = storage();
  const ok = await mountAccess(() => json({ ok: true, signedIn: true }), store);
  assert.equal(ok.button.hidden, false);
  store.setItem('geek:last-session-checked', '0'); // force a fresh check on the next page
  const limited = await mountAccess(() => limitedReply(42), store);
  assert.equal(limited.button.hidden, false, 'never shown as signed out on 429');
  const text = limited.node('[data-sign-out-status]').textContent;
  assert.equal(text, 'Temporarily rate limited. Your session has not changed. Try again in 42 seconds.');
  assert.equal(store.getItem('geek:last-session-state'), 'signed-in');
});

test('the retry time falls back to the body reset field, and a 5xx is unknown rather than signed out', async () => {
  const store = storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) });
  const reset = await mountAccess(() => json({ ok: false, reset: Date.now() + 30000 }, 429), store);
  assert.match(reset.node('[data-sign-out-status]').textContent, /^Temporarily rate limited\. .* Try again in (29|30) seconds\.$/);
  const down = await mountAccess(() => json({ ok: false }, 503), storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) }));
  assert.equal(down.button.hidden, false);
  assert.match(down.node('[data-sign-out-status]').textContent, /couldn’t check your sign-in/);
});

test('after the limit clears the UI recovers without signing in again', async () => {
  let limited = true; const calls = [];
  const store = storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) });
  const ui = await mountAccess(() => { calls.push(1); return limited ? limitedReply(5) : json({ ok: true, signedIn: true }); }, store);
  assert.match(ui.node('[data-sign-out-status]').textContent, /Try again in 5 seconds/);
  const retry = [...ui.timers.values()].find(t => t.delay === 5000);
  assert.ok(retry, 'a retry is scheduled for the Retry-After time');
  limited = false; retry.fn(); await settle();
  assert.equal(calls.length, 2);
  assert.equal(ui.button.hidden, false);
  assert.equal(ui.node('[data-sign-out-status]').textContent, '');
  assert.equal(store.getItem('geek:last-session-state'), 'signed-in');
});

test('a status checked moments ago on the previous page is reused instead of refetched', async () => {
  let calls = 0; const store = storage();
  await mountAccess(() => { calls++; return json({ ok: true, signedIn: true }); }, store);
  const next = await mountAccess(() => { calls++; return json({ ok: true, signedIn: true }); }, store);
  assert.equal(calls, 1); assert.equal(next.button.hidden, false);
});

test('an explicit 401 shows signed out', async () => {
  const store = storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) });
  const ui = await mountAccess(() => json({ ok: false }, 401), store);
  assert.equal(ui.button.hidden, true);
  assert.equal(store.getItem('geek:last-session-state'), 'signed-out');
});

// ---- client: sign-in page ----
const signInScripts = ['sign-in.js', 'passkeys.js'].map(p => readFileSync(new URL('../public/sign-in/assets/' + p, import.meta.url), 'utf8'));
const mountSignIn = async (statusReply, store) => {
  const listeners = new Map();
  const ui = clientFixture(async path => path === '/api/session' ? json({ ok: true }) : statusReply());
  ui.window.isSecureContext = true; ui.window.PublicKeyCredential = undefined; ui.window.sessionStorage = store;
  ui.context.navigator.userAgent = '';
  ui.node('[data-wallet-open-app]', 'a').hidden = true;
  ui.document.addEventListener = (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]);
  ui.document.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  for (const name of ['address', 'signature']) ui.node(`[data-${name}-form]`).append(ui.make('button'));
  const panel = ui.node('[data-passkeys]');
  for (const name of ['note', 'list', 'label', 'wallet-help', 'player', 'device', 'device-help', 'login-area', 'account', 'player-row', 'new-title']) panel.append(ui.node(`[data-passkey-${name}]`));
  for (const name of ['save', 'login', 'verify', 'wallet-authorize']) panel.append(ui.node(`[data-passkey-${name}]`, 'button'));
  ui.node('[data-sign-in-hq]').hidden = true;
  for (const script of signInScripts) ui.run(script);
  await settle(); await settle(); return ui;
};

test('sign-in page under 429 keeps a known signed-in user signed in, without the guest-unavailable copy', async () => {
  const ui = await mountSignIn(() => limitedReply(42), storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) }));
  const status = ui.node('[data-sign-in-status]').textContent;
  assert.doesNotMatch(status, /temporarily unavailable|continue as a guest/i);
  assert.equal(status, 'Temporarily rate limited. Your session has not changed. Try again in 42 seconds.');
  assert.equal(ui.node('[data-sign-in-hq]').hidden, false);
  assert.equal(ui.node('[data-passkey-note]').textContent, '', 'the retry message is owned by the page status region only');
});

test('sign-in page with 401 on status shows signed out', async () => {
  const ui = await mountSignIn(() => json({ ok: false }, 401), storage());
  assert.equal(ui.node('[data-sign-in-status]').textContent, 'Not signed in.');
  assert.equal(ui.node('[data-sign-in-hq]').hidden, true);
});

test('the sign-in and profile pages render exactly one Sign out control', () => {
  for (const page of ['sign-in', 'profile']) {
    const html = readFileSync(new URL(`../public/${page}/index.html`, import.meta.url), 'utf8');
    assert.equal((html.match(/>\s*Sign out\s*</g) || []).length, 1, page);
    assert.equal((html.match(/data-passkey-logout/g) || []).length, 0, page);
  }
});

test('the sign-in page makes one passkey status request per load (no duplicate from session-access)', async () => {
  const listeners = new Map(), calls = [];
  const ui = clientFixture(async (path, options = {}) => { calls.push(`${options.method || 'GET'} ${path}`); return json(path === '/api/session' ? { ok: true } : { ok: true, signedIn: true, credentials: [] }); });
  ui.window.isSecureContext = true; ui.window.PublicKeyCredential = undefined; ui.window.sessionStorage = storage();
  ui.context.navigator.userAgent = ''; ui.node('[data-wallet-open-app]', 'a').hidden = true;
  ui.document.addEventListener = (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]);
  ui.document.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  for (const name of ['address', 'signature']) ui.node(`[data-${name}-form]`).append(ui.make('button'));
  const panel = ui.node('[data-passkeys]');
  for (const name of ['note', 'list', 'label', 'wallet-help', 'player', 'device', 'device-help', 'login-area', 'account', 'player-row', 'new-title']) panel.append(ui.node(`[data-passkey-${name}]`));
  for (const name of ['save', 'login', 'verify', 'wallet-authorize']) panel.append(ui.node(`[data-passkey-${name}]`, 'button'));
  const button = ui.node('[data-sign-out]', 'button'); button.hidden = true; ui.node('[data-sign-out-status]');
  ui.node('[data-sign-in-hq]').hidden = true;
  for (const script of [...signInScripts, accessSource]) ui.run(script);
  await settle(); await settle();
  assert.equal(calls.filter(c => c.includes('/api/passkeys')).length, 1, calls.join(', '));
  assert.equal(button.hidden, false, 'the single Sign out control follows the panel status');
});

test('sign-out clears per-account browser state so the next guest starts clean', async () => {
  const session = storage({ 'geek-assisted-run': 'run', 'geek-challenge-active-v1': 'c1' });
  const local = storage({ geek_hq_ranked_run_v1: 'a'.repeat(40), 'geek-lobby-identity-v1': 'Account Name', 'geek-cce-name-v1': 'Account Name', geek_hq_board_season_v1: 'season-1' });
  const ui = clientFixture(async (path, options = {}) => options.method === 'POST' ? json({ ok: true, signedOut: true }) : json({ ok: true, signedIn: true }));
  ui.window.sessionStorage = session; ui.window.localStorage = local; ui.context.location.replace = () => {};
  ui.document.addEventListener = () => {}; ui.document.dispatchEvent = () => {};
  const button = ui.node('[data-sign-out]', 'button'); ui.node('[data-sign-out-status]');
  ui.run(accessSource); await settle();
  await button.emit('click');
  for (const key of ['geek_hq_ranked_run_v1', 'geek-lobby-identity-v1', 'geek-cce-name-v1']) assert.equal(local.getItem(key), null, key);
  for (const key of ['geek-assisted-run', 'geek-challenge-active-v1']) assert.equal(session.getItem(key), null, key);
  assert.equal(local.getItem('geek_hq_board_season_v1'), 'season-1', 'non-account preferences stay');
  assert.equal(session.getItem('geek:last-session-state'), 'signed-out');
});
