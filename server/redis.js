const config = () => ({
  url: process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || ''
});

const request = async (path, body) => {
  const { url, token } = config();
  if (!url || !token) throw new Error('REDIS_NOT_CONFIGURED');
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${url.replace(/\/$/, '')}${path}`, {
      method: 'POST', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json();
    if (!response.ok || payload.error) throw new Error('REDIS_UNAVAILABLE');
    return payload;
  } catch (error) {
    if (controller.signal.aborted) throw new Error('REDIS_TIMEOUT');
    throw new Error('REDIS_UNAVAILABLE');
  } finally { clearTimeout(deadline); }
};

export const redis = async (...command) => (await request('', command)).result;

export const pipeline = async (commands, atomic = false) => {
  const result = await request(atomic ? '/multi-exec' : '/pipeline', commands);
  if (!Array.isArray(result)) throw new Error('REDIS_INVALID_RESPONSE');
  return result.map((item) => {
    if (item.error) throw new Error(item.error);
    return item.result;
  });
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
