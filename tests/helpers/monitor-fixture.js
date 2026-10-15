export function expectedProbe(spec) {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store, max-age=0' };
  let status = 200, body;
  if (spec.kind === 'page') { body = `<!doctype html><html>${spec.marker}</html>`; headers['Content-Type'] = 'text/html'; }
  else if (spec.kind === 'private-page') { status = 303; body = ''; headers.Location = '/ops-login/'; headers['Cache-Control'] = 'private, no-store'; }
  else if (spec.kind === 'private-api') { status = 401; body = { ok: false, error: 'Sign in.' }; headers['Cache-Control'] = 'private, no-store'; }
  else if (spec.kind === 'health') body = { ok: true, storage: 'connected' };
  else if (spec.kind === 'study') body = { ok: true, ranked: false, rewardsEnabled: false, topics: Array.from({ length: 11 }, (_, i) => ({ id: `topic-${i}`, count: 5 })) };
  else if (spec.kind === 'royale') body = { ok: true, discovery: { serverNow: Date.now(), rooms: [] } };
  else if (spec.kind === 'economy') body = { ok: true, economy: { journal: 'planning-only', purchasesEnabled: false, payoutsEnabled: false, burnsEnabled: false, reserve: { signingEnabled: false } } };
  else if (spec.kind === 'widget') body = { version: '1.5.0', size: 1138847, sha256: 'a'.repeat(64), release: 'https://github.com/GEEKProtocol0110/kaspa-live-widget/releases/tag/v1.5.0' };
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });
}
