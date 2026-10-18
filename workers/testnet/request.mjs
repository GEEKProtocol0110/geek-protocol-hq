export function workerRequest(env = process.env) {
  const origin = env.HQ_REWARD_ORIGIN || 'https://www.geekprotocol.xyz', token = env.TESTNET_AUTO_WORKER_TOKEN;
  if (!['https://www.geekprotocol.xyz', 'https://geekprotocol.xyz'].includes(origin)) throw new Error('CANONICAL_HQ_REQUIRED');
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw new Error('WORKER_TOKEN_REQUIRED');
  return async body => {
    const response = await fetch(`${origin}/api/session/?service=testnet-worker`, { method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body), redirect: 'error', signal: AbortSignal.timeout(30000) });
    const payload = await response.json();
    if (!response.ok || payload.ok !== true) throw new Error('HQ_REQUEST_FAILED');
    return payload;
  };
}
