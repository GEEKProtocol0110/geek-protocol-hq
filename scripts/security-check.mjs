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

for (const path of ['SECURITY.md', 'docs/THREAT-MODEL.md', 'docs/MINT-PROTOCOL.md', 'docs/IDENTITY-PROTOCOL.md', 'docs/PAYOUT-RISK-CONTROLS.md', 'docs/DEPENDENCY-PROVENANCE.md', 'docs/AUDIT-SCOPE.md', 'docs/COLLECTIBLE-PROTOCOL.md', 'docs/GEEK-500-ART-BIBLE.md', 'public/data/geek-500.json', 'public/data/legacy-geek-art.json', 'security/controls.json', 'package-lock.json']) {
  check(await exists(path), `required evidence exists: ${path}`);
}

const publicFiles = await walk('public/');
check(!publicFiles.some((path) => /questions.*\.json$/i.test(path)), 'ranked question banks are absent from public');

const rewards = await text('api/rewards.js');
check(rewards.includes('withdrawalsEnabled: false'), 'withdrawals remain disabled');
check(rewards.includes('settlementEligible: false'), 'payout preferences remain settlement-ineligible');
const mainnetPayout = await text('server/mainnet-payout.js');
const mainnetSchedule = await text('workers/mainnet/schedule.mjs');
const mainnetCron = await text('workers/mainnet/cron.mjs');
const envExample = await text('.env.example');
check(mainnetPayout.includes('settlementEligible: false') && mainnetPayout.includes('withdrawalsEnabled: false'), 'mainnet payout flags stay false');
check(mainnetPayout.includes("MAINNET_PAYOUT_ENABLED !== 'true'"), 'mainnet payout admission defaults off');
check(mainnetCron.includes("MAINNET_SIGNER_ENABLED !== 'true'"), 'mainnet signer defaults off');
const mainnetWorker = await text('workers/mainnet/worker.mjs');
const mainnetSigner = await text('workers/mainnet/signer.mjs');
check(mainnetSigner.includes("MAINNET_PAYOUT_ADDRESS_SHA256, MAINNET_PAYOUT_SENDER, expectedRaw } from './schedule.mjs';") &&
  mainnetSigner.includes('let pinnedSenderDigest = MAINNET_PAYOUT_ADDRESS_SHA256;') && (mainnetSigner.match(/pinnedSenderDigest =/g) || []).length === 2,
  'mainnet signer takes its sender pin from the schedule digest and only the guarded test hook can change it');
check(mainnetSigner.includes('if (!chosen.sender || !senderPinned(chosen.sender) ||') && mainnetSigner.includes('if (!senderPinned(sender()) ||') &&
  mainnetSigner.includes("config.network !== 'mainnet' || !senderPinned(config.sender) ||"), 'mainnet signer requires the pinned sender digest in policy, verify and inspect');
check(mainnetSigner.includes("if (process.env.VERCEL_ENV === 'production' || !process.env.NODE_TEST_CONTEXT ||"), 'mainnet signer test pin hook is refused in production and outside the test runner');
const pinHookUsers = (await Promise.all(['api/', 'server/', 'workers/', 'scripts/', 'public/'].map(walk))).flat()
  .filter(path => /\.(m?js|json)$/.test(path) && !path.includes('node_modules') && path !== 'scripts/security-check.mjs');
const pinHookCallers = [];
for (const path of pinHookUsers) if ((await text(path)).includes('pinTestSenderDigest')) pinHookCallers.push(path);
check(pinHookCallers.sort().join('|') === 'workers/mainnet/check-signing.mjs|workers/mainnet/signer.mjs', 'only the offline signer check can call the test sender pin hook');
const { spawnSync } = await import('node:child_process');
const pinAttempt = spawnSync(process.execPath, ['--input-type=module', '-e',
  "const s = await import('./signer.mjs'); try { s.pinTestSenderDigest('0'.repeat(64)); console.log('PINNED'); } catch (e) { console.log(e.message); }"],
  { cwd: new URL('workers/mainnet/', root), encoding: 'utf8', env: { PATH: process.env.PATH, VERCEL_ENV: 'production', NODE_TEST_CONTEXT: 'child-v8' } });
check(pinAttempt.status === 0 && pinAttempt.stdout.trim() === 'SIGNER_POLICY_MISMATCH', 'production cannot override the mainnet signer sender pin');
check(mainnetPayout.includes("VERCEL_ENV !== 'production'"), 'mainnet admission is production-only');
check(mainnetWorker.indexOf("MAINNET_SIGNER_ENABLED !== 'true'") !== -1 && mainnetWorker.indexOf("MAINNET_SIGNER_ENABLED !== 'true'") < mainnetWorker.indexOf('MAINNET_SIGNER_PRIVATE_KEY'), 'mainnet worker checks the signer gate before reading the key');
// The reviewed hot wallet stays pinned, now by SHA-256 hex of its exact full address string
// (UTF-8, lowercase, including the "kaspa:" prefix) instead of the plain text.
const REVIEWED_PAYOUT_ADDRESS_SHA256 = '662d1730e13025e8df48ffcfc1d982a8047bf8ba191958dda7739e111b504d59';
check(mainnetSchedule.includes(`export const MAINNET_PAYOUT_ADDRESS_SHA256 = '${REVIEWED_PAYOUT_ADDRESS_SHA256}';`), 'mainnet hot wallet is pinned to the reviewed public receive address digest');
check(mainnetSchedule.includes("export const MAINNET_PAYOUT_ADDRESS_ENV = 'MAINNET_PAYOUT_ADDRESS';") && !/kaspa:q[a-z0-9]{50,}/.test(mainnetSchedule), 'mainnet hot wallet is read from MAINNET_PAYOUT_ADDRESS with no hardcoded address');
const scheduleModule = await import(new URL('workers/mainnet/schedule.mjs', root));
const syntheticSender = 'kaspa:qrjf8kl3cyxcpu6creysfyctzszvcmqnjq8wqavywnaff2lgcnx3xcldmts00';
check(scheduleModule.MAINNET_PAYOUT_ADDRESS_SHA256 === REVIEWED_PAYOUT_ADDRESS_SHA256 &&
  [{}, { MAINNET_PAYOUT_ADDRESS: '' }, { MAINNET_PAYOUT_ADDRESS: 'kaspa:invalid' }, { MAINNET_PAYOUT_ADDRESS: syntheticSender, VERCEL_ENV: 'production' }].every(env => scheduleModule.resolvePayoutSender(env) === null) &&
  scheduleModule.resolvePayoutSender({ MAINNET_PAYOUT_ADDRESS: syntheticSender }) === syntheticSender, 'mainnet payout sender fails closed when missing, invalid, or not the reviewed wallet in production');
check(envExample.includes('MAINNET_PAYOUT_ENABLED=false') && envExample.includes('MAINNET_SIGNER_ENABLED=false'), 'mainnet payout example flags stay false');
check(!/MAINNET_SIGNER_PRIVATE_KEY\s*=\s*\S/.test(envExample), 'mainnet signing key is not stored in the env example');
check(envExample.includes('MAINNET_PAYOUT_JOB_HMAC') && !/MAINNET_PAYOUT_JOB_HMAC\s*=/.test(envExample), 'job hmac secret is named and has no committed value');
check(rewards.includes('PAYOUT_CHANGE_COOLDOWN_MS'), 'payout changes declare a cooldown');
check(rewards.includes('requirePayoutAuthorization'), 'linked identities require fresh payout authorization');
check(rewards.includes('payoutMutationHistory'), 'payout mutations retain a bounded risk history');
check(rewards.includes('payoutNotice'), 'payout mutations create persistent player notices');
check(rewards.includes('createPayoutReview'), 'higher-risk payout destinations enter private review');

const identity = await text('server/identity.js');
const identityWallet = await text('server/identity-wallet.js');
const identityRecords = await text('server/identity-records.js');
const playerSession = await text('server/session.js');
check(identity.includes('kaspa.verifyMessage'), 'wallet signatures are verified on the server');
check(identityWallet.includes('toAddress(kaspa.NetworkType.Mainnet)'), 'public keys are bound to derived Kaspa mainnet addresses');
check(identity.includes('randomBytes(32)'), 'wallet challenges include a 256-bit random nonce');
check(identity.includes("redis('GETDEL'"), 'wallet challenges and authorizations are atomically consumed');
check(identity.includes('geek-identity-bind-v1'), 'wallet and player bindings use an atomic compare-and-set transition');
check(identityRecords.includes('CHALLENGE_TTL_SECONDS = 5 * 60'), 'wallet challenges expire after five minutes');
check(identity.includes("challenge.origin !== canonicalOrigin(req)"), 'wallet proofs are rechecked against the exact requesting origin');
check(identity.includes('decodeIdentityRecord') && playerSession.includes('decodeIdentityRecord'), 'identity and linked sessions validate stored wallet records');
check(playerSession.includes('decodeSessionRecord') && playerSession.includes('validateSessionRecord'), 'session records are validated before reads and writes');
check(identity.includes('decodeChallengeRecord') && identity.includes('decodeAuthorizationRecord'), 'one-time proofs and payout authorizations validate stored records');

const payoutReview = await text('server/payout-review.js');
check(payoutReview.includes('PAYOUT_REVIEW_ADMIN_TOKEN'), 'payout review uses a dedicated credential');
check(payoutReview.includes("currentAddressHash === record.addressHash"), 'stale payout reviews fail closed');
check(payoutReview.includes('settlementEnabled: false'), 'payout review cannot enable settlement');

const wallet = await text('public/assets/wallet.js');
check(wallet.includes("wallet.signMessage(message, { type: 'schnorr' })"), 'Kasware requests explicit Schnorr signatures');
check(!wallet.includes('verifyMessage('), 'the browser is not trusted to verify wallet proofs');

const mintServer = await text('server/mint.js');
const mintDeployment = await text('server/geek-deployment.js');
check(mintServer.includes("import { GEEK_DEPLOYMENT } from './geek-deployment.js'"), 'mint verifier uses the shared canonical deployment');
check(mintDeployment.includes("ticker: 'GEEK'"), 'mint verifier pins the GEEK ticker');
check(mintDeployment.includes("maxRaw: '14400000000000000000'"), 'mint verifier pins maximum supply');
check(mintDeployment.includes("limitRaw: '10000000000000'"), 'mint verifier pins per-mint limit');
check(mintDeployment.includes("deploymentHash: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1'"), 'mint verifier pins the canonical reveal hash');
check(mintServer.includes('MINT_DEPLOYMENT_MISMATCH'), 'mint verifier fails closed on deployment mismatch');

const mintApi = await text('api/mint.js');
check(mintApi.includes('userApprovalRequired: true'), 'mint API declares wallet approval mandatory');
check(mintApi.includes('custodial: false'), 'mint API declares the non-custodial boundary');
check(mintApi.includes("fresh ? 'no-store, max-age=0'"), 'pre-mint status checks bypass shared caches');

const mintClient = await text('public/mint/assets/mint.js');
check(mintClient.includes('const provider = window.kasware;') && mintClient.includes('await provider.signKRC20Transaction('), 'minting is handed to the captured Kasware provider');
check(mintClient.includes("network !== MAINNET"), 'mint client enforces Kaspa Mainnet');
check(/status\.transaction\.inscription,\s*3,\s*undefined,\s*0/.test(mintClient), 'mint request fixes type, destination behavior, and added priority fee');
check(mintClient.includes('const HISTORY_LIMIT = 100;') && mintClient.includes('return cleanHistory(raw ? JSON.parse(raw) : []);') && !mintClient.includes('innerHTML'), 'mint history is bounded, validated display data rendered without HTML');
check(!mintClient.includes('rawtx'), 'raw mint transactions are not handled by the page');

const audit = await text('server/audit.js');
check(audit.includes("createHmac('sha256'"), 'audit records support HMAC-SHA-256');
check(audit.includes('hashAuditIdentifier'), 'audit actors and objects are pseudonymized');
check(!audit.includes('payoutAddress'), 'audit module does not depend on raw payout addresses');

const progression = await text('server/progression.js');
const profileApi = await text('server/player-api.js');
check(progression.includes('recordRoundJourney'), 'progression is written by the ranked server');
check(progression.includes('JOURNEY_LIMIT'), 'journey history has a fixed retention bound');
check(profileApi.includes('requireSession(req)'), 'player journey requires an authenticated session');
check(!profileApi.includes("req.method === 'POST'"), 'player journey API exposes no browser progression write');
const prestigeApi = await text('server/prestige.js');
check(progression.includes('LEVELS_PER_PRESTIGE = 50'), 'prestige requires the 50-level cycle');
check(prestigeApi.includes('before.canPrestige') && prestigeApi.includes('PRESTIGE_MAXED'), 'manual prestige enforces eligibility and the 25-rank cap');
check(prestigeApi.includes('requireSession(req)') && prestigeApi.includes('Object.keys(body)'), 'prestige requires a session and rejects client progression fields');
check(prestigeApi.includes('geek-prestige-v1') && prestigeApi.includes('state.prestige !== expectedPrestige'), 'prestige resets atomically with replay protection');

const collectibles = await text('server/collectibles.js');
const stickerTrades = await text('server/sticker-trades.js');
const collectionBlueprint = await text('server/geek-collection.js');
check(collectibles.includes('onChainTransfersEnabled: false'), 'collectible API keeps on-chain transfers disabled');
check(stickerTrades.includes('geek-sticker-trade-create-v1'), 'sticker offers reserve inventory atomically');
check(stickerTrades.includes('geek-sticker-trade-accept-v1'), 'sticker exchanges settle both profiles atomically');
check(stickerTrades.includes('geek-sticker-trade-cancel-v1'), 'sticker cancellation releases inventory atomically');
check(collectionBlueprint.includes('supply: 500'), 'collection blueprint pins the 500-Geek supply');
check(collectionBlueprint.includes('onChainOwnershipActive: false'), 'collection ownership remains off-chain until audited deployment');
check(collectionBlueprint.includes('metadataFrozen: false'), 'unfinished metadata cannot claim frozen status');
check(collectionBlueprint.includes('independentlyAudited: false'), 'collection audit status remains honest');
const publicCollection = JSON.parse(await text('public/data/geek-500.json'));
check(publicCollection.identities?.length === 500, 'public collection manifest contains exactly 500 identities');
check(publicCollection.blueprint?.anchors?.map((identity) => identity.name).join('|') === 'GIGA|A.C.E.', 'collection blueprint preserves both mythic anchors');
check(publicCollection.identities?.every((identity) => identity.metadata?.image === null && identity.production?.approved === false), 'public collection manifest makes no finished art claims');
const legacyArt = JSON.parse(await text('public/data/legacy-geek-art.json'));
check(legacyArt.records?.length === 10, 'legacy archive exposes exactly ten recovered concepts');
check(legacyArt.blueprint?.approvedAssetCount === 0 && legacyArt.blueprint?.editionMapping === 'unmapped', 'legacy archive does not invent approval or edition mappings');
check(legacyArt.records?.every((record) => record.production?.approved === false && record.production?.mintReady === false && record.production?.mappedEdition === null && /^[a-f0-9]{64}$/.test(record.asset?.sha256)), 'legacy concepts remain unmapped and carry reproducible hashes');

const config = JSON.parse(await text('vercel.json'));
check(config.installCommand === 'npm ci --ignore-scripts', 'production installs the locked dependency graph without lifecycle scripts');
const headerValues = (config.headers || []).flatMap((route) => route.headers || []).map((item) => `${item.key}:${item.value}`);
check(headerValues.some((item) => item.startsWith('Content-Security-Policy:')), 'Content Security Policy is configured');
check(headerValues.some((item) => item.startsWith('Strict-Transport-Security:')), 'HSTS is configured');
check(headerValues.some((item) => item.startsWith('X-Frame-Options:')), 'clickjacking protection is configured');
check(config.functions?.['api/identity.js']?.includeFiles === 'node_modules/@dfns/kaspa-wasm/kaspa_bg.wasm', 'identity deployment includes the pinned verifier WebAssembly');
const verifierAsset = 'node_modules/@dfns/kaspa-wasm/kaspa_bg.wasm';
for (const entry of ['session', 'ranked', 'lobbies', 'leaderboard', 'content', 'rewards']) {
  const glob = config.functions?.[`api/${entry}.js`]?.includeFiles || '';
  const included = glob.startsWith('{') && glob.endsWith('}') ? glob.slice(1, -1).split(',') : [glob];
  check(included.includes(verifierAsset), `${entry} deployment includes the shared identity verifier WebAssembly`);
}
check(config.functions?.['api/session.js']?.includeFiles?.includes('server/ops-ui/**'), 'session deployment retains private operator UI assets');
for (const entry of ['ranked', 'lobbies']) check(config.functions?.[`api/${entry}.js`]?.includeFiles?.includes('server/questions/**'), `${entry} deployment retains private question banks`);

const packageJson = JSON.parse(await text('package.json'));
const packageLock = JSON.parse(await text('package-lock.json'));
check(packageJson.dependencies?.['@dfns/kaspa-wasm'] === '0.14.1', 'Kaspa verifier uses an exact dependency version');
check(packageLock.packages?.['node_modules/@dfns/kaspa-wasm']?.integrity === 'sha512-Lv/VkiPkxQgPTRmz2MG/PTNFzL0JuVLxhc9mKKgQbxbuT7XTOzra/AmCJgOBrn0O/A73/0QKAeiBg+1HrQ7ZnA==', 'Kaspa verifier archive integrity is locked');

const controls = JSON.parse(await text('security/controls.json'));
check(controls.auditStatus === 'not-independently-audited', 'public audit status is honest');
check(controls.settlementStatus === 'disabled', 'control map keeps settlement disabled');
check(Array.isArray(controls.controls) && controls.controls.length >= 22, 'control map contains reviewable evidence');
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
