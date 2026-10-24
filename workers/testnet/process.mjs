// Every restart reads the durable journal BEFORE any transaction construction.
// Rebroadcasts use identical signed bytes and transaction IDs, never a new payment.
import { reportFailure } from './diagnostics.mjs';
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
    for (const phase of ['commit', 'reveal']) {
      try { await signer.submit(job.journal[phase]); }
      catch (error) { uncertain = true; reportFailure(`submit-${phase}`, error, report); }
    }
    await step('mark-submitted', () => update('submitted'));
    await step('reconcile-after-submit', () => update('check'));
    return job.state === 'indexed-confirmed' ? job.state : uncertain ? 'reconciling' : 'awaiting-indexer';
  } finally {
    // Losing this response costs only the two-minute lease, never replay safety.
    try { await request({ action: 'release', lease }); } catch (error) { reportFailure('release', error, report); /* expires */ }
  }
}
