import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../public/assets/analytics.js', import.meta.url), 'utf8');
const boot = (url = 'https://www.geekprotocol.xyz/study/?wallet=private#answer', privacy = {}, existing = false) => {
  const scripts = [], location = new URL(url), navigator = { ...privacy }, window = {};
  const context = vm.createContext({ URL, location, navigator, window, document: {
    getElementById: () => existing,
    createElement: () => ({}),
    head: { append: script => scripts.push(script) }
  } });
  vm.runInContext(source, context);
  const filter = window.vaq?.find(args => args[0] === 'beforeSend')?.[1];
  return { window, navigator, scripts, filter, repeat: () => vm.runInContext(source, context) };
};
const plain = value => JSON.parse(JSON.stringify(value));

test('analytics excludes previews, private pages and browser privacy preferences', () => {
  for (const [url, privacy, existing] of [
    ['https://preview.vercel.app/study/', {}], ['http://localhost/study/', {}],
    ['https://www.geekprotocol.xyz/moderate/', {}], ['https://www.geekprotocol.xyz/unknown/', {}],
    ['https://www.geekprotocol.xyz/study/', { doNotTrack: '1' }],
    ['https://www.geekprotocol.xyz/study/', { globalPrivacyControl: true }],
    ['https://www.geekprotocol.xyz/study/', {}, true]
  ]) {
    const app = boot(url, privacy, existing);
    assert.equal(app.scripts.length, 0);
    assert.equal(app.window.GeekAnalytics, undefined);
  }
});

test('the provider boundary strips private fields and accepts only route-appropriate categories', () => {
  const app = boot(), url = 'https://www.geekprotocol.xyz/study/index.html?wallet=private#answer';
  const extra = { wallet: 'kaspa:secret', answers: ['private'], playerId: 'private', runId: 'private', score: 5 };
  assert.deepEqual(plain(app.filter({ type: 'pageview', url, payload: extra })), { type: 'pageview', url: 'https://www.geekprotocol.xyz/study/' });
  assert.deepEqual(plain(app.filter({ type: 'event', url, payload: { name: 'Practice completed', data: { mode: 'study', topic: 'origins', level: 'foundations', ...extra } }, __cdp: extra })), {
    type: 'event', url: 'https://www.geekprotocol.xyz/study/', payload: { name: 'Practice completed', data: { mode: 'study', topic: 'origins', level: 'foundations' } }
  });
  for (const event of [
    { type: 'identify', url },
    { type: 'event', url, payload: { name: 'Unknown', data: extra } },
    { type: 'event', url, payload: { name: 'Practice completed', data: { mode: 'study', topic: 'private', level: 'foundations' } } },
    { type: 'event', url, payload: { name: 'Free lifeline used', data: { item: 'fifty-fifty' } } },
    { type: 'event', url, payload: { name: 'Giga choice selected', data: { surface: 'home', choice: 'start' } } },
    { type: 'event', url, payload: null },
    ...['https://foreign.test/study/', 'https://www.geekprotocol.xyz/moderate/', 'http://www.geekprotocol.xyz/study/', 'https://private@www.geekprotocol.xyz/study/', 'https://www.geekprotocol.xyz:8000/study/', 'malformed'].map(url => ({ type: 'pageview', url }))
  ]) assert.equal(app.filter(event), null);
  app.navigator.globalPrivacyControl = true;
  assert.equal(app.filter({ type: 'pageview', url }), null);
});

test('supported learning calls queue safely before the SDK loads, with no arbitrary metadata', () => {
  for (const [path, name, data] of [
    ['/study/', 'Lesson walkthrough completed', { topic: 'origins' }],
    ['/study/', 'Practice started', { mode: 'study', topic: 'tokens', level: 'connections' }],
    ['/study/', 'Practice completed', { mode: 'study', topic: 'wallets', level: 'mixed' }],
    ['/practice/', 'Practice started', { mode: 'assisted' }],
    ['/practice/', 'Practice completed', { mode: 'assisted' }],
    ['/practice/', 'Free lifeline used', { item: 'fifty-fifty' }],
    ['/practice/', 'Free lifeline used', { item: 'extra-time' }],
    ['/', 'Giga choice selected', { surface: 'home', choice: 'start' }],
    ['/study/', 'Giga choice selected', { surface: 'study-welcome', choice: 'understand' }],
    ['/profile/', 'Giga choice selected', { surface: 'progress', choice: 'review' }]
  ]) {
    const app = boot('https://geekprotocol.xyz' + path);
    app.window.GeekAnalytics.track(name, { ...data, answer: 'private' });
    assert.equal(app.window.vaq.length, 2);
    assert.deepEqual(plain([...app.window.vaq[1]]), ['event', { name, data }]);
    assert.equal(app.scripts.length, 1);
  }
});

test('invalid calls and a failing provider cannot interrupt learning', () => {
  const app = boot();
  for (const data of [null, [], { topic: 'private' }]) app.window.GeekAnalytics.track('Lesson walkthrough completed', data);
  assert.equal(app.window.vaq.length, 1);
  app.window.va = () => { throw Error('Analytics unavailable'); };
  assert.doesNotThrow(() => app.window.GeekAnalytics.track('Lesson walkthrough completed', { topic: 'origins' }));
  app.navigator.doNotTrack = '1';
  app.window.va = () => assert.fail('Privacy preference must suppress events');
  assert.doesNotThrow(() => app.window.GeekAnalytics.track('Lesson walkthrough completed', { topic: 'origins' }));
});
