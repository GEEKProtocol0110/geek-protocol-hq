import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { Wasm } from '@kasplex/kiwi';

const key = new Wasm.PrivateKey('1'.padStart(64, '0'));
const sender = key.toPublicKey().toAddress('mainnet').toString();
const sha256 = value => createHash('sha256').update(value, 'utf8').digest('hex');
// Offline checks use a synthetic sender (public test key 0x…01), set before schedule.mjs reads the
// environment and pinned through the signer's test-only hook. The reviewed wallet's digest stays the
// pin everywhere else; this hook is refused in production and outside the Node test runner.
process.env.MAINNET_PAYOUT_ADDRESS = sender;
const { inscription, livePolicy, prepareTransactions, createSigner, pinTestSenderDigest } = await import('./signer.mjs');
const { DAILY_WHOLE, GAUNTLET_PERFECT_WHOLE, GEEK_DECIMALS, GEEK_DEPLOYMENT_HASH, MAINNET_PAYOUT_ADDRESS_SHA256, MAINNET_PAYOUT_SENDER, toRaw } = await import('./schedule.mjs');
const { jobMac } = await import('./job-mac.mjs');
pinTestSenderDigest(sha256(sender));
const otherKeyHex = '5'.padStart(64, '0');
const otherSender = new Wasm.PrivateKey(otherKeyHex).toPublicKey().toAddress('mainnet').toString();
const recipient = new Wasm.PrivateKey('2'.padStart(64, '0')).toPublicKey().toAddress('mainnet').toString();
const hmacSecret = 'cd'.repeat(32);
const mac = value => ({ ...value, mac: jobMac(value, hmacSecret) });
const proofContext = { runId: 'a'.repeat(40), bankVersion: 'f'.repeat(64), season: 'season-1' };
const job = mac({ network: 'mainnet', sender, recipient, ticker: 'GEEK', amount: toRaw(DAILY_WHOLE), proof: { ...proofContext, kind: 'daily', round: 1, correctCount: 1, answered: 5 } });
const entry = { address: sender, amount: 2000000000n, outpoint: { transactionId: 'a'.repeat(64), index: 2 },
  scriptPublicKey: Wasm.payToAddressScript(key.toPublicKey().toAddress('mainnet')), blockDaaScore: 0n, isCoinbase: false };
const fixturePolicy = { ...livePolicy, sender, syntheticFixture: true, jobHmacSecret: hmacSecret };

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
  await assert.rejects(prepareTransactions(key, job, [entry]), /JOB_MAC_INVALID|SIGNER_POLICY_MISMATCH/);
  const partial = mac({ ...job, amount: toRaw(70), proof: { ...proofContext, kind: 'gauntlet', round: 1, correctCount: 7, answered: 10 }, mac: undefined });
  const signed = await prepareTransactions(key, partial, [entry], fixturePolicy);
  assert.notEqual(signed.commit.id, signed.reveal.id);
  await assert.rejects(prepareTransactions(key, { ...partial, amount: toRaw(100) }, [entry], fixturePolicy), /JOB_MAC_INVALID/);
  const oneInRoundTen = mac({ ...job, amount: toRaw(1800), proof: { ...proofContext, kind: 'gauntlet', round: 10, correctCount: 1, answered: 10 }, mac: undefined });
  const roundTen = await prepareTransactions(key, oneInRoundTen, [entry], fixturePolicy);
  assert.notEqual(roundTen.commit.id, roundTen.reveal.id);
  await assert.rejects(prepareTransactions(key, mac({ ...oneInRoundTen, amount: toRaw(18000), mac: undefined }), [entry], fixturePolicy), /SIGNER_POLICY_MISMATCH/);
  await assert.rejects(prepareTransactions(key, { ...oneInRoundTen, amount: toRaw(18000) }, [entry], fixturePolicy), /JOB_MAC_INVALID/);
  process.env.MAINNET_PAYOUT_JOB_HMAC = hmacSecret;
  const signer = createSigner('1'.padStart(64, '0'), { getUtxosByAddresses() { throw new Error('UTXO_READ'); } });
  await assert.rejects(signer.prepare({}, oneInRoundTen, '2'.repeat(64)), /JOB_ALREADY_SIGNED/);
  signer.close();
  delete process.env.MAINNET_PAYOUT_JOB_HMAC;
  await assert.rejects(prepareTransactions(key, job, [], fixturePolicy), /FUNDED_UTXO_REQUIRED/);
});

test('the signer rejects a non-mainnet node and a key that is not the pinned hot wallet', async () => {
  const healthy = { networkId: 'mainnet', isSynced: true, hasUtxoIndex: true };
  for (const info of [{ ...healthy, networkId: 'testnet-10' }, { ...healthy, isSynced: false }, { ...healthy, hasUtxoIndex: false }]) {
    const signer = createSigner('1'.padStart(64, '0'), { isConnected: true, getServerInfo: async () => info });
    await assert.rejects(signer.verify({}, job), /MAINNET_SYNCED_NODE_REQUIRED/);
    signer.close();
  }
  // A valid, pinned, configured sender with a payable job. Only the signing key differs between the two runs.
  assert.equal(MAINNET_PAYOUT_SENDER, sender);
  const config = { sender, network: 'mainnet', ticker: 'GEEK', deploymentHash: GEEK_DEPLOYMENT_HASH, decimals: String(GEEK_DECIMALS), fingerprint: 'e'.repeat(64) };
  const payable = mac({ ...job, mac: undefined, deploymentHash: GEEK_DEPLOYMENT_HASH, decimals: String(GEEK_DECIMALS), configFingerprint: config.fingerprint });
  const originalFetch = globalThis.fetch; let indexerReads = 0;
  globalThis.fetch = async () => { indexerReads++; throw new Error('INDEXER_REACHED'); };
  process.env.MAINNET_PAYOUT_JOB_HMAC = hmacSecret;
  try {
    const mismatched = createSigner(otherKeyHex, { isConnected: true, getServerInfo: async () => healthy });
    await assert.rejects(mismatched.verify(config, payable), /SIGNER_POLICY_MISMATCH/);
    mismatched.close();
    assert.equal(indexerReads, 0, 'the mismatched key stops at the policy check');
    const matching = createSigner('1'.padStart(64, '0'), { isConnected: true, getServerInfo: async () => healthy });
    await assert.rejects(matching.verify(config, payable), /INDEXER_REACHED/);
    matching.close();
    assert.ok(indexerReads > 0, 'the same config and job pass the policy check with the pinned key');
  } finally { globalThis.fetch = originalFetch; delete process.env.MAINNET_PAYOUT_JOB_HMAC; }
});

test('a valid sender that is not pinned is refused outside production, including for a synthetic fixture', async () => {
  assert.notEqual(process.env.VERCEL_ENV, 'production');
  assert.notEqual(sha256(otherSender), sha256(sender));
  const otherKey = new Wasm.PrivateKey(otherKeyHex);
  const otherEntry = { ...entry, address: otherSender, scriptPublicKey: Wasm.payToAddressScript(otherKey.toPublicKey().toAddress('mainnet')) };
  const otherJob = mac({ ...job, mac: undefined, sender: otherSender });
  await assert.rejects(prepareTransactions(otherKey, otherJob, [otherEntry], { ...fixturePolicy, sender: otherSender }), /SIGNER_POLICY_MISMATCH/);
  const signer = createSigner(otherKeyHex, { isConnected: true, getServerInfo: async () => ({ networkId: 'mainnet', isSynced: true, hasUtxoIndex: true }) });
  await assert.rejects(signer.inspect({ network: 'mainnet', sender: otherSender }, { sender: otherSender }), /SIGNER_POLICY_MISMATCH/);
  signer.close(); otherKey.free();
});

test('the test pin hook is refused in production and outside the test runner, and the shipped pin is the reviewed digest', () => {
  assert.match(MAINNET_PAYOUT_ADDRESS_SHA256, /^[a-f0-9]{64}$/);
  assert.notEqual(MAINNET_PAYOUT_ADDRESS_SHA256, sha256(sender));
  const saved = { VERCEL_ENV: process.env.VERCEL_ENV, NODE_TEST_CONTEXT: process.env.NODE_TEST_CONTEXT };
  try {
    process.env.VERCEL_ENV = 'production';
    assert.throws(() => pinTestSenderDigest(sha256(sender)), /SIGNER_POLICY_MISMATCH/);
    delete process.env.VERCEL_ENV; delete process.env.NODE_TEST_CONTEXT;
    assert.throws(() => pinTestSenderDigest(sha256(sender)), /SIGNER_POLICY_MISMATCH/);
    process.env.NODE_TEST_CONTEXT = saved.NODE_TEST_CONTEXT;
    assert.throws(() => pinTestSenderDigest('not-a-digest'), /SIGNER_POLICY_MISMATCH/);
  } finally {
    for (const [name, value] of Object.entries(saved)) { if (value === undefined) delete process.env[name]; else process.env[name] = value; }
  }
});

test('the local worker does not read the signing key while paused', async () => {
  const marker = 'paused-key-marker';
  const run = async env => {
    const child = spawn(process.execPath, ['worker.mjs', '--once'], {
      cwd: fileURLToPath(new URL('.', import.meta.url)),
      env: { ...process.env, MAINNET_SIGNER_PRIVATE_KEY: marker, ...env }
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const [code] = await once(child, 'exit');
    return { code, output };
  };
  for (const env of [{ MAINNET_SIGNER_ENABLED: 'false', VERCEL_ENV: 'production' }, { MAINNET_SIGNER_ENABLED: 'true', VERCEL_ENV: 'preview' }]) {
    const result = await run(env);
    assert.equal(result.code, 0);
    assert.match(result.output, /mainnet worker: paused/);
    assert.equal(result.output.includes(marker), false);
  }
});


test('signing refuses public, legacy, Season 0 and incomplete answer proofs before RPC inputs or transaction construction', async () => {
  for (const fields of [{ bankVersion: undefined }, { bankVersion: 'public' }, { season: 'season-0' },
    { season: undefined }, { answered: 4 }, { runId: '' }, { unranked: true }, { correctCount: 0 }]) {
    const bad = mac({ ...job, proof: { ...job.proof, ...fields } });
    await assert.rejects(prepareTransactions(key, bad, [entry], fixturePolicy), /PRIVATE_RANKED_PROOF_REQUIRED/);
    const signer = createSigner('1'.padStart(64, '0'), {
      getServerInfo() { assert.fail('Invalid proof cannot reach RPC'); },
      getUtxosByAddresses() { assert.fail('Invalid proof cannot request signing inputs'); }
    });
    try {
      await assert.rejects(signer.verify({}, bad), /PRIVATE_RANKED_PROOF_REQUIRED/);
      await assert.rejects(signer.prepare({}, bad), /PRIVATE_RANKED_PROOF_REQUIRED/);
    } finally { signer.close(); }
  }
});

test('without a configured sender the live policy refuses to sign', async () => {
  for (const missing of [null, undefined, '']) {
    await assert.rejects(prepareTransactions(key, job, [entry], { ...livePolicy, sender: missing }), /SIGNER_POLICY_MISMATCH/);
    await assert.rejects(prepareTransactions(key, job, [entry], { ...fixturePolicy, sender: missing }), /SIGNER_POLICY_MISMATCH/);
  }
});
