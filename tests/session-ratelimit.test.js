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
  assert.equal((await call(passkeysHandler, cookie, undefined, 'GET')).statusCode, 200, 'a limited create bucket leaves status reads working');
  assert.ok(RATE_LIMITS.passkeyCreateSession.maximum <= 10 && RATE_LIMITS.passkeyLoginSession.maximum <= 20);
});

// ---- client: session-access.js ----
const accessSource = readFileSync(new URL('../public/assets/session-access.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
const storage = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), m }; };
const mountAccess = async (reply, store) => {
  const ui = clientFixture(async () => reply());
  ui.window.sessionStorage = store;
  ui.document.addEventListener = () => {};
  const button = ui.node('[data-sign-out]', 'button'); button.hidden = true; ui.node('[data-sign-out-status]');
  ui.run(accessSource); await settle(); return { ...ui, button };
};

test('a 429 or 5xx on the session check keeps a signed-in UI and shows a fixed retry message', async () => {
  for (const status of [429, 503]) {
    const store = storage();
    const ok = await mountAccess(() => json({ ok: true, signedIn: true }), store);
    assert.equal(ok.button.hidden, false);
    const limited = await mountAccess(() => json({ ok: false, error: '<b>Slow down</b>' }, status), store);
    assert.equal(limited.button.hidden, false, `signed-in UI kept on ${status}`);
    assert.match(limited.node('[data-sign-out-status]').textContent, /couldn’t check your sign-in/);
    assert.doesNotMatch(limited.node('[data-sign-out-status]').textContent, /Slow down/);
  }
});

test('an explicit 401 shows signed out', async () => {
  const store = storage({ 'geek:last-session-state': 'signed-in' });
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
  const ui = await mountSignIn(() => json({ ok: false, error: 'Slow down and try again in a moment.' }, 429), storage({ 'geek:last-session-state': 'signed-in' }));
  const status = ui.node('[data-sign-in-status]').textContent;
  assert.doesNotMatch(status, /temporarily unavailable|continue as a guest/i);
  assert.match(status, /couldn’t check your sign-in/);
  assert.equal(ui.node('[data-sign-in-hq]').hidden, false);
  assert.match(ui.node('[data-passkey-note]').textContent, /couldn’t check your sign-in/);
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
