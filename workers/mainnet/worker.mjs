import { setTimeout as delay } from 'node:timers/promises';

// Same gate as cron.mjs. The signing key is not read, and the signer module is
// not loaded, until production and the explicit signer flag are both set.
const paused = () => process.env.VERCEL_ENV !== 'production' || process.env.MAINNET_SIGNER_ENABLED !== 'true';
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
process.on('SIGTERM', () => { stopping = true; });
if (paused()) {
  console.log('mainnet worker: paused');
} else {
  const { processPayment } = await import('./process.mjs');
  const { createSigner, createRpc } = await import('./signer.mjs');
  const { workerRequest } = await import('./request.mjs');
  const { rpcDeadline } = await import('./rpc-health.mjs');
  const request = workerRequest();
  const rpc = createRpc();
  const signer = createSigner(process.env.MAINNET_SIGNER_PRIVATE_KEY, rpc);
  try {
    do {
      try {
        console.log(`mainnet worker: ${await processPayment({ request, signer })}`);
      } catch { console.error('mainnet worker paused: check configuration, funding, HQ and RPC. Payment journals retained.'); }
      if (!stopping && !process.argv.includes('--once')) await delay(15000);
    } while (!stopping && !process.argv.includes('--once'));
  } finally { signer.close(); await rpcDeadline(() => rpc.disconnect(), 'RPC_DISCONNECT_FAILED', 2000); }
}
