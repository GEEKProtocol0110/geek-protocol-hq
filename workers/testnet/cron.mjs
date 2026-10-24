import { timingSafeEqual } from 'node:crypto';
import { workerRequest } from './request.mjs';
import { processPayment } from './process.mjs';
import { reportFailure, reportOutcome } from './diagnostics.mjs';

async function runScheduledPayment() {
  const { createSigner, createRpc } = await import('./signer.mjs');
  const rpc = createRpc(), signer = createSigner(process.env.TESTNET_SIGNER_PRIVATE_KEY, rpc);
  try { return await processPayment({ request: workerRequest(), signer }); }
  finally { signer.close(); await rpc.disconnect(); }
}
export const createCronHandler = (run = runScheduledPayment, report) => async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  if (req.method !== 'GET') return res.status(405).json({ ok: false });
  const expected = process.env.CRON_SECRET || '', given = req.headers?.authorization || '';
  if (!/^[a-f0-9]{64}$/.test(expected) || typeof given !== 'string' || Buffer.byteLength(given) !== 71 ||
      !timingSafeEqual(Buffer.from(given), Buffer.from(`Bearer ${expected}`))) return res.status(401).json({ ok: false });
  if (process.env.VERCEL_ENV !== 'production' || process.env.TESTNET_SIGNER_ENABLED !== 'true') return res.status(200).json({ ok: true, state: 'paused' });
  try { const state = await run(); reportOutcome(state, report); return res.status(200).json({ ok: true, state }); }
  catch (error) { reportFailure('scheduled-run', error, report); return res.status(503).json({ ok: false, state: 'paused', error: 'Payment state retained. Check worker funding, configuration and connectivity.' }); }
};
