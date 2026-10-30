#!/usr/bin/env node
// Operator reset for a monthly season's pinned ranked-bank version.
//
// Each private-bank month-season records the bank version of its first saved
// ranked run (production only) at:
//   production:  geek:season-bank:season-N
//   other envs:  geek:<env>:season-bank:season-N   (e.g. geek:preview:...)
// If the live bank changes mid-season, new runs in that season are refused
// (503 RANKED_BANK_UNAVAILABLE) until the pin is cleared or
// GEEK_SEASON_BANK_VERSIONS sets the season's expected version explicitly.
//
// This is a local CLI only — there is deliberately no HTTP endpoint.
// It talks to Redis through UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
// from the operator's environment.
//
// Usage:
//   node scripts/season-bank-reset.mjs --season season-N --env production|preview|development [--confirm]
// Without --confirm it only prints the key and current value (dry run).
// Exit codes: 0 ok, 1 Redis error, 2 usage error.
import { seasonBankKey } from '../server/seasons.js';

export const parseArgs = argv => {
  const args = { confirm: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--confirm') args.confirm = true;
    else if (arg === '--season' || arg === '--env') { const value = argv[++i]; if (!value || value.startsWith('--')) throw new Error('USAGE'); args[arg.slice(2)] = value; }
    else throw new Error('USAGE');
  }
  if (!/^season-[1-9]\d{0,3}$/.test(args.season || '') || !/^[a-z0-9-]{1,32}$/.test(args.env || '')) throw new Error('USAGE');
  return args;
};
export const resetKeyFor = ({ season, env }) => seasonBankKey(season, { VERCEL_ENV: env });

export const main = async (argv = process.argv.slice(2), { redis, log = console.log, error = console.error } = {}) => {
  let args;
  try { args = parseArgs(argv); } catch {
    error('Usage: node scripts/season-bank-reset.mjs --season season-N --env production|preview|development [--confirm]');
    return 2;
  }
  const key = resetKeyFor(args);
  try {
    const command = redis || (await import('../server/redis.js')).redis;
    const current = await command('GET', key);
    log(`${key} = ${current ?? '(not set)'}`);
    if (!args.confirm) { log('Dry run. Re-run with --confirm to delete this pin.'); return 0; }
    const deleted = await command('DEL', key);
    log(deleted ? `Deleted ${key}.` : `Nothing to delete at ${key}.`);
    return 0;
  } catch (failure) {
    error(`Redis error: ${/^[A-Z_]{1,64}$/.test(failure?.message || '') ? failure.message : 'UNKNOWN'}`);
    return 1;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) process.exitCode = await main();
