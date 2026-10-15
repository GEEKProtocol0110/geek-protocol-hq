// Local analysis of a pilot coordinator's assessment file. Not reward or identity proof.
export const evaluatePilot = data => {
  if (!data || data.schema !== 1 || !Array.isArray(data.participants) || data.participants.length > 1000) throw new Error('Invalid pilot data');
  const ids = new Set(), scores = { baseline:[], immediate:[], delayed:[] }, paired = [];
  for (const p of data.participants) {
    if (!p || typeof p.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(p.id) || ids.has(p.id)) throw new Error('Use unique pseudonymous participant IDs');
    ids.add(p.id);
    const observed = {};
    for (const phase of ['baseline','immediate','delayed']) {
      const x = p[phase]; if (x === null || x === undefined) continue;
      const at = Date.parse(x.at);
      if (!Number.isFinite(at) || x.total !== 5 || !Number.isInteger(x.correct) || x.correct < 0 || x.correct > 5) throw new Error('Invalid five-item assessment');
      observed[phase] = { at, correct:x.correct };
    }
    if (!observed.baseline || (observed.immediate && observed.immediate.at < observed.baseline.at)
      || (observed.delayed && (!observed.immediate || observed.delayed.at < observed.immediate.at + 24*3600000))) throw new Error('Assess in order; delayed review must be at least 24 hours after immediate review');
    for (const phase of Object.keys(observed)) scores[phase].push(observed[phase].correct);
    if (observed.delayed) paired.push(observed.delayed.correct - observed.baseline.correct);
  }
  const mean = xs => xs.length ? xs.reduce((a,b) => a+b,0)/xs.length : null;
  return { schema:1, started:data.participants.length,
    phases:Object.fromEntries(Object.entries(scores).map(([phase,xs]) => [phase,{ completed:xs.length, missing:data.participants.length-xs.length, meanCorrect:mean(xs), total:5 }])),
    delayedPairedCount:paired.length, meanPairedChange:mean(paired),
    provenance:'Coordinator-supplied observations; not server-verified game scores or a qualification.',
    limits:'Descriptive only. Missing delayed responses are excluded from paired change and reported separately. Repeated items, practice effects and cohort selection prevent attributing improvement solely to Geek.' };
};
