import { setTimeout as delay } from 'node:timers/promises';
import { processPayment } from './process.mjs';
import { createSigner, createRpc } from './signer.mjs';
import { workerRequest } from './request.mjs';
import { rpcDeadline } from './rpc-health.mjs';

const request = workerRequest();
const rpc = createRpc(), signer = createSigner(process.env.TESTNET_SIGNER_PRIVATE_KEY, rpc);
let stopping = false;
process.on('SIGINT', () => { stopping = true; }); process.on('SIGTERM', () => { stopping = true; });
try {
  do {
    try {
      console.log(`TN10 worker: ${await processPayment({ request, signer })}`);
    } catch { console.error('TN10 worker paused: check configuration, funding, HQ and RPC. Payment journals retained.'); }
    if (!stopping && !process.argv.includes('--once')) await delay(15000);
  } while (!stopping && !process.argv.includes('--once'));
} finally { signer.close(); await rpcDeadline(() => rpc.disconnect(), 'RPC_DISCONNECT_FAILED', 2000); }
