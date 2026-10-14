import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, webcrypto } from 'node:crypto';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';
import { copyWidgetText, loadWidgetScript, scriptableAsset } from '../public/assets/widget-install.js';

const script = readFileSync(new URL('../public/tools/kaspa-widget/downloads/Geek-Kaspa-Widget-v1.0.0.txt', import.meta.url), 'utf8');
const metadata = JSON.parse(readFileSync(new URL('../public/tools/kaspa-widget/downloads/scriptable-version.json', import.meta.url), 'utf8'));
const source = readFileSync(new URL('../public/assets/widget-guide.js', import.meta.url), 'utf8').replace(/^import[^\n]+\n/, '');
const release = { version: '1.5.0', size: 1138847, sha256: 'a'.repeat(64), release: 'https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/tag/v1.5.0' };
const tick = () => new Promise(resolve => setImmediate(resolve));

async function page({ clipboard, loader = async () => script, fetchImpl = async () => json(release) } = {}) {
  const ui = clientFixture(fetchImpl, { navigator: { clipboard }, copyWidgetText, loadWidgetScript: loader });
  ui.document.getElementById = id => ui.node('#' + id);
  ui.node('#widget-manual-copy').hidden = true;
  ui.node('#widget-page-link', 'input').value = 'https://www.geekprotocol.xyz/tools/kaspa-widget/';
  ui.run(source); await tick(); return ui;
}

test('the served Scriptable asset matches the reviewed version and declared checksum', async () => {
  assert.equal(createHash('sha256').update(script).digest('hex'), scriptableAsset.sha256);
  assert.equal(metadata.sha256, scriptableAsset.sha256);
  assert.equal(metadata.version, scriptableAsset.version);
  assert.equal(metadata.sourceCommit, '41423f2a7bbdb7a5dea5268012cf38b77a91f971');
  assert.equal(await loadWidgetScript(async (url, options) => {
    assert.equal(url, scriptableAsset.url); assert.ok(options.signal); return new Response(script);
  }, webcrypto.subtle), script);
});

test('script loading rejects HTML, truncation, oversized text and modified complete scripts', async () => {
  for (const content of ['<html>Not found</html>', script.slice(0, -30), script.replace('Geek Kaspa Widget 1.0.0', 'Other widget'), script + ' '.repeat(262145)]) {
    await assert.rejects(loadWidgetScript(async () => new Response(content), webcrypto.subtle));
  }
  await assert.rejects(loadWidgetScript(async () => new Response('', { status: 503 }), webcrypto.subtle));
  await assert.rejects(loadWidgetScript(async () => { throw new Error('Offline'); }, webcrypto.subtle));
  await assert.rejects(loadWidgetScript(async () => new Response(script), null));
});

test('clipboard failure or missing browser support returns a manual-copy result', async () => {
  assert.equal(await copyWidgetText('text', undefined), false);
  assert.equal(await copyWidgetText('text', { writeText: async () => { throw new Error('Blocked'); } }), false);
  let value; assert.equal(await copyWidgetText('text', { writeText: async v => { value = v; } }), true); assert.equal(value, 'text');
});

test('a stalled script request aborts at its deadline', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const request = loadWidgetScript(async (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
  }), webcrypto.subtle);
  const rejected = assert.rejects(request, /Request aborted/);
  t.mock.timers.tick(8000);
  await rejected;
});

test('script copy writes the whole file and reuses it on a second click', async () => {
  let copies = [], loads = 0;
  const ui = await page({ clipboard: { writeText: async value => copies.push(value) }, loader: async () => { loads++; return script; } });
  await ui.node('#copy-widget-script').emit('click'); await ui.node('#copy-widget-script').emit('click');
  assert.deepEqual(copies, [script, script]); assert.equal(loads, 1);
  assert.match(ui.node('#widget-script-status').textContent, /Copied/);
  assert.equal(ui.node('#widget-manual-copy').hidden, true);
  assert.equal(ui.node('#copy-widget-script').disabled, false);
});

test('blocked clipboard reveals a focused readonly-source fallback instead of claiming success', async () => {
  const ui = await page({ clipboard: { writeText: async () => { throw new Error('Permission denied'); } } });
  await ui.node('#copy-widget-script').emit('click');
  assert.equal(ui.node('#widget-manual-copy').hidden, false);
  assert.equal(ui.node('#widget-script-text').value, script);
  assert.equal(ui.document.activeElement, ui.node('#widget-script-text'));
  assert.match(ui.node('#widget-script-status').textContent, /blocked automatic copying/);
  await ui.node('#select-widget-script').emit('click');
  assert.match(ui.node('#widget-script-status').textContent, /Entire script selected/);
});

test('script retrieval failure permits retry and leaves the raw-text route available', async () => {
  let calls = 0;
  const ui = await page({ loader: async () => { if (++calls === 1) throw new Error('Offline'); return script; } });
  await ui.node('#copy-widget-script').emit('click');
  assert.match(ui.node('#widget-script-status').textContent, /View script as text/);
  assert.equal(ui.node('#copy-widget-script').disabled, false);
  await ui.node('#copy-widget-script').emit('click');
  assert.equal(ui.node('#widget-script-text').value, script); assert.equal(calls, 2);
});

test('repeated clicks cannot start competing script loads', async () => {
  const request = deferred(); let loads = 0;
  const ui = await page({ loader: () => { loads++; return request.promise; } });
  const first = ui.node('#copy-widget-script').emit('click');
  assert.equal(ui.node('#copy-widget-script').disabled, true);
  await ui.node('#copy-widget-script').emit('click'); assert.equal(loads, 1);
  request.resolve(script); await first; assert.equal(ui.node('#copy-widget-script').disabled, false);
});

test('Android page-link copying degrades to selecting the field', async () => {
  const ui = await page(); await ui.node('#copy-widget-link').emit('click');
  assert.equal(ui.document.activeElement, ui.node('#widget-page-link'));
  assert.match(ui.node('#widget-link-status').textContent, /Select the link/);
  let copied; const good = await page({ clipboard: { writeText: async s => { copied = s; } } });
  await good.node('#copy-widget-link').emit('click'); assert.equal(copied, 'https://www.geekprotocol.xyz/tools/kaspa-widget/');
});

test('valid release metadata updates Android links; invalid or offline metadata preserves fallbacks', async () => {
  const good = await page();
  assert.equal(good.node('#widget-release').href, release.release);
  assert.equal(good.node('#widget-direct').href, 'https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/download/v1.5.0/kaspa-live-widget.apk');
  for (const invalid of [{ ...release, release: 'https://attacker.invalid' }, { ...release, sha256: null }, { ...release, size: -1 }]) {
    const ui = await page({ fetchImpl: async () => json(invalid) });
    assert.match(ui.node('#widget-version').textContent, /Open release notes/); assert.equal(ui.node('#widget-direct').href, undefined);
  }
  const offline = await page({ fetchImpl: async () => { throw new Error('Offline'); } });
  await offline.node('#copy-widget-script').emit('click');
  assert.equal(offline.node('#widget-script-text').value, script);
});
