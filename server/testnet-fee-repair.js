// A fee correction conflicts with the retained commit's SAME funding outpoint.
// This is not another independent payment. Neither retained journal is erased.
import { createHash } from 'node:crypto';
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const keys = (value, expected) => value && Object.keys(value).sort().join(',') === expected.split(',').sort().join(',');
const hex = (value, n) => typeof value === 'string' && new RegExp(`^[a-f0-9]{${n}}$`).test(value);
const quantity = value => typeof value === 'string' && /^(?:0|[1-9][0-9]{0,19})$/.test(value) && BigInt(value) <= 18446744073709551615n;
function transaction(saved) {
  if (!keys(saved, 'id,transaction') || !hex(saved.id, 64) || typeof saved.transaction !== 'string' || saved.transaction.length > 2800) throw Error();
  const tx = JSON.parse(saved.transaction);
  if (!keys(tx, 'id,version,inputs,outputs,subnetworkId,lockTime,gas,mass,payload') || tx.id !== saved.id || tx.version !== 0 ||
      tx.subnetworkId !== '0'.repeat(40) || tx.lockTime !== '0' || tx.gas !== '0' || tx.payload !== '' ||
      !quantity(tx.mass) || BigInt(tx.mass) > 100000n || !Array.isArray(tx.inputs) || tx.inputs.length !== 1 ||
      !Array.isArray(tx.outputs) || tx.outputs.length < 1 || tx.outputs.length > 2) throw Error();
  const input = tx.inputs[0];
  if (!keys(input, 'transactionId,index,sequence,sigOpCount,signatureScript,utxo') || !hex(input.transactionId, 64) ||
      !Number.isSafeInteger(input.index) || input.index < 0 || input.sequence !== '0' || input.sigOpCount !== 1 ||
      typeof input.signatureScript !== 'string' || !/^[a-f0-9]+$/.test(input.signatureScript) || input.signatureScript.length % 2 ||
      !keys(input.utxo, 'address,amount,scriptPublicKey,blockDaaScore,isCoinbase') || input.utxo.address !== null ||
      !quantity(input.utxo.amount) || !quantity(input.utxo.blockDaaScore) || typeof input.utxo.isCoinbase !== 'boolean') throw Error();
  for (const output of tx.outputs) if (!keys(output, 'value,scriptPublicKey') || !quantity(output.value) || BigInt(output.value) === 0n ||
      !/^0000[a-f0-9]+$/.test(output.scriptPublicKey)) throw Error();
  return tx;
}
const unsignedInput = input => { const { signatureScript, ...rest } = input; return rest; };
const fee = tx => BigInt(tx.inputs[0].utxo.amount) - tx.outputs.reduce((n, o) => n + BigInt(o.value), 0n);
export function validateFeeRepair(job, journal) {
  try {
    if (!job.freshTestOf || job.network !== 'testnet-10' || job.ticker !== 'GEEKT' || job.amount !== '100000000' || job.decimals !== '8' ||
        !keys(journal, 'commit,reveal') || !keys(job.journal, 'commit,reveal')) throw Error();
    const oldC = transaction(job.journal.commit), oldR = transaction(job.journal.reveal);
    const c = transaction(journal.commit), r = transaction(journal.reveal), index = oldR.inputs[0].index;
    if (oldC.outputs.length !== 2 || c.outputs.length !== 2 || oldR.outputs.length !== 1 || r.outputs.length !== 1 || index > 1 ||
        oldR.inputs[0].transactionId !== oldC.id || r.inputs[0].transactionId !== c.id || r.inputs[0].index !== index ||
        c.id === oldC.id || r.id === oldR.id || c.id === r.id ||
        !equal(unsignedInput(c.inputs[0]), unsignedInput(oldC.inputs[0])) ||
        !equal(c.outputs[index], oldC.outputs[index]) || c.outputs[index].value !== '130000000' ||
        c.outputs[1 - index].scriptPublicKey !== oldC.outputs[1 - index].scriptPublicKey ||
        c.outputs[1 - index].scriptPublicKey !== oldC.inputs[0].utxo.scriptPublicKey ||
        BigInt(c.outputs[1 - index].value) >= BigInt(oldC.outputs[1 - index].value) ||
        !equal(r.inputs[0].utxo, oldR.inputs[0].utxo) || r.inputs[0].utxo.amount !== '130000000' ||
        r.inputs[0].utxo.scriptPublicKey !== c.outputs[index].scriptPublicKey ||
        !/^41[a-f0-9]{128}01/.test(r.inputs[0].signatureScript) ||
        r.inputs[0].signatureScript.slice(132) !== oldR.inputs[0].signatureScript.slice(132) ||
        r.outputs[0].scriptPublicKey !== oldR.outputs[0].scriptPublicKey || r.outputs[0].scriptPublicKey !== oldC.inputs[0].utxo.scriptPublicKey ||
        fee(oldC) <= 0n || fee(oldR) <= 0n || fee(c) <= fee(oldC) || fee(r) < fee(oldR) || fee(c) + fee(r) > 5000000n) throw Error();
    return true;
  } catch { throw new Error('TESTNET_AUTO_FEE_REPAIR_INVALID'); }
}
export function decodeFeeRepair(job) {
  if (job.feeRepair === undefined) return null;
  const repair = job.feeRepair;
  if (!keys(repair, 'schema,reason,originalJournalHash,createdAt,journal') || repair.schema !== 1 || repair.reason !== 'insufficient-fee' ||
      repair.originalJournalHash !== digest(job.journal) || !Number.isSafeInteger(repair.createdAt) || repair.createdAt <= 0) throw new Error('TESTNET_AUTO_FEE_REPAIR_INVALID');
  validateFeeRepair(job, repair.journal);
  return repair;
}
export const createFeeRepair = (job, journal) => {
  validateFeeRepair(job, journal);
  return { schema: 1, reason: 'insufficient-fee', originalJournalHash: digest(job.journal), createdAt: Date.now(), journal };
};
