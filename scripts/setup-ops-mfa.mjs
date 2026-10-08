import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

export const createEnrollment = () => {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let accumulator = 0, bits = 0, secret = '';
  for (const byte of randomBytes(20)) {
    accumulator = ((accumulator << 8) | byte) & 0xffff; bits += 8;
    while (bits >= 5) { bits -= 5; secret += alphabet[(accumulator >>> bits) & 31]; }
  }
  const issuer = 'Geek Protocol Operations';
  return { secret, uri: `otpauth://totp/${encodeURIComponent(issuer + ':Owner')}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30` };
};
export const writeEnrollment = async filename => {
  if (!isAbsolute(filename)) throw new Error('Choose an absolute private output path outside the repository.');
  const enrollment = createEnrollment();
  await writeFile(filename, JSON.stringify(enrollment, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
};
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length !== 2 || args[0] !== '--out') throw new Error('Usage: node scripts/setup-ops-mfa.mjs --out /absolute/private/enrollment.json');
    await writeEnrollment(args[1]);
    console.log('Private enrollment file created. Follow docs/OPERATOR-SECURITY.md to enroll and enable it. No secret was printed.');
  } catch (error) {
    console.error(error.code === 'EEXIST' ? 'That file already exists. Choose a new private file; existing enrollment was not replaced.' : error.message);
    process.exitCode = 1;
  }
}
