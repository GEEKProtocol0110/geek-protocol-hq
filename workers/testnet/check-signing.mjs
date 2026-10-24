import test from 'node:test';
import assert from 'node:assert/strict';
import { Wasm } from '@kasplex/kiwi';
import { inscription, prepareTransactions, createSigner, inspectJournal } from './signer.mjs';
const key = new Wasm.PrivateKey('1'.padStart(64, '0')), sender = key.toPublicKey().toAddress('testnet');
const recipient = new Wasm.PrivateKey('2'.padStart(64, '0')).toPublicKey().toAddress('testnet');
const job = { network: 'testnet-10', sender: sender.toString(), recipient: recipient.toString(), ticker: 'GEEKT', amount: '100000000' };
const entry = { address: sender.toString(), amount: 2000000000n, outpoint: { transactionId: 'a'.repeat(64), index: 2 },
  scriptPublicKey: Wasm.payToAddressScript(sender), blockDaaScore: 0n, isCoinbase: false };
test('real SDK constructs and signs a linked TN10 commit/reveal with exact inscription and bounded fees offline', async () => {
  const journal = await prepareTransactions(key, job, [entry]);
  const commit = Wasm.Transaction.deserializeFromSafeJSON(journal.commit.transaction), reveal = Wasm.Transaction.deserializeFromSafeJSON(journal.reveal.transaction);
  try {
    const c = commit.serializeToObject(), r = reveal.serializeToObject();
    assert.equal(commit.id, journal.commit.id); assert.equal(reveal.id, journal.reveal.id);
    assert.equal(c.inputs.length, 1); assert.equal(c.inputs[0].transactionId, entry.outpoint.transactionId);
    assert.equal(c.inputs[0].index, 2); assert.ok(c.inputs[0].signatureScript.length > 120);
    assert.equal(r.inputs.length, 1); assert.equal(r.inputs[0].transactionId, commit.id);
    assert.ok(r.inputs[0].signatureScript.includes(Buffer.from(JSON.stringify({ p: 'krc-20', op: 'transfer', tick: 'GEEKT', amt: '100000000', to: job.recipient })).toString('hex')));
    const script = inscription(key, job), spk = script.createPayToScriptHashScript();
    assert.equal(c.outputs[r.inputs[0].index].scriptPublicKey, '0000' + spk.script);
    assert.equal(c.outputs[r.inputs[0].index].value, 130000000n);
    const changeScript = '0000' + entry.scriptPublicKey.script;
    assert.ok(r.outputs.every(o => o.scriptPublicKey === changeScript));
    const fee = entry.amount - c.outputs.reduce((n, o) => n + o.value, 0n) + 130000000n - r.outputs.reduce((n, o) => n + o.value, 0n);
    assert.ok(fee > 0n && fee <= 5000000n);
    assert.equal(journal.commit.transaction.length + journal.reveal.transaction.length < 5600, true);
    // Native verification covers the standard commit input. That helper treats
    // P2SH as a plain pubkey, so reveal coverage checks the Schnorr signature
    // framing and exact redeem script; real-node acceptance is a separate gate.
    const signedCommit = Wasm.signTransaction(commit, [], true); signedCommit.free();
    assert.match(r.inputs[0].signatureScript, /^41[a-f0-9]{128}01/);
    assert.equal(r.inputs[0].signatureScript.slice(132), '4cbe' + script.toString());
  } finally { commit.free(); reveal.free(); }
});
test('journal rehydration preserves the signed bytes and IDs across process restarts', async () => {
  const journal = await prepareTransactions(key, job, [entry]);
  for (const saved of Object.values(journal)) {
    const rehydrated = Wasm.Transaction.deserializeFromSafeJSON(saved.transaction);
    assert.equal(rehydrated.id, saved.id); assert.equal(rehydrated.serializeToSafeJSON(), saved.transaction); rehydrated.free();
  }
});
test('wrong network, sender, self-transfer and missing funded UTXO cannot produce a journal', async () => {
  for (const bad of [{ network: 'mainnet' }, { sender: recipient.toString() }, { recipient: sender.toString() }, { amount: '1e8' }]) {
    await assert.rejects(prepareTransactions(key, { ...job, ...bad }, [entry]), /SIGNER_POLICY/);
  }
  await assert.rejects(prepareTransactions(key, job, []), /FUNDED_UTXO/);
});
test('the worker independently rejects a Mainnet, unsynced or unindexed RPC', async () => {
  for (const info of [{ networkId: 'mainnet', isSynced: true, hasUtxoIndex: true },
    { networkId: 'testnet-10', isSynced: false, hasUtxoIndex: true }, { networkId: 'testnet-10', isSynced: true, hasUtxoIndex: false }]) {
    const signer = createSigner('1'.padStart(64, '0'), { getServerInfo: async () => info });
    await assert.rejects(signer.verify({}, job), /TN10_SYNCED_NODE/); signer.close();
  }
});

test('saved-journal inspection reads exact original outpoints without signing, sending or changing the pair', async () => {
  const journal = await prepareTransactions(key, job, [entry]), serialized = JSON.stringify(journal);
  const reveal = Wasm.Transaction.deserializeFromSafeJSON(journal.reveal.transaction);
  const revealInput = reveal.serializeToObject().inputs[0]; reveal.free();
  for (const [commitAvailable, revealAvailable] of [[true, false], [false, true], [false, false]]) {
    let reads = 0;
    const rpc = { async getUtxosByAddresses({ addresses }) {
      reads++; assert.equal(addresses.length, 2); assert.equal(addresses[0], job.sender);
      assert.ok(addresses[1].startsWith('kaspatest:')); assert.notEqual(addresses[1], job.sender);
      return { entries: [...(commitAvailable ? [entry] : []), ...(revealAvailable ? [{ outpoint: { transactionId: revealInput.transactionId, index: revealInput.index } }] : [])] };
    } };
    assert.deepEqual(await inspectJournal({ ...job, journal }, rpc), { commitInputsAvailable: commitAvailable, revealInputAvailable: revealAvailable });
    assert.equal(reads, 1); assert.equal(JSON.stringify(journal), serialized);
  }
});

test('malformed saved-journal links cannot trigger a node inspection', async () => {
  const journal = await prepareTransactions(key, job, [entry]);
  const rpc = { getUtxosByAddresses() { assert.fail('Do not inspect an invalid journal'); } };
  await assert.rejects(inspectJournal({ ...job, journal: { ...journal, commit: { ...journal.commit, id: 'f'.repeat(64) } } }, rpc), /JOURNAL_LINK_MISMATCH/);
  await assert.rejects(inspectJournal({ ...job, network: 'mainnet', journal }, rpc), /JOURNAL_LINK_MISMATCH/);
});
