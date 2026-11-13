import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { holidayById } from '../public/assets/holiday-calendar.js';

const source = [
  readFileSync(new URL('../public/assets/holiday-marks.js', import.meta.url), 'utf8').replace('export const holidayMark', 'globalThis.holidayMark'),
  readFileSync(new URL('../public/assets/holiday-theme.js', import.meta.url), 'utf8').replace(/^import .*\n/gm, '').replace('export const initHolidayTheme', 'globalThis.initHolidayTheme')
].join('\n');

const matchSimple = (el, selector) => {
  let rest = selector.trim();
  const classes = [], attrs = [];
  while (rest) {
    if (rest.startsWith('.')) {
      const name = rest.slice(1).match(/^[^.[\]\s]+/)[0];
      classes.push(name);
      rest = rest.slice(name.length + 1);
    } else if (rest.startsWith('[')) {
      const match = rest.match(/^\[([^=\]]+)(?:="([^"]*)")?\]/);
      if (!match) return false;
      attrs.push([match[1], match[2]]);
      rest = rest.slice(match[0].length);
    } else {
      const tag = rest.match(/^[a-zA-Z0-9-]+/);
      if (!tag || el.tagName !== tag[0].toUpperCase()) return false;
      rest = rest.slice(tag[0].length);
    }
  }
  const names = String(el.className || '').split(/\s+/).filter(Boolean);
  return classes.every(name => names.includes(name)) && attrs.every(([name, value]) => el.attributes.get(name) !== undefined && (value === undefined || el.attributes.get(name) === value));
};
const matches = (el, selector) => {
  const parts = selector.trim().split(/\s+/);
  if (!matchSimple(el, parts.at(-1))) return false;
  let node = el.parent;
  for (let index = parts.length - 2; index >= 0; index -= 1) {
    while (node && !matchSimple(node, parts[index])) node = node.parent;
    if (!node) return false;
    node = node.parent;
  }
  return true;
};

const mount = async ({ pathname = '/', quiz = false, playing = false, payload = { ok: true, theme: { id: 'christmas' } }, fail = false } = {}) => {
  const elements = [];
  const make = tag => {
    const el = {
      tagName: tag.toUpperCase(), className: '', textContent: '', children: [], parent: null, dataset: {}, attributes: new Map(),
      style: {}, classList: { contains: name => String(el.className).split(/\s+/).includes(name) },
      setAttribute(name, value) { this.attributes.set(name, String(value)); },
      getAttribute(name) { return this.attributes.get(name) ?? null; },
      append(...kids) { for (const kid of kids) { kid.parent = this; this.children.push(kid); } },
      remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
    };
    elements.push(el);
    return el;
  };
  const connected = el => { let node = el; while (node) { if (node === document) return true; node = node.parent; } return false; };
  const queryAll = selector => elements.filter(el => connected(el) && selector.split(',').some(part => matches(el, part.trim())));
  const document = {
    hidden: false,
    addEventListener() {},
    dispatchEvent() {},
    createElement: make,
    createElementNS: () => make('svg'),
    querySelector: selector => queryAll(selector)[0] || null,
    querySelectorAll: queryAll
  };
  const root = make('html'), head = make('head'), body = make('body'), header = make('header'), brand = make('a');
  root.parent = document; head.parent = root; body.parent = root; root.children = [head, body];
  header.className = 'site-header'; brand.className = 'brand'; header.append(brand); body.append(header);
  body.className = playing ? 'is-playing' : '';
  if (quiz) { const screen = make('div'); screen.className = 'active'; screen.attributes.set('data-screen', 'quiz'); body.append(screen); }
  document.documentElement = root; document.head = head; document.body = body;
  const timers = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (fail) throw new Error('offline');
    return { ok: payload.ok !== false, json: async () => payload };
  };
  const context = {
    document, holidayById, location: { pathname }, Event, AbortController, Promise, Date,
    window: { addEventListener() {} },
    setTimeout(fn, delay) { const id = timers.length + 1; timers.push({ id, fn, delay, cleared: false }); return id; },
    clearTimeout(id) { const timer = timers.find(item => item.id === id); if (timer) timer.cleared = true; },
    fetchImpl
  };
  runInNewContext(source, context);
  context.initHolidayTheme({ fetchImpl });
  await new Promise(resolve => setTimeout(resolve, 0));
  return {
    calls: () => calls,
    timers,
    dataset: () => root.dataset.holidayTheme,
    greetings: () => queryAll('.holiday-greeting'),
    ornaments: () => queryAll('.holiday-atmosphere'),
    marks: () => queryAll('.holiday-brand-mark'),
    async again() { timers.filter(timer => timer.delay === 60_000 && !timer.cleared).at(-1).fn(); await new Promise(resolve => setTimeout(resolve, 0)); }
  };
};

test('an unknown id, a null theme, or a failed read leaves the standard page', async () => {
  for (const options of [{ payload: { ok: true, theme: { id: 'not-a-holiday' } } }, { payload: { ok: true, theme: null } }, { fail: true }]) {
    const page = await mount(options);
    assert.equal(page.dataset(), undefined);
    assert.equal(page.greetings().length, 0);
    assert.equal(page.ornaments().length, 0);
    assert.equal(page.marks().length, 0);
  }
});

test('a catalog holiday renders one greeting and twelve catalog motifs, and a repeat read does not duplicate them', async () => {
  const page = await mount();
  const holiday = holidayById('christmas');
  assert.equal(page.dataset(), 'christmas');
  assert.equal(page.greetings().length, 1);
  assert.equal(page.greetings()[0].textContent, holiday.greeting);
  assert.equal(page.greetings()[0].getAttribute('aria-hidden'), null);
  assert.equal(page.greetings()[0].textContent.includes(holiday.icon), false);
  assert.equal(page.ornaments().length, 1);
  assert.equal(page.ornaments()[0].getAttribute('aria-hidden'), 'true');
  assert.deepEqual(page.ornaments()[0].children.map(node => node.children[0].getAttribute('data-mark')), Array.from({ length: 12 }, (_, index) => holiday.marks[index % holiday.marks.length]));
  assert.equal(page.marks().length, 1);
  assert.equal(page.marks()[0].getAttribute('aria-hidden'), 'true');
  assert.equal(page.marks()[0].children[0].getAttribute('data-mark'), holiday.marks[0]);
  await page.again();
  assert.equal(page.calls(), 2);
  assert.equal(page.greetings().length, 1);
  assert.equal(page.ornaments().length, 1);
});

test('individual game routes and an active quiz do not receive edge ornaments', async () => {
  const board = await mount({ pathname: '/games/chess/' });
  assert.equal(board.dataset(), undefined);
  assert.equal(board.ornaments().length, 0);
  assert.equal(board.greetings().length, 0);
  const quiz = await mount({ quiz: true });
  assert.equal(quiz.dataset(), 'christmas');
  assert.equal(quiz.ornaments().length, 0);
  assert.equal(quiz.greetings().length, 1);
  const playing = await mount({ playing: true });
  assert.equal(playing.ornaments().length, 0);
});
