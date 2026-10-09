import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { firstSignal, getChapter, checksFor } from '../public/quest/assets/chapter.js';
import { campaignCards, campaignSummary } from '../public/quest/assets/campaign.js';
import { decodeQuest, questView } from '../server/quest.js';

const source = readFileSync(new URL('../public/quest/assets/quest.js', import.meta.url), 'utf8').replace(/^import .*;\n/gm, '');
const initial = () => questView(decodeQuest(''));
const started = () => ({ ...initial(), revision: 1, updatedAt: 1700000000000, attempt: { id: 'a'.repeat(32), token: 'b'.repeat(32), status: 'lesson', index: 0, sceneIndex: 0, answered: 0, correct: 0 } });
const unavailable = () => new Response(JSON.stringify({ code: 'QUEST_STATE_INVALID', error: 'Your saved chapter could not be verified.' }), { status: 503 });
const ok = data => new Response(JSON.stringify(data));
const page = async (questRequest, { campaignRequest, search = '' } = {}) => {
  const nodes = new Map(), requests = [];
  const node = selector => {
    if (!nodes.has(selector)) nodes.set(selector, {
      textContent: '', innerHTML: '', hidden: false, disabled: false, dataset: {}, attributes: new Map(), events: new Map(),
      addEventListener(name, handler) { this.events.set(name, handler); },
      setAttribute(name, value) { this.attributes.set(name, value); }, hasAttribute(name) { return this.attributes.has(name); }, removeAttribute(name) { this.attributes.delete(name); },
      replaceChildren() {}, append() {}, focus() { this.focused = true; }, scrollIntoView(options) { this.scrolled = options; }, showModal() {},
    });
    return nodes.get(selector);
  };
  const fetch = async (path, options) => {
    requests.push({ path, method: options.method || 'GET', body: options.body && JSON.parse(options.body) });
    if (path === '/api/session') return ok({ player: { name: 'Explorer' } });
    if (path === '/api/collectibles') return ok({ collection: { avatar: { id: 'giga-builder' } } });
    if (path === '/api/quest?campaign=1') return campaignRequest ? campaignRequest() : ok({ campaign: { chapters: [{ chapterId: firstSignal.id, available: true, status: 'unstarted', answered: 0, total: 6 }] } });
    return questRequest(options);
  };
  const context = { document: { querySelector: node, querySelectorAll: () => [], createElement: () => node('button') }, location: { search },
    firstSignal, getChapter, checksFor, campaignCards, campaignSummary, defaultGeek: {}, geekSvg: () => '', geekDescription: () => '',
    fetch, URLSearchParams, AbortController, setTimeout, clearTimeout, Intl, Date };
  runInNewContext(source.replace('map(); drawCampaign(); initialize();', 'map(); drawCampaign(); globalThis.startup = initialize(); globalThis.actions = { act, load, refreshCampaign };'), context);
  await context.startup;
  return { node, requests, actions: context.actions };
};

test('an unreadable first load shows recovery instead of Begin and keeps the map unavailable', async () => {
  const ui = await page(() => unavailable());
  assert.equal(ui.node('[data-begin]').hidden, true);
  assert.equal(ui.node('[data-chapter-layout]').hidden, true);
  assert.equal(ui.node('[data-story-map]').hidden, true);
  assert.equal(ui.node('[data-chapter-reference]').hidden, false);
  assert.equal(ui.node('[data-chapter-lock]').hidden, false);
  assert.match(ui.node('[data-lock-title]').textContent, /saved chapter needs a check/);
  assert.equal(ui.node('[data-lock-link]').hidden, true);
  assert.match(ui.node('[data-resume]').textContent, /Retry loading/);
  assert.doesNotMatch(ui.node('[data-status]').textContent, /Saving could not be confirmed|last action may have saved/);
  await ui.actions.refreshCampaign();
  assert.match(ui.node('[data-campaign]').innerHTML, /Saved status unavailable/);
  assert.doesNotMatch(ui.node('[data-campaign]').innerHTML, /Ready to explore/);
  await ui.actions.act('begin');
  assert.equal(ui.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/quest')).length, 0);
});

test('retrying a failed load restores only the saved server step, without starting a chapter', async () => {
  let failure = true;
  const ui = await page(() => failure ? unavailable() : ok({ quest: started() }));
  failure = false; await ui.actions.load();
  assert.equal(ui.node('[data-chapter-layout]').hidden, false);
  assert.equal(ui.node('[data-chapter-lock]').hidden, true);
  assert.equal(ui.node('[data-resume]').hidden, true);
  assert.equal(ui.node('[data-begin]').hidden, true);
  assert.equal(ui.node('[data-continue]').disabled, false);
  assert.equal(ui.node('[data-title]').textContent, firstSignal.scenes[0].name);
  assert.equal(ui.node('[data-title]').focused, true);
  assert.equal(ui.node('[data-title]').scrolled.block, 'start');
  assert.match(ui.node('[data-campaign]').innerHTML, /saved visit in progress/);
  assert.equal(ui.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/quest')).length, 0);
});

test('a lost Begin response disables writes and resumes its accepted step without automatic POST retry', async () => {
  let saved = initial();
  const ui = await page(options => {
    if (options.method === 'POST') { saved = started(); throw new TypeError('Network reply lost.'); }
    return ok({ quest: saved });
  });
  assert.equal(ui.node('[data-begin]').hidden, false);
  await ui.actions.act('begin');
  assert.equal(ui.node('[data-begin]').hidden, true);
  assert.match(ui.node('[data-status]').textContent, /last action may have saved/);
  assert.match(ui.node('[data-campaign]').innerHTML, /Saved status unavailable/);
  await ui.actions.act('begin');
  assert.equal(ui.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/quest')).length, 1);
  await ui.actions.load();
  assert.equal(ui.node('[data-continue]').disabled, false);
  assert.equal(ui.node('[data-begin]').hidden, true);
  assert.equal(ui.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/quest')).length, 1);
});

test('a failed later step keeps its last verified scene and prevents stale map claims', async () => {
  let failReads = false;
  const ui = await page(options => options.method === 'POST' || failReads ? unavailable() : ok({ quest: started() }));
  await ui.actions.act('continue'); failReads = true;
  assert.equal(ui.node('[data-title]').textContent, firstSignal.scenes[0].name);
  assert.equal(ui.node('[data-chapter-layout]').hidden, false);
  assert.equal(ui.node('[data-continue]').disabled, true);
  assert.match(ui.node('[data-save-note]').textContent, /unverified/);
  await ui.actions.refreshCampaign();
  assert.match(ui.node('[data-campaign]').innerHTML, /Saved status unavailable/);
  assert.doesNotMatch(ui.node('[data-campaign]').innerHTML, /saved visit in progress/);
  await ui.actions.load();
  assert.doesNotMatch(ui.node('[data-status]').textContent, /last action may have saved/);
  await ui.actions.act('continue');
  assert.equal(ui.requests.filter(r => r.method === 'POST' && r.path.startsWith('/api/quest')).length, 1);
});

test('a locked chapter still directs the player to its prerequisite', async () => {
  const ui = await page(() => new Response(JSON.stringify({ code: 'QUEST_LOCKED', error: 'Complete First Signal to unlock this chapter.', prerequisite: { id: firstSignal.id, title: firstSignal.title, href: '/quest/?chapter=first-signal' } }), { status: 403 }), { search: '?chapter=inside-blockdag' });
  assert.equal(ui.node('[data-chapter-layout]').hidden, true);
  assert.equal(ui.node('[data-lock-link]').hidden, false);
  assert.equal(ui.node('[data-lock-link]').href, '/quest/?chapter=first-signal');
  assert.equal(ui.node('[data-resume]').textContent, 'Check chapter unlock');
  assert.match(ui.node('[data-lock-title]').textContent, /locked/);
});
test('an aborted chapter read has a clear retry message and cannot start a chapter', async () => {
  const ui = await page(() => { throw Object.assign(new Error('Aborted'), { name: 'AbortError' }); });
  assert.match(ui.node('[data-status]').textContent, /took too long to respond/);
  assert.doesNotMatch(ui.node('[data-status]').textContent, /Saving could not be confirmed|last action may have saved/);
  assert.equal(ui.node('[data-begin]').hidden, true);
  assert.equal(ui.node('[data-resume]').disabled, false);
});
