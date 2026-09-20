const KASPLEX_TOKEN_URL = 'https://api.kasplex.org/v1/krc20/token/GEEK';
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

let cachedStatus = null;

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

export const loadGeekMintStatus = async ({ fetchImpl = fetch, now = Date.now(), force = false } = {}) => {
  if (!force && cachedStatus && now - cachedStatus.checkedAt < STATUS_CACHE_MS) return cachedStatus;
  try {
    const response = await fetchImpl(KASPLEX_TOKEN_URL, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Geek-Protocol-HQ/1.0 mint-status'
      },
      signal: AbortSignal.timeout(9_000)
    });
    if (!response.ok) throw new Error('MINT_STATUS_UNAVAILABLE');
    const status = parseGeekMintStatus(await response.json(), now);
    cachedStatus = status;
    return status;
  } catch (error) {
    if (error?.message === 'MINT_DEPLOYMENT_MISMATCH') throw error;
    if (String(error?.message || '').startsWith('MINT_STATUS_INVALID:')) throw new Error('MINT_DEPLOYMENT_MISMATCH');
    throw new Error('MINT_STATUS_UNAVAILABLE');
  }
};

export const geekMintInscription = () => JSON.stringify({ p: 'KRC-20', op: 'mint', tick: GEEK_DEPLOYMENT.ticker });
