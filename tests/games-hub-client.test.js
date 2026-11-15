import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture } from './helpers/client-fixture.js';

const html = readFileSync('public/games/index.html', 'utf8');
const source = readFileSync('public/games/assets/hub.js', 'utf8');
const expected = [
  '/practice/', '/play/?mode=daily#timed-games', '/play/?mode=speed#timed-games', '/memory/',
  '/games/brain/?mode=sequence', '/games/brain/?mode=math', '/games/brain/?mode=switch',
  '/games/online/', '/games/chess/', '/games/checkers/', '/games/solitaire/',
  '/games/tic-tac-toe/', '/games/dots/', '/games/battle-geek/', '/games/connect-four/',
  '/games/reversi/', '/games/codebreaker/', '/games/hanoi/', '/games/sudoku/', '/games/peg-quest/',
  '/quest/', '/play/?mode=gauntlet#timed-games', '/duel/', '/royale/',
];
const decode = text => text.replaceAll('&amp;', '&').replaceAll('&quot;', '"');
function setup() {
  const ui = clientFixture(() => { throw new Error('Lobby discovery must never make requests'); }, { location: { hash: '' } });
  const sections = [];
  const cards = [];
  for (const match of html.matchAll(/<section data-game-section[^>]*id="([^"]+)"[\s\S]*?<\/section>/g)) {
    const section = ui.make('section'); section.dataset.gameSection = ''; section.id = match[1]; sections.push(section);
    for (const row of match[0].matchAll(/<article class="game-card" data-game-card data-category="([^"]+)" data-search="([^"]+)"/g)) {
      const card = ui.make('article'); card.dataset = { gameCard: '', category: row[1], search: decode(row[2]) };
      section.append(card); cards.push(card);
    }
  }
  for (const category of ['all', 'quick', 'strategy', 'friends', 'adventures']) {
    const button = ui.make('button'); button.dataset.gameFilter = category;
  }
  ui.node('[data-game-tools]').hidden = true; ui.node('[data-game-search]').value = '';
  ui.run(source);
  return { ...ui, sections, cards, visible: () => cards.filter(card => !card.hidden) };
}

test('all 24 original game setup links survive the redesign without demo substitutions', () => {
  const cards = [...html.matchAll(/<article class="game-card"[\s\S]*?<\/article>/g)];
  assert.equal(cards.length, expected.length);
  const links = cards.map(card => decode(card[0].match(/class="game-open" href="([^"]+)"/)[1]));
  assert.deepEqual(links.sort(), [...expected].sort());
  assert.ok(!html.includes('/games/preview/arcade.js'));
  assert.match(html, /token payouts are not live/);
  assert.match(html, /id="friends"[\s\S]*?Geek Game Lounge[\s\S]*?\/games\/online\//);
});

test('filters retain existing links and expose only matching groups without API calls', async () => {
  const ui = setup(); assert.equal(ui.visible().length, 24); assert.equal(ui.node('[data-game-tools]').hidden, false);
  await ui.node('[data-game-filter="friends"]').emit('click');
  assert.deepEqual(ui.visible().map(card => card.dataset.search), ['Geek Game Lounge', 'Duel', 'Trivia Royale']);
  assert.equal(ui.sections.find(section => section.id === 'quick').hidden, true);
  assert.equal(ui.sections.find(section => section.id === 'friends').hidden, false);
  await ui.node('[data-game-filter="all"]').emit('click'); assert.equal(ui.visible().length, 24);
});

test('search intersects the selected category; literal empty results recover by clearing the search', async () => {
  const ui = setup(), search = ui.node('[data-game-search]');
  search.value = '  cHeSs  '; await search.emit('input');
  assert.deepEqual(ui.visible().map(card => card.dataset.search), ['Geek Chess']);
  await ui.node('[data-game-filter="friends"]').emit('click'); assert.equal(ui.visible().length, 0);
  assert.equal(ui.node('[data-game-empty]').hidden, false);
  search.value = '<img src=x onerror=alert(1)>'; await search.emit('input'); assert.equal(ui.visible().length, 0);
  search.value = ''; await search.emit('input'); assert.equal(ui.visible().length, 3);
  assert.equal(ui.node('[data-game-empty]').hidden, true);
});

test('historic game-section fragments reveal their targets after filtering', async () => {
  const ui = setup();
  await ui.node('[data-game-filter="friends"]').emit('click');
  ui.context.location.hash = '#brain-games'; ui.window.dispatchEvent({ type: 'hashchange' });
  assert.equal(ui.visible().length, 24);
  assert.equal(ui.sections.find(section => section.id === 'brain-games').hidden, false);
  assert.equal(ui.node('[data-game-filter="all"]').getAttribute('aria-pressed'), 'true');
});
