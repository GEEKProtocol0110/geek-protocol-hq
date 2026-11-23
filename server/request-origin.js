const PRODUCTION_ORIGINS = ['https://www.geekprotocol.xyz', 'https://geekprotocol.xyz'];
const HOST = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?::[1-9][0-9]{0,4})?$/;

// These values are operator configuration, never inferred from a request header
// or from a wildcard deployment suffix. Malformed entries fail closed.
const configuredOrigins = () => new Set([
  ...PRODUCTION_ORIGINS,
  ...String(process.env.IDENTITY_ALLOWED_ORIGINS || '').split(','),
  String(process.env.IDENTITY_ORIGIN || '')
].map(value => value.trim()).filter(Boolean).map(value => {
  const candidate = value.replace(/\/$/, '');
  const url = new URL(candidate);
  if (url.protocol !== 'https:' || !HOST.test(url.host) || url.username || url.password || url.origin !== candidate) throw new Error('Invalid origin configuration');
  return candidate;
}));

export const trustedRequestOrigin = (req, {
  requireOrigin = false,
  invalidCode = 'REQUEST_ORIGIN_INVALID',
  mismatchCode = 'REQUEST_ORIGIN_MISMATCH'
} = {}) => {
  const invalid = () => { throw new Error(invalidCode); };
  const header = name => {
    const value = req?.headers?.[name];
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || !value || value !== value.trim() || /[,\s]/.test(value)) invalid();
    return value;
  };
  const host = header('host')?.toLowerCase();
  if (!host || !HOST.test(host)) invalid();
  const origin = `https://${host}`;
  let allowed;
  try {
    if (new URL(origin).origin !== origin) invalid();
    allowed = configuredOrigins();
  } catch { invalid(); }
  if (!allowed.has(origin)) invalid();

  // A forwarded value may confirm Host, but cannot select another authority.
  const forwardedHost = header('x-forwarded-host');
  if (forwardedHost !== undefined && forwardedHost.toLowerCase() !== host) invalid();
  const protocol = header('x-forwarded-proto');
  if (protocol !== undefined && protocol !== 'https') invalid();
  const fetchSite = header('sec-fetch-site');
  if (fetchSite !== undefined && !['same-origin', 'same-site', 'none'].includes(fetchSite)) invalid();

  const supplied = header('origin');
  if (supplied === undefined) {
    if (requireOrigin) invalid();
  } else {
    try { if (new URL(supplied).origin !== supplied || !supplied.startsWith('https://')) invalid(); }
    catch { invalid(); }
    if (supplied !== origin) throw new Error(mismatchCode);
  }
  return origin;
};
