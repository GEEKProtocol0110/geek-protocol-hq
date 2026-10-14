import { readFileSync } from 'node:fs';
import { stressExamples } from '../server/economy-stress.js';
const report = stressExamples();
if (process.argv.includes('--check')) {
  const saved = JSON.parse(readFileSync(new URL('../docs/economy-stress-report.json', import.meta.url), 'utf8'));
  if (JSON.stringify(saved) !== JSON.stringify(report)) throw new Error('STRESS_REPORT_STALE');
  console.log('Economy stress baseline matches the current model.');
} else console.log(JSON.stringify(report, null, 2));
for (const pool of Object.values(report.reserve)) {
  const a = BigInt(pool.modeledAvailableRaw), paid = BigInt(pool.coveredRewardsRaw), closed = BigInt(pool.closingReserveRaw);
  if (a !== paid + closed || BigInt(pool.feeTotalRaw) !== BigInt(pool.recyclePendingRaw) + BigInt(pool.burnPendingRaw) || paid > BigInt(pool.input.rewardCapRaw) || closed < 0n) throw new Error('STRESS_INVARIANT_FAILED');
}
