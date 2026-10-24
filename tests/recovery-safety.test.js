import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { recoveryArguments, recoveryTarget, recoveryCommand, resetRestoredSessions } from '../scripts/reset-restored-sessions.mjs';

const env = { RECOVERY_REDIS_REST_URL: 'https://restore.example', RECOVERY_REDIS_REST_TOKEN: 'synthetic-private-token' };

test('recovery needs distinct explicit production and restored hosts even without application configuration', () => {
  assert.equal(recoveryTarget(env, 'restore.example', 'production.example'), 'https://restore.example');
  for (const host of [undefined, '', 'restore.example', 'RESTORE.example', 'production.example.', 'https://production.example', 'production.example:443', '127.1', '0x7f000001']) {
    assert.throws(() => recoveryTarget(env, 'restore.example', host));
  }
  for (const value of ['http://restore.example', 'https://restore.example:8443', 'https://user:password@restore.example', 'https://restore.example/command', 'https://restore.example?token=private', 'https://restore.example/#private', 'https://restore.example.']) {
    assert.throws(() => recoveryTarget({ ...env, RECOVERY_REDIS_REST_URL: value }, 'restore.example', 'production.example'));
  }
  for (const key of ['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']) {
    for (const value of ['https://restore.example', 'https://RESTORE.example:8443', 'https://restore.example.', 'malformed', 'http://production.example', 'https://user:secret@production.example', 'https://production.example/command', 'https://production.example?secret=private']) {
      assert.throws(() => recoveryTarget({ ...env, [key]: value }, 'restore.example', 'production.example'));
    }
  }
  assert.throws(() => recoveryTarget({ ...env, RECOVERY_REDIS_REST_TOKEN: ' ' }, 'restore.example', 'production.example'));
});

test('legacy, duplicate or ambiguous CLI arguments fail before any database request', () => {
  const args = ['--production-host', 'production.example', '--restored-host', 'restore.example'];
  assert.equal(recoveryArguments(args).apply, false);
  assert.equal(recoveryArguments([...args, '--apply']).apply, true);
  for (const bad of [[], ['--restored-host', 'restore.example', '--apply'], [...args, '--apply', '--apply'], [...args, '--production-host', 'other.example'], [...args, '--unknown'], ['--production-host', '--apply', '--restored-host', 'restore.example']]) {
    assert.throws(() => recoveryArguments(bad));
  }
  const result = spawnSync(process.execPath, ['scripts/reset-restored-sessions.mjs', '--restored-host', 'restore.example', '--apply'], { env: { ...process.env, ...env }, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.match(result.stderr, /--production-host/);
  assert.doesNotMatch(result.stderr, /synthetic-private-token|https:\/\/restore/);
});

test('cleanup rejects malformed scans and ambiguous apply values before removing anything', async () => {
  for (const result of [null, [], ['0'], ['x', []], ['0', null], ['0', ['geek:passkey:account:v1:durable']], ['0', [null]]]) {
    let deletions = 0;
    await assert.rejects(resetRestoredSessions({ apply: true, command: async name => { if (name === 'DEL') deletions++; return result; } }));
    assert.equal(deletions, 0);
  }
  let requests = 0;
  await assert.rejects(resetRestoredSessions({ apply: 'true', command: async () => { requests++; } }));
  assert.equal(requests, 0);
});

test('cleanup cannot report success for malformed deletion replies or leftover sessions', async () => {
  for (const reply of [undefined, null, '1', -1, 0.5, 2, NaN]) {
    await assert.rejects(resetRestoredSessions({ apply: true, command: async name => name === 'DEL' ? reply : ['0', ['geek:session:synthetic']] }));
  }
  await assert.rejects(resetRestoredSessions({ apply: true, command: async name => name === 'DEL' ? 0 : ['0', ['geek:session:synthetic']] }), /sessions remain/);
});

test('paginated duplicate scan keys are removed once, then the offline target is checked again', async () => {
  const keys = new Set(['geek:session:first', 'geek:session:second']); let deletions = 0, scans = 0;
  const result = await resetRestoredSessions({ apply: true, command: async (name, cursor, ...rest) => {
    if (name === 'DEL') {
      deletions++; const list = [cursor, ...rest];
      assert.equal(new Set(list).size, 2);
      return list.reduce((n, key) => n + Number(keys.delete(key)), 0);
    }
    assert.equal(name, 'SCAN'); scans++;
    if (rest[1] !== 'geek:session:*' || !keys.size) return ['0', []];
    return cursor === '0' ? ['7', ['geek:session:first']] : ['0', [...keys]];
  } });
  assert.deepEqual(result, { mode: 'applied', matched: 2, removed: 2 });
  assert.equal(deletions, 1); assert.equal(scans, 17);
});

for (const phase of ['headers', 'body']) test(`offline recovery ${phase} timeout ends without retrying a deletion`, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0, signal;
  const stalled = s => new Promise((resolve, reject) => s.addEventListener('abort', () => reject(new Error('private-provider-detail')), { once: true }));
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests++; signal = options.signal;
    assert.equal(options.redirect, 'error');
    return phase === 'headers' ? stalled(signal) : { ok: true, json: () => stalled(signal) };
  });
  const result = recoveryCommand({ url: env.RECOVERY_REDIS_REST_URL, token: env.RECOVERY_REDIS_REST_TOKEN })('DEL', 'geek:session:synthetic');
  await Promise.resolve(); await Promise.resolve();
  const rejected = assert.rejects(result, /^Error: Restored-database command failed; inspect saved state before retrying\.$/);
  t.mock.timers.tick(14999); assert.equal(signal.aborted, false);
  t.mock.timers.tick(1); await rejected;
  assert.equal(requests, 1);
});

test('recovery validates provider envelopes, clears deadlines and redacts provider failures', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal;
  t.mock.method(globalThis, 'fetch', async (url, options) => { signal = options.signal; return new Response('{"result":0}'); });
  const command = recoveryCommand({ url: env.RECOVERY_REDIS_REST_URL, token: env.RECOVERY_REDIS_REST_TOKEN });
  assert.equal(await command('DEL', 'geek:session:expired'), 0);
  t.mock.timers.tick(15000); assert.equal(signal.aborted, false);
  for (const payload of ['null', '[]', '{}', '{"error":"private-provider-detail"}', 'invalid-json']) {
    globalThis.fetch = async () => new Response(payload);
    await assert.rejects(command('SCAN', '0'), /^Error: Restored-database command failed; inspect saved state before retrying\.$/);
  }
  globalThis.fetch = async () => new Response('{"result":0}', { status: 503 });
  await assert.rejects(command('DEL', 'geek:session:synthetic'), /command failed/);
});
