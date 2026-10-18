import { Wasm } from '@kasplex/kiwi';

const hashPattern = /^[a-f0-9]{64}$/;
const BASE = 'https://tn10api.kasplex.org/v1/krc20';
const FUNDING = 130000000n, MAX_FEE = 5000000n;
const bounded = promise => Promise.race([promise, new Promise((_, reject) => {
  const timer = setTimeout(() => reject(new Error('RPC_TIMEOUT')), 12000); timer.unref();
})]);
async function indexed(path) {
  const response = await fetch(`${BASE}/${path}`, { signal: AbortSignal.timeout(10000), redirect: 'error', cache: 'no-store' });
  const text = await response.text();
  if (!response.ok || text.length > 64000) throw new Error('INDEXER_UNAVAILABLE');
  const value = JSON.parse(text);
  if (value.message !== 'successful' || !Array.isArray(value.result) || value.result.length > 1) throw new Error('INDEXER_UNAVAILABLE');
  return value.result[0];
}
export const inscription = (key, job) => new Wasm.ScriptBuilder()
  .addData(key.toPublicKey().toXOnlyPublicKey().toString()).addOp(Wasm.Opcodes.OpCheckSig)
  .addOp(Wasm.Opcodes.OpFalse).addOp(Wasm.Opcodes.OpIf).addData(Buffer.from('kasplex')).addI64(0n)
  .addData(Buffer.from(JSON.stringify({ p: 'krc-20', op: 'transfer', tick: job.ticker, amt: job.amount, to: job.recipient })))
  .addOp(Wasm.Opcodes.OpEndIf);

export async function prepareTransactions(key, job, entries) {
  const sender = key.toPublicKey().toAddress('testnet').toString();
  if (job.network !== 'testnet-10' || job.sender !== sender || !job.recipient?.startsWith('kaspatest:') ||
      job.recipient === sender || !/^[A-Z]{4,6}$/.test(job.ticker) || !/^[1-9][0-9]{0,19}$/.test(job.amount)) throw new Error('SIGNER_POLICY_MISMATCH');
  const script = inscription(key, job), spk = script.createPayToScriptHashScript();
  const address = Wasm.addressFromScriptPublicKey(spk, 'testnet');
  let commit, reveal;
  try {
    // One input bounds the journal and removes hidden consolidation transactions.
    const entry = entries.find(e => BigInt(e.amount ?? e.entry?.amount ?? 0) >= FUNDING + MAX_FEE);
    if (!entry) throw new Error('FUNDED_UTXO_REQUIRED');
    const first = await Wasm.createTransactions({ entries: [entry], changeAddress: sender,
      outputs: [{ address: address.toString(), amount: FUNDING }], priorityFee: 0n, networkId: 'testnet-10' });
    if (first.transactions.length !== 1) throw new Error('CONSOLIDATION_NOT_ALLOWED');
    commit = first.transactions[0]; commit.sign([key]);
    const commitObject = commit.serializeToObject();
    const outputIndex = commitObject.outputs.findIndex(o => o.scriptPublicKey === spk.version.toString(16).padStart(4, '0') + spk.script && BigInt(o.value) === FUNDING);
    if (outputIndex < 0) throw new Error('COMMIT_OUTPUT_INVALID');
    const second = await Wasm.createTransactions({ entries: [{ address: address.toString(), amount: FUNDING,
      outpoint: { transactionId: commit.id, index: outputIndex }, scriptPublicKey: spk, blockDaaScore: 18446744073709551615n, isCoinbase: false }],
    changeAddress: sender, outputs: [], priorityFee: 100000n, sigOpCount: 1, networkId: 'testnet-10' });
    if (second.transactions.length !== 1) throw new Error('CONSOLIDATION_NOT_ALLOWED');
    reveal = second.transactions[0];
    for (let i = 0; i < reveal.transaction.inputs.length; i++) {
      const signature = reveal.createInputSignature(i, key);
      reveal.fillInput(i, script.encodePayToScriptHashSignatureScript(signature));
    }
    if (commit.feeAmount + reveal.feeAmount > MAX_FEE) throw new Error('FEE_LIMIT_EXCEEDED');
    const journal = { commit: { id: commit.id, transaction: commit.serializeToSafeJSON() }, reveal: { id: reveal.id, transaction: reveal.serializeToSafeJSON() } };
    if (Object.values(journal).some(tx => !hashPattern.test(tx.id) || tx.transaction.length > 2800)) throw new Error('JOURNAL_LIMIT_EXCEEDED');
    return journal;
  } finally { commit?.free(); reveal?.free(); script.free(); spk.free(); address?.free(); }
}

export function createSigner(secret, rpc) {
  if (!hashPattern.test(secret || '')) throw new Error('DEDICATED_SIGNER_KEY_REQUIRED');
  const key = new Wasm.PrivateKey(secret);
  return {
    async verify(config, job) {
      if (!rpc.isConnected && typeof rpc.connect === 'function') await bounded(rpc.connect({ timeoutDuration: 10000 }));
      const info = await bounded(rpc.getServerInfo());
      if (info.networkId !== 'testnet-10' || !info.isSynced || !info.hasUtxoIndex) throw new Error('TN10_SYNCED_NODE_REQUIRED');
      if (config.network !== 'testnet-10' || config.sender !== key.toPublicKey().toAddress('testnet').toString() ||
          ['sender', 'ticker', 'deploymentHash', 'amount', 'decimals'].some(k => config[k] !== job[k]) ||
          config.fingerprint !== job.configFingerprint) throw new Error('SIGNER_POLICY_MISMATCH');
      const [asset, deploy] = await Promise.all([indexed(`token/${job.ticker}`), indexed(`op/${job.deploymentHash}`)]);
      if (asset?.tick !== job.ticker || asset.state !== 'deployed' || asset.hashRev !== job.deploymentHash || asset.dec !== job.decimals ||
          deploy?.hashRev !== job.deploymentHash || deploy.p !== 'KRC-20' || deploy.op !== 'deploy' || deploy.tick !== job.ticker ||
          deploy.dec !== job.decimals || deploy.txAccept !== '1' || deploy.opAccept !== '1' || deploy.opError) throw new Error('PINNED_ASSET_REQUIRED');
      // A previously submitted payment may have consumed this balance. Never use
      // the current balance to reset/rebuild a persisted payment.
      if (!job.journal) {
        const balance = await indexed(`address/${job.sender}/tokenlist?tick=${job.ticker}`);
        if (balance?.tick !== job.ticker || balance.dec !== job.decimals || !/^[0-9]+$/.test(balance.balance) ||
            BigInt(balance.balance) < BigInt(job.amount)) throw new Error('GEEKT_FUNDING_REQUIRED');
      }
    },
    async prepare(config, job) {
      const { entries } = await bounded(rpc.getUtxosByAddresses({ addresses: [config.sender] }));
      return prepareTransactions(key, job, entries);
    },
    async submit(saved) {
      const tx = Wasm.Transaction.deserializeFromSafeJSON(saved.transaction);
      try {
        if (tx.id !== saved.id) throw new Error('JOURNAL_HASH_MISMATCH');
        const result = await bounded(rpc.submitTransaction({ transaction: tx, allowOrphan: false }));
        if (result.transactionId !== saved.id) throw new Error('RPC_HASH_MISMATCH');
      } finally { tx.free(); }
    },
    close() { key.free(); }
  };
}
export const createRpc = () => new Wasm.RpcClient({ resolver: new Wasm.Resolver(), networkId: 'testnet-10', encoding: Wasm.Encoding.Borsh });
