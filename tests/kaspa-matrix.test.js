import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
function setup({ path = '/', reduced = false, saved = null, hidden = false, playing = false, footer = true } = {}) {
  const store = new Map(saved ? [['geek-matrix-background', saved]] : []), frames = new Map(), timers = new Map(); let id = 0;
  const body = element('body'), head = element('head'), docEvents = element('document'), win = element('window'), foot = footer ? element('footer') : null;
  if (playing) body.classList.add('is-playing');
  const document = { hidden, body, head, documentElement: element('html'), createElement: element,
    querySelector: s => (s === 'footer' ? foot : null), addEventListener: (...a) => docEvents.addEventListener(...a), dispatchEvent: e => docEvents.emit(e.type, e) };
  Object.assign(win, { innerWidth: 1280, innerHeight: 800, devicePixelRatio: 2, matchMedia: q => ({ matches: q.includes('reduced') ? reduced : false, addEventListener() {} }) });
  const context = { document, window: win, location: { pathname: path }, navigator: {}, performance: { now: () => 0 }, CustomEvent,
    localStorage: { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) },
    requestAnimationFrame: fn => { frames.set(++id, fn); return id; }, cancelAnimationFrame: n => frames.delete(n),
    setTimeout: (fn, ms) => { timers.set(++id, { fn, ms }); return id; }, clearTimeout: n => timers.delete(n) };
  runInNewContext(source, context);
  const layer = body.children.find(c => c.dataset.kaspaMatrixLayer !== undefined), canvas = layer?.children[0];
  const tick = t => { const [key, fn] = [...frames].at(-1) || []; if (!fn) return false; frames.delete(key); fn(t); return true; };
  return { context, document, body, layer, canvas, frames, timers, store, footer: foot, toggle: foot?.children[0], tick, run: () => runInNewContext(source.replaceAll('initKaspaMatrix', 'initKaspaMatrixAgain').replaceAll('MATRIX_KEY', 'MATRIX_KEY_AGAIN'), context) };
}

test('code rain is skipped on game boards, owner and sign-in pages, and installs once elsewhere', () => {
  for (const path of ['/games/chess/', '/games/hanoi/', '/ops/', '/ops-login/', '/sign-in/']) assert.equal(setup({ path }).layer, undefined, path);
  const f = setup();
  assert.equal(f.layer.getAttribute('aria-hidden'), 'true');
  assert.equal(f.layer.style.pointerEvents, 'none');
  assert.equal(f.layer.style.position, 'fixed');
  assert.equal(f.layer.style.zIndex, '1', 'faint veil below the header (z 90), menus and dialogs');
  assert.equal(f.canvas.tagName, 'CANVAS');
  assert.equal(f.frames.size, 1, 'one animation loop');
  f.run();
  assert.equal(f.body.children.filter(c => c.dataset.kaspaMatrixLayer !== undefined).length, 1);
  assert.equal(f.frames.size, 1);
  assert.ok(setup({ path: '/games/' }).layer, 'the games hub keeps the effect');
});

test('frame rate is capped near 24fps and the device pixel ratio is bounded', () => {
  const f = setup();
  assert.equal(f.canvas.width, 1920, 'dpr capped at 1.5 on desktop');
  // Each drawn frame starts with exactly one fade fill, so fillRect counts frames independent of glyph randomness.
  const frames = () => f.canvas.calls.fillRect;
  f.tick(1000); const first = frames(); assert.ok(first > 0);
  f.tick(1010); f.tick(1020); assert.equal(frames(), first, 'no draw inside the frame budget');
  f.tick(1050); assert.ok(frames() > first);
});

test('reduced motion defaults off, and an explicit opt-in shows one still frame without a loop', () => {
  const off = setup({ reduced: true });
  assert.equal(off.layer.hidden, true); assert.equal(off.frames.size, 0); assert.equal(off.toggle.getAttribute('aria-pressed'), 'false');
  const on = setup({ reduced: true, saved: 'on' });
  assert.equal(on.layer.hidden, false); assert.equal(on.frames.size, 0); assert.ok(on.canvas.calls.fillText > 0, 'static frame drawn');
});

test('footer toggle persists the choice and stops the loop; the terminal event also toggles', () => {
  const f = setup();
  assert.match(f.toggle.textContent, /Code rain: on/); assert.equal(f.toggle.getAttribute('aria-pressed'), 'true');
  f.toggle.emit('click');
  assert.equal(f.store.get('geek-matrix-background'), 'off'); assert.equal(f.frames.size, 0); assert.equal(f.layer.hidden, true);
  assert.match(f.toggle.textContent, /off/);
  f.document.dispatchEvent(new CustomEvent('geek:matrix-toggle', { detail: { on: true } }));
  assert.equal(f.store.get('geek-matrix-background'), 'on'); assert.equal(f.frames.size, 1); assert.equal(f.layer.hidden, false);
  assert.equal(setup({ saved: 'off' }).frames.size, 0);
});

test('hidden tabs, quiz routes and active games never animate', () => {
  assert.equal(setup({ hidden: true }).frames.size, 0);
  for (const path of ['/play/', '/practice/', '/quest/', '/duel/', '/royale/', '/memory/']) {
    const f = setup({ path });
    assert.equal(f.frames.size, 0, path); assert.ok(f.layer.classList.contains('kaspa-matrix--quiet'), path);
  }
  const playing = setup({ playing: true });
  assert.equal(playing.frames.size, 0); assert.ok(playing.layer.classList.contains('kaspa-matrix--quiet'));
  playing.body.classList.remove('is-playing');
  [...playing.timers.values()].at(-1).fn();
  assert.equal(playing.frames.size, 1, 'resumes after play ends');
  const f = setup(); f.document.hidden = true; f.document.dispatchEvent({ type: 'visibilitychange' });
  assert.equal(f.frames.size, 0, 'pauses on visibilitychange');
});

test('the Stray signal terminal can toggle code rain', () => {
  const egg = readFileSync(new URL('../public/assets/easter-eggs.js', import.meta.url), 'utf8');
  assert.match(egg, /geek:matrix-toggle/);
  assert.match(egg, /matrix,/);
});
