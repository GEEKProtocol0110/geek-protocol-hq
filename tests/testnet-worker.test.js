import test from 'node:test';
import assert from 'node:assert/strict';
import { processPayment } from '../workers/testnet/process.mjs';

const journal = { commit: { id: 'commit', transaction: 'signed-commit' }, reveal: { id: 'reveal', transaction: 'signed-reveal' } };
function system({ persisted = false, lostPrepare = false, throwSend = false, accepted = false } = {}) {
  let job = { id: 'job', version: 'v1', state: persisted ? 'prepared' : 'queued', ...(persisted ? { journal } : {}) };
  const calls = []; let prepared = 0;
  const request = async b => {
    calls.push(b.action);
    if (b.action === 'claim') return { lease: 'lease', job: structuredClone(job), config: {} };
    if (b.action === 'release') return {};
    if (b.action === 'prepare') { job.journal = b.journal; job.state = 'prepared'; if (lostPrepare) throw new Error('lost response'); }
    if (b.action === 'submitted') job.state = 'awaiting-indexer';
    if (b.action === 'check') job.state = accepted ? 'indexed-confirmed' : 'awaiting-indexer';
    return { job: structuredClone(job) };
  };
  return { request, calls, get prepared() { return prepared; }, signer: { verify: async () => {}, prepare: async () => { prepared++; return journal; }, submit: async tx => { calls.push(tx.transaction); if (throwSend) throw new Error('uncertain RPC'); } } };
}
test('both signed transactions are durably acknowledged before their first broadcast', async () => {
  const s = system(); assert.equal(await processPayment(s), 'awaiting-indexer'); assert.equal(s.prepared, 1);
  assert.deepEqual(s.calls, ['claim', 'prepare', 'signed-commit', 'signed-reveal', 'submitted', 'check', 'release']);
});
test('a lost prepare acknowledgement broadcasts nothing and restart reuses the committed journal', async () => {
  const s = system({ lostPrepare: true }); await assert.rejects(processPayment(s));
  assert.deepEqual(s.calls, ['claim', 'prepare', 'release']);
  s.calls.length = 0; await processPayment(s); assert.equal(s.prepared, 1);
  assert.deepEqual(s.calls, ['claim', 'check', 'signed-commit', 'signed-reveal', 'submitted', 'check', 'release']);
});
test('accepted recovered payments are checked without creating or broadcasting transactions', async () => {
  const s = system({ persisted: true, accepted: true }); assert.equal(await processPayment(s), 'indexed-confirmed');
  assert.deepEqual(s.calls, ['claim', 'check', 'release']); assert.equal(s.prepared, 0);
});
test('uncertain RPC sends retain identical signed bytes and do not construct another payment', async () => {
  const s = system({ throwSend: true }); assert.equal(await processPayment(s), 'reconciling');
  assert.equal(await processPayment(s), 'reconciling'); assert.equal(s.prepared, 1);
  assert.equal(s.calls.filter(x => x === 'signed-commit').length, 2); assert.equal(s.calls.filter(x => x === 'signed-reveal').length, 2);
});
test('configuration/network/funding and indexer failures stop payment work and release the lease', async () => {
  const s = system(); s.signer.verify = async () => { throw new Error('wrong network'); };
  await assert.rejects(processPayment(s)); assert.deepEqual(s.calls, ['claim', 'release']);
});
