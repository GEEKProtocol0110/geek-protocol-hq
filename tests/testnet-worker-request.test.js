import test from 'node:test';
import assert from 'node:assert/strict';
import { workerRequest } from '../workers/testnet/request.mjs';
test('worker targets the canonical HQ API path without redirects or automatic write retries', async () => {
  const original = globalThis.fetch; let calls = 0;
  try {
    globalThis.fetch = async (url, options) => {
      calls++; assert.equal(url, 'https://www.geekprotocol.xyz/api/session/?service=testnet-worker');
      assert.equal(options.method, 'POST'); assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, `Bearer ${'e'.repeat(64)}`);
      return Response.json({ ok: false }, { status: 503 });
    };
    const request = workerRequest({ TESTNET_AUTO_WORKER_TOKEN: 'e'.repeat(64) });
    await assert.rejects(request({ action: 'claim' }), error => error.message === 'HQ_REQUEST_FAILED' && error.httpStatus === 503); assert.equal(calls, 1);
    assert.throws(() => workerRequest({ HQ_REWARD_ORIGIN: 'https://evil.invalid', TESTNET_AUTO_WORKER_TOKEN: 'e'.repeat(64) }), /CANONICAL/);
  } finally { globalThis.fetch = original; }
});
