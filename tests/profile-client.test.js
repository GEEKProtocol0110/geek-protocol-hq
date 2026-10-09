import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, aborted, json } from './helpers/client-fixture.js';
import * as geek from '../public/assets/geek-avatar.js';
import * as campaignUI from '../public/quest/assets/campaign.js';
import { questChapters } from '../public/quest/assets/chapter.js';
import { defaultProfile } from '../server/profile.js';
import { collectibleProfile } from '../server/collectibles.js';
import { buildJourneyProfile, deriveProgression } from '../server/progression.js';

const source = name => readFileSync(new URL(`../public/profile/assets/${name}.js`, import.meta.url), 'utf8');
const player = { name: 'Explorer', createdAt: 1700000000000 };
const profile = () => buildJourneyProfile(defaultProfile(), player);
const collection = () => collectibleProfile(defaultProfile(), { progression: deriveProgression(defaultProfile()), walletProtected: false });
const progress = { explored: 1, review: 0, confidence: 0, total: 20, next: { topic: 'origins', name: 'Origins' }, topics: [] };

const profilePage = async (intercept = () => undefined) => {
  const requests = [];
  const ui = clientFixture(async (path, options) => {
    const body = options.body && JSON.parse(options.body); requests.push({ path, body });
    const intercepted = intercept(path, options, body); if (intercepted !== undefined) return intercepted;
    if (path === '/api/session') return json({ ok: true, player });
    if (path === '/api/profile') return json({ ok: true, profile: profile() });
    if (path === '/api/collectibles') return json({ ok: true, collection: collection(), trades: [] });
    if (path.includes('service=study')) return json({ ok: true, progress });
    return json({ ok: true, campaign: { chapters: [] } });
  }, { campaignUI });
  const form = ui.node('[data-trade-form]', 'form'); form.append(ui.make('button'));
  ui.node('[data-give-sticker]').value = 'giga-core'; ui.node('[data-want-sticker]').value = 'dag-node';
  ui.node('[data-give-quantity]').value = '1'; ui.node('[data-want-quantity]').value = '1';
  ui.window.GeekBuilder = { receive() {}, unavailable() {}, svg: () => '', description: () => '' };
  ui.run(source('profile').replace("await import('../../quest/assets/campaign.js')", 'campaignUI')
    .replace('collectionControls(); initialize();', 'collectionControls(); globalThis.startup = initialize(); globalThis.actions = { collectibleAction, refreshStudy };'));
  await ui.context.startup;
  return { ...ui, requests };
};

test('a pending sticker offer blocks duplicate submits and restores controls after its receipt', async () => {
  const reply = deferred();
  const ui = await profilePage((path, options) => path === '/api/collectibles' && options.method === 'POST' ? reply.promise : undefined);
  const body = { action: 'create-trade', giveSticker: 'giga-core', giveQuantity: '1', wantSticker: 'dag-node', wantQuantity: '1' };
  const pending = ui.context.actions.collectibleAction(body, 'Offer saved.');
  assert.equal(ui.node('[data-trade-form]').querySelector('button').disabled, true);
  await ui.node('[data-trade-form]').emit('submit');
  await ui.context.actions.collectibleAction(body, 'Duplicate.');
  assert.equal(ui.requests.filter(r => r.body?.action === 'create-trade').length, 1);
  reply.resolve(json({ ok: true, collection: collection(), trades: [] })); await pending;
  assert.equal(ui.node('[data-trade-form]').querySelector('button').disabled, false);
  assert.equal(ui.node('[data-trade-feedback]').textContent, 'Offer saved.');
});

test('an uncertain collection action requires a successful fresh read before another write', async () => {
  const ui = await profilePage((path, options) => {
    if (path === '/api/collectibles' && options.method === 'POST') return Promise.reject(new TypeError('Reply lost.'));
  });
  const body = { action: 'cancel-trade', tradeId: 'synthetic-trade' };
  await ui.context.actions.collectibleAction(body, 'Cancelled.');
  assert.equal(ui.window.GeekProfile.offline, true);
  assert.equal(ui.node('[data-trade-form]').querySelector('button').disabled, true);
  assert.match(ui.node('[data-trade-feedback]').textContent, /check the saved collection/);
  await ui.context.actions.collectibleAction(body, 'Again.');
  assert.equal(ui.requests.filter(r => r.body?.action === 'cancel-trade').length, 1);
  await ui.window.GeekProfile.refreshCollectibles();
  assert.equal(ui.window.GeekProfile.offline, false);
  assert.equal(ui.requests.filter(r => r.body?.action === 'cancel-trade').length, 1);
});
for (const failed of [false, true]) test(`a late ${failed ? 'failed' : 'successful'} collection refresh cannot replace a newer mutation receipt`, async () => {
  const oldRead = deferred(); let delay = false;
  const canonical = collection(); canonical.avatar = canonical.avatars.find(a => a.id === geek.customGeekId);
  const ui = await profilePage((path, options) => {
    if (path === '/api/collectibles' && options.method === 'POST') return json({ ok: true, collection: canonical, trades: [] });
    if (path === '/api/collectibles' && delay) return oldRead.promise;
  });
  delay = true; const pending = ui.window.GeekProfile.refreshCollectibles();
  await ui.context.actions.collectibleAction({ action: 'select-avatar', avatarId: geek.customGeekId }, 'Equipped.');
  if (failed) oldRead.reject(new TypeError('Old refresh failed.')); else oldRead.resolve(json({ ok: true, collection: collection(), trades: [] }));
  await pending;
  assert.equal(ui.window.GeekProfile.collection.avatar.id, geek.customGeekId);
  assert.equal(ui.window.GeekProfile.offline, false);
});

test('a real studio save blocks sticker actions and cannot be undone by an older collection refresh', async () => {
  const reply = deferred(), oldRead = deferred(); let delayRead = false, customization;
  const ui = await profilePage((path, options, body) => {
    if (body?.action === 'customize-avatar') { customization = body.customization; return reply.promise; }
    if (path === '/api/collectibles' && delayRead) return oldRead.promise;
  });
  Object.assign(ui.context, geek);
  ui.run(source('geek-builder').replace(/^import .*;\n/gm, ''));
  delayRead = true; const pendingRead = ui.window.GeekProfile.refreshCollectibles();
  const palette = ui.node('[data-geek-part="palette"]'); palette.value = geek.geekParts.palette.choices[1][0]; await palette.emit('change');
  const pendingSave = ui.node('[data-geek-save]').emit('click');
  assert.equal(ui.window.GeekProfile.collectionBusy, true);
  await ui.context.actions.collectibleAction({ action: 'create-trade' }, 'Offer.');
  assert.equal(ui.requests.filter(r => r.body?.action === 'create-trade').length, 0);
  const canonical = collection(); canonical.avatar = canonical.avatars.find(a => a.id === geek.customGeekId); canonical.customization = customization;
  reply.resolve(json({ ok: true, collection: canonical, trades: [] })); await pendingSave;
  oldRead.resolve(json({ ok: true, collection: collection(), trades: [] })); await pendingRead;
  assert.equal(ui.window.GeekProfile.collectionBusy, false);
  assert.equal(ui.window.GeekProfile.collection.avatar.id, geek.customGeekId);
  assert.equal(ui.window.GeekProfile.collection.customization.palette, customization.palette);
  assert.equal(ui.node('[data-geek-preview-state]').textContent, 'YOUR CHARACTER PREVIEW');
});

test('a profile refresh cannot re-enable or replace the draft during a pending name save', async () => {
  const reply = deferred();
  const ui = await profilePage((path, options, body) => body?.action === 'rename' ? reply.promise : undefined);
  ui.node('[data-name-input]').value = 'New Geek';
  const pending = ui.node('[data-name-form]').emit('submit');
  ui.window.GeekProfile.renderProfile(profile());
  assert.equal(ui.node('[data-name-save]').disabled, true);
  assert.equal(ui.node('[data-name-input]').value, 'New Geek');
  await ui.node('[data-name-form]').emit('submit');
  assert.equal(ui.requests.filter(r => r.body?.action === 'rename').length, 1);
  reply.resolve(json({ ok: true, player: { name: 'New Geek' } })); await pending;
  assert.equal(ui.node('[data-player-name]').textContent, 'New Geek');
  assert.equal(ui.node('[data-name-save]').disabled, false);
});

test('failed Study refresh hides stale totals and next-step claims', async () => {
  let fail = false;
  const ui = await profilePage(path => fail && path.includes('service=study') ? json({ error: 'Study unavailable.' }, 503) : undefined);
  assert.equal(ui.node('[data-study-totals]').hidden, false);
  fail = true; await ui.context.actions.refreshStudy();
  assert.equal(ui.node('[data-study-totals]').hidden, true);
  assert.equal(ui.node('[data-study-next]').hidden, true);
  assert.equal(ui.node('[data-study-retry]').hidden, false);
});

const builderPage = fetch => {
  const ui = clientFixture(fetch, geek);
  ui.run(source('geek-builder').replace(/^import .*;\n/gm, '') + '\nglobalThis.actions = { saveCharacter };');
  ui.window.GeekBuilder.receive({ avatar: { id: geek.customGeekId }, customization: geek.defaultGeek, effects: [] });
  return ui;
};
test('a stalled character save unlocks the editor, keeps the draft and cannot repeat automatically', async () => {
  const requests = [];
  const ui = builderPage((path, options) => { requests.push(JSON.parse(options.body)); return aborted(options.signal); });
  const palette = ui.node('[data-geek-part="palette"]'); palette.value = geek.geekParts.palette.choices[1][0]; await palette.emit('change');
  const pending = ui.node('[data-geek-save]').emit('click');
  assert.equal(ui.node('[data-geek-controls]').disabled, true);
  ui.expire(); await pending;
  assert.equal(ui.node('[data-geek-controls]').disabled, false);
  assert.equal(ui.node('[data-geek-save]').disabled, true);
  assert.equal(palette.value, requests[0].customization.palette);
  assert.match(ui.node('[data-geek-status]').textContent, /check whether the save was accepted/);
  assert.doesNotMatch(ui.node('[data-geek-status]').textContent, /has not replaced/);
  await ui.node('[data-geek-save]').emit('click'); assert.equal(requests.length, 1);
  // A successful reconnect can confirm that the lost reply followed a save.
  ui.window.GeekBuilder.receive({ avatar: { id: geek.customGeekId }, customization: requests[0].customization, effects: [] });
  assert.equal(ui.node('[data-geek-save]').disabled, false);
  assert.equal(ui.node('[data-geek-preview-state]').textContent, 'YOUR CHARACTER PREVIEW');
  assert.equal(ui.timers.size, 0);
});

test('character-save timeout includes waiting for response JSON and sends the design once', async () => {
  const bodyStarted = deferred(); let calls = 0;
  const ui = builderPage(async (path, options) => ({ ok: true, json() { calls++; bodyStarted.resolve(); return aborted(options.signal); } }));
  const pending = ui.context.actions.saveCharacter(geek.defaultGeek);
  await bodyStarted.promise; ui.expire();
  await assert.rejects(pending, /took too long/);
  assert.equal(calls, 1); assert.equal(ui.timers.size, 0);
});

const dashboardPage = fetch => {
  const ui = clientFixture(fetch);
  ui.window.GeekProfile = { refreshCollectibles: async () => {}, renderProfile(p) { this.currentProfile = p; ui.window.dispatchEvent(new CustomEvent('geek:profile', { detail: p })); } };
  ui.run(source('dashboard') + '\n');
  return ui;
};
test('a lost prestige reply releases the dialog and requires profile recovery before retrying', async () => {
  const requests = [];
  const state = { ...defaultProfile(), xp: 12250 };
  const after = buildJourneyProfile({ ...state, prestigeState: { ...state.prestigeState, prestige: 1, xpBaseline: 12250 } }, player);
  const ui = dashboardPage((path, options) => {
    const body = options.body && JSON.parse(options.body); requests.push({ path, body });
    if (body?.action === 'prestige') return aborted(options.signal);
    if (path === '/api/profile/') return json({ ok: true, profile: after });
    if (path.includes('leaderboard')) return json({ ok: true, entries: [] });
    return json({ ok: true, periods: [], attempts: [] });
  });
  ui.window.GeekProfile.renderProfile(buildJourneyProfile(state, player));
  await ui.node('[data-prestige-open]').emit('click');
  ui.node('[data-prestige-check]').checked = true; await ui.node('[data-prestige-check]').emit('change');
  const pending = ui.node('[data-prestige-confirm]').emit('click');
  ui.expire(); await pending;
  assert.equal(ui.node('[data-prestige-cancel]').disabled, false);
  assert.equal(ui.node('[data-prestige-confirm]').disabled, true);
  assert.equal(ui.node('[data-prestige-open]').disabled, true);
  // An older, unrelated profile refresh cannot authorize retrying the prestige.
  ui.window.GeekProfile.renderProfile(buildJourneyProfile(state, player));
  assert.equal(ui.node('[data-prestige-open]').disabled, true);
  await ui.node('[data-prestige-check]').emit('change'); await ui.node('[data-prestige-confirm]').emit('click');
  assert.equal(requests.filter(r => r.body?.action === 'prestige').length, 1);
  await ui.node('[data-dashboard-refresh]').emit('click');
  assert.match(ui.node('[data-prestige-summary]').textContent, /Prestige 1/);
  assert.equal(requests.filter(r => r.body?.action === 'prestige').length, 1);
});

test('dashboard reads also expire while their response body stalls', async () => {
  const bodyStarted = deferred();
  const ui = dashboardPage(async (path, options) => ({ ok: true, json() { bodyStarted.resolve(); return aborted(options.signal); } }));
  const pending = ui.node('[data-dashboard-refresh]').emit('click');
  await bodyStarted.promise; ui.expire(); await pending;
  assert.equal(ui.node('[data-dashboard-refresh]').disabled, false);
  assert.match(ui.node('[data-prestige-feedback]').textContent, /took too long/);
});

test('HQ resets a completed-adventure link label when campaign status becomes unavailable', () => {
  const ui = clientFixture(() => {}, { questChapters });
  ui.window.GeekProfile = { campaign: questChapters.map(c => ({ chapterId: c.id, available: true, badge: { id: c.id } })) };
  ui.run(source('hq').replace(/^import .*;\n/gm, ''));
  assert.equal(ui.node('[data-hq-quest-link]').textContent, 'See your chapter badges →');
  ui.window.dispatchEvent(new Event('geek:campaign-unavailable'));
  assert.equal(ui.node('[data-hq-quest-link]').href, '../quest/');
  assert.equal(ui.node('[data-hq-quest-link]').textContent, 'Reconnect adventure →');
});
