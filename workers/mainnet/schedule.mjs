import { createHash } from 'node:crypto';

// Current KRC-20 GEEK reward schedule confirmed 2026-11-12.
// Whole-token amounts. Eight decimals are applied at the raw-unit boundary.
// The 100,000 daily cap is a temporary safety limit, not a permanent reward policy.
// Alpha-credit ROUND_CONFIG rewards are a separate internal balance and are not paid here.

// The public hot-wallet sender address is read from the environment, never from source.
// MAINNET_PAYOUT_ADDRESS belongs to the Production scope (HQ production and the worker project).
export const MAINNET_PAYOUT_ADDRESS_ENV = 'MAINNET_PAYOUT_ADDRESS';
// SHA-256 hex digest of the reviewed hot-wallet address: the exact UTF-8 string, including the
// "kaspa:" prefix, lowercase, with no surrounding whitespace. In production a configured address
// with any other digest is refused, so the reviewed wallet stays pinned without its plain text here.
export const MAINNET_PAYOUT_ADDRESS_SHA256 = '662d1730e13025e8df48ffcfc1d982a8047bf8ba191958dda7739e111b504d59';
const ADDRESS_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
const ADDRESS_GENERATORS = [0x98f2bc8e61n, 0x79b76d99e2n, 0xf33e5fb3c4n, 0xae2eabe2a8n, 0x1e4f43e470n];

// Exact lowercase kaspa: mainnet address with a valid checksum. No trimming or case folding.
export function isMainnetPayoutAddress(value) {
  const match = typeof value === 'string' ? /^kaspa:([qpzry9x8gf2tvdw0s3jn54khce6mua7l]{61,63})$/.exec(value) : null;
  if (!match) return false;
  let checksum = 1n;
  for (const digit of [...'kaspa'].map(c => c.charCodeAt(0) & 31).concat(0, [...match[1]].map(c => ADDRESS_CHARSET.indexOf(c)))) {
    const high = checksum >> 35n;
    checksum = ((checksum & 0x07ffffffffn) << 5n) ^ BigInt(digit);
    ADDRESS_GENERATORS.forEach((generator, index) => { if ((high >> BigInt(index)) & 1n) checksum ^= generator; });
  }
  return (checksum ^ 1n) === 0n;
}

// Returns the configured sender, or null when it is missing, empty, malformed, or (in production)
// not the reviewed wallet. There is no hardcoded fallback. Every payout path compares against the
// result, so null fails closed: HQ admits nothing and the signer refuses every live job.
export function resolvePayoutSender(env = process.env) {
  const value = env?.[MAINNET_PAYOUT_ADDRESS_ENV];
  if (!isMainnetPayoutAddress(value)) return null;
  if (env.VERCEL_ENV === 'production' && createHash('sha256').update(value, 'utf8').digest('hex') !== MAINNET_PAYOUT_ADDRESS_SHA256) return null;
  return value;
}

export const MAINNET_PAYOUT_SENDER = resolvePayoutSender();
export const GEEK_TICKER = 'GEEK';
export const GEEK_PROTOCOL = 'KRC-20';
export const GEEK_DECIMALS = 8;
export const GEEK_DEPLOYMENT_HASH = 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1';
export const DAILY_WHOLE = 100;
export const DAILY_CAP_WHOLE = 100_000;
// One perfect Gauntlet (46,300) plus one Daily (100). Temporary, like the global cap.
export const PLAYER_DAILY_CAP_WHOLE = 46_400;
// Per correct answer, from game-economy.js ROUND_CONFIG.reward. A perfect round is reward * 10.
export const GAUNTLET_REWARD_WHOLE = Object.freeze([10, 20, 40, 80, 150, 280, 450, 700, 1100, 1800]);
export const GAUNTLET_PERFECT_WHOLE = Object.freeze(GAUNTLET_REWARD_WHOLE.map(reward => reward * 10));
export const PERFECT_GAUNTLET_WHOLE = GAUNTLET_PERFECT_WHOLE.reduce((sum, value) => sum + value, 0);
const RAW_SCALE = 10n ** BigInt(GEEK_DECIMALS);

export const toRaw = (whole) => {
  if (!Number.isSafeInteger(whole) || whole <= 0) throw new Error('MAINNET_PAYOUT_AMOUNT_INVALID');
  return (BigInt(whole) * RAW_SCALE).toString();
};

// Integer only: max × correctCount / 10, which equals reward × correctCount on this table.
// A fractional result is rejected. correctCount 1 in round 10 is 1,800, not the 18,000 maximum.
export function gauntletWhole(round, correctCount) {
  if (!Number.isInteger(round) || round < 1 || round > GAUNTLET_REWARD_WHOLE.length) return null;
  if (!Number.isInteger(correctCount) || correctCount < 1 || correctCount > 10) return null;
  const max = BigInt(GAUNTLET_PERFECT_WHOLE[round - 1]);
  const count = BigInt(correctCount);
  if (max % 10n !== 0n || (max * count) % 10n !== 0n) return null;
  const whole = (max * count) / 10n;
  const reward = BigInt(GAUNTLET_REWARD_WHOLE[round - 1]);
  if (whole !== reward * count || whole <= 0n || whole > max) return null;
  return Number(whole);
}

export const allowedRawAmounts = Object.freeze([...new Set([
  toRaw(DAILY_WHOLE),
  ...GAUNTLET_REWARD_WHOLE.flatMap(reward => Array.from({ length: 10 }, (_, index) => toRaw(reward * (index + 1))))
])]);

const qualifyingCorrect = (proof, maximum) => Number.isInteger(proof?.correctCount) && proof.correctCount >= 1 && proof.correctCount <= maximum;

// Recompute from the server-written proof. A different schedule amount for the same
// round and correctCount does not match, including a perfect-round maximum.
export function expectedRaw(proof) {
  if (!proof || typeof proof !== 'object' || !Number.isInteger(proof.correctCount)) return null;
  if (proof.kind === 'daily' && proof.round === 1 && qualifyingCorrect(proof, 5)) return toRaw(DAILY_WHOLE);
  const whole = proof.kind === 'gauntlet' ? gauntletWhole(proof.round, proof.correctCount) : null;
  return whole ? toRaw(whole) : null;
}

// Count only strict boolean grades stored by the server. run.correctCount, run.amount,
// and a disagreeing run.correct are not payout inputs.
const gradedCorrectCount = (answers) => {
  let count = 0;
  for (const answer of answers) {
    if (answer?.correct === true) count += 1;
    else if (answer?.correct !== false) return null;
  }
  return count;
};

// Daily pays 100 once. Gauntlet pays reward × graded correctCount once per finished round.
// Zero correct pays nothing. A retry of that same round does not pay again.
export function quoteGeekReward(run) {
  if (!run || typeof run !== 'object') return null;
  const answers = Array.isArray(run.roundAnswers) ? run.roundAnswers : null;
  if (!answers) return null;
  const correctCount = gradedCorrectCount(answers);
  if (correctCount === null || (Number.isInteger(run.correct) && run.correct !== correctCount)) return null;
  if (run.mode === 'daily') {
    if (run.status !== 'finished' || run.completedRound !== 1 || run.questionCount !== 5 || answers.length !== 5 || correctCount < 1) return null;
    return { kind: 'daily', round: 1, correctCount, whole: DAILY_WHOLE, raw: toRaw(DAILY_WHOLE) };
  }
  if (run.mode !== 'gauntlet' || run.status !== 'between-rounds') return null;
  const round = run.completedRound;
  if (!Number.isInteger(round) || round < 1 || round > GAUNTLET_REWARD_WHOLE.length || round !== run.round) return null;
  if (run.questionCount !== 10 || answers.length !== 10) return null;
  const whole = gauntletWhole(round, correctCount);
  if (!whole) return null;
  return { kind: 'gauntlet', round, correctCount, whole, raw: toRaw(whole) };
}
