const KASPLEX_TOKEN_URL = 'https://api.kasplex.org/v1/krc20/token/GEEK';
// Kasware's published mainnet fallback; never accept an upstream URL from a request.
const KASPLEX_FALLBACK_URL = 'https://api-fallback.kasplex.org/v1/krc20/token/GEEK';
const STATUS_SOURCES = [KASPLEX_TOKEN_URL, KASPLEX_FALLBACK_URL];
const STATUS_CACHE_MS = 10_000;
const DIGITS = /^\d{1,40}$/;

export const GEEK_DEPLOYMENT = Object.freeze({
  network: 'kaspa-mainnet',
  protocol: 'KRC-20',
  ticker: 'GEEK',
  maxRaw: '14400000000000000000',
  limitRaw: '10000000000000',
  premintRaw: '0',
  decimals: 8,
  mode: 'mint',
  deployer: 'kaspa:qzj0e55rlxpm0knvra9wvgckpkyq9h8hv8wl0lh2ngjad9a4cedmj24cy07ew',
  deploymentHash: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1',
  protocolFeeKas: '1'
});

const rawInteger = (value, label) => {
  const raw = String(value ?? '');
  if (!DIGITS.test(raw)) throw new Error(`MINT_STATUS_INVALID:${label}`);
  return BigInt(raw);
};

const tokenAmount = (rawValue, decimalsValue) => {
  const raw = BigInt(rawValue);
  const decimals = Number(decimalsValue);
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
};

const deploymentMatches = (token) => (
  String(token.tick || '').toUpperCase() === GEEK_DEPLOYMENT.ticker
  && String(token.max || '') === GEEK_DEPLOYMENT.maxRaw
  && String(token.lim || '') === GEEK_DEPLOYMENT.limitRaw
  && String(token.pre || '') === GEEK_DEPLOYMENT.premintRaw
  && Number(token.dec) === GEEK_DEPLOYMENT.decimals
  && String(token.mod || '') === GEEK_DEPLOYMENT.mode
  && String(token.to || '') === GEEK_DEPLOYMENT.deployer
  && String(token.hashRev || '') === GEEK_DEPLOYMENT.deploymentHash
);

export const parseGeekMintStatus = (payload, checkedAt = Date.now()) => {
  const token = Array.isArray(payload?.result)
    ? payload.result.find((item) => String(item?.tick || '').toUpperCase() === GEEK_DEPLOYMENT.ticker)
    : null;
  if (payload?.message !== 'successful' || !token) throw new Error('MINT_STATUS_UNAVAILABLE');
  if (!deploymentMatches(token)) throw new Error('MINT_DEPLOYMENT_MISMATCH');

  const max = rawInteger(token.max, 'max');
  const limit = rawInteger(token.lim, 'limit');
  const minted = rawInteger(token.minted, 'minted');
  const burned = rawInteger(token.burned || '0', 'burned');
  if (limit <= 0n || max <= 0n || max % limit !== 0n || minted > max || minted % limit !== 0n) {
    throw new Error('MINT_STATUS_INVALID:arithmetic');
  }

  const totalMints = max / limit;
  const completedMints = minted / limit;
  const remainingMints = totalMints - completedMints;
  const state = String(token.state || 'unknown');

  return {
    source: 'Kasplex KRC-20 indexer',
    sourceUrl: KASPLEX_TOKEN_URL,
    checkedAt: Number(checkedAt),
    deployment: {
      ...GEEK_DEPLOYMENT,
      verified: true
    },
    mint: {
      open: state === 'deployed' && remainingMints > 0n,
      state,
      perMint: tokenAmount(limit, GEEK_DEPLOYMENT.decimals),
      perMintRaw: limit.toString(),
      minted: tokenAmount(minted, GEEK_DEPLOYMENT.decimals),
      mintedRaw: minted.toString(),
      maximum: tokenAmount(max, GEEK_DEPLOYMENT.decimals),
      maximumRaw: max.toString(),
      burned: tokenAmount(burned, GEEK_DEPLOYMENT.decimals),
      burnedRaw: burned.toString(),
      completedMints: completedMints.toString(),
      totalMints: totalMints.toString(),
      remainingMints: remainingMints.toString(),
      progressBasisPoints: Number((minted * 10_000n) / max),
      indexerUpdatedAt: Number(token.mtsMod || 0)
    }
  };
};

export const createGeekMintStatusLoader = ({ fetchImpl = fetch, clock = Date.now, logger = console.warn } = {}) => {
  let cachedStatus = null;
  const report = (sourceUrl, reason, httpStatus = null) => {
    // Fixed diagnostic fields only: never log wallet data, request headers, or upstream bodies.
    try { logger({ event: 'geek_mint_status_failure', sourceUrl, reason, httpStatus }); } catch { /* Logging cannot change mint safety. */ }
  };
  return async ({ force = false } = {}) => {
    const age = cachedStatus ? clock() - cachedStatus.checkedAt : Infinity;
    if (!force && cachedStatus && age >= 0 && age < STATUS_CACHE_MS) return cachedStatus;
    cachedStatus = null;

    for (const sourceUrl of STATUS_SOURCES) {
      let response;
      try {
        response = await fetchImpl(sourceUrl, {
          headers: { Accept: 'application/json', 'User-Agent': 'Geek-Protocol-HQ/1.0 mint-status' },
          cache: 'no-store',
          redirect: 'error',
          signal: AbortSignal.timeout(9_000)
        });
      } catch (error) {
        report(sourceUrl, error?.name === 'TimeoutError' ? 'timeout' : 'transport_error');
        continue;
      }
      if (!response.ok) {
        report(sourceUrl, 'http_error', response.status);
        if (response.status >= 500 || response.status === 429) continue;
        throw new Error('MINT_STATUS_UNAVAILABLE');
      }

      // A reachable source reporting a mismatch or bad data must never be overridden
      // by a second source. Fallback handles availability failures only.
      try {
        const status = parseGeekMintStatus(await response.json(), clock());
        status.sourceUrl = sourceUrl;
        cachedStatus = status;
        return status;
      } catch (error) {
        const mismatch = error?.message === 'MINT_DEPLOYMENT_MISMATCH'
          || String(error?.message || '').startsWith('MINT_STATUS_INVALID:');
        report(sourceUrl, mismatch ? 'deployment_mismatch' : 'invalid_response', response.status);
        throw new Error(mismatch ? 'MINT_DEPLOYMENT_MISMATCH' : 'MINT_STATUS_UNAVAILABLE');
      }
    }
    throw new Error('MINT_STATUS_UNAVAILABLE');
  };
};

export const loadGeekMintStatus = createGeekMintStatusLoader();

export const geekMintInscription = () => JSON.stringify({ p: 'KRC-20', op: 'mint', tick: GEEK_DEPLOYMENT.ticker });
