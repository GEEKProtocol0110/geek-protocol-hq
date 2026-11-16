// Self-contained QR Code encoder (ISO/IEC 18004): byte mode, error correction
// level M, versions 1-40. No dependencies, network access or inline script.
const ECC_PER_BLOCK = [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28];
const BLOCKS = [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49];
const bit = (value, i) => ((value >>> i) & 1) !== 0;
const rawModules = version => {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) { const align = Math.floor(version / 7) + 2; result -= (25 * align - 10) * align - 55; if (version >= 7) result -= 36; }
  return result;
};
const dataCodewords = version => Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version] * BLOCKS[version];
const gfMultiply = (x, y) => { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11d); z ^= ((y >>> i) & 1) * x; } return z & 0xff; };
const rsDivisor = degree => {
  const result = new Array(degree).fill(0); result[degree - 1] = 1; let root = 1;
  for (let i = 0; i < degree; i++) { for (let j = 0; j < degree; j++) { result[j] = gfMultiply(result[j], root); if (j + 1 < degree) result[j] ^= result[j + 1]; } root = gfMultiply(root, 2); }
  return result;
};
const rsRemainder = (data, divisor) => {
  const result = divisor.map(() => 0);
  for (const b of data) { const factor = b ^ result.shift(); result.push(0); divisor.forEach((coef, i) => { result[i] ^= gfMultiply(coef, factor); }); }
  return result;
};
const alignmentPositions = version => {
  if (version === 1) return [];
  const size = version * 4 + 17, count = Math.floor(version / 7) + 2;
  const step = version === 32 ? 26 : Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < count; pos -= step) result.splice(1, 0, pos);
  return result;
};
const MASKS = [
  (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, x => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
  (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
];

function penalty(modules) {
  const size = modules.length; let score = 0, dark = 0;
  const line = get => {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && get(i) === get(i - 1)) run++;
      else { if (run >= 5) score += run - 2; run = 1; }
    }
    const cells = Array.from({ length: size }, (_, i) => get(i) ? 1 : 0).join('');
    for (const pattern of ['10111010000', '00001011101']) for (let i = cells.indexOf(pattern); i !== -1; i = cells.indexOf(pattern, i + 1)) score += 40;
  };
  for (let y = 0; y < size; y++) line(x => modules[y][x]);
  for (let x = 0; x < size; x++) line(y => modules[y][x]);
  for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) {
    const c = modules[y][x];
    if (c === modules[y][x + 1] && c === modules[y + 1][x] && c === modules[y + 1][x + 1]) score += 3;
  }
  for (const row of modules) for (const cell of row) if (cell) dark++;
  const total = size * size;
  return score + (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
}

/** Encode text as a QR Code. Returns { version, mask, size, modules } with modules[y][x] true for dark. */
export function encodeQr(text, { mask: forcedMask } = {}) {
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 1;
  for (;; version++) {
    if (version > 40) throw new RangeError('Text is too long for a QR Code');
    if (4 + (version < 10 ? 8 : 16) + bytes.length * 8 <= dataCodewords(version) * 8) break;
  }
  const capacity = dataCodewords(version) * 8, bits = [];
  const push = (value, length) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(0b0100, 4); push(bytes.length, version < 10 ? 8 : 16); for (const b of bytes) push(b, 8);
  push(0, Math.min(4, capacity - bits.length)); push(0, (8 - bits.length % 8) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  // Split into blocks, append Reed-Solomon codewords and interleave.
  const blockCount = BLOCKS[version], eccLength = ECC_PER_BLOCK[version], raw = Math.floor(rawModules(version) / 8);
  const shortBlocks = blockCount - raw % blockCount, shortLength = Math.floor(raw / blockCount), divisor = rsDivisor(eccLength);
  const blocks = [];
  for (let i = 0, k = 0; i < blockCount; i++) {
    const block = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1)); k += block.length;
    const ecc = rsRemainder(block, divisor); if (i < shortBlocks) block.push(0); blocks.push(block.concat(ecc));
  }
  const codewords = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((block, j) => { if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]); });

  const size = version * 4 + 17;
  const base = Array.from({ length: size }, () => new Array(size).fill(false));
  const isFunction = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFunction = (modules, x, y, dark) => { modules[y][x] = dark; isFunction[y][x] = true; };
  const drawFormat = (modules, mask) => {
    const value = (0 << 3) | mask; let rem = value; // Level M format bits are 00.
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const format = ((value << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) setFunction(modules, 8, i, bit(format, i));
    setFunction(modules, 8, 7, bit(format, 6)); setFunction(modules, 8, 8, bit(format, 7)); setFunction(modules, 7, 8, bit(format, 8));
    for (let i = 9; i < 15; i++) setFunction(modules, 14 - i, 8, bit(format, i));
    for (let i = 0; i < 8; i++) setFunction(modules, size - 1 - i, 8, bit(format, i));
    for (let i = 8; i < 15; i++) setFunction(modules, 8, size - 15 + i, bit(format, i));
    setFunction(modules, 8, size - 8, true);
  };
  for (let i = 0; i < size; i++) { setFunction(base, 6, i, i % 2 === 0); setFunction(base, i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
    const x = cx + dx, y = cy + dy, distance = Math.max(Math.abs(dx), Math.abs(dy));
    if (x >= 0 && x < size && y >= 0 && y < size) setFunction(base, x, y, distance !== 2 && distance !== 4);
  }
  const align = alignmentPositions(version), last = align.length - 1;
  align.forEach((ay, i) => align.forEach((ax, j) => {
    if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFunction(base, ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }));
  drawFormat(base, 0);
  if (version >= 7) {
    let rem = version; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const info = (version << 12) | rem;
    for (let i = 0; i < 18; i++) { const a = size - 11 + i % 3, b = Math.floor(i / 3); setFunction(base, a, b, bit(info, i)); setFunction(base, b, a, bit(info, i)); }
  }
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, upward = ((right + 1) & 2) === 0, y = upward ? size - 1 - vert : vert;
      if (!isFunction[y][x] && index < codewords.length * 8) { base[y][x] = bit(codewords[index >>> 3], 7 - (index & 7)); index++; }
    }
  }
  const masked = mask => {
    const modules = base.map(row => row.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && MASKS[mask](x, y)) modules[y][x] = !modules[y][x];
    drawFormat(modules, mask); return modules;
  };
  let mask = forcedMask, modules;
  if (mask === undefined) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) { const m = masked(candidate), score = penalty(m); if (score < best) { best = score; mask = candidate; modules = m; } }
  } else modules = masked(mask);
  return { version, mask, size, modules };
}

/** Render a QR Code as a standalone SVG string with a four-module quiet zone. */
export function qrSvg(text, { border = 4 } = {}) {
  const { size, modules } = encodeQr(text), full = size + border * 2; let path = '';
  modules.forEach((row, y) => row.forEach((dark, x) => { if (dark) path += `M${x + border},${y + border}h1v1h-1z`; }));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${path}" fill="#000"/></svg>`;
}
