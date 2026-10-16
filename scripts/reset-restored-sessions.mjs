import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const patterns = ['geek:session:*', 'geek:ops:session:*', 'geek:*:identity:challenge:*', 'geek:*:identity:authorization:*', 'geek:passkey:challenge:v1:*', 'geek:passkey:grant:v1:*'];
const transient = key => /^geek:(session:|ops:session:|[a-z0-9-]+:identity:(challenge|authorization):|passkey:(challenge|grant):v1:)/.test(key);
const scanSessions = async command => {
  const keys = new Set();
  for (const pattern of patterns) {
    let cursor = '0', pages = 0;
    do {
      if (++pages > 10_000) throw new Error('Recovery scan limit reached; no further action taken.');
      const result = await command('SCAN', cursor, 'MATCH', pattern, 'COUNT', 100);
      if (!Array.isArray(result) || result.length !== 2 || !/^\d+$/.test(String(result[0])) || !Array.isArray(result[1])) throw new Error('Invalid recovery scan response.');
      cursor = String(result[0]);
      for (const key of result[1]) {
        if (typeof key !== 'string' || !transient(key)) throw new Error('Unexpected key in recovery scan; no sessions removed.');
        keys.add(key); if (keys.size > 100_000) throw new Error('Recovery key limit reached; no sessions removed.');
      }
    } while (cursor !== '0');
  }
  return keys;
};
export const resetRestoredSessions = async ({ command, apply = false }) => {
  if (typeof apply !== 'boolean') throw new Error('Recovery mode must be explicit.');
  const keys = await scanSessions(command);
  let removed = 0; const list = [...keys];
  if (apply) {
    for (let i = 0; i < list.length; i += 100) {
      const batch = list.slice(i, i + 100), count = await command('DEL', ...batch);
      if (!Number.isSafeInteger(count) || count < 0 || count > batch.length) throw new Error('Invalid recovery deletion response; inspect the offline restore before retrying.');
      removed += count;
    }
    if ((await scanSessions(command)).size) throw new Error('Restored sessions remain; keep the target offline and rerun cleanup.');
  }
  return { mode: apply ? 'applied' : 'dry-run', matched: keys.size, removed };
};
const validHost = host => {
  if (typeof host !== 'string' || host.length > 253 || !host.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return false;
  try { return new URL(`https://${host}`).hostname === host; } catch { return false; }
};
export const recoveryTarget = (env, host, productionHost) => {
  let url;
  try { url = new URL(env.RECOVERY_REDIS_REST_URL); } catch { throw new Error('Configure a dedicated restored-database HTTPS endpoint.'); }
  if (!validHost(host) || !validHost(productionHost) || host === productionHost) throw new Error('Confirm distinct production and restored database hosts.');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash || url.hostname !== host || !env.RECOVERY_REDIS_REST_TOKEN?.trim()) throw new Error('Restored host confirmation or credentials are missing.');
  for (const current of [env.UPSTASH_REDIS_REST_URL, env.KV_REST_API_URL].filter(Boolean)) {
    let application;
    try { application = new URL(current); } catch { throw new Error('Invalid configured application endpoint; recovery stopped.'); }
    if (application.hostname.replace(/\.$/, '') === host) throw new Error('Refusing the configured application database.');
    if (application.protocol !== 'https:' || application.username || application.password || application.pathname !== '/' || application.search || application.hash || !validHost(application.hostname.replace(/\.$/, ''))) throw new Error('Invalid configured application endpoint; recovery stopped.');
  }
  return url.origin;
};
export const recoveryCommand = ({ url, token }) => async (...values) => {
  const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { method: 'POST', redirect: 'error', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(values), signal: controller.signal });
    const payload = await response.json();
    if (!response.ok || !payload || Array.isArray(payload) || payload.error || !Object.hasOwn(payload, 'result')) throw new Error('Invalid recovery response.');
    return payload.result;
  } catch { throw new Error('Restored-database command failed; inspect saved state before retrying.'); }
  finally { clearTimeout(deadline); }
};
export const recoveryArguments = args => {
  const options = { apply: false };
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--apply' && !options.apply) options.apply = true;
    else if (['--production-host', '--restored-host'].includes(flag) && !Object.hasOwn(options, flag) && args[i + 1] && !args[i + 1].startsWith('--')) options[flag] = args[++i];
    else throw new Error('Invalid recovery arguments.');
  }
  if (!options['--production-host'] || !options['--restored-host']) throw new Error('Both database host confirmations are required.');
  return options;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = recoveryArguments(process.argv.slice(2)), apply = options.apply;
    const url = recoveryTarget(process.env, options['--restored-host'], options['--production-host']);
    const command = recoveryCommand({ url, token: process.env.RECOVERY_REDIS_REST_TOKEN });
    console.log(JSON.stringify(await resetRestoredSessions({command,apply})));
  } catch { console.error('Recovery action stopped. Confirm distinct --production-host and --restored-host, the restored-only credentials and offline isolation. If removal had started, inspect and rerun on the same offline restore to finish.'); process.exitCode = 1; }
}
