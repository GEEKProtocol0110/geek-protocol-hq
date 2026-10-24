import test from 'node:test';
import assert from 'node:assert/strict';
import { createCronHandler } from '../workers/testnet/cron.mjs';
test('scheduled signer authenticates before loading keys and cannot run in previews or while paused', async () => {
  process.env.CRON_SECRET = 'a'.repeat(64); process.env.VERCEL_ENV = 'production'; process.env.TESTNET_SIGNER_ENABLED = 'true';
  let sends = 0; const events = [], handler = createCronHandler(async () => { sends++; return 'idle'; }, event => events.push(event));
  const call = async (auth = `Bearer ${process.env.CRON_SECRET}`) => {
    const res = { statusCode: 0, setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
    await handler({ method: 'GET', headers: { authorization: auth } }, res); return res;
  };
  assert.equal((await call('bad')).statusCode, 401); assert.equal(sends, 0);
  process.env.VERCEL_ENV = 'preview'; assert.equal((await call()).body.state, 'paused'); assert.equal(sends, 0);
  process.env.VERCEL_ENV = 'production'; process.env.TESTNET_SIGNER_ENABLED = 'false'; assert.equal((await call()).body.state, 'paused'); assert.equal(sends, 0);
  process.env.TESTNET_SIGNER_ENABLED = 'true'; assert.equal((await call()).body.state, 'idle'); assert.equal(sends, 1);
  assert.deepEqual(events, [{ event: 'tn10-worker-result', state: 'idle' }]);
});

test('authenticated scheduled failures log a redacted category and retain the generic HTTP response', async () => {
  process.env.CRON_SECRET = 'a'.repeat(64); process.env.VERCEL_ENV = 'production'; process.env.TESTNET_SIGNER_ENABLED = 'true';
  const events = [], handler = createCronHandler(async () => { throw new Error('private-key raw-transaction kaspatest:private'); }, event => events.push(event));
  const res = { setHeader() {}, status(n) { this.statusCode = n; return this; }, json(body) { this.body = body; } };
  await handler({ method: 'GET', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }, res);
  assert.equal(res.statusCode, 503); assert.equal(res.body.state, 'paused');
  assert.deepEqual(events, [{ event: 'tn10-worker-failure', stage: 'scheduled-run', code: 'UNCLASSIFIED' }]);
  assert.doesNotMatch(JSON.stringify({ events, body: res.body }), /private-key|raw-transaction|kaspatest:/);
});
