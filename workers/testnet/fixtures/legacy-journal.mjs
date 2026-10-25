// Offline regression fixture for the pre-repair 1 sompi/gram builder.
import { Wasm } from '@kasplex/kiwi';
import { inscription } from '../signer.mjs';
export { Wasm };
export async function legacyJournal(key, job, entry) {
  const script = inscription(key, job), spk = script.createPayToScriptHashScript(), address = Wasm.addressFromScriptPublicKey(spk, 'testnet');
  let commit, reveal;
  try {
    const first = await Wasm.createTransactions({ entries: [entry], changeAddress: job.sender,
      outputs: [{ address: address.toString(), amount: 130000000n }], priorityFee: 0n, networkId: 'testnet-10' });
    commit = first.transactions[0]; commit.sign([key]);
    const index = commit.serializeToObject().outputs.findIndex(o => o.scriptPublicKey === '0000' + spk.script);
    const second = await Wasm.createTransactions({ entries: [{ address: address.toString(), amount: 130000000n,
      outpoint: { transactionId: commit.id, index }, scriptPublicKey: spk, blockDaaScore: 18446744073709551615n, isCoinbase: false }],
    changeAddress: job.sender, outputs: [], priorityFee: 100000n, sigOpCount: 1, networkId: 'testnet-10' });
    reveal = second.transactions[0]; reveal.fillInput(0, script.encodePayToScriptHashSignatureScript(reveal.createInputSignature(0, key)));
    return Object.fromEntries([['commit', commit], ['reveal', reveal]].map(([phase, tx]) => [phase, { id: tx.id, transaction: tx.serializeToSafeJSON() }]));
  } finally { commit?.free(); reveal?.free(); script.free(); spk.free(); address.free(); }
}
