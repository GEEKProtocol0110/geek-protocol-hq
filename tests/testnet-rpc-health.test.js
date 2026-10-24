import test from 'node:test';
import assert from 'node:assert/strict';
import { readRpcHealth, rpcDeadline } from '../workers/testnet/rpc-health.mjs';
import { deferred } from './helpers/client-fixture.js';
const settle = () => new Promise(setImmediate);
const healthy = { networkId: 'testnet-10', isSynced: true, hasUtxoIndex: true };

test('read-only discovery retries a failed first node after disconnect, using bounded SDK fallback', async () => {
  const calls = []; let attempts = 0;
  const rpc = { isConnected: false, async connect(options) {
    calls.push('connect'); assert.equal(options.strategy, 'fallback'); assert.equal(options.blockAsyncConnect, true);
    assert.equal(options.timeoutDuration, 5000);
    if (++attempts === 1) throw new Error('private upstream message'); this.isConnected = true;
  }, async disconnect() { calls.push('disconnect'); this.isConnected = false; }, async getServerInfo() { calls.push('info'); return healthy; } };
  assert.equal(await readRpcHealth(rpc), healthy);
  assert.deepEqual(calls, ['connect', 'disconnect', 'connect', 'info']);
});

test('a failed node info read reconnects before retry and an existing healthy connection is reused', async () => {
  const calls = []; let reads = 0;
  const rpc = { isConnected: true, async connect() { calls.push('connect'); this.isConnected = true; },
    async disconnect() { calls.push('disconnect'); this.isConnected = false; },
    async getServerInfo() { calls.push('info'); if (++reads === 1) throw new Error('lost connection'); return healthy; } };
  assert.equal(await readRpcHealth(rpc), healthy);
  assert.deepEqual(calls, ['info', 'disconnect', 'connect', 'info']);
  calls.length = 0; assert.equal(await readRpcHealth(rpc), healthy); assert.deepEqual(calls, ['info']);
});

test('discovery stops after two failed connections, exposes a fixed category and never starts node calls', async () => {
  let connects = 0, disconnects = 0;
  const rpc = { isConnected: false, async connect() { connects++; throw new Error('kaspatest:private raw error'); },
    async disconnect() { disconnects++; }, getServerInfo() { assert.fail('No node call after failed connection'); } };
  await assert.rejects(readRpcHealth(rpc), error => error.message === 'RPC_CONNECT_FAILED');
  assert.equal(connects, 2); assert.equal(disconnects, 2);
});

test('a timed-out connection cannot overlap a replacement until disconnect is acknowledged', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const stop = deferred(); let connects = 0, stopping = false;
  const rpc = { isConnected: false, connect() { connects++; return connects === 1 ? new Promise(() => {}) : Promise.resolve(); },
    async disconnect() { stopping = true; await stop.promise; }, async getServerInfo() { return healthy; } };
  const result = readRpcHealth(rpc); await settle();
  t.mock.timers.tick(6000); await settle(); assert.equal(stopping, true); assert.equal(connects, 1);
  stop.resolve(); assert.equal(await result, healthy); assert.equal(connects, 2);
});

test('an unacknowledged disconnect stops recovery rather than overlapping connection attempts', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] }); let connects = 0;
  const rpc = { isConnected: false, async connect() { connects++; throw new Error('connection failed'); },
    disconnect() { return new Promise(() => {}); } };
  const result = assert.rejects(readRpcHealth(rpc), /RPC_DISCONNECT_FAILED/); await settle();
  t.mock.timers.tick(2000); await result; assert.equal(connects, 1);
});

test('transport recovery never upgrades wrong-network or unsynced node information into approval', async () => {
  for (const info of [{ ...healthy, networkId: 'mainnet' }, { ...healthy, isSynced: false }, { ...healthy, hasUtxoIndex: false }]) {
    let reads = 0;
    assert.equal(await readRpcHealth({ isConnected: true, async getServerInfo() { reads++; return info; } }), info);
    assert.equal(reads, 1); // The signer must still apply its existing exact-network/sync/index checks.
  }
});

test('successful RPC deadlines cancel their timer and stalled node reads retain a bounded timeout category', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  assert.equal(await rpcDeadline(async () => 'done'), 'done');
  t.mock.timers.tick(12000); // A cleared timer cannot turn a completed read into failure.
  let reads = 0, stops = 0;
  const rpc = { isConnected: true, getServerInfo() { reads++; return new Promise(() => {}); }, async disconnect() { stops++; } };
  const result = assert.rejects(readRpcHealth(rpc), /RPC_SERVER_INFO_TIMEOUT/); await settle();
  t.mock.timers.tick(6000); await settle(); t.mock.timers.tick(6000); await result;
  assert.equal(reads, 2); assert.equal(stops, 2);
});
