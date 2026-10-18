// Every restart reads the durable journal BEFORE any transaction construction.
// Rebroadcasts use identical signed bytes and transaction IDs, never a new payment.
export async function processPayment({ request, signer }) {
  const claim = await request({ action: 'claim' });
  if (claim.busy) return 'busy';
  const { lease, config } = claim;
  let job = claim.job;
  const update = async (action, fields = {}) => {
    const result = await request({ action, lease, id: job.id, version: job.version, ...fields });
    job = result.job; return job;
  };
  try {
    if (!job) return 'idle';
    await signer.verify(config, job);
    if (!job.journal) {
      const journal = await signer.prepare(config, job);
      // A timeout here exits. The next claim retrieves the possibly committed
      // journal; nothing is broadcast from the unacknowledged local candidate.
      await update('prepare', { journal });
    } else {
      // Read-only reconciliation before any rebroadcast, including after a crash.
      await update('check');
      if (job.state === 'indexed-confirmed') return 'indexed-confirmed';
    }
    // Never trust transient RPC errors as proof of failure. Each submit receives
    // only the immutable persisted bytes. Still try the dependent reveal if a
    // duplicate/already-mined commit response is uncertain.
    let uncertain = false;
    for (const phase of ['commit', 'reveal']) {
      try { await signer.submit(job.journal[phase]); }
      catch { uncertain = true; }
    }
    await update('submitted');
    await update('check');
    return job.state === 'indexed-confirmed' ? job.state : uncertain ? 'reconciling' : 'awaiting-indexer';
  } finally {
    // Losing this response costs only the two-minute lease, never replay safety.
    try { await request({ action: 'release', lease }); } catch { /* expires */ }
  }
}
