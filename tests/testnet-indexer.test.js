import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { jsonFromIndexer } from '../server/testnet-rewards.js';

const originalFetch = globalThis.fetch, path = `op/${'b'.repeat(64)}`;
after(() => { globalThis.fetch = originalFetch; });
const respond = (status, payload) => { globalThis.fetch = async () => Response.json(payload, { status }); };

test('only explicit operation lookups accept the exact Kasplex missing-operation response', async () => {
  for (const status of [403, 404]) {
    respond(status, { message: 'op not found', result: null });
    assert.equal(await jsonFromIndexer(path, { allowMissingOperation: true }), null);
    await assert.rejects(jsonFromIndexer(path), /TESTNET_INDEXER_UNAVAILABLE/);
    await assert.rejects(jsonFromIndexer('token/GEEKT', { allowMissingOperation: true }), /TESTNET_INDEXER_UNAVAILABLE/);
  }
});

test('authorization failures, outages, malformed responses and unrelated missing assets still stop work', async () => {
  for (const [status, payload] of [
    [401, { message: 'op not found', result: null }],
    [503, { message: 'op not found', result: null }],
    [403, { message: 'forbidden', result: null }],
    [403, { message: 'op not found', result: [] }],
    [404, { message: 'token not found', result: null }],
    [200, { message: 'successful', result: null }],
    [200, { message: 'successful', result: [{}, {}] }]
  ]) {
    respond(status, payload);
    await assert.rejects(jsonFromIndexer(path, { allowMissingOperation: true }), /TESTNET_INDEXER_UNAVAILABLE/);
  }
  globalThis.fetch = async () => new Response('<html>Access denied</html>', { status: 403 });
  await assert.rejects(jsonFromIndexer(path, { allowMissingOperation: true }), /TESTNET_INDEXER_UNAVAILABLE/);
  globalThis.fetch = async () => { throw new Error('network unavailable'); };
  await assert.rejects(jsonFromIndexer(path, { allowMissingOperation: true }), /TESTNET_INDEXER_UNAVAILABLE/);
});
