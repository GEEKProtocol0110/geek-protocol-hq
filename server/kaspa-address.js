const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATORS = [
  0x98f2bc8e61n,
  0x79b76d99e2n,
  0xf33e5fb3c4n,
  0xae2eabe2a8n,
  0x1e4f43e470n
];

const polymod = (values) => {
  let checksum = 1n;
  for (const value of values) {
    const high = checksum >> 35n;
    checksum = ((checksum & 0x07ffffffffn) << 5n) ^ BigInt(value);
    for (let index = 0; index < GENERATORS.length; index += 1) {
      if (((high >> BigInt(index)) & 1n) !== 0n) checksum ^= GENERATORS[index];
    }
  }
  return checksum ^ 1n;
};

export const normalizeKaspaAddress = (value) => String(value || '').trim().toLowerCase();

export const isValidKaspaMainnetAddress = (value) => {
  const raw = String(value || '').trim();
  if (!raw || raw.length > 120) return false;
  const hasLower = raw !== raw.toUpperCase();
  const hasUpper = raw !== raw.toLowerCase();
  if (hasLower && hasUpper) return false;

  const normalized = raw.toLowerCase();
  const separator = normalized.indexOf(':');
  if (separator < 1 || separator !== normalized.lastIndexOf(':')) return false;
  const prefix = normalized.slice(0, separator);
  const payload = normalized.slice(separator + 1);
  if (prefix !== 'kaspa' || payload.length < 9) return false;

  const values = [];
  for (const character of prefix) values.push(character.charCodeAt(0) & 31);
  values.push(0);
  for (const character of payload) {
    const valueIndex = CHARSET.indexOf(character);
    if (valueIndex < 0) return false;
    values.push(valueIndex);
  }
  return polymod(values) === 0n;
};

export const maskKaspaAddress = (value) => {
  const address = normalizeKaspaAddress(value);
  if (!address) return '';
  return `${address.slice(0, 14)}…${address.slice(-8)}`;
};
