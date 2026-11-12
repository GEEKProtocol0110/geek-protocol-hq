import { Wasm } from '@kasplex/kiwi';
import { readRpcHealth, rpcDeadline } from './rpc-health.mjs';
import { GEEK_DECIMALS, GEEK_DEPLOYMENT_HASH, GEEK_TICKER, MAINNET_PAYOUT_SENDER, expectedRaw } from './schedule.mjs';

const hashPattern = /^[a-f0-9]{64}$/;
const BASE = 'https://api.kasplex.org/v1/krc20';
const FUNDING = 130000000n, MAX_FEE = 5000000n;
// Mainnet relay pricing follows the pinned SDK default of 1 sompi/gram.
// The tested TN10 worker used 100. Commit/reveal shape and the combined fee ceiling are unchanged.
const FEE_RATE = 1;
const bounded = promise => rpcDeadline(() => promise);

export const livePolicy = Object.freeze({
  network: 'mainnet',
  addressNetwork: 'mainnet',
  networkId: 'mainnet',
  sender: MAINNET_PAYOUT_SENDER,
  feeRate: FEE_RATE,
  syntheticFixture: false
});

function policyOf(policy) {
  const chosen = policy || livePolicy;
  if (chosen.network !== 'mainnet' || chosen.networkId !== 'mainnet' || chosen.addressNetwork !== 'mainnet' || chosen.feeRate !== FEE_RATE) throw new Error('SIGNER_POLICY_MISMATCH');
  if (chosen.sender !== MAINNET_PAYOUT_SENDER && chosen.syntheticFixture !== true) throw new Error('SIGNER_POLICY_MISMATCH');
  return chosen;
}

function finalized(pending, policy) {
  const tx = Wasm.Transaction.deserializeFromSafeJSON(pending.serializeToSafeJSON());
  try {
    const object = tx.serializeToObject();
    const numbers = values => values.map(value => {
      if (BigInt(value) > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('TRANSACTION_MASS_INVALID');
      return Number(value);
    });
    const mass = Wasm.calculateStorageMass(policy.networkId, numbers(object.inputs.map(i => i.utxo.amount)), numbers(object.outputs.map(o => o.value)));
    const fullMass = Wasm.calculateTransactionMass(policy.networkId, tx);
    const fee = object.inputs.reduce((n, i) => n + BigInt(i.utxo.amount), 0n) - object.outputs.reduce((n, o) => n + BigInt(o.value), 0n);
    if (mass === undefined || mass > 100000n || fullMass > 100000n) throw new Error('TRANSACTION_MASS_INVALID');
    if (fee > MAX_FEE) throw new Error('FEE_LIMIT_EXCEEDED');
    if (fee < fullMass * BigInt(policy.feeRate)) {
      const error = new Error('FEE_RATE_SHORTFALL'); error.shortfall = fullMass * BigInt(policy.feeRate) - fee; throw error;
    }
    tx.mass = mass;
    if (tx.id !== pending.id) throw new Error('JOURNAL_HASH_MISMATCH');
    return { id: tx.id, transaction: tx.serializeToSafeJSON() };
  } finally { tx.free(); }
}

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

export async function prepareTransactions(key, job, entries, policy = livePolicy) {
  const rules = policyOf(policy);
  const sender = key.toPublicKey().toAddress(rules.addressNetwork).toString();
  // Exact amount for this proof's round and server-graded correctCount. Another
  // schedule amount, including that round's perfect maximum, is not payable.
  const boundAmount = expectedRaw(job.proof);
  if (job.network !== 'mainnet' || job.sender !== sender || job.sender !== rules.sender || !job.recipient?.startsWith('kaspa:') ||
      job.recipient === sender || job.ticker !== GEEK_TICKER || !boundAmount || job.amount !== boundAmount) throw new Error('SIGNER_POLICY_MISMATCH');
  const script = inscription(key, job), spk = script.createPayToScriptHashScript();
  const address = Wasm.addressFromScriptPublicKey(spk, rules.addressNetwork);
  let commit, reveal;
  try {
    const entry = entries.find(e => BigInt(e.amount ?? e.entry?.amount ?? 0) >= FUNDING + MAX_FEE);
    if (!entry) throw new Error('FUNDED_UTXO_REQUIRED');
    let savedCommit, padding = 0n;
    for (let attempt = 0; attempt < 3; attempt++) {
      const first = await Wasm.createTransactions({ entries: [entry], changeAddress: sender,
        outputs: [{ address: address.toString(), amount: FUNDING }], priorityFee: padding, feeRate: rules.feeRate, networkId: rules.networkId });
      if (first.transactions.length !== 1) throw new Error('CONSOLIDATION_NOT_ALLOWED');
      commit = first.transactions[0]; commit.sign([key]);
      try { savedCommit = finalized(commit, rules); break; }
      catch (error) {
        if (error.message !== 'FEE_RATE_SHORTFALL' || attempt === 2) throw error;
        padding += error.shortfall + 100000n;
        if (padding > MAX_FEE) throw new Error('FEE_LIMIT_EXCEEDED');
        commit.free(); commit = null;
      }
    }
    const commitObject = commit.serializeToObject();
    const outputIndex = commitObject.outputs.findIndex(o => o.scriptPublicKey === spk.version.toString(16).padStart(4, '0') + spk.script && BigInt(o.value) === FUNDING);
    if (outputIndex < 0) throw new Error('COMMIT_OUTPUT_INVALID');
    const second = await Wasm.createTransactions({ entries: [{ address: address.toString(), amount: FUNDING,
      outpoint: { transactionId: commit.id, index: outputIndex }, scriptPublicKey: spk, blockDaaScore: 18446744073709551615n, isCoinbase: false }],
    changeAddress: sender, outputs: [], priorityFee: 100000n, feeRate: rules.feeRate, sigOpCount: 1, networkId: rules.networkId });
    if (second.transactions.length !== 1) throw new Error('CONSOLIDATION_NOT_ALLOWED');
    reveal = second.transactions[0];
    for (let i = 0; i < reveal.transaction.inputs.length; i++) {
      const signature = reveal.createInputSignature(i, key);
      reveal.fillInput(i, script.encodePayToScriptHashSignatureScript(signature));
    }
    if (commit.feeAmount + reveal.feeAmount > MAX_FEE) throw new Error('FEE_LIMIT_EXCEEDED');
    const journal = { commit: savedCommit, reveal: finalized(reveal, rules) };
    if (Object.values(journal).some(tx => !hashPattern.test(tx.id) || tx.transaction.length > 2800)) throw new Error('JOURNAL_LIMIT_EXCEEDED');
    return journal;
  } finally { commit?.free(); reveal?.free(); script.free(); spk.free(); address?.free(); }
}

export async function inspectJournal(job, rpc) {
  let commit, reveal, spk, address;
  try {
    commit = Wasm.Transaction.deserializeFromSafeJSON(job.journal.commit.transaction);
    reveal = Wasm.Transaction.deserializeFromSafeJSON(job.journal.reveal.transaction);
    const c = commit.serializeToObject(), r = reveal.serializeToObject(), input = r.inputs[0];
    if (job.network !== 'mainnet' || !job.sender?.startsWith('kaspa:') || commit.id !== job.journal.commit.id ||
        reveal.id !== job.journal.reveal.id || c.inputs.length !== 1 || r.inputs.length !== 1 ||
        input.transactionId !== commit.id || !Number.isInteger(input.index) || !c.outputs[input.index]) throw new Error('JOURNAL_LINK_MISMATCH');
    const script = c.outputs[input.index].scriptPublicKey;
    if (typeof script !== 'string' || !/^[a-f0-9]{6,}$/.test(script)) throw new Error('JOURNAL_LINK_MISMATCH');
    spk = new Wasm.ScriptPublicKey(parseInt(script.slice(0, 4), 16), script.slice(4));
    address = Wasm.addressFromScriptPublicKey(spk, 'mainnet');
    if (!address) throw new Error('JOURNAL_LINK_MISMATCH');
    const { entries } = await bounded(rpc.getUtxosByAddresses({ addresses: [job.sender, address.toString()] }));
    if (!Array.isArray(entries)) throw new Error('JOURNAL_INSPECTION_FAILED');
    const available = point => entries.some(e => {
      const outpoint = e.outpoint || e.entry?.outpoint;
      return String(outpoint?.transactionId) === point.transactionId && outpoint.index === point.index;
    });
    return { commitInputsAvailable: c.inputs.every(available), revealInputAvailable: available(input) };
  } finally { commit?.free(); reveal?.free(); spk?.free(); address?.free(); }
}

export function createSigner(secret, rpc) {
  if (!hashPattern.test(secret || '')) throw new Error('DEDICATED_SIGNER_KEY_REQUIRED');
  const key = new Wasm.PrivateKey(secret);
  const sender = () => key.toPublicKey().toAddress('mainnet').toString();
  return {
    async verify(config, job) {
      const info = await readRpcHealth(rpc);
      if (info.networkId !== 'mainnet' || !info.isSynced || !info.hasUtxoIndex) throw new Error('MAINNET_SYNCED_NODE_REQUIRED');
      if (sender() !== MAINNET_PAYOUT_SENDER || config?.sender !== MAINNET_PAYOUT_SENDER || job?.sender !== MAINNET_PAYOUT_SENDER ||
          config?.network !== 'mainnet' || job?.network !== 'mainnet' || config?.ticker !== GEEK_TICKER || job?.ticker !== GEEK_TICKER ||
          config?.deploymentHash !== GEEK_DEPLOYMENT_HASH || job?.deploymentHash !== GEEK_DEPLOYMENT_HASH ||
          String(config?.decimals) !== String(GEEK_DECIMALS) || String(job?.decimals) !== String(GEEK_DECIMALS) ||
          config?.fingerprint !== job?.configFingerprint || job?.amount !== expectedRaw(job?.proof) ||
          job?.recipient === job?.sender) throw new Error('SIGNER_POLICY_MISMATCH');
      const [asset, deploy] = await Promise.all([indexed(`token/${job.ticker}`), indexed(`op/${job.deploymentHash}`)]);
      if (asset?.tick !== job.ticker || asset.state !== 'deployed' || asset.hashRev !== job.deploymentHash || asset.dec !== String(job.decimals) ||
          deploy?.hashRev !== job.deploymentHash || deploy.p !== 'KRC-20' || deploy.op !== 'deploy' || deploy.tick !== job.ticker ||
          deploy.dec !== String(job.decimals) || deploy.txAccept !== '1' || deploy.opAccept !== '1' || deploy.opError) throw new Error('PINNED_ASSET_REQUIRED');
      if (!job.journal) {
        const balance = await indexed(`address/${job.sender}/tokenlist?tick=${job.ticker}`);
        if (balance?.tick !== job.ticker || balance.dec !== String(job.decimals) || !/^[0-9]+$/.test(balance.balance) ||
            BigInt(balance.balance) < BigInt(job.amount)) throw new Error('GEEK_FUNDING_REQUIRED');
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
    async inspect(config, job) {
      if (config.network !== 'mainnet' || config.sender !== sender() || config.sender !== MAINNET_PAYOUT_SENDER || job.sender !== config.sender) throw new Error('SIGNER_POLICY_MISMATCH');
      const info = await rpcDeadline(() => rpc.getServerInfo(), 'RPC_SERVER_INFO_TIMEOUT', 6000);
      if (info.networkId !== 'mainnet' || !info.isSynced || !info.hasUtxoIndex) throw new Error('MAINNET_SYNCED_NODE_REQUIRED');
      return inspectJournal(job, rpc);
    },
    close() { key.free(); }
  };
}
export const createRpc = () => new Wasm.RpcClient({ resolver: new Wasm.Resolver(), networkId: 'mainnet', encoding: Wasm.Encoding.Borsh });
