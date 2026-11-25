import test, { after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { redisFixture } from './helpers/redis-fixture.js';
import { rateLimit } from '../server/redis.js';

const fixture = await redisFixture(), originalFetch = globalThis.fetch;
process.env.UPSTASH_REDIS_REST_URL = 'https://redis.rate-limit.test';
process.env.UPSTASH_REDIS_REST_TOKEN = 'synthetic-rate-limit-fixture';
let mode = 'normal', reply, requests = 0;
globalThis.fetch = async (url, options) => {
  assert.ok(String(url).startsWith('https://redis.rate-limit.test'));
  requests++;
  const command = JSON.parse(options.body), batch = String(url).endsWith('/pipeline');
  if (mode === 'invalid-reply') return Response.json(batch ? [reply === undefined ? {} : { result: reply }, { result: 1 }] : reply === undefined ? {} : { result: reply });
  if (mode === 'rejected') {
    // Model the original split-command failure: INCR is accepted, expiry is not.
    // A rejected single EVAL executes neither part of the new transition.
    if (batch) await fixture.command(...command[0]);
    return Response.json({ error: 'synthetic provider rejected request' });
  }
  let payload;
  if (mode === 'deny-expire') {
    const run = async c => (await fixture.commands([['AUTH', 'rate-fixture', 'synthetic-fixture-only'], c])).at(-1);
    try { payload = batch ? await Promise.all(command.map(async c => ({ result: await run(c) }))) : { result: await run(command) }; }
    catch { return Response.json({ error: 'synthetic denied command' }); }
  } else payload = batch ? (await fixture.commands(command)).map(result => ({ result })) : { result: await fixture.command(...command) };
  if (mode === 'lost-ack') throw new Error('synthetic acknowledgment lost after execution');
  return Response.json(payload);
};
beforeEach(async () => { mode = 'normal'; reply = undefined; requests = 0; await fixture.command('FLUSHDB'); });
after(async () => { globalThis.fetch = originalFetch; await fixture.close(); });
const key = (scope = 'test', id = 'network') => `geek:rate:${scope}:${id}`;
const ttl = () => fixture.command('PTTL', key());

test('concurrent calls admit exactly the budget and retain one expiring counter', async () => {
  const result = await Promise.allSettled(Array.from({ length: 100 }, () => rateLimit('test', 'network', 7, 60)));
  assert.equal(result.filter(r => r.status === 'fulfilled').length, 7);
  assert.ok(result.filter(r => r.status === 'rejected').every(r => r.reason.message === 'RATE_LIMITED'));
  assert.equal(await fixture.command('GET', key()), '100');
  assert.ok(await ttl() > 0 && await ttl() <= 60_000);
  assert.equal(requests, 100);
});

test('allowed and rejected calls preserve the existing fixed-window expiry', async () => {
  await fixture.command('SET', key(), '1', 'PX', 2500);
  const before = await fixture.command('PEXPIRETIME', key());
  await rateLimit('test', 'network', 2, 60);
  await assert.rejects(rateLimit('test', 'network', 2, 60), /^Error: RATE_LIMITED$/);
  assert.equal(await fixture.command('GET', key()), '3');
  assert.equal(await fixture.command('PEXPIRETIME', key()), before);
});

test('legacy counters without an expiry are repaired without clearing their consumed budget', async () => {
  await fixture.command('SET', key(), '12');
  await assert.rejects(rateLimit('test', 'network', 3, 60), /^Error: RATE_LIMITED$/);
  assert.equal(await fixture.command('GET', key()), '13');
  assert.ok(await ttl() > 0 && await ttl() <= 60_000);
});

test('a rejected atomic write cannot leave an increment without expiry', async t => {
  t.mock.method(console, 'error', () => {});
  mode = 'rejected';
  await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_UNAVAILABLE$/);
  assert.equal(requests, 1);
  assert.equal(await fixture.command('GET', key()), null);
  assert.equal(await ttl(), -2);
});

test('loss of an acknowledgment retains a counted expiring attempt and never retries automatically', async t => {
  t.mock.method(console, 'error', () => {});
  mode = 'lost-ack';
  await assert.rejects(rateLimit('test', 'network', 1, 60), /^Error: REDIS_UNAVAILABLE$/);
  assert.equal(requests, 1);
  assert.equal(await fixture.command('GET', key()), '1');
  assert.ok(await ttl() > 0);
  mode = 'normal';
  await assert.rejects(rateLimit('test', 'network', 1, 60), /^Error: RATE_LIMITED$/);
  assert.equal(await fixture.command('GET', key()), '2');
});

test('malformed count responses fail closed instead of accepting the request', async t => {
  t.mock.method(console, 'error', () => {});
  mode = 'invalid-reply';
  for (const value of [undefined, null, 0, -1, 'NaN', '2.0', true, [], {}, Number.MAX_SAFE_INTEGER + 1]) {
    reply = value;
    await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_INVALID_RESPONSE$/, JSON.stringify(value));
  }
});

test('corrupt or unsafe counters are not reset, repaired into valid budgets or admitted', async t => {
  t.mock.method(console, 'error', () => {});
  for (const value of ['-10', '01', 'bad', '1.5', '9007199254740991']) {
    await fixture.command('SET', key(), value);
    await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_UNAVAILABLE$/);
    assert.equal(await fixture.command('GET', key()), value);
    assert.equal(await ttl(), -1);
  }
  await fixture.command('DEL', key()); await fixture.command('LPUSH', key(), 'bad-type');
  await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_UNAVAILABLE$/);
  assert.deepEqual(await fixture.command('LRANGE', key(), 0, -1), ['bad-type']);
});

test('invalid limiter configuration is rejected before storage access', async () => {
  for (const [maximum, seconds] of [[0, 60], [-1, 60], [1.5, 60], [Infinity, 60], [2, 0], [2, -1], [2, 1.5], [2, '60'], [2, 2147483648]]) {
    await assert.rejects(rateLimit('test', 'network', maximum, seconds), /^Error: INVALID_RATE_LIMIT$/);
  }
  assert.equal(requests, 0);
});

test('a single expiring write works even when a separate EXPIRE command is denied', async () => {
  await fixture.command('ACL', 'SETUSER', 'rate-fixture', 'reset', 'on', '>synthetic-fixture-only', '~geek:rate:*', '+eval', '+get', '+pttl', '+set', '+incr');
  mode = 'deny-expire';
  try {
    await rateLimit('test', 'network', 5, 60);
    assert.equal(await fixture.command('GET', key()), '1');
    assert.ok(await ttl() > 0);
    await fixture.command('PERSIST', key());
    await rateLimit('test', 'network', 5, 60);
    assert.equal(await fixture.command('GET', key()), '2');
    assert.ok(await ttl() > 0);
  } finally { mode = 'normal'; await fixture.command('ACL', 'DELUSER', 'rate-fixture'); }
});

test('expired windows restart while independent scopes and identities retain their budgets', async () => {
  await rateLimit('test', 'network', 1, 60);
  await fixture.command('PEXPIRE', key(), 1);
  const deadline = Date.now() + 1000;
  while (await fixture.command('EXISTS', key())) {
    assert.ok(Date.now() < deadline, 'synthetic counter did not expire');
    await new Promise(resolve => setTimeout(resolve, 5));
  }
  assert.equal(await rateLimit('test', 'network', 1, 60), undefined);
  await rateLimit('other', 'network', 1, 60);
  await rateLimit('test', 'different', 1, 60);
  assert.equal(await fixture.command('GET', key()), '1');
  assert.equal(await fixture.command('GET', key('other')), '1');
  assert.equal(await fixture.command('GET', key('test', 'different')), '1');
});

test('an actual Redis write rejection leaves new and legacy counters unchanged', async t => {
  t.mock.method(console, 'error', () => {});
  await fixture.command('ACL', 'SETUSER', 'rate-fixture', 'reset', 'on', '>synthetic-fixture-only', '~geek:rate:*', '+eval', '+get', '+pttl', '+incr');
  mode = 'deny-expire';
  try {
    await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_UNAVAILABLE$/);
    assert.equal(await fixture.command('GET', key()), null);
    await fixture.command('SET', key(), '7');
    await assert.rejects(rateLimit('test', 'network'), /^Error: REDIS_UNAVAILABLE$/);
    assert.equal(await fixture.command('GET', key()), '7');
    assert.equal(await ttl(), -1);
  } finally { mode = 'normal'; await fixture.command('ACL', 'DELUSER', 'rate-fixture'); }
  await rateLimit('test', 'network');
  assert.equal(await fixture.command('GET', key()), '8');
  assert.ok(await ttl() > 0);
});
