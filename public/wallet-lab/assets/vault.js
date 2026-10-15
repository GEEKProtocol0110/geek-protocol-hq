// Browser-local testnet vault. No key, phrase or password is sent to a server.
export const NETWORK = 'testnet-10';
export const DERIVATION = "m/44'/111111'/0'/0/0";
const iterations = 600000;
const encode = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const decode = text => Uint8Array.from(atob(text), c => c.charCodeAt(0));
const keyFor = async (password, salt) => {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Use a wallet password of 12–256 characters.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', hash:'SHA-256', salt, iterations }, material, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
};
export const derive = (sdk, phrase) => {
  if (!sdk.Mnemonic.validate(phrase)) throw new Error('Invalid wallet recovery data.');
  const mnemonic = new sdk.Mnemonic(phrase); let root, generator, key, address;
  try {
    root = new sdk.XPrv(mnemonic.toSeed()); generator = new sdk.PrivateKeyGenerator(root, false, 0n);
    key = generator.receiveKey(0); address = key.toAddress(NETWORK);
    return address.toString();
  } finally { address?.free(); key?.free(); generator?.free(); root?.free(); mnemonic.free(); }
};
export const seal = async (sdk, phrase, password) => {
  const address = derive(sdk, phrase), salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const header = { version:1, network:NETWORK, derivation:DERIVATION, address, kdf:'PBKDF2-SHA256', iterations };
  const bytes = new TextEncoder().encode(JSON.stringify({ phrase }));
  try {
    const ciphertext = await crypto.subtle.encrypt({ name:'AES-GCM', iv, additionalData:new TextEncoder().encode(JSON.stringify(header)) }, await keyFor(password,salt), bytes);
    return { ...header, salt:encode(salt), iv:encode(iv), ciphertext:encode(ciphertext) };
  } finally { bytes.fill(0); }
};
export const open = async (sdk, vault, password) => {
  const fields = ['version','network','derivation','address','kdf','iterations','salt','iv','ciphertext'];
  if (!vault || typeof vault !== 'object' || Object.keys(vault).sort().join(',') !== fields.sort().join(',')) throw new Error('Unsupported testnet backup fields.');
  if (!vault || vault.version !== 1 || vault.network !== NETWORK || vault.derivation !== DERIVATION || vault.kdf !== 'PBKDF2-SHA256'
    || vault.iterations !== iterations || typeof vault.address !== 'string' || !vault.address.startsWith('kaspatest:')
    || ['salt','iv','ciphertext'].some(k => typeof vault[k] !== 'string' || vault[k].length > 16000)) throw new Error('Unsupported testnet backup.');
  const { version,network,derivation,address,kdf } = vault;
  const header = { version,network,derivation,address,kdf,iterations }, salt = decode(vault.salt), iv = decode(vault.iv);
  if (salt.length !== 16 || iv.length !== 12) throw new Error('Invalid backup parameters.');
  let plaintext;
  try {
    plaintext = new Uint8Array(await crypto.subtle.decrypt({ name:'AES-GCM', iv, additionalData:new TextEncoder().encode(JSON.stringify(header)) }, await keyFor(password,salt), decode(vault.ciphertext)));
    const { phrase } = JSON.parse(new TextDecoder().decode(plaintext));
    if (derive(sdk,phrase) !== address) throw new Error('Backup address mismatch.');
    return { address, phrase };
  } finally { plaintext?.fill(0); }
};
