export const DECIMALS = 8;
export const MAX_RAW = 14400000000000000000n;
const SCALE = 10n ** BigInt(DECIMALS);

export const rawAmount = value => {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,19})$/.test(value)) throw new Error('ECONOMY_AMOUNT_INVALID');
  const amount = BigInt(value);
  if (amount > MAX_RAW) throw new Error('ECONOMY_AMOUNT_INVALID');
  return amount;
};

export const decimalToRaw = value => {
  if (typeof value !== 'string' || value.length > 21 || !/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) throw new Error('ECONOMY_AMOUNT_INVALID');
  const [whole, fraction = ''] = value.split('.');
  const raw = (BigInt(whole) * SCALE + BigInt(fraction.padEnd(DECIMALS, '0'))).toString();
  rawAmount(raw);
  return raw;
};

export const formatRaw = value => {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,29})$/.test(value)) throw new Error('ECONOMY_AMOUNT_INVALID');
  const amount = BigInt(value);
  const fraction = (amount % SCALE).toString().padStart(DECIMALS, '0').replace(/0+$/, '');
  return new Intl.NumberFormat('en-US').format(amount / SCALE) + (fraction ? '.' + fraction : '');
};

export const splitFee = (grossRaw, feeRaw) => {
  const gross = rawAmount(grossRaw), fee = rawAmount(feeRaw);
  if (gross === 0n || fee > gross) throw new Error('ECONOMY_AMOUNT_INVALID');
  const recycled = fee * 70n / 100n;
  return { grossRaw, feeRaw, recyclePendingRaw: recycled.toString(), burnPendingRaw: (fee - recycled).toString() };
};
