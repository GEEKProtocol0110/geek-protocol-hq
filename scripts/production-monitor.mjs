import { probeProduction, monitorChecks } from '../server/production-monitor.js';
const report = await probeProduction();
if (process.argv.includes('--json')) console.log(JSON.stringify(report));
else {
  console.log(`### Geek HQ production check\n\nChecked ${new Date(report.checkedAt).toISOString()}. ${report.passed ? 'All probes passed.' : 'Attention required.'}\n`);
  console.log('| Check | Result | HTTP | Response time | Reason |\n| --- | --- | --- | --- | --- |');
  for (const check of report.checks) console.log(`| ${monitorChecks.find(s => s.id === check.id).name} | ${check.passed ? 'Passed' : 'Failed'} | ${check.status || 'No response'} | ${check.elapsedMs} ms | ${check.reason} |`);
  console.log('\nRead-only HTTP checks. They do not play games, sign transactions, certify backup recovery, or prove wallet/phone behavior. No response bodies or credentials are recorded.');
}
if (!report.passed) process.exitCode = 1;
