import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Execute the shipped canvas loop, observing frames and draw calls rather than CSS text.
const fixture = ({ reduced = false, saveData = false, styled = true } = {}) => {
  const frames = new Map(), events = new Map(), windowEvents = new Map(), created = [];
  let next = 0, draws = 0;
  const context = { clearRect() { draws++; }, beginPath() {}, arc() {}, fill() {}, stroke() {}, moveTo() {}, lineTo() {}, setTransform() {}, createLinearGradient() { return { addColorStop() {} }; } };
  const host = { classList: { add() {} }, prepend() {}, getBoundingClientRect: () => ({ width: 900, height: 400 }) };
  const media = { matches: reduced, addEventListener() {} };
  const document = { documentElement: {}, hidden: false, body: { classList: { toggle() {} } },
    querySelector: () => null, querySelectorAll: selector => selector.startsWith('.hero,') ? [host] : [],
    createElement: tag => { created.push(tag); return { getContext: () => context, setAttribute() {} }; },
    addEventListener: (name, fn) => events.set(name, fn) };
  const window = { getComputedStyle:()=>({getPropertyValue:()=>styled?'1':''}), scrollY: 0, devicePixelRatio: 1, matchMedia: () => media, addEventListener: (name, fn) => windowEvents.set(name, fn) };
  runInNewContext(readFileSync(new URL('../public/assets/site.js', import.meta.url), 'utf8'), {
    document, window, navigator: { connection: { saveData } },
    requestAnimationFrame: fn => { const id = ++next; frames.set(id, fn); return id; },
    cancelAnimationFrame: id => frames.delete(id)
  }, { importModuleDynamically: () => Promise.reject(new Error('Shared-module loading is outside this canvas fixture')) });
  const tick = time => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time)); };
  return { frames, created, tick, document, events, windowEvents, get draws() { return draws; } };
};

test('the shipped space loop ends its entrance without a motion button or an ongoing frame queue', () => {
  const ui = fixture(); assert.deepEqual(ui.created, ['canvas']);
  for (let i = 1; i < 90; i++) ui.tick(i * 100);
  assert.ok(ui.draws > 1); assert.equal(ui.frames.size, 0);
  const final = ui.draws;
  ui.windowEvents.get('pageshow')(); ui.tick(10000);
  assert.equal(ui.draws, final); assert.equal(ui.frames.size, 0);
});

test('reduced motion and data saver draw static stars without scheduling animation', () => {
  for (const settings of [{ reduced: true }, { saveData: true }]) {
    const ui = fixture(settings);
    assert.equal(ui.draws, 1); assert.equal(ui.frames.size, 0); assert.deepEqual(ui.created, ['canvas']);
  }
});

test('hidden pages stop the frame queue and resume only the remaining entrance time', () => {
  const ui = fixture(); ui.tick(100); ui.tick(200);
  ui.document.hidden = true; ui.events.get('visibilitychange')();
  const before = ui.draws; assert.equal(ui.frames.size, 0); ui.tick(1000); assert.equal(ui.draws, before);
  ui.document.hidden = false; ui.events.get('visibilitychange')(); assert.equal(ui.frames.size, 1);
  for (let i = 1; i < 90; i++) ui.tick(1000 + i * 100);
  assert.equal(ui.frames.size, 0); assert.ok(ui.draws > before);
});

test('missing canvas styles leave the document untouched instead of inserting a layout-sized canvas',()=>{const ui=fixture({styled:false});assert.deepEqual(ui.created,[]);assert.equal(ui.frames.size,0);ui.windowEvents.get('load')();assert.deepEqual(ui.created,[]);});
