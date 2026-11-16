import { qrSvg } from './qr.js';

// The tip address lives only in the page's data-tip-address attribute.
export const PENDING_ADDRESS = 'KASPA_TIP_ADDRESS_PENDING';
const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const GENERATORS = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

/** True only for a mainnet kaspa: address whose checksum is valid. */
export function isKaspaAddress(value) {
  const match = /^kaspa:([qpzry9x8gf2tvdw0s3jn54khce6mua7l]{61,63})$/.exec(String(value));
  if (!match) return false;
  let c = 1n;
  for (const d of [...'kaspa'].map(ch => ch.charCodeAt(0) & 31).concat(0, [...match[1]].map(ch => CHARSET.indexOf(ch)))) {
    const top = c >> 35n; c = ((c & 0x07ffffffffn) << 5n) ^ BigInt(d);
    GENERATORS.forEach((g, i) => { if ((top >> BigInt(i)) & 1n) c ^= g; });
  }
  return (c ^ 1n) === 0n;
}

export function setupSupport(doc, nav) {
  const root = doc.querySelector('[data-tip]');
  if (root) {
    const address = String(root.dataset.tipAddress || '').trim();
    const field = root.querySelector('[data-tip-field]'), copy = root.querySelector('[data-tip-copy]');
    const qr = root.querySelector('[data-tip-qr]'), status = root.querySelector('[data-tip-status]');
    const ready = address !== PENDING_ADDRESS && isKaspaAddress(address);
    root.dataset.tipState = ready ? 'ready' : 'pending';
    root.querySelector('[data-tip-pending]').hidden = ready;
    root.querySelector('[data-tip-ready]').hidden = !ready;
    copy.disabled = !ready;
    if (ready) {
      field.value = address;
      qr.src = `data:image/svg+xml,${encodeURIComponent(qrSvg(address))}`;
      qr.alt = `QR code for the Geek Protocol KAS tip address ${address}`;
      qr.hidden = false;
      let busy = false;
      copy.addEventListener('click', async () => {
        if (busy) return; busy = true; copy.disabled = true;
        try {
          if (!nav.clipboard?.writeText) throw new Error('Clipboard unavailable');
          await nav.clipboard.writeText(address);
          status.textContent = 'Full address copied. Compare it with the address shown here before you send.';
        } catch {
          field.focus(); field.select();
          status.textContent = 'Address selected. Use your device’s Copy command.';
        } finally { busy = false; copy.disabled = false; }
      });
    }
  }
  // Sponsor buttons stay hidden until a real https link is filled in.
  for (const link of doc.querySelectorAll('[data-sponsor-link]')) {
    const href = String(link.getAttribute('href') || '').trim();
    link.hidden = !/^https:\/\/\S+$/.test(href);
  }
}

if (typeof document !== 'undefined' && typeof navigator !== 'undefined') setupSupport(document, navigator);
