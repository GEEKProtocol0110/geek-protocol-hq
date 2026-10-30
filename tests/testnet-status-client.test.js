import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json, aborted } from './helpers/client-fixture.js';

const source = readFileSync(new URL('../public/play/assets/testnet-status.js', import.meta.url), 'utf8');
const settle = () => new Promise(setImmediate);
const status = (patch = {}) => ({ ok: true, enabled: true, enrollment: { enabled: true }, records: [{ state: 'queued' }], ...patch });
async function setup(reply = () => json(status()), withDashboard = false, accountReply = null) {
  const requests = [], accounts = [], listeners = new Map();
  const ui = clientFixture(async (url, options) => {
    // The account check is recorded separately so request counts keep describing the
    // rewards read they were written against (issues #183, #199).
    if (url === '/api/passkeys/') { accounts.push({ url, options }); return typeof accountReply === 'function' ? accountReply() : accountReply || json({ ok: true, signedIn: true }); }
    requests.push({ url, options }); return reply(options, requests.length);
  });
  const panel = ui.node('[data-testnet-status]'); panel.hidden = true;
  let dashboard;
  if (withDashboard) {
    dashboard = ui.node('[data-testnet-dashboard]'); dashboard.hidden = true;
    dashboard.append(panel);
    for (const [name, tag] of [['badge', 'span'], ['details', 'dl'], ['checked', 'p'], ['refresh', 'button']]) dashboard.append(ui.node(`[data-testnet-${name}]`, tag));
  }
  ui.document.addEventListener = (name, handler) => listeners.set(name, handler);
  ui.run(source); await settle();
  return { ...ui, requests, accounts, panel, dashboard,
    async documentEvent(name) { await listeners.get(name)?.(); await settle(); },
    async fire(delay = 15000) {
      const [id, timer] = [...ui.timers].find(([, t]) => t.delay === delay) || [];
      assert.ok(timer, `Expected ${delay}ms timer`); ui.timers.delete(id); await timer.fn(); await settle();
    }
  };
}

test('a visitor without an account session sends no rewards request and sees nothing', async () => {
  for (const accountReply of [() => json({}, 401), () => json({ ok: true, signedIn: false, walletLinked: false })]) {
    const ui = await setup(() => json(status({ enrollment: null, records: [] })), false, accountReply);
    assert.equal(ui.accounts.length, 1);
    assert.equal(ui.accounts[0].url, '/api/passkeys/');
    assert.equal(ui.accounts[0].options.method, undefined);
    assert.equal(ui.accounts[0].options.body, undefined);
    assert.equal(ui.accounts[0].options.credentials, 'same-origin');
    assert.equal(ui.requests.length, 0);
    assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
    assert.equal(ui.timers.size, 0);
    // The rewards dashboard stays hidden for a guest too, and no timed poll starts.
    const dashboard = await setup(() => json(status({ enrollment: null, records: [] })), true, accountReply);
    assert.equal(dashboard.requests.length, 0);
    assert.equal(dashboard.dashboard.hidden, true);
    assert.equal(dashboard.timers.size, 0);
  }
});

test('a signed-in visitor reads rewards after one account check and keeps polling that read', async () => {
  const ui = await setup(() => json(status({ enrollment: null, records: [] })));
  assert.equal(ui.accounts.length, 1);
  assert.equal(ui.requests.length, 1);
  assert.equal(ui.requests[0].url, '/api/rewards/?service=testnet');
  assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
  const dashboard = await setup(() => json(status({ enrollment: null, records: [] })), true);
  assert.equal(dashboard.requests.length, 1);
  assert.match(dashboard.panel.textContent, /Saving an address does not enroll/);
  await dashboard.fire();
  assert.equal(dashboard.accounts.length, 1);
  assert.equal(dashboard.requests.length, 2);
});

test('a failed account check never sends the rewards read and retries quietly', async () => {
  const ui = await setup(() => json(status()), false, () => json({}, 503));
  assert.equal(ui.accounts.length, 1);
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
  await ui.fire();
  assert.equal(ui.accounts.length, 2);
  assert.equal(ui.requests.length, 0);
});

test('player status uses private canonical reads and distinguishes queued, paused and confirmed payments', async () => {
  let payload = status();
  const ui = await setup(() => json(payload));
  assert.match(ui.panel.textContent, /queued for the automatic reward service/);
  payload = status({ enabled: false }); await ui.fire();
  assert.match(ui.panel.textContent, /saved.*paused/);
  assert.doesNotMatch(ui.panel.textContent, /will be sent|being confirmed/);
  payload = status({ enabled: false, records: [{ state: 'prepared' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /saved.*paused/);
  payload = status({ enabled: false, records: [{ state: 'indexed-confirmed' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /confirmed by the indexer/);
  for (const { url, options } of ui.requests) {
    assert.equal(url, '/api/rewards/?service=testnet');
    assert.equal(options.credentials, 'same-origin'); assert.equal(options.cache, 'no-store');
    assert.equal(options.method, undefined); assert.equal(options.body, undefined);
  }
});

test('temporary network and HTTP failures keep retrying and replace stale success text', async () => {
  let outcome = 'network';
  const ui = await setup(() => {
    if (outcome === 'network') throw new Error('offline');
    return outcome === 'http' ? json({ ok: false }, 503) : json(status());
  });
  assert.equal(ui.panel.hidden, true);
  outcome = 'ok'; await ui.fire(); assert.equal(ui.panel.hidden, false);
  outcome = 'http'; await ui.fire(); assert.match(ui.panel.textContent, /status is unavailable/);
  outcome = 'ok'; await ui.fire(); assert.match(ui.panel.textContent, /queued/);
  assert.equal(ui.requests.length, 4);
});

test('lost access or missing enrollment clears the previous player status and stops timed polling', async () => {
  for (const reply of [() => json({ ok: false }, 401), () => json({ ok: false }, 403),
    () => json(status({ enrollment: null, records: [] }))]) {
    let denied = false;
    const ui = await setup(() => denied ? reply() : json(status()));
    denied = true; await ui.fire();
    assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
    assert.equal(ui.timers.size, 0);
  }
});

test('a saved-run event during an older read triggers a fresh read without overlapping requests', async () => {
  const pending = deferred();
  const ui = await setup((options, count) => count === 1 ? pending.promise : json(status()));
  await ui.window.emit('geek:run-saved');
  await ui.window.emit('geek:run-saved');
  assert.equal(ui.requests.length, 1);
  pending.resolve(json(status({ records: [] }))); await settle();
  assert.equal(ui.requests.length, 2); assert.match(ui.panel.textContent, /queued/);
});

test('enrollment and confirmed views continue discovering later rewards', async () => {
  let payload = status({ records: [] });
  const ui = await setup(() => json(payload));
  assert.match(ui.panel.textContent, /handled automatically/);
  payload = status({ records: [{ state: 'indexed-confirmed' }] }); await ui.fire();
  assert.match(ui.panel.textContent, /confirmed by the indexer/);
  payload = status(); await ui.fire(); assert.match(ui.panel.textContent, /queued/);
});

test('request timeouts recover on the next bounded poll', async () => {
  const ui = await setup((options, count) => count === 1 ? aborted(options.signal) : json(status()));
  await ui.fire(10000); assert.equal(ui.requests[0].options.signal.aborted, true);
  await ui.fire(); assert.match(ui.panel.textContent, /queued/);
});

test('backgrounding cancels private reads and a late reply cannot restore the hidden status', async () => {
  const pending = deferred();
  const ui = await setup((options, count) => count === 1 ? pending.promise : json(status({ records: [] })));
  ui.document.hidden = true; await ui.documentEvent('visibilitychange');
  assert.equal(ui.requests[0].options.signal.aborted, true);
  await ui.window.emit('geek:run-saved'); assert.equal(ui.requests.length, 1);
  pending.resolve(json(status())); await settle();
  assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, ''); assert.equal(ui.timers.size, 0);
  ui.document.hidden = false; await ui.documentEvent('visibilitychange');
  assert.match(ui.panel.textContent, /handled automatically/); assert.equal(ui.requests.length, 2);
});

test('new player and page-cache return discard old responses and old deadlines target only their own request', async () => {
  const old = deferred(), current = deferred();
  const ui = await setup((options, count) => count === 1 ? old.promise : count === 2 ? current.promise : json(status({ enrollment: null, records: [] })));
  const oldDeadline = [...ui.timers.values()].find(t => t.delay === 10000).fn;
  await ui.documentEvent('geek:signed-in'); assert.equal(ui.requests.length, 2);
  oldDeadline(); assert.equal(ui.requests[1].options.signal.aborted, false);
  old.resolve(json(status())); await settle(); assert.equal(ui.panel.hidden, true);
  current.resolve(json(status({ records: [] }))); await settle(); assert.match(ui.panel.textContent, /handled automatically/);
  await ui.window.emit('pagehide'); assert.equal(ui.panel.hidden, true); assert.equal(ui.panel.textContent, '');
  await ui.window.emit('pageshow', { persisted: true }); await settle();
  assert.equal(ui.requests.length, 3); assert.equal(ui.panel.hidden, true);
});

const payment = (patch = {}) => ({ state: 'queued', ticker: 'GEEKT', network: 'testnet-10', amount: '100000000', decimals: '8', recipient: 'kaspatest:original-fixture', ...patch });
const descriptions = ui => ui.node('[data-testnet-details]').children.filter(n => n.tagName === 'DD').map(n => n.textContent);

test('the player dashboard distinguishes preparation from submission and only reports observed confirmation', async () => {
  let latest = payment();
  const ui = await setup(() => json(status({ records: [latest] })), true);
  assert.equal(ui.dashboard.hidden, false); assert.equal(ui.node('[data-testnet-badge]').textContent, 'Queued');
  assert.deepEqual(descriptions(ui), ['1 GEEKT · Testnet-10', 'Queued', 'kaspatest:original-fixture']);
  latest = payment({ state: 'prepared', transactionHash: 'a'.repeat(64) }); await ui.fire();
  assert.match(ui.panel.textContent, /prepared.*handle submission/);
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Prepared');
  assert.doesNotMatch(ui.panel.textContent, /received|sent|confirmed by/);
  latest = { ...latest, state: 'awaiting-indexer' }; await ui.fire();
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Awaiting confirmation');
  latest = { ...latest, state: 'indexed-confirmed' }; await ui.fire();
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Confirmed by indexer');
  assert.match(ui.panel.textContent, /confirmed by the indexer/);
  assert.ok(descriptions(ui).includes('a'.repeat(64)));
});

test('dashboard amounts retain exact raw-unit precision and long destinations render as text', async () => {
  let latest = payment({ amount: '99999999999999999999', recipient: '<img src=x onerror=alert(1)>' });
  const ui = await setup(() => json(status({ records: [latest] })), true);
  assert.equal(descriptions(ui)[0], '999999999999.99999999 GEEKT · Testnet-10');
  assert.ok(descriptions(ui).includes(latest.recipient));
  assert.ok(ui.node('[data-testnet-details]').children.every(n => n.innerHTML === ''));
  latest = payment({ amount: '1', decimals: '18' }); await ui.fire();
  assert.equal(descriptions(ui)[0], '0.000000000000000001 GEEKT · Testnet-10');
  latest = payment({ amount: '1', decimals: '0' }); await ui.fire();
  assert.equal(descriptions(ui)[0], '1 GEEKT · Testnet-10');
});

test('refresh and a saved-address event read current status without changing an existing payment destination', async () => {
  const pending = deferred(); let block = false;
  const ui = await setup(() => block ? pending.promise : json(status({ enrollment: { recipient: 'kaspatest:new-fixture', enabled: true }, records: [payment()] })), true);
  block = true;
  const first = ui.node('[data-testnet-refresh]').emit('click'); await settle();
  assert.equal(ui.node('[data-testnet-refresh]').disabled, true);
  assert.equal(ui.dashboard.getAttribute('aria-busy'), 'true');
  await ui.window.emit('geek:receiving-address-saved'); assert.equal(ui.requests.length, 2);
  block = false; pending.resolve(json(status({ records: [payment()] }))); await first; await settle();
  assert.equal(ui.requests.length, 3);
  assert.ok(descriptions(ui).includes('kaspatest:original-fixture'));
  assert.equal(ui.node('[data-testnet-refresh]').disabled, false);
  for (const {options} of ui.requests) { assert.equal(options.method, undefined); assert.equal(options.body, undefined); }
});

test('dashboard failures mark retained details stale, recover on refresh, and never mistake unknown states for confirmation', async () => {
  let outcome = 'fail';
  const ui = await setup(() => outcome === 'fail' ? json({}, 503) : json(status({ records: [payment({ state: outcome === 'unknown' ? 'made-up' : 'indexed-confirmed' })] })), true);
  assert.equal(ui.dashboard.hidden, false); assert.equal(ui.node('[data-testnet-badge]').textContent, 'Status unavailable');
  assert.equal(descriptions(ui).length, 0);
  outcome = 'ok'; await ui.node('[data-testnet-refresh]').emit('click');
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Confirmed by indexer');
  outcome = 'fail'; await ui.fire();
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Status unavailable');
  assert.match(ui.node('[data-testnet-checked]').textContent, /last loaded.*Current confirmation is unavailable/);
  assert.doesNotMatch(ui.panel.textContent, /confirmed by/);
  outcome = 'unknown'; await ui.fire(); assert.equal(ui.node('[data-testnet-badge]').textContent, 'Status unavailable');
  outcome = 'ok'; await ui.fire(); assert.equal(ui.node('[data-testnet-badge]').textContent, 'Confirmed by indexer');
});

test('dashboard sign-out clears private details and rejects a late reply; passkey and device sign-ins load the new account', async () => {
  const pending = deferred(); let count = 0;
  const ui = await setup(() => ++count === 2 ? pending.promise : json(status({ records: count > 2 ? [] : [payment()] })), true);
  const refresh = ui.node('[data-testnet-refresh]').emit('click'); await settle();
  await ui.documentEvent('geek:signed-out');
  assert.equal(ui.dashboard.hidden, true); assert.equal(descriptions(ui).length, 0);
  pending.resolve(json(status({ records: [payment()] }))); await refresh;
  assert.equal(ui.dashboard.hidden, true); assert.equal(ui.timers.size, 0);
  await ui.documentEvent('geek:passkey-signed-in');
  assert.equal(ui.dashboard.hidden, false); assert.equal(descriptions(ui).length, 0);
  await ui.documentEvent('geek:device-signed-in'); assert.equal(ui.requests.length, 4);
  for (const code of [401, 403]) {
    const guest = await setup(() => json({}, code), true);
    assert.equal(guest.dashboard.hidden, true); assert.equal(descriptions(guest).length, 0); assert.equal(guest.timers.size, 0);
  }
});

test('accounts without pilot enrollment see an honest empty dashboard and continue checking for future jobs', async () => {
  const ui = await setup(() => json(status({ enrollment: null, records: [] })), true);
  assert.equal(ui.dashboard.hidden, false); assert.equal(ui.node('[data-testnet-badge]').textContent, 'No test reward yet');
  assert.match(ui.panel.textContent, /Saving an address does not enroll/);
  await ui.fire(); assert.equal(ui.requests.length, 2);
});

test('retained original attempts say retries stopped and a fresh attempt remains distinct from confirmation', async () => {
  let latest = payment({ state: 'awaiting-indexer', serviceRetriesStopped: true });
  const ui = await setup(() => json(status({ records: [latest] })), true);
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Retries stopped');
  assert.match(ui.panel.textContent, /receipt is retained.*stopped retrying/);
  assert.doesNotMatch(ui.panel.textContent, /received|canceled|confirmed/);
  latest = payment({ freshTest: true }); await ui.fire();
  assert.equal(ui.node('[data-testnet-badge]').textContent, 'Queued');
  assert.ok(descriptions(ui).includes('Fresh test · original receipt retained'));
});
