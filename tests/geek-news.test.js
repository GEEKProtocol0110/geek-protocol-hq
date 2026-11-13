import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clientFixture } from './helpers/client-fixture.js';
const source = readFileSync('public/news/assets/news.js', 'utf8');
function setup() {
  const f = clientFixture(() => { throw new Error('News must not fetch through the account origin'); }, { location: { href: 'https://example.test/news/?feed=https://attacker.test/#private', search: '?feed=https://attacker.test/', pathname: '/news/' } });
  const heading = f.node('[data-news-heading]');
  const description = f.node('[data-news-description]');
  const sourceLink = f.node('[data-news-source]', 'a');
  const host = f.node('[data-news-feed]');
  const status = f.node('[data-news-status]');
  const pause = f.node('[data-news-pause]', 'button'); pause.hidden = true;
  const buttons = Object.fromEntries(['top100', 'overview', 'markets', 'stocks', 'forex', 'commodities', 'bonds', 'macrofutures', 'crypto', 'world', 'futures', 'https://attacker.test/'].map(key => [key, f.node(`[data-news-panel="${key}"]`, 'button')]));
  f.run(source); return { f, host, status, pause, buttons, heading, description, sourceLink };
}
const payload = frame => JSON.parse(decodeURIComponent(new URL(frame.src).hash.slice(1)));
test('news isolates provider content and uses one fixed feed, never account or query-string data', async () => {
  const x = setup();
  assert.equal(x.host.children.length, 1);
  const first = x.host.children[0], url = new URL(first.src);
  assert.equal(url.origin, 'https://www.tradingview-widget.com');
  assert.equal(url.pathname, '/embed-widget/market-quotes/');
  assert.equal(first.getAttribute('sandbox'), 'allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  assert.equal(first.getAttribute('referrerpolicy'), 'no-referrer');
  assert.ok(payload(first).symbolsGroups[0].symbols.some(s => s.name === 'FOREXCOM:SPXUSD'));
  assert.doesNotMatch(first.src, /example|attacker|private/);
  await x.buttons['https://attacker.test/'].emit('click'); assert.equal(x.host.children[0], first);
  await x.buttons.overview.emit('click'); assert.equal(x.host.children[0], first);
  await x.buttons.futures.emit('click');
  assert.equal(x.host.children.length, 1); assert.notEqual(x.host.children[0], first);
  const symbols = payload(x.host.children[0]).symbolsGroups[0].symbols;
  assert.equal(symbols.length, 4); assert.ok(symbols.every(s => s.name.endsWith('USDT.P')));
  assert.equal(x.buttons.markets.getAttribute('aria-pressed'), 'false');
  assert.equal(x.buttons.futures.getAttribute('aria-pressed'), 'true');
});
test('pause disconnects the feed; resume and news changes reconnect without a fabricated live state', async () => {
  const x = setup();
  await x.pause.emit('click');
  assert.equal(x.host.children.length, 0); assert.equal(x.pause.textContent, 'Resume feed');
  assert.match(x.status.textContent, /paused/);
  await x.pause.emit('click'); assert.equal(x.host.children.length, 1);
  await x.buttons.crypto.emit('click');
  assert.equal(new URL(x.host.children[0].src).searchParams.get('market'), 'crypto');
  assert.match(x.host.children[0].title, /Crypto news/);
  await x.buttons.world.emit('click');
  assert.equal(new URL(x.host.children[0].src).searchParams.get('market'), null);
  assert.match(x.host.children[0].title, /Global market/);
  await x.host.children[0].emit('load');
  assert.match(x.status.textContent, /may be delayed/);
  assert.doesNotMatch(x.status.textContent, /verified|connected|up.to.date|live now/i);
});
test('news permits only the provider frame; other pages keep their existing strict policy', () => {
  const config = JSON.parse(readFileSync('vercel.json', 'utf8'));
  const baseline = config.headers.find(h => h.source === '/((?!news(?:/|$)).*)');
  const news = config.headers.find(h => h.source === '/news/:path*');
  assert.deepEqual(config.headers.find(h => h.source === '/news/').headers, news.headers, 'the trailing-slash document needs an explicit deployed header rule');
  const csp = h => h.headers.find(v => v.key === 'Content-Security-Policy').value;
  assert.equal(csp(news), csp(baseline).replace('frame-src https://kgi.kaspad.net;', 'frame-src https://www.tradingview-widget.com;'));
  for (const path of ['/news', '/news/', '/news/assets/news.js']) assert.equal(new RegExp(`^${baseline.source}$`).test(path), false);
  for (const path of ['/', '/profile/', '/sign-in/', '/api/session', '/newsletter/']) assert.equal(new RegExp(`^${baseline.source}$`).test(path), true);
  assert.doesNotMatch(csp(news), /unsafe-inline|unsafe-eval|\*|script-src[^;]*https:/);
  const html = readFileSync('public/news/index.html', 'utf8');
  assert.doesNotMatch(html, /<script[^>]*src="https:/);
  assert.match(html, /data-coverage/); assert.match(html, /privacy-policy/);
  assert.match(readFileSync('public/index.html','utf8'), /href="\/news\/"/);
});

test('market desk covers world benchmarks and distinct asset classes with matching native controls', async () => {
  const x = setup();
  const required = {
    overview: ['FOREXCOM:SPXUSD', 'INDEX:DEU40', 'INDEX:NKY'],
    markets: ['KRAKEN:KASUSD', 'KRAKEN:BTCUSD', 'KRAKEN:LINKUSD'],
    stocks: ['NASDAQ:AAPL', 'NASDAQ:NVDA', 'NYSE:JPM', 'NYSE:XOM'],
    forex: ['FX:EURUSD', 'FX:USDJPY', 'FX:USDCAD'],
    commodities: ['OANDA:XAUUSD', 'OANDA:XAGUSD', 'NYMEX:CL1!'],
    bonds: ['TVC:US02Y', 'TVC:DE10Y', 'TVC:JP10Y'],
    macrofutures: ['CME_MINI:ES1!', 'COMEX:GC1!', 'CBOT:ZN1!'],
    futures: ['BINANCE:KASUSDT.P', 'BINANCE:BTCUSDT.P']
  };
  const html = readFileSync('public/news/index.html', 'utf8');
  for (const [key, symbols] of Object.entries(required)) {
    await x.buttons[key].emit('click');
    assert.equal(x.host.children.length, 1);
    const config = payload(x.host.children[0]);
    const actual = config.symbolsGroups.flatMap(g => g.symbols.map(s => s.name));
    for (const symbol of symbols) assert.ok(actual.includes(symbol), `${key}: ${symbol}`);
    assert.match(html, new RegExp(`data-news-panel="${key}"`));
    assert.ok(x.heading.textContent.length > 0);
    assert.ok(x.description.textContent.length > 20);
    assert.equal(new URL(x.sourceLink.href).origin, 'https://www.tradingview.com');
    await x.pause.emit('click'); assert.equal(x.host.children.length, 0);
    await x.pause.emit('click'); assert.equal(x.host.children.length, 1);
  }
  await x.buttons.markets.emit('click');
  assert.equal(payload(x.host.children[0]).symbolsGroups[0].symbols.length, 8);
  assert.match(html, /broker quotes/);
  assert.match(source, /yields in percent, not bond prices/);
  assert.match(source, /Continuous front-contract series/);
});

test('top 100 selection replaces the frame and cancels its request on pause or view change', async () => {
  const x = setup(); let options;
  x.f.window.GeekCrypto100 = value => { options = value; };
  await x.buttons.top100.emit('click');
  assert.equal(x.host.children.length, 0); assert.equal(options.signal.aborted, false);
  await x.pause.emit('click'); assert.equal(options.signal.aborted, true);
  await x.pause.emit('click'); assert.equal(options.signal.aborted, false);
  await x.buttons.stocks.emit('click'); assert.equal(options.signal.aborted, true);
  assert.equal(x.host.children.length, 1);
});
