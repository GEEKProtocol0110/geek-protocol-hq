const hex = x => typeof x === 'string' && /^[a-f0-9]{32}$/.test(x);
const b64 = x => typeof x === 'string' && /^[A-Za-z0-9_-]+$/.test(x) && x.length <= 4096 && Buffer.from(x, 'base64url').toString('base64url') === x;
const fail = () => { throw new Error('PASSKEY_STATE_INVALID'); };
export const decodePasskeyAccount = (raw, id) => {
  if (raw === null) return null;
  let a; try { a = JSON.parse(raw); } catch { fail(); }
  if (!a || a.version !== 1 || !hex(a.playerId) || a.playerId !== id || !Number.isSafeInteger(a.epoch) || a.epoch < 1
    || !Number.isSafeInteger(a.walletVersion) || a.walletVersion < 0 || !Array.isArray(a.credentials) || a.credentials.length > 10) fail();
  const ids = new Set();
  for (const c of a.credentials) {
    if (!c || !b64(c.id) || !b64(c.publicKey) || !Number.isSafeInteger(c.counter) || c.counter < 0
      || typeof c.label !== 'string' || c.label.length > 40 || !Number.isSafeInteger(c.createdAt) || c.createdAt < 1
      || !Array.isArray(c.transports) || c.transports.some(t => !['ble','cable','hybrid','internal','nfc','smart-card','usb'].includes(t))
      || ids.has(c.id)) fail();
    ids.add(c.id);
  }
  return a;
};
