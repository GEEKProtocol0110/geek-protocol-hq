import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture, deferred, json } from './helpers/client-fixture.js';
const source = readFileSync(new URL('../public/leaderboard/leaderboard.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/leaderboard/index.html', import.meta.url), 'utf8');
const settle = () => new Promise(resolve => setImmediate(resolve));
async function page(search, intercept = () => undefined) {
  const requests = [], urls = [];
  const ui = clientFixture((path, options) => {
    requests.push({ path, options });
    return intercept(path, options) ?? Promise.resolve(json({ ok: true, entries: [], day: '2026-11-06', players: 0 }));
  }, { location: { href: `https://example.test/leaderboard/${search}`, search }, history: { replaceState(state, title, url) { urls.push(String(url)); } } });
  const fields = {};
  for (const name of ['source', 'mode', 'category', 'focus']) {
    const field = ui.make('select');
    const markup = html.match(new RegExp(`<select[^>]*name="${name}"[^>]*>([\\s\\S]*?)<\\/select>`))[1];
    field.options = [...markup.matchAll(/<option value="([^"]+)"[^>]*>([^<]+)/g)].map(match => {
      const option = ui.make('option'); option.setAttribute('value', match[1]); option.value = match[1]; option.textContent = match[2]; field.append(option); return option;
    });
    field.value = field.options[0].value;
    Object.defineProperty(field, 'selectedOptions', { get: () => field.options.filter(option => option.value === field.value) });
    fields[name] = field;
  }
  ui.node('#board-filters').elements = fields;
  ui.run(source); await settle(); return { ...ui, fields, requests, urls };
}
test('a shared HQ board opens and preserves its selected category and mode', async () => {
  const ui = await page('?source=hq&mode=speed&category=technology');
  assert.match(ui.requests[0].path, /^\/api\/leaderboard\?mode=speed&category=technology&limit=50$/);
  assert.equal(ui.requests[0].options.credentials, 'same-origin');
  assert.equal(new URL(ui.urls.at(-1)).search, '?source=hq&mode=speed&category=technology');
  ui.fields.category.value = 'history'; await ui.fields.category.emit('change'); await settle();
  assert.equal(new URL(ui.urls.at(-1)).searchParams.get('category'), 'history');
});
test('Mini Speed focus survives a copied link and Mini never requests Gauntlet', async () => {
  const ui = await page('?source=mini&mode=speed&focus=builders');
  assert.equal(ui.requests[0].path, '/api/mini?mode=speed&focus=builders');
  assert.equal(new URL(ui.urls.at(-1)).searchParams.get('focus'), 'builders');
  ui.fields.mode.value = 'gauntlet'; await ui.fields.mode.emit('change'); await settle();
  assert.equal(ui.fields.mode.value, 'daily');
  assert.equal(new URL(ui.urls.at(-1)).searchParams.has('focus'), false);
});
test('unknown query values cannot select an unsupported board', async () => {
  const ui = await page('?source=unknown&mode=__proto__&category=constructor&focus=invalid');
  assert.match(ui.requests[0].path, /^\/api\/leaderboard\?mode=gauntlet&category=kaspa&limit=50$/);
});
test('a stale board response cannot replace a newer category or copied link', async () => {
  const old = deferred();
  const ui = await page('?category=technology', path => path.includes('category=technology') ? old.promise : undefined);
  ui.fields.category.value = 'history'; await ui.fields.category.emit('change'); await settle();
  old.resolve(json({ ok: true, entries: [{ rank: 1, name: 'Old category', score: 10 }] })); await settle();
  assert.equal(ui.node('#board-rows').children.length, 0);
  assert.equal(new URL(ui.urls.at(-1)).searchParams.get('category'), 'history');
});
