import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';

// Synthetic DOM and fake responses only; no network, preview or production traffic.
const read = p => readFileSync(new URL(p, import.meta.url), 'utf8');
const access = read('../public/assets/session-access.js');
const signIn = ['sign-in.js', 'passkeys.js'].map(p => read('../public/sign-in/assets/' + p));
const settle = async () => { for (let i = 0; i < 4; i++) await new Promise(setImmediate); };
const storage = (initial = {}) => { const m = new Map(Object.entries(initial)); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k), m }; };
const RL = 'Temporarily rate limited. Your session has not changed. Try again in 42 seconds.';
const limited = () => new Response(JSON.stringify({ ok: false, code: 'RATE_LIMITED', retryAfter: 42 }), { status: 429, headers: { 'Retry-After': '42' } });
const FORMS = ['[data-passkey-login-area]', '[data-passkey-new]', '[data-passkey-account]', '[data-wallet-methods]', '[data-device-access]'];

const page = ({ reply, local = {}, session = {}, signInPage = false, signOut = true }) => {
  const calls = [], listeners = new Map();
  const ui = clientFixture(async (path, options = {}) => { calls.push(`${options.method || 'GET'} ${path}`); return reply(path, options); });
  ui.window.localStorage = storage(local); ui.window.sessionStorage = storage(session);
  ui.window.isSecureContext = true; ui.window.PublicKeyCredential = undefined; ui.context.navigator.userAgent = '';
  ui.document.addEventListener = (type, fn) => listeners.set(type, [...(listeners.get(type) || []), fn]);
  ui.document.dispatchEvent = event => { for (const fn of listeners.get(event.type) || []) fn(event); };
  const navEl = ui.node('[data-nav]'), link = ui.make('a'); link.setAttribute('href', '/sign-in/'); link.textContent = 'Sign in'; navEl.append(link);
  const button = signOut ? ui.node('[data-sign-out]', 'button') : null;
  if (button) { button.hidden = true; ui.node('[data-sign-out-status]'); }
  if (signInPage) {
    ui.node('[data-wallet-open-app]', 'a').hidden = true;
    for (const name of ['address', 'signature']) ui.node(`[data-${name}-form]`).append(ui.make('button'));
    const panel = ui.node('[data-passkeys]');
    for (const name of ['note', 'list', 'label', 'wallet-help', 'player', 'device', 'device-help', 'login-area', 'new', 'account', 'player-row', 'new-title']) panel.append(ui.node(`[data-passkey-${name}]`));
    for (const name of ['save', 'login', 'verify', 'wallet-authorize']) panel.append(ui.node(`[data-passkey-${name}]`, 'button'));
    for (const s of ['[data-wallet-methods]', '[data-device-access]', '[data-sign-in-guest]']) ui.node(s);
    ui.node('[data-sign-in-hq]').hidden = true;
  }
  return { ui, calls, link, button, run: async () => { if (signInPage) for (const s of signIn) ui.run(s); ui.run(access); await settle(); },
    emit: (type, detail) => ui.document.dispatchEvent(new CustomEvent(type, { detail })) };
};
const signInReply = status => path => path === '/api/session' ? json({ ok: true }) : status();

test('(1) 429 on /sign-in with a cached signed-in state (new tab: localStorage only) keeps the signed-in view and Sign out, with no forms', async () => {
  const p = page({ reply: signInReply(limited), local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) }, signInPage: true });
  await p.run();
  for (const s of FORMS) assert.equal(p.ui.node(s).hidden, true, `${s} hidden`);
  assert.equal(p.ui.node('[data-sign-in-guest]').hidden, true);
  assert.equal(p.ui.node('[data-sign-in-hq]').hidden, false);
  assert.equal(p.button.hidden, false, 'Sign out stays visible');
  assert.equal(p.ui.node('[data-sign-in-status]').textContent, RL);
});

test('(1) 429 on /sign-in with no cached state shows only the retry message, never the signed-out form', async () => {
  const p = page({ reply: signInReply(limited), signInPage: true });
  await p.run();
  for (const s of [...FORMS, '[data-sign-in-guest]', '[data-sign-in-hq]']) assert.equal(p.ui.node(s).hidden, true, `${s} hidden`);
  assert.equal(p.button.hidden, true, 'unknown state does not claim signed in');
  assert.equal(p.ui.node('[data-sign-in-status]').textContent, RL);
  assert.doesNotMatch(p.ui.node('[data-sign-in-status]').textContent, /Not signed in|signed out/);
});

test('(1) 429 on /profile in a new tab keeps Sign out from the cached signed-in state', async () => {
  const p = page({ reply: limited, local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) } });
  await p.run();
  assert.equal(p.button.hidden, false);
  assert.equal(p.ui.node('[data-sign-out-status]').textContent, RL);
});

test('(2) the rate-limit message renders exactly once on /sign-in', async () => {
  const p = page({ reply: signInReply(limited), local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) }, signInPage: true });
  await p.run();
  const regions = ['[data-sign-in-status]', '[data-passkey-note]', '[data-sign-out-status]', '[data-device-note]', '[data-manual-status]'];
  const shown = regions.filter(s => p.ui.node(s).textContent.includes('Temporarily rate limited'));
  assert.deepEqual(shown, ['[data-sign-in-status]']);
});

test('(3) the nav says Account when signed in and Sign in for guests, using the existing check only', async () => {
  const signedIn = page({ reply: () => json({ ok: true, signedIn: true }) });
  await signedIn.run();
  assert.equal(signedIn.link.textContent, 'Account'); assert.equal(signedIn.calls.length, 1);
  const guest = page({ reply: () => json({ ok: true, signedIn: false }), local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) } });
  await guest.run(); assert.equal(guest.link.textContent, 'Sign in');
  const expired = page({ reply: () => json({ ok: false }, 401), local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) } });
  await expired.run(); assert.equal(expired.link.textContent, 'Sign in');
});

test('(3) unknown state degrades to the default Sign in link, and pages without account controls make no request', async () => {
  const unknown = page({ reply: limited });
  await unknown.run(); assert.equal(unknown.link.textContent, 'Sign in');
  const plain = page({ reply: () => assert.fail('no extra request'), local: { 'geek:last-session-state': 'signed-in', 'geek:last-session-at': String(Date.now()) }, signOut: false });
  await plain.run();
  assert.equal(plain.calls.length, 0); assert.equal(plain.link.textContent, 'Account');
  plain.emit('geek:account-status', { signedIn: false }); assert.equal(plain.link.textContent, 'Sign in');
});

test('(4) the Start fresh copy is accurate about sign-out clearing guest progress', () => {
  const source = read('../public/sign-in/assets/passkeys.js');
  assert.ok(source.includes('Start fresh creates an empty account. Your guest progress is not added to it and will be cleared from this browser when you sign out.'));
  assert.equal(source.includes('leaves the guest progress in this browser’s guest player'), false);
});

test('(5) Sign out appears immediately on the signed-in event, before any refetch completes', async () => {
  const wait = deferred();
  const p = page({ reply: () => wait.promise, session: { 'geek:last-session-state': 'signed-out', 'geek:last-session-checked': String(Date.now()) }, local: { 'geek:last-session-state': 'signed-out' } });
  await p.run();
  assert.equal(p.button.hidden, true); assert.equal(p.calls.length, 0, 'fresh guest status reused');
  p.emit('geek:passkey-signed-in', { continue: true });
  assert.equal(p.button.hidden, false, 'visible synchronously');
  assert.equal(p.link.textContent, 'Account');
  assert.equal(p.ui.window.localStorage.getItem('geek:last-session-state'), 'signed-in');
  // The next page (e.g. /profile after the redirect) shows Sign out without waiting.
  const next = page({ reply: () => new Promise(() => {}), session: Object.fromEntries(p.ui.window.sessionStorage.m), local: Object.fromEntries(p.ui.window.localStorage.m) });
  await next.run(); assert.equal(next.button.hidden, false);
  wait.resolve(json({ ok: true, signedIn: true }));
});
