import { access, readFile, readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const failures = [];
const passed = [];

const check = (condition, label) => {
  if (condition) passed.push(label);
  else failures.push(label);
};

const text = async (path) => readFile(new URL(path, root), 'utf8');
const exists = async (path) => access(new URL(path, root)).then(() => true).catch(() => false);

const walk = async (directory) => {
  const absolute = new URL(directory, root);
  const entries = await readdir(absolute, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(`${path}/`));
    else files.push(relative('.', path));
  }
  return files;
};

for (const path of ['SECURITY.md', 'docs/THREAT-MODEL.md', 'docs/IDENTITY-PROTOCOL.md', 'docs/DEPENDENCY-PROVENANCE.md', 'docs/AUDIT-SCOPE.md', 'security/controls.json', 'package-lock.json']) {
  check(await exists(path), `required evidence exists: ${path}`);
}

const publicFiles = await walk('public/');
check(!publicFiles.some((path) => /questions.*\.json$/i.test(path)), 'ranked question banks are absent from public');

const rewards = await text('api/rewards.js');
check(rewards.includes('withdrawalsEnabled: false'), 'withdrawals remain disabled');
check(rewards.includes('settlementEligible: false'), 'payout preferences remain settlement-ineligible');
check(rewards.includes('PAYOUT_CHANGE_COOLDOWN_MS'), 'payout changes declare a cooldown');
check(rewards.includes('requirePayoutAuthorization'), 'linked identities require fresh payout authorization');

const identity = await text('server/identity.js');
check(identity.includes('kaspa.verifyMessage'), 'wallet signatures are verified on the server');
check(identity.includes('toAddress(kaspa.NetworkType.Mainnet)'), 'public keys are bound to derived Kaspa mainnet addresses');
check(identity.includes('randomBytes(32)'), 'wallet challenges include a 256-bit random nonce');
check(identity.includes("redis('GETDEL'"), 'wallet challenges and authorizations are atomically consumed');
check(identity.includes('geek-identity-bind-v1'), 'wallet and player bindings use an atomic compare-and-set transition');
check(identity.includes('CHALLENGE_TTL_SECONDS = 5 * 60'), 'wallet challenges expire after five minutes');

const wallet = await text('public/assets/wallet.js');
check(wallet.includes("signMessage(challenge.message, { type: 'schnorr' })"), 'wallet requests explicit Schnorr signatures');
check(!wallet.includes('verifyMessage('), 'the browser is not trusted to verify wallet proofs');

const audit = await text('server/audit.js');
check(audit.includes("createHmac('sha256'"), 'audit records support HMAC-SHA-256');
check(audit.includes('hashAuditIdentifier'), 'audit actors and objects are pseudonymized');
check(!audit.includes('payoutAddress'), 'audit module does not depend on raw payout addresses');

const config = JSON.parse(await text('vercel.json'));
check(config.installCommand === 'npm ci --ignore-scripts', 'production installs the locked dependency graph without lifecycle scripts');
const headerValues = (config.headers || []).flatMap((route) => route.headers || []).map((item) => `${item.key}:${item.value}`);
check(headerValues.some((item) => item.startsWith('Content-Security-Policy:')), 'Content Security Policy is configured');
check(headerValues.some((item) => item.startsWith('Strict-Transport-Security:')), 'HSTS is configured');
check(headerValues.some((item) => item.startsWith('X-Frame-Options:')), 'clickjacking protection is configured');
check(config.functions?.['api/identity.js']?.includeFiles === 'node_modules/@dfns/kaspa-wasm/kaspa_bg.wasm', 'identity deployment includes the pinned verifier WebAssembly');

const packageJson = JSON.parse(await text('package.json'));
const packageLock = JSON.parse(await text('package-lock.json'));
check(packageJson.dependencies?.['@dfns/kaspa-wasm'] === '0.14.1', 'Kaspa verifier uses an exact dependency version');
check(packageLock.packages?.['node_modules/@dfns/kaspa-wasm']?.integrity === 'sha512-Lv/VkiPkxQgPTRmz2MG/PTNFzL0JuVLxhc9mKKgQbxbuT7XTOzra/AmCJgOBrn0O/A73/0QKAeiBg+1HrQ7ZnA==', 'Kaspa verifier archive integrity is locked');

const controls = JSON.parse(await text('security/controls.json'));
check(controls.auditStatus === 'not-independently-audited', 'public audit status is honest');
check(controls.settlementStatus === 'disabled', 'control map keeps settlement disabled');
check(Array.isArray(controls.controls) && controls.controls.length >= 15, 'control map contains reviewable evidence');
for (const control of controls.controls || []) {
  check(/^GP-[A-Z0-9-]+$/.test(control.id), `control has stable identifier: ${control.id || 'missing'}`);
  for (const evidence of control.evidence || []) check(await exists(evidence), `control evidence exists: ${control.id} -> ${evidence}`);
}

for (const label of passed) console.log(`PASS ${label}`);
if (failures.length) {
  for (const label of failures) console.error(`FAIL ${label}`);
  process.exitCode = 1;
} else {
  console.log(`Security evidence check passed (${passed.length} assertions).`);
}
