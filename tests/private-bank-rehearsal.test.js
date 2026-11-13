import test from 'node:test';
import assert from 'node:assert/strict';
import { rehearsalEnvironment } from '../scripts/private-bank-rehearsal.mjs';

test('local rehearsal inherits only process paths, never provider credentials, flags or source settings', () => {
  const env = rehearsalEnvironment({
    PATH: '/synthetic/bin', REDIS_SERVER_BIN: '/synthetic/redis-server', TMPDIR: '/synthetic/tmp',
    VERCEL_ENV: 'production', NODE_OPTIONS: '--require untrusted',
    UPSTASH_REDIS_REST_URL: 'https://synthetic-production.invalid',
    UPSTASH_REDIS_REST_TOKEN: 'synthetic-credential',
    MAINNET_PAYOUT_ENABLED: 'true', MAINNET_SIGNER_ENABLED: 'true',
    MAINNET_SIGNER_PRIVATE_KEY: 'synthetic-not-a-key',
    GEEK_PRIVATE_QUESTION_DIR: 'fake-bank',
    GEEK_PRIVATE_QUESTION_TOKEN: 'fake-token'
  });
  assert.deepEqual(env, { PATH: '/synthetic/bin', REDIS_SERVER_BIN: '/synthetic/redis-server', TMPDIR: '/synthetic/tmp' });
  assert.deepEqual(rehearsalEnvironment({}), {});
});
