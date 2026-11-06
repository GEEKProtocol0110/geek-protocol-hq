import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createCryptoMarkets, normalizeMarkets, marketHandler } from '../server/crypto-markets.js';
import { clientFixture, deferred } from './helpers/client-fixture.js';
const rows = () => Array.from({ length: 100 }, (_, i) => ({ id: 'coin-' + i, name: 'Coin ' + i, symbol: 'c' + i, market_cap: 1e9 - i * 1e6, current_price: i === 0 ? 0 : 2, total_volume: 0, price_change_percentage_24h: i === 0 ? 0 : -1, last_updated: '2026-11-06T16:00:00Z' }));
const source = readFileSync('public/news/assets/crypto100.js', 'utf8');
test('rankings require 100 distinct valid coins and preserve zero/missing data', () => {
  const input = rows(); input[1].current_price = null;
  const data = normalizeMarkets(input.reverse(), 1000);
  assert.equal(data.coins.length, 100); assert.equal(data.coins[0].rank, 1);
  assert.equal(data.coins[0].price, 0); assert.equal(data.coins[0].change24h, 0);
  assert.equal(data.coins[1].price, null);
  for (const bad of [rows().slice(1), [...rows().slice(1), rows()[1]], rows().map((r,i) => i ? r : {...r, market_cap: null})]) assert.throws(() => normalizeMarkets(bad, 1000));
});
test('one fixed upstream is cached, concurrent requests coalesce and failures back off', async () => {
  let calls = 0, time = 1000; const wait = deferred();
  const provider = createCryptoMarkets(async (url, options) => { calls++; assert.equal(new URL(url).hostname, 'api.coingecko.com'); assert.equal(new URL(url).searchParams.get('per_page'), '100'); assert.equal(options.redirect, 'error'); await wait.promise; return Response.json(rows()); }, () => time);
  const a = provider.latest(), b = provider.latest(); wait.resolve();
  await Promise.all([a,b]); assert.equal(calls, 1); await provider.latest(); assert.equal(calls, 1);
  time += 300001; await provider.latest(); assert.equal(calls, 2);
  calls = 0; const failed = createCryptoMarkets(async () => { calls++; return new Response('', {status:429}); }, () => time);
  await assert.rejects(failed.latest()); await assert.rejects(failed.latest()); assert.equal(calls, 1);
  time += 15001; await assert.rejects(failed.latest()); assert.equal(calls, 2);
});
test('public market service rejects mutation methods and failures never fabricate a ranking', async () => {
  let contacted = false, code, result; const headers = {};
  const res = {setHeader(k,v) {headers[k]=v;},status(n) {code=n;return this;},json(v) {result=v;},end() {}};
  const handler = marketHandler({latest() { contacted=true; throw new Error('offline'); }});
  await handler({method:'POST'},res); assert.equal(code,405); assert.equal(contacted,false);
  await handler({method:'GET'},res); assert.equal(code,503); assert.equal(result.available,false);
  assert.match(headers['Cache-Control'],/s-maxage=15/);
});
test('native table renders 100 rows, filters coins locally, preserves zeros and uses text-safe names', async () => {
  let calls=0; const data=normalizeMarkets(rows(),Date.now()); data.coins[0].name='<img src=x onerror=alert(1)>';
  const f=clientFixture(async (url,options) => {calls++;assert.equal(url,'/api/widget?service=markets');assert.equal(options.credentials,'omit');return Response.json(data);});
  f.run(source); const host=f.node('#host'),status=f.node('#status'); const control=new AbortController();
  await f.window.GeekCrypto100({host,status,signal:control.signal});
  const body=host.querySelector('tbody'); assert.equal(body.children.length,100);
  assert.equal(body.children[0].children[2].textContent,'$0.00');
  assert.equal(body.children[0].children[3].textContent,'0.00%');
  assert.equal(host.querySelectorAll('img').length,0);
  const search=host.querySelector('input'); search.value='c99';await search.emit('input');
  assert.equal(body.children.length,1);assert.equal(body.children[0].children[0].textContent,'100');assert.equal(calls,1);
  search.value='not-a-coin';await search.emit('input');assert.equal(body.children.length,0);
});
test('switching away prevents late table/error insertion; unavailable data has a native source link', async () => {
  const wait=deferred(); const f=clientFixture(() => wait.promise);f.run(source);
  const host=f.node('#host'),status=f.node('#status'),control=new AbortController();
  const pending=f.window.GeekCrypto100({host,status,signal:control.signal});control.abort();host.replaceChildren(f.make('iframe'));
  wait.resolve(Response.json(normalizeMarkets(rows(),Date.now())));await pending;
  assert.equal(host.children[0].tagName,'IFRAME');
  const bad=clientFixture(async () => new Response('',{status:503}));bad.run(source);
  const h=bad.node('#host'); await bad.window.GeekCrypto100({host:h,status:bad.node('#status'),signal:new AbortController().signal});
  assert.equal(h.querySelector('a').href,'https://www.coingecko.com/');assert.equal(h.querySelector('table'),null);
});
