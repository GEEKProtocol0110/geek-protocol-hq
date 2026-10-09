import { runInNewContext } from 'node:vm';

// Minimal synthetic DOM, event and timer fixture for executing shipped clients.
// It checks behavior; it does not claim real-browser rendering or phone QA.
export const clientFixture = (fetch, extra = {}) => {
  const elements = new Set(), roots = new Map(), timers = new Map(); let timerId = 0;
  const dataKey = name => name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
  const matches = (el, selector) => {
    if (selector === ':focus') return document.activeElement === el;
    if (selector.includes(' ')) {
      const split = selector.lastIndexOf(' ');
      return matches(el, selector.slice(split + 1)) && Boolean(el.closest(selector.slice(0, split)));
    }
    if (selector.startsWith('#')) return el.id === selector.slice(1);
    if (selector.startsWith('[')) {
      const [, name, value] = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || [];
      const actual = name?.startsWith('data-') ? el.dataset[dataKey(name)] : name === 'value' ? el.value : el.attributes.get(name);
      return actual !== undefined && (value === undefined || String(actual) === value);
    }
    return el.tagName === selector.toUpperCase();
  };
  const make = (tag = 'div') => {
    const el = { tagName: tag.toUpperCase(), dataset: {}, attributes: new Map(), events: new Map(), children: [], parent: null,
      textContent: '', innerHTML: '', value: '', checked: false, disabled: false, hidden: false, elements: {},
      style: { setProperty() {} }, classList: { toggle() {} },
      addEventListener(name, handler) { const handlers = this.events.get(name) || []; this.events.set(name, [...handlers, handler]); },
      async emit(name, detail = {}) { for (const handler of this.events.get(name) || []) await handler({ currentTarget: this, target: this, preventDefault() {}, ...detail }); },
      setAttribute(name, value) { this.attributes.set(name, String(value)); }, getAttribute(name) { return this.attributes.get(name) ?? null; },
      hasAttribute(name) { return this.attributes.has(name); }, removeAttribute(name) { this.attributes.delete(name); },
      matches(selector) { return matches(this, selector); },
      closest(selector) { for (let n = this; n; n = n.parent) if (matches(n, selector)) return n; return null; },
      append(...items) { for (const child of items) { child.parent = this; this.children.push(child); } },
      replaceChildren(...items) { this.children = []; this.append(...items); },
      querySelectorAll(selector) { return [...elements].filter(n => selector.split(',').some(s => matches(n, s.trim())) && n !== this && (() => { for (let p = n.parent; p; p = p.parent) if (p === this) return true; return false; })()); },
      querySelector(selector) { return this.querySelectorAll(selector)[0] || null; },
      focus() { document.activeElement = this; }, scrollIntoView(options) { this.scrolled = options; },
      showModal() { this.open = true; }, close() { this.open = false; }, select() {},
    };
    elements.add(el); return el;
  };
  const node = (selector, tag = 'div') => {
    if (roots.has(selector)) return roots.get(selector);
    const found = [...elements].find(el => matches(el, selector));
    if (found) return found;
    const el = make(tag);
    if (selector.startsWith('#')) el.id = selector.slice(1);
    else if (selector.startsWith('[')) {
      const [, name, value] = selector.match(/^\[([^=\]]+)(?:="([^"]*)")?\]$/) || [];
      if (name?.startsWith('data-')) el.dataset[dataKey(name)] = value ?? '';
      else if (name) el.attributes.set(name, value ?? '');
    }
    roots.set(selector, el); return el;
  };
  const document = { hidden: false, activeElement: null, querySelector: node,
    querySelectorAll: selector => [...elements].filter(el => selector.split(',').some(s => matches(el, s.trim()))),
    createElement: make, addEventListener: (...args) => docEvents.addEventListener(...args) };
  const window = make('window'), docEvents = make('document');
  window.dispatchEvent = event => { for (const handler of window.events.get(event.type) || []) handler(event); };
  const context = { document, window, location: { href: 'https://example.test/royale/', pathname: '/royale/', search: '' },
    history: { replaceState() {} }, navigator: {}, performance: { now: () => 100 }, fetch,
    URL, URLSearchParams, AbortController, Intl, Date, Event, CustomEvent, confirm: () => true,
    setTimeout(fn, delay) { const id = ++timerId; timers.set(id, { fn, delay }); return id; }, clearTimeout(id) { timers.delete(id); },
    setInterval() {}, ...extra };
  return { node, make, window, document, context, timers,
    run(source) { runInNewContext(source, context); },
    expire(delay = 15000) { const item = [...timers.values()].filter(t => t.delay === delay).at(-1); if (!item) throw new Error(`No ${delay}ms request deadline`); item.fn(); },
  };
};

export const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
export const aborted = signal => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('Stalled connection')), { once: true }));
export const json = (payload, status = 200) => new Response(JSON.stringify(payload), { status });
