// Every restart reads the durable journal BEFORE any transaction construction.
// A single same-input fee repair retains the original pair and is acknowledged
// before broadcast. Restart recovery always uses that acknowledged active pair.
import { reportFailure, reportJournalState } from './diagnostics.mjs';
export async function processPayment({ request, signer, report }) {
  const step = async (stage, action) => {
    try { return await action(); }
    catch (error) { reportFailure(stage, error, report); throw error; }
  };
  const claim = await step('claim', () => request({ action: 'claim' }));
  if (claim.busy) return 'busy';
  const { lease, config } = claim;
  let job = claim.job;
  const update = async (action, fields = {}) => {
    const result = await request({ action, lease, id: job.id, version: job.version, ...fields });
    job = result.job; return job;
  };
  try {
    if (!job) return 'idle';
    await step('verify', () => signer.verify(config, job));
    if (!job.journal) {
      const journal = await step('prepare', () => signer.prepare(config, job));
      // A timeout here exits. The next claim retrieves the possibly committed
      // journal; nothing is broadcast from the unacknowledged local candidate.
      await step('persist-journal', () => update('prepare', { journal }));
    } else {
      // Read-only reconciliation before any rebroadcast, including after a crash.
      await step('reconcile-before-submit', () => update('check'));
      if (job.state === 'indexed-confirmed') return 'indexed-confirmed';
    }
    // Never trust transient RPC errors as proof of failure. Each submit receives
    // only the immutable persisted bytes. Still try the dependent reveal if a
    // duplicate/already-mined commit response is uncertain.
    let uncertain = false;
    for (let attempt = 0; attempt < 2; attempt++) {
      let missingInputs = false, insufficientFee = false;
      uncertain = false;
      const journal = job.feeRepair?.journal || job.journal;
      for (const phase of ['commit', 'reveal']) {
        try { await signer.submit(journal[phase]); }
        catch (error) {
          uncertain = true;
          const code = reportFailure(`submit-${phase}`, error, report);
          if (code === 'RPC_INPUT_UNAVAILABLE') missingInputs = true;
          if (phase === 'commit' && code === 'RPC_INSUFFICIENT_FEE') insufficientFee = true;
        }
      }
      if (insufficientFee && job.freshTestOf && !job.feeRepair && typeof signer.repair === 'function') {
        await step('reconcile-before-repair', () => update('check'));
        if (job.state === 'indexed-confirmed') return 'indexed-confirmed';
        const repaired = await step('repair-fee', () => signer.repair(config, job));
        // A lost acknowledgement exits without broadcasting the local candidate.
        await step('persist-fee-repair', () => update('repair-fee', { journal: repaired }));
        continue;
      }
      if (missingInputs && typeof signer.inspect === 'function') {
        try { reportJournalState(await signer.inspect(config, { ...job, journal }), report); }
        catch (error) { reportFailure('inspect-journal', error, report); }
      }
      break;
    }
    await step('mark-submitted', () => update('submitted'));
    await step('reconcile-after-submit', () => update('check'));
    return job.state === 'indexed-confirmed' ? job.state : uncertain ? 'reconciling' : 'awaiting-indexer';
  } finally {
    // Losing this response costs only the two-minute lease, never replay safety.
    try { await request({ action: 'release', lease }); } catch (error) { reportFailure('release', error, report); /* expires */ }
  }
}
