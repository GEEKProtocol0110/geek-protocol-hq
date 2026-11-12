import test from 'node:test';
import assert from 'node:assert/strict';
import { Wasm } from '@kasplex/kiwi';
import { inscription, livePolicy, prepareTransactions, createSigner } from './signer.mjs';
import { DAILY_WHOLE, GAUNTLET_PERFECT_WHOLE, MAINNET_PAYOUT_SENDER, toRaw } from './schedule.mjs';

const key = new Wasm.PrivateKey('1'.padStart(64, '0'));
const sender = key.toPublicKey().toAddress('mainnet').toString();
const recipient = new Wasm.PrivateKey('2'.padStart(64, '0')).toPublicKey().toAddress('mainnet').toString();
const job = { network: 'mainnet', sender, recipient, ticker: 'GEEK', amount: toRaw(DAILY_WHOLE), proof: { kind: 'daily', round: 1 } };
const entry = { address: sender, amount: 2000000000n, outpoint: { transactionId: 'a'.repeat(64), index: 2 },
  scriptPublicKey: Wasm.payToAddressScript(key.toPublicKey().toAddress('mainnet')), blockDaaScore: 0n, isCoinbase: false };
const fixturePolicy = { ...livePolicy, sender, syntheticFixture: true };

test('live policy pays only the pinned hot wallet and the published ladder', () => {
  assert.equal(livePolicy.sender, MAINNET_PAYOUT_SENDER);
  assert.equal(livePolicy.networkId, 'mainnet');
  assert.equal(livePolicy.syntheticFixture, false);
  assert.equal(toRaw(DAILY_WHOLE), '10000000000');
  assert.equal(GAUNTLET_PERFECT_WHOLE.reduce((sum, value) => sum + value, 0), 46300);
});

test('real SDK constructs a linked mainnet KRC-20 commit/reveal offline for a synthetic fixture key', async () => {
  const journal = await prepareTransactions(key, job, [entry], fixturePolicy);
  const commit = Wasm.Transaction.deserializeFromSafeJSON(journal.commit.transaction), reveal = Wasm.Transaction.deserializeFromSafeJSON(journal.reveal.transaction);
  try {
    const c = commit.serializeToObject(), r = reveal.serializeToObject();
    assert.equal(commit.id, journal.commit.id); assert.equal(reveal.id, journal.reveal.id);
    assert.equal(c.inputs.length, 1); assert.equal(r.inputs.length, 1);
    assert.equal(r.inputs[0].transactionId, commit.id);
    assert.ok(r.inputs[0].signatureScript.includes(Buffer.from(JSON.stringify({ p: 'krc-20', op: 'transfer', tick: 'GEEK', amt: job.amount, to: job.recipient })).toString('hex')));
    const script = inscription(key, job), spk = script.createPayToScriptHashScript();
    assert.equal(c.outputs[r.inputs[0].index].scriptPublicKey, '0000' + spk.script);
    assert.equal(c.outputs[r.inputs[0].index].value, 130000000n);
    const fee = entry.amount - c.outputs.reduce((n, o) => n + o.value, 0n) + 130000000n - r.outputs.reduce((n, o) => n + o.value, 0n);
    assert.ok(fee > 0n && fee <= 5000000n);
    assert.ok(fee >= Wasm.calculateTransactionMass('mainnet', reveal) * 1n);
    script.free(); spk.free();
  } finally { commit.free(); reveal.free(); }
});

test('journal rehydration preserves signed bytes and the live policy rejects the fixture sender', async () => {
  const journal = await prepareTransactions(key, job, [entry], fixturePolicy);
  for (const saved of Object.values(journal)) {
    const rehydrated = Wasm.Transaction.deserializeFromSafeJSON(saved.transaction);
    assert.equal(rehydrated.id, saved.id);
    assert.equal(rehydrated.serializeToSafeJSON(), saved.transaction);
    rehydrated.free();
  }
  await assert.rejects(prepareTransactions(key, job, [entry]), /SIGNER_POLICY_MISMATCH/);
  await assert.rejects(prepareTransactions(key, { ...job, amount: toRaw(10), proof: { kind: 'gauntlet', round: 1 } }, [entry], fixturePolicy), /SIGNER_POLICY_MISMATCH/);
  await assert.rejects(prepareTransactions(key, job, [], fixturePolicy), /FUNDED_UTXO_REQUIRED/);
});

test('the signer rejects a non-mainnet node and a key that is not the pinned hot wallet', async () => {
  const healthy = { networkId: 'mainnet', isSynced: true, hasUtxoIndex: true };
  for (const info of [{ ...healthy, networkId: 'testnet-10' }, { ...healthy, isSynced: false }, { ...healthy, hasUtxoIndex: false }]) {
    const signer = createSigner('1'.padStart(64, '0'), { isConnected: true, getServerInfo: async () => info });
    await assert.rejects(signer.verify({}, job), /MAINNET_SYNCED_NODE_REQUIRED/);
    signer.close();
  }
  const signer = createSigner('1'.padStart(64, '0'), { isConnected: true, getServerInfo: async () => healthy });
  await assert.rejects(signer.verify({ sender: MAINNET_PAYOUT_SENDER, network: 'mainnet' }, { ...job, sender: MAINNET_PAYOUT_SENDER }), /SIGNER_POLICY_MISMATCH/);
  signer.close();
});
