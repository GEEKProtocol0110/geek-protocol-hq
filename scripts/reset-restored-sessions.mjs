import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const patterns = ['geek:session:*', 'geek:ops:session:*', 'geek:*:identity:challenge:*', 'geek:*:identity:authorization:*'];
const transient = key => /^geek:(session:|ops:session:|[a-z0-9-]+:identity:(challenge|authorization):)/.test(key);
export const resetRestoredSessions = async ({ command, apply = false }) => {
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
  let removed = 0; const list = [...keys];
  if (apply) for (let i = 0; i < list.length; i += 100) removed += Number(await command('DEL', ...list.slice(i, i + 100)));
  return { mode: apply ? 'applied' : 'dry-run', matched: keys.size, removed };
};
export const recoveryTarget = (env, host) => {
  let url;
  try { url = new URL(env.RECOVERY_REDIS_REST_URL); } catch { throw new Error('Configure a dedicated restored-database HTTPS endpoint.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash || url.hostname !== host || !env.RECOVERY_REDIS_REST_TOKEN) throw new Error('Restored host confirmation or credentials are missing.');
  for (const current of [env.UPSTASH_REDIS_REST_URL, env.KV_REST_API_URL].filter(Boolean)) {
    try { if (new URL(current).origin === url.origin) throw new Error('Refusing the configured application database.'); }
    catch (error) { if (error.message === 'Refusing the configured application database.') throw error; }
  }
  return url.origin;
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2), apply = args.includes('--apply');
    const clean = args.filter(value => value !== '--apply');
    if (clean.length !== 2 || clean[0] !== '--restored-host' || args.filter(value=>value==='--apply').length > 1) throw new Error('Usage: node scripts/reset-restored-sessions.mjs --restored-host RESTORED_HOST [--apply]');
    const url = recoveryTarget(process.env, clean[1]);
    const command = async (...values) => {
      const response = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${process.env.RECOVERY_REDIS_REST_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify(values), signal: AbortSignal.timeout(15_000) });
      const payload = await response.json();
      if (!response.ok || payload.error) throw new Error('Restored-database command failed.');
      return payload.result;
    };
    console.log(JSON.stringify(await resetRestoredSessions({command,apply})));
  } catch { console.error('Recovery action stopped. Check the restored-only endpoint, explicit host, credentials and command arguments. If removal had started, rerun on the same offline restore to finish.'); process.exitCode = 1; }
}
