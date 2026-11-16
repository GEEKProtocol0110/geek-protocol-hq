import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { encodeQr, qrSvg } from '../public/support/assets/qr.js';
import { isKaspaAddress, setupSupport, PENDING_ADDRESS } from '../public/support/assets/support.js';

const TIP = 'kaspa:qph2ze987szljrmkscymvjk03gh0ncwj7s73a4rgcmcaf5qdmrjguxf54pf42';
const PAYOUT = 'kaspa:qql9hrch8rqk62ywncjmm4y3qr6dv0d8r0vvu8q7382ccawlwz50xqu0e3gvs';
const html = readFileSync('public/support/index.html', 'utf8');
const files = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(`${dir}/${e.name}`) : [`${dir}/${e.name}`]);
const rows = q => q.modules.map(r => r.map(c => c ? 1 : 0).join('')).join('\n');

test('the tip address is defined once, in the data-tip-address attribute, and the payout wallet appears nowhere public', () => {
  assert.equal(html.split(TIP).length - 1, 1);
  assert.match(html, new RegExp(`data-tip data-tip-address="${TIP}"`));
  assert.equal(isKaspaAddress(TIP), true);
  assert.ok(TIP !== PAYOUT);
  for (const file of files('public')) if (/\.(html|js|css|json|svg|txt|xml|webmanifest)$/.test(file)) assert.ok(!readFileSync(file, 'utf8').includes(PAYOUT), file);
});

test('address validation needs the kaspa prefix and a valid checksum', () => {
  assert.equal(isKaspaAddress(PENDING_ADDRESS), false);
  assert.equal(isKaspaAddress(TIP.slice(0, -1) + '3'), false);
  assert.equal(isKaspaAddress(TIP.replace('kaspa:', 'kaspatest:')), false);
  assert.equal(isKaspaAddress(TIP.toUpperCase()), false);
  assert.equal(isKaspaAddress(` ${TIP}`), false);
});

test('the QR encoder reproduces the reference matrix for the tip address', () => {
  const q = encodeQr(TIP);
  assert.equal(q.version, 5); assert.equal(q.size, 37); assert.equal(q.mask, 2);
  // Matrix cross-checked module-for-module against an independent QR library for all eight masks.
  assert.equal(createHash('sha256').update(rows(q)).digest('hex'), 'b226191ac68258f1d75864d4e986be1d4ad6f16c9e4f0f2e01b520219b990e5c');
  for (const [x, y] of [[0, 0], [q.size - 7, 0], [0, q.size - 7]]) assert.equal(q.modules[y].slice(x, x + 7).join(), Array(7).fill(true).join());
  assert.equal(q.modules[q.size - 8][8], true, 'dark module');
  assert.match(qrSvg(TIP), /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 45 45"/);
  assert.throws(() => encodeQr('x'.repeat(3000)), RangeError);
});

const fakeDocument = address => {
  const el = (attrs = {}) => ({ hidden: false, disabled: false, value: '', textContent: '', src: '', alt: '', dataset: {}, events: {}, ...attrs,
    addEventListener(name, fn) { this.events[name] = fn; }, getAttribute(name) { return this.attrs?.[name] ?? null; }, focus() { this.focused = true; }, select() { this.selected = true; } });
  const parts = { '[data-tip-field]': el(), '[data-tip-copy]': el({ disabled: true }), '[data-tip-qr]': el({ hidden: true }), '[data-tip-status]': el(), '[data-tip-pending]': el(), '[data-tip-ready]': el({ hidden: true }) };
  const root = el({ dataset: { tipAddress: address }, querySelector: s => parts[s] });
  const sponsors = [el({ attrs: { href: '' }, hidden: true }), el({ attrs: { href: 'https://github.com/sponsors/example' }, hidden: true })];
  return { parts, root, sponsors, doc: { querySelector: s => s === '[data-tip]' ? root : null, querySelectorAll: () => sponsors } };
};

test('with the real address the copy button and QR are enabled and use the exact string', async () => {
  const f = fakeDocument(TIP), written = [];
  setupSupport(f.doc, { clipboard: { writeText: async text => { written.push(text); } } });
  assert.equal(f.root.dataset.tipState, 'ready');
  assert.equal(f.parts['[data-tip-field]'].value, TIP);
  assert.equal(f.parts['[data-tip-copy]'].disabled, false);
  assert.equal(f.parts['[data-tip-pending]'].hidden, true); assert.equal(f.parts['[data-tip-ready]'].hidden, false);
  const qr = f.parts['[data-tip-qr]'];
  assert.equal(qr.hidden, false); assert.equal(decodeURIComponent(qr.src.replace('data:image/svg+xml,', '')), qrSvg(TIP));
  await f.parts['[data-tip-copy]'].events.click();
  assert.deepEqual(written, [TIP]);
  assert.match(f.parts['[data-tip-status]'].textContent, /^Full address copied/);
});

test('a denied clipboard selects the address instead of claiming success', async () => {
  const f = fakeDocument(TIP);
  setupSupport(f.doc, { clipboard: { writeText: async () => { throw new Error('Denied'); } } });
  await f.parts['[data-tip-copy]'].events.click();
  assert.equal(f.parts['[data-tip-field]'].selected, true);
  assert.match(f.parts['[data-tip-status]'].textContent, /^Address selected/);
});

test('the placeholder or an invalid address shows the coming-soon state with no copy and no QR', () => {
  for (const address of [PENDING_ADDRESS, '', TIP.slice(0, -1) + '3']) {
    const f = fakeDocument(address); setupSupport(f.doc, {});
    assert.equal(f.root.dataset.tipState, 'pending');
    assert.equal(f.parts['[data-tip-copy]'].disabled, true);
    assert.equal(f.parts['[data-tip-qr]'].hidden, true); assert.equal(f.parts['[data-tip-qr]'].src, '');
    assert.equal(f.parts['[data-tip-field]'].value, '');
    assert.equal(f.parts['[data-tip-pending]'].hidden, false);
  }
});

test('sponsor buttons stay hidden until they have an https link', () => {
  const f = fakeDocument(TIP); setupSupport(f.doc, {});
  assert.deepEqual(f.sponsors.map(s => s.hidden), [true, false]);
  assert.equal((html.match(/data-sponsor-link hidden/g) || []).length, 2);
  assert.equal((html.match(/href="" target="_blank" rel="noopener noreferrer" data-sponsor-link/g) || []).length, 2);
});

test('support page uses only same-origin scripts, honest copy and the shared footer link', () => {
  assert.ok(![...html.matchAll(/<script\b([^>]*)>/g)].some(m => !/\bsrc="\/(?:assets|support\/assets)\//.test(m[1])), 'no inline or external scripts');
  assert.match(html, /<a href="https:\/\/x\.com\/geekonkas">@geekonkas<\/a>/);
  assert.match(html, /not an investment or a token purchase, and nobody receives \$GEEK/);
  assert.doesNotMatch(html, /mint proceeds|guaranteed|to the moon/i);
  for (const file of files('public').filter(f => f.endsWith('index.html'))) {
    const page = readFileSync(file, 'utf8'), footer = page.match(/<footer class="site-footer[\s\S]*?<\/footer>/)?.[0];
    if (footer) assert.match(footer, /<a href="\/support\/">Support<\/a>/, file);
  }
});
