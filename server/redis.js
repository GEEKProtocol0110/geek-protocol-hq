const config = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
});

const request = async (path, body) => {
  const { url, token } = config();
  // Only fixed labels and bounded numbers enter logs. Never include an Error,
  // provider payload, endpoint, command, key, token or player information.
  const started = performance.now();
  let failure = 'configuration', status = null, stage = 'configuration';
  const report = () => {
    try {
      console.error('Geek Redis failure', JSON.stringify({
        failure, stage, operation: path === '/multi-exec' ? 'transaction' : path === '/pipeline' ? 'pipeline' : 'command',
        status, elapsedMs: Math.min(8000, Math.max(0, Math.round(performance.now() - started)))
      }));
    } catch { /* Logging must not replace the storage failure. */ }
  };
  if (!url || !token) { report(); throw new Error('REDIS_NOT_CONFIGURED'); }
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    failure = 'network'; stage = 'headers';
    const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    status = Number.isInteger(response.status) && response.status >= 100 && response.status <= 599 ? response.status : null;
    stage = 'body'; failure = response.ok ? 'invalid_json' : 'http';
    let payload;
    try { payload = await response.json(); }
    catch (error) {
      if (response.ok && !(error instanceof SyntaxError)) failure = 'network';
      throw error;
    }
    if (!response.ok) throw new Error('REDIS_UNAVAILABLE');
    stage = 'response'; failure = 'invalid_response';
    const envelope = value => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!envelope(payload) && !Array.isArray(payload)) throw new Error('REDIS_UNAVAILABLE');
    if (payload.error) { failure = 'provider'; throw new Error('REDIS_UNAVAILABLE'); }
    if (path) {
      if (!Array.isArray(payload) || payload.length !== body.length || !payload.every(envelope)) throw new Error('REDIS_INVALID_RESPONSE');
      if (payload.some(item => item.error)) { failure = 'provider'; throw new Error('REDIS_UNAVAILABLE'); }
      if (!payload.every(item => Object.hasOwn(item, 'result'))) throw new Error('REDIS_INVALID_RESPONSE');
    } else {
      if (!envelope(payload)) throw new Error('REDIS_UNAVAILABLE');
      // Preserve undefined for existing domain decoders, which distinguish a
      // malformed identity/session read from Redis's explicit absent null.
      if (!Object.hasOwn(payload, 'result')) report();
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted) failure = 'timeout';
    report();
    if (controller.signal.aborted) throw new Error('REDIS_TIMEOUT');
    if (error?.message === 'REDIS_INVALID_RESPONSE') throw new Error('REDIS_INVALID_RESPONSE');
    throw new Error('REDIS_UNAVAILABLE');
  } finally { clearTimeout(deadline); }
};

export const redis = async (...command) => (await request('', command)).result;

export const pipeline = async (commands, atomic = false) => {
  const result = await request(atomic ? '/multi-exec' : '/pipeline', commands);
  return result.map(item => item.result);
};

export const rateLimit = async (scope, id, maximum = 30, seconds = 60) => {
  const key = `geek:rate:${scope}:${id}`;
  const [count] = await pipeline([
    ['INCR', key],
    ['EXPIRE', key, seconds, 'NX']
  ]);
  if (Number(count) > maximum) throw new Error('RATE_LIMITED');
};

export const parseStoredJson = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
