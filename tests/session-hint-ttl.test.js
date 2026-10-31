import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

// Synthetic DOM and fake responses only; no network, preview or production traffic.
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const hint = read('../public/assets/session-hint.js');
const access = hint + read('../public/assets/session-access.js');
const signIn = ['sign-in.js', 'passkeys.js'].map(p => hint + read('../public/sign-in/assets/' + p));
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
const storage = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const RL = 'Temporarily rate limited. Your session has not changed. Try again in 42 seconds.';
const limited = () => new Response(JSON.stringify({ ok: false, code: 'RATE_LIMITED', retryAfter: 42 }), { status: 429, headers: { 'Retry-After': '42' } });
const FORMS = ['[data-passkey-login-area]', '[data-passkey-new]', '[data-passkey-account]', '[data-wallet-methods]', '[data-device-access]'];

const page = ({ reply, local = {}, session = {}, signInPage = false, signOut = true, home = false }) => {
  const calls = [], listeners = new Map();
  const ui = clientFixture(async (path, options = {}) => { calls.push(`${options.method || 'GET'} ${path}`); return reply(path, options); });
  ui.window.localStorage = storage(local); ui.window.sessionStorage = storage(session);
  ui.window.isSecureContext = true; ui.window.PublicKeyCredential = undefined; ui.context.navigator.userAgent = '';
  ui.document.addEventListener = (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]);
  ui.document.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  const navEl = ui.node('[data-nav]'), link = ui.make('a'); link.setAttribute('href', '/sign-in/'); link.textContent = 'Sign in'; navEl.append(link);
  const button = signOut ? ui.node('[data-sign-out]', 'button') : null;
  if (button) { button.hidden = true; ui.node('[data-sign-out-status]'); }
  const homeNodes = home ? [ui.node('[data-signed-out-only]', 'span')] : [];
  if (signInPage) {
    ui.node('[data-wallet-open-app]', 'a').hidden = true;
    for (const name of ['address', 'signature']) ui.node(`[data-${name}-form]`).append(ui.make('button'));
    const panel = ui.node('[data-passkeys]');
    for (const name of ['note', 'list', 'label', 'wallet-help', 'player', 'device', 'device-help', 'login-area', 'new', 'account', 'player-row', 'new-title']) panel.append(ui.node(`[data-passkey-${name}]`));
    for (const name of ['save', 'login', 'verify', 'wallet-authorize']) panel.append(ui.node(`[data-passkey-${name}]`, 'button'));
    for (const s of ['[data-wallet-methods]', '[data-device-access]', '[data-sign-in-guest]']) ui.node(s);
    ui.node('[data-sign-in-hq]').hidden = true;
  }
  return { ui, calls, link, button, homeNodes, run: async () => { if (signInPage) for (const s of signIn) ui.run(s); ui.run(access); await settle(); },
    emit: (type, detail) => ui.document.dispatchEvent(new CustomEvent(type, { detail })) };
};
const signInReply = status => path => path === '/api/session' ? json({ ok: true }) : status();

const DAY = 24 * 3600 * 1000;
const at = ms => ({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now() - ms) });

for (const [label, age, signedIn] of [['before 24h', DAY - 60000, true], ['at exactly 24h', DAY, false], ['after 24h', DAY + 60000, false]]) {
  test(`saved signed-in hint ${label}: ${signedIn ? 'still trusted' : 'treated as unknown'} while the status check is rate limited`, async () => {
    const p = page({ reply: limited, local: at(age) });
    await p.run();
    assert.equal(p.calls.length, 1);
    assert.equal(p.link.textContent, signedIn ? 'Account' : 'Sign in');
    assert.equal(p.button.hidden, !signedIn);
  });
  test(`sign-in page with a hint ${label}: ${signedIn ? 'signed-in view' : 'no signed-in view'} under 429`, async () => {
    const p = page({ reply: signInReply(limited), local: at(age), signInPage: true });
    await p.run();
    assert.equal(p.ui.node('[data-sign-in-hq]').hidden, !signedIn);
  });
}

test('a hint with no timestamp (written by an older client) is treated as unknown', async () => {
  const p = page({ reply: limited, local: { 'geek:last-session-state': 'signed-in' } });
  await p.run();
  assert.equal(p.link.textContent, 'Sign in'); assert.equal(p.button.hidden, true);
});

test('a confirmed status refreshes the hint timestamp', async () => {
  const p = page({ reply: () => json({ ok: true, signedIn: true }), local: at(DAY - 1000) });
  await p.run();
  assert.ok(Date.now() - Number(p.ui.window.localStorage.getItem('geek:last-session-at')) < 5000);
});

test('a sign-in event always asks the server, and a spoofed event is undone by its answer', async () => {
  const p = page({ reply: () => json({ ok: true, signedIn: false }), session: { 'geek:last-session-state': 'signed-out', 'geek:last-session-checked': String(Date.now()) }, local: { 'geek:last-session-state': 'signed-out' } });
  await p.run(); assert.equal(p.calls.length, 0);
  p.emit('geek:signed-in', {});
  await settle();
  assert.equal(p.calls.length, 1, 'server check after a sign-in event');
  assert.equal(p.button.hidden, true); assert.equal(p.link.textContent, 'Sign in');
});

test('an event marked initial is always confirmed with the server, even after a status event (any script can fire both)', async () => {
  const q = page({ reply: () => json({ ok: true, signedIn: false }), session: { 'geek:last-session-state': 'signed-out', 'geek:last-session-checked': String(Date.now()) }, local: { 'geek:last-session-state': 'signed-out' } });
  await q.run();
  q.emit('geek:account-status', { signedIn: true });
  q.emit('geek:passkey-signed-in', { initial: true }); await settle();
  assert.equal(q.calls.length, 1, 'server asked despite the spoofed confirmation');
  assert.equal(q.button.hidden, true, 'spoofed state undone by the server');
});

test('event-triggered checks are bounded but never dropped: a burst queues one more check', async () => {
  const p = page({ reply: () => json({ ok: true, signedIn: false }), session: { 'geek:last-session-state': 'signed-out', 'geek:last-session-checked': String(Date.now()) }, local: { 'geek:last-session-state': 'signed-out' } });
  await p.run();
  for (let i = 0; i < 20; i++) p.emit('geek:signed-in', {});
  await settle();
  assert.equal(p.calls.length, 1, 'one request for the burst');
  const queued = [...p.ui.timers.values()].filter(t => t.delay > 0 && t.delay <= 5000);
  assert.equal(queued.length, 1, 'exactly one follow-up check queued');
  queued[0].fn(); await settle();
  assert.equal(p.calls.length, 2); assert.equal(p.button.hidden, true);
});

test('a future-dated hint is never trusted (session-access, sign-in page and the shared helper)', async () => {
  const future = { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now() + DAY * 365) };
  const p = page({ reply: limited, local: future });
  await p.run();
  assert.equal(p.link.textContent, 'Sign in'); assert.equal(p.button.hidden, true);
  const s = page({ reply: signInReply(limited), local: future, signInPage: true });
  await s.run();
  assert.equal(s.ui.node('[data-sign-in-hq]').hidden, true);
  assert.equal(p.ui.window.geekSessionHint.read(p.ui.window), null);
  assert.equal(p.ui.window.geekSessionHint.read({ localStorage: storage({ 'geek:last-session-state': 'signed-in', 'geek:last-session-at': 'junk' }) }), null);
});

test('one shared hint rule: neither client file carries its own 24h check', () => {
  for (const f of ['../public/assets/session-access.js', '../public/sign-in/assets/sign-in.js']) {
    const src = read(f);
    assert.match(src, /geekSessionHint\?\.read\(window\)/, f);
    assert.doesNotMatch(src, /24 \* 3600|last-session-at/, f);
  }
  assert.match(read('../public/sign-in/index.html'), /session-hint\.js"><\/script>\n\s*<script defer src="\.\/assets\/sign-in\.js">/);
  assert.match(read('../public/assets/site.js'), /import\('\/assets\/session-hint\.js'\)[^\n]*import\('\/assets\/session-access\.js'\)/);
});

test('home page sign-in and recover prompts hide when signed in and come back after sign-out or expiry', async () => {
  const p = page({ reply: () => json({ ok: true, signedIn: true }), home: true });
  await p.run();
  assert.equal(p.homeNodes[0].hidden, true);
  const expired = page({ reply: () => json({ ok: false }, 401), local: at(1000), home: true });
  await expired.run();
  assert.equal(expired.homeNodes[0].hidden, false);
  const stale = page({ reply: limited, local: at(DAY + 1), home: true });
  await stale.run();
  assert.equal(stale.homeNodes[0].hidden, false);
});

test('home page markup tags both prompts as signed-out only', () => {
  const html = read('../public/index.html');
  assert.match(html, /<span data-signed-out-only><br \/><a href="\/sign-in\/">Already a Geek\? Sign in →<\/a>/);
  assert.match(html, /<a href="\/sign-in\/" data-signed-out-only>Recover your Geek player/);
});
