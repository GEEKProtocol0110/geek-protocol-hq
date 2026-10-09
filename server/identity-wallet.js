import kaspa from '@dfns/kaspa-wasm';
import { isValidKaspaMainnetAddress, normalizeKaspaAddress } from './kaspa-address.js';

export const normalizePublicKey = (value) => {
  const publicKey = String(value || '').trim().toLowerCase();
  if (/^[a-f0-9]{64}$/.test(publicKey)) return `02${publicKey}`;
  if (!/^(02|03)[a-f0-9]{64}$/.test(publicKey)) throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
  return publicKey;
};

// KIP-5 uses the x-only key. Keep older compressed-key records compatible.
export const sameSigningKey = (first, second) => normalizePublicKey(first).slice(2) === normalizePublicKey(second).slice(2);

const publicKeyFromAddress = (address) => {
  let parsed;
  try {
    parsed = new kaspa.Address(address);
    if (!['PubKey', 'PubKeyECDSA'].includes(parsed.version)) throw new Error('IDENTITY_ADDRESS_UNSUPPORTED');
    const alphabet = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
    const values = address.split(':')[1].slice(0, -8);
    const bytes = [];
    let bits = 0, accumulator = 0;
    for (const character of values) {
      accumulator = ((accumulator << 5) | alphabet.indexOf(character)) & 0xffff;
      bits += 5;
      while (bits >= 8) { bits -= 8; bytes.push((accumulator >>> bits) & 255); }
    }
    const expected = parsed.version === 'PubKey' ? 33 : 34;
    if (bytes.length !== expected || bits >= 5 || ((accumulator << (8 - bits)) & 255)) throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
    return { publicKey: normalizePublicKey(Buffer.from(bytes.slice(1)).toString('hex')), ecdsa: parsed.version === 'PubKeyECDSA' };
  } catch (error) {
    if (error.message === 'IDENTITY_ADDRESS_UNSUPPORTED') throw error;
    throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
  } finally { parsed?.free(); }
};

export const addressForPublicKey = (publicKey) => {
  try {
    const key = new kaspa.PublicKey(publicKey);
    try {
      const address = key.toAddress(kaspa.NetworkType.Mainnet);
      try { return address.toString().toLowerCase(); }
      finally { address.free(); }
    } finally { key.free(); }
  } catch {
    throw new Error('IDENTITY_PUBLIC_KEY_INVALID');
  }
};

export const validateWalletProofInputs = (addressValue, publicKeyValue) => {
  if (!isValidKaspaMainnetAddress(addressValue)) throw new Error('INVALID_KASPA_ADDRESS');
  const address = normalizeKaspaAddress(addressValue);
  const decoded = publicKeyFromAddress(address);
  const publicKey = publicKeyValue == null || publicKeyValue === '' ? decoded.publicKey : normalizePublicKey(publicKeyValue);
  // The SDK validates the curve point. ECDSA-format addresses embed the full
  // compressed key, including parity; Schnorr addresses embed its x coordinate.
  const schnorrAddress = addressForPublicKey(publicKey);
  if (decoded.ecdsa ? publicKey !== decoded.publicKey : schnorrAddress !== address) throw new Error('IDENTITY_KEY_MISMATCH');
  return { address, publicKey };
};
