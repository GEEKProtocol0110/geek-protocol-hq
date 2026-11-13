#!/usr/bin/env node
// Local synthetic API rehearsal. This never enables deployed Preview ranked writes.
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const rehearsalEnvironment = (env = process.env) => Object.fromEntries(
  ['PATH', 'REDIS_SERVER_BIN', 'TMPDIR'].filter(key => typeof env[key] === 'string').map(key => [key, env[key]])
);

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Local synthetic private-bank rehearsal: fresh loopback Redis, fake banks, no inherited credentials or provider settings.');
  const result = spawnSync(process.execPath, ['--test',
    'tests/private-bank-rehearsal.test.js',
    'tests/monthly-seasons.test.js',
    'tests/private-ranked-bank.test.js',
    'tests/private-bank-resilience.test.js',
    'tests/private-bank-tooling.test.js',
    'tests/private-bank-leak-check.test.js'
  ], { cwd: fileURLToPath(new URL('..', import.meta.url)), env: rehearsalEnvironment(), stdio: 'inherit', timeout: 60000 });
  if (result.error || result.signal) {
    console.error('Synthetic rehearsal did not complete; no hosted acceptance is claimed.');
    process.exitCode = 1;
  } else process.exitCode = result.status ?? 1;
}
