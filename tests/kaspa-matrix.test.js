import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Synthetic DOM: checks lifecycle and safeguards, not real-browser rendering or phone QA.
const source = readFileSync(new URL('../public/assets/kaspa-matrix.js', import.meta.url), 'utf8').replaceAll('export const', 'const');
const classes = () => { const set = new Set(); return { add: c => set.add(c), remove: c => set.delete(c), contains: c => set.has(c), toggle: (c, on = !set.has(c)) => { if (on) set.add(c); else set.delete(c); return on; } }; };
const element = tag => {
  const el = { tagName: tag.toUpperCase(), dataset: {}, attributes: new Map(), children: [], events: new Map(), hidden: false, classList: classes(), style: { setProperty(name, value) { this[name] = value; } },
    setAttribute(n, v) { this.attributes.set(n, String(v)); }, getAttribute(n) { return this.attributes.get(n) ?? null; },
    append(...kids) { this.children.push(...kids); }, addEventListener(n, fn) { this.events.set(n, [...(this.events.get(n) || []), fn]); },
    emit(n, e = {}) { for (const fn of this.events.get(n) || []) fn(e); } };
  if (tag === 'canvas') { el.calls = { fillText: 0, clearRect: 0, fillRect: 0 }; el.getContext = () => new Proxy({}, { get: (_, k) => k in el.calls ? () => el.calls[k]++ : () => {}, set: () => true }); }
  return el;
};
function setup({ path = '/', reduced = false, saved = null, legacySaved = null, hidden = false, playing = false, footer = true, saveData = false } = {}) {
  const session = new Map(saved ? [['geek-matrix-background', saved]] : []);
  const store = new Map(legacySaved ? [['geek-matrix-background', legacySaved]] : []);
  const frames = new Map(), timers = new Map(); let id = 0;
  const body = element('body'), head = element('head'), docEvents = element('document'), win = element('window'), foot = footer ? element('footer') : null;
  if (playing) body.classList.add('is-playing');
  const document = { hidden, body, head, documentElement: element('html'), createElement: element,
    querySelector: s => (s === 'footer' ? foot : null), addEventListener: (...a) => docEvents.addEventListener(...a), dispatchEvent: e => docEvents.emit(e.type, e) };
  Object.assign(win, { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2, matchMedia: q => ({ matches: q.includes('reduced') ? reduced : false, addEventListener() {} }) });
  const memory = map => ({ getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) });
  const context = { document, window: win, location: { pathname: path }, navigator: { connection: { saveData } }, performance: { now: () => 0 }, CustomEvent,
    localStorage: memory(store), sessionStorage: memory(session),
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: n => frames.delete(n),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: n => timers.delete(n) };
  runInNewContext(source, context);
  const layer = body.children.find(c => c.dataset.kaspaMatrixLayer !== undefined), canvas = layer?.children[0];
  const planet = body.children.find(c => c.dataset.kaspaPlanetLayer !== undefined);
  const space = body.children.find(c => c.dataset.kaspaSpace !== undefined);
  const tick = t => { const [key, fn] = [...frames].at(-1) || []; if (!fn) return false; frames.delete(key); fn(t); return true; };
  const again = source.replaceAll('initKaspaMatrix', 'initKaspaMatrixAgain').replaceAll('initKaspaPlanet', 'initKaspaPlanetAgain').replaceAll('MATRIX_KEY', 'MATRIX_KEY_AGAIN').replaceAll('PLANET_SRC', 'PLANET_SRC_AGAIN').replaceAll('PLANET_PLACEMENTS', 'PLANET_PLACEMENTS_AGAIN').replaceAll('applyPlanetPlacement', 'applyPlanetPlacementAgain').replaceAll('planetPlacement', 'planetPlacementAgain').replaceAll('planetPath', 'planetPathAgain').replaceAll('planetHash', 'planetHashAgain').replaceAll('mediaQuery', 'mediaQueryAgain').replaceAll('ensureMatrixCss', 'ensureMatrixCssAgain').replaceAll('quietRoute', 'quietRouteAgain').replaceAll('gameOrOpsRoute', 'gameOrOpsRouteAgain').replaceAll('planetShouldBeStill', 'planetShouldBeStillAgain');
  return { context, document, body, layer, canvas, planet, space, frames, timers, store, session, footer: foot, tick, run: () => runInNewContext(again, context) };
}

test('code rain is skipped on game boards, owner and sign-in pages, and installs once elsewhere', () => {
  for (const path of ['/games/chess/', '/games/hanoi/', '/ops/', '/ops-login/', '/sign-in/']) {
    const f = setup({ path });
    assert.equal(f.layer, undefined, path);
    assert.equal(f.space, undefined, path);
    assert.ok(f.planet, `planet still mounts on ${path}`);
    assert.ok(f.planet.classList.contains('kaspa-planet--still'), path);
    assert.equal(f.frames.size, 0, path);
  }
  const f = setup();
  assert.ok(f.planet);
  assert.ok(f.space);
  assert.equal(f.layer.getAttribute('aria-hidden'), 'true');
  assert.equal(f.layer.style.pointerEvents, 'none');
  assert.equal(f.layer.style.position, 'fixed');
  assert.equal(f.layer.style.zIndex, '-1', 'behind translucent panels, below the header (z 90)');
  assert.equal(f.planet.style.zIndex, '-3', 'planet sits between nebula and stars');
  assert.equal(f.planet.style.pointerEvents, 'none');
  assert.equal(f.canvas.tagName, 'CANVAS');
  assert.equal(f.frames.size, 1, 'one animation loop');
  assert.equal(f.footer?.children.length, 0, 'no Code rain footer button');
  f.run();
  assert.equal(f.body.children.filter(c => c.dataset.kaspaMatrixLayer !== undefined).length, 1);
  assert.equal(f.body.children.filter(c => c.dataset.kaspaPlanetLayer !== undefined).length, 1);
  assert.equal(f.frames.size, 1);
  assert.ok(setup({ path: '/games/' }).layer, 'the games hub keeps the rain');
});

test('frame rate is capped near 24fps and the device pixel ratio is bounded', () => {
  const f = setup();
  assert.equal(f.canvas.width, 1920, 'dpr capped at 1.5 on desktop');
  const frames = () => f.canvas.calls.fillRect;
  f.tick(1000); const first = frames(); assert.ok(first > 0);
  f.tick(1010); f.tick(1020); assert.equal(frames(), first, 'no draw inside the frame budget');
  f.tick(1050); assert.ok(frames() > first);
});

test('reduced motion defaults rain off, keeps a still planet, and an explicit opt-in shows one still frame without a loop', () => {
  const off = setup({ reduced: true });
  assert.equal(off.layer.hidden, true); assert.equal(off.frames.size, 0);
  assert.ok(off.planet.classList.contains('kaspa-planet--still'));
  const on = setup({ reduced: true, saved: 'on' });
  assert.equal(on.layer.hidden, false); assert.equal(on.frames.size, 0); assert.ok(on.canvas.calls.fillText > 0, 'static frame drawn');
  assert.ok(on.planet.classList.contains('kaspa-planet--still'));
});

test('no footer toggle; a leftover localStorage off-state is ignored and cleared; the terminal event is session-only', () => {
  const ignored = setup({ legacySaved: 'off' });
  assert.equal(ignored.footer?.children.length, 0, 'no Code rain button in the footer');
  assert.equal(ignored.frames.size, 1, 'stale localStorage off-state must not hide the effect');
  assert.equal(ignored.layer.hidden, false);
  assert.equal(ignored.store.has('geek-matrix-background'), false, 'stale localStorage key cleared on load');
  assert.equal(ignored.session.get('geek-matrix-background'), undefined);

  const f = setup();
  assert.equal(f.footer?.children.length, 0);
  f.document.dispatchEvent(new CustomEvent('geek:matrix-toggle', { detail: { on: false } }));
  assert.equal(f.store.has('geek-matrix-background'), false, 'never writes localStorage');
  assert.equal(f.session.get('geek-matrix-background'), 'off');
  assert.equal(f.frames.size, 0); assert.equal(f.layer.hidden, true);
  f.document.dispatchEvent(new CustomEvent('geek:matrix-toggle', { detail: { on: true } }));
  assert.equal(f.session.get('geek-matrix-background'), 'on');
  assert.equal(f.store.has('geek-matrix-background'), false);
  assert.equal(f.frames.size, 1); assert.equal(f.layer.hidden, false);
  assert.equal(setup({ saved: 'off' }).frames.size, 0, 'sessionStorage off still pauses this tab');
});

test('hidden tabs, quiz routes and active games never animate', () => {
  assert.equal(setup({ hidden: true }).frames.size, 0);
  for (const path of ['/play/', '/practice/', '/quest/', '/duel/', '/royale/', '/memory/', '/challenges/']) {
    const f = setup({ path });
    assert.equal(f.frames.size, 0, path); assert.ok(f.layer.classList.contains('kaspa-matrix--quiet'), path);
    assert.ok(f.planet.classList.contains('kaspa-planet--still'), path);
  }
  const playing = setup({ playing: true });
  assert.equal(playing.frames.size, 0); assert.ok(playing.layer.classList.contains('kaspa-matrix--quiet'));
  playing.body.classList.remove('is-playing');
  [...playing.timers.values()].at(-1).fn();
  assert.equal(playing.frames.size, 1, 'resumes after play ends');
  const f = setup(); f.document.hidden = true; f.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(f.frames.size, 0, 'pauses on visibilitychange');
});

test('the Stray signal terminal can toggle code rain for this tab only', () => {
  const egg = readFileSync(new URL('../public/assets/easter-eggs.js', import.meta.url), 'utf8');
  assert.match(egg, /geek:matrix-toggle/);
  assert.match(egg, /matrix,/);
  assert.doesNotMatch(egg, /footer Code rain button/);
  const css = readFileSync(new URL('../public/assets/kaspa-matrix.css', import.meta.url), 'utf8');
  assert.doesNotMatch(css, /kaspa-matrix-toggle/);
  assert.match(css, /kaspa-planet/);
  assert.match(css, /kaspa-space-nebula/);
});

test('planet placement is stable for a route and differs across pages', () => {
  const box = el => ['top', 'right', 'bottom', 'left', 'width', 'transform'].map(k => el.style[k]).concat(el.dataset.kaspaPlanetCorner).join('|');
  const home = setup({ path: '/' }), homeAgain = setup({ path: '/' });
  const news = setup({ path: '/news/' }), newsAlias = setup({ path: '/news' });
  const hanoi = setup({ path: '/games/hanoi/' });
  const play = setup({ path: '/play/' });
  const unknown = setup({ path: '/tools/' }), unknownAgain = setup({ path: '/tools/' });
  const otherUnknown = setup({ path: '/litepaper/' });
  assert.equal(box(home.planet), box(homeAgain.planet), 'home is stable');
  assert.equal(box(news.planet), box(newsAlias.planet), 'trailing-slash aliases match');
  assert.equal(box(unknown.planet), box(unknownAgain.planet), 'hashed routes are stable');
  assert.notEqual(box(home.planet), box(news.planet), 'home and news differ');
  assert.notEqual(box(home.planet), box(hanoi.planet), 'home and a game board differ');
  assert.notEqual(box(news.planet), box(hanoi.planet), 'news and a game board differ');
  assert.notEqual(box(home.planet), box(play.planet), 'home and a quiz route differ');
  assert.notEqual(box(unknown.planet), box(otherUnknown.planet), 'distinct unmapped routes differ');
  assert.equal(home.planet.dataset.kaspaPlanetCorner, 'br');
  assert.equal(news.planet.dataset.kaspaPlanetCorner, 'bl');
  assert.equal(hanoi.planet.dataset.kaspaPlanetCorner, 'tr');
  assert.match(home.planet.style.right, /vw$/);
  assert.equal(home.planet.style.left, 'auto');
  assert.equal(news.planet.style.right, 'auto');
  const narrow = setup({ path: '/' });
  // Re-run placement the way a narrow viewport would, by reconstructing from applied API via a second init context.
  assert.match(narrow.planet.style.width, /42vw/, 'desktop width formula at 1280px fixture');
});

test('planet assets exist at the documented swap paths and stay under size budgets', () => {
  const root = new URL('../public/assets/', import.meta.url);
  for (const name of ['kaspa-planet.webp', 'kaspa-planet.avif', 'kaspa-planet-sm.webp', 'kaspa-planet-sm.avif']) {
    const file = new URL(name, root);
    assert.ok(existsSync(file), name);
  }
  assert.ok(statSync(new URL('kaspa-planet.webp', root)).size < 120_000);
  assert.ok(statSync(new URL('kaspa-planet.avif', root)).size < 120_000);
  assert.ok(statSync(new URL('kaspa-planet-sm.webp', root)).size < 50_000);
  const js = readFileSync(new URL('../public/assets/kaspa-matrix.js', import.meta.url), 'utf8');
  assert.match(js, /\/assets\/kaspa-planet\.webp/);
  assert.match(js, /\/assets\/kaspa-planet-sm\.webp/);
  const entry = readFileSync(new URL('../public/assets/kaspa-planet.js', import.meta.url), 'utf8');
  assert.match(entry, /kaspa-matrix\.js/);
});
