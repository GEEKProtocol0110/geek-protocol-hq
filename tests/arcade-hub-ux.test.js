import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const cfg = JSON.parse(readFileSync('vercel.json', 'utf8'));
const site = JSON.parse(readFileSync('docs/site-pages.json', 'utf8'));
const hub = readFileSync('public/games/assets/hub.css', 'utf8');
const mint = readFileSync('public/mint/assets/mint.css', 'utf8');
const lounge = readFileSync('public/games/online/online.css', 'utf8');

test('retired /games/preview/ concept permanently redirects to the real Games hub', () => {
  for (const source of ['/games/preview', '/games/preview/', '/games/preview/:path*']) {
    const rule = cfg.redirects.find(r => r.source === source);
    assert.ok(rule, `${source} redirect exists`);
    assert.equal(rule.destination, '/games/');
    assert.equal(rule.permanent, true);
    assert.equal(rule.has, undefined);
  }
  assert.equal(existsSync('public/games/preview'), false, 'stale mockup files are removed');
  assert.ok(!site.pages.some(p => p.path.startsWith('/games/preview')), 'no site-pages entry for the retired route');
});

test('hub phone layout sizes art and the tilted board relative to their containers', () => {
  assert.match(hub, /\.hub-board-scene\{[^}]*overflow:clip[^}]*contain:paint/);
  assert.match(hub, /\.hub-chessboard\{[^}]*width:min\(78%,285px\)/);
  assert.match(hub, /@media\(max-width:600px\)\{[^\n]*\.hub-chessboard\{width:min\(190px,74%\)/);
  assert.match(hub, /\.hub-art-tower span\{max-width:100%/);
  assert.match(hub, /@media\(max-width:600px\)\{[^\n]*\.hub-art-tower span:nth-child\(3\)\{width:min\(112px,76%\)\}/);
  assert.doesNotMatch(hub, /\.hub-chessboard\{width:(190|230)px/);
});

test('disabled mint history Clear button is visibly dimmed', () => {
  assert.match(mint, /\.mint-history button:is\(:disabled,\[aria-disabled=true\]\)\{[^}]*opacity:\.5[^}]*cursor:not-allowed/);
});

test('lounge alert note and public lobby heading are not flush with the controls above', () => {
  assert.match(lounge, /#browse #push-alert-note\{margin-top:\.75rem\}/);
  assert.match(lounge, /#browse \.online-columns\+h3\{margin-top:2rem\}/);
});
