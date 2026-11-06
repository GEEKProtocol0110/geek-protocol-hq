const upstream = 'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1&sparkline=false';
const numeric = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
export function normalizeMarkets(rows, fetchedAt) {
  if (!Array.isArray(rows) || rows.length !== 100) throw new Error('Incomplete ranking');
  const ids = new Set();
  const coins = rows.map(row => {
    if (!row || !/^[a-z0-9][a-z0-9-]{0,119}$/.test(row.id) || ids.has(row.id) ||
        typeof row.name !== 'string' || !row.name.trim() || row.name.length > 120 ||
        typeof row.symbol !== 'string' || !row.symbol.trim() || row.symbol.length > 40 ||
        numeric(row.market_cap) === null || row.market_cap <= 0) throw new Error('Invalid coin');
    ids.add(row.id);
    return { id: row.id, name: row.name, symbol: row.symbol, price: numeric(row.current_price),
      marketCap: row.market_cap, volume: numeric(row.total_volume), change24h: numeric(row.price_change_percentage_24h),
      updatedAt: typeof row.last_updated === 'string' && Number.isFinite(Date.parse(row.last_updated)) ? new Date(row.last_updated).toISOString() : null };
  }).sort((a, b) => b.marketCap - a.marketCap);
  return { source: 'CoinGecko', currency: 'USD', fetchedAt: new Date(fetchedAt).toISOString(),
    coins: coins.map((coin, i) => ({ ...coin, rank: i + 1 })) };
}
export function createCryptoMarkets(fetchImpl = fetch, now = Date.now) {
  let cached, expires = 0, pending, retryAfter = 0;
  async function latest() {
    if (cached && now() < expires) return cached;
    if (pending) return pending;
    if (now() < retryAfter) throw new Error('Provider temporarily unavailable');
    pending = (async () => {
      const response = await fetchImpl(upstream, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(7000) });
      if (!response.ok) throw new Error('Market data unavailable');
      if (!response.body) throw new Error('Empty response');
      const reader = response.body.getReader(), chunks = []; let size = 0;
      try {
        while (true) {
          const { value, done } = await reader.read(); if (done) break;
          size += value.byteLength; if (size > 1_000_000) throw new Error('Oversize response');
          chunks.push(Buffer.from(value));
        }
      } finally { await reader.cancel().catch(() => {}); }
      const text = Buffer.concat(chunks).toString('utf8');
      const result = normalizeMarkets(JSON.parse(text), now());
      cached = result; expires = now() + 300_000;
      return result;
    })();
    try { return await pending; } catch (error) { retryAfter = now() + 15_000; throw error; } finally { pending = undefined; }
  }
  return { latest };
}
export function marketHandler(markets) {
  return async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).end(); }
    try {
      const data = await markets.latest();
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300');
      return res.status(200).json(data);
    } catch {
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=15');
      return res.status(503).json({ available: false });
    }
  };
}
