// Current KRC-20 GEEK reward schedule confirmed 2026-11-12.
// Whole-token amounts. Eight decimals are applied at the raw-unit boundary.
// The 100,000 daily cap is a temporary safety limit, not a permanent reward policy.
// Alpha-credit ROUND_CONFIG rewards are a separate internal balance and are not paid here.

export const MAINNET_PAYOUT_SENDER = 'kaspa:qql9hrch8rqk62ywncjmm4y3qr6dv0d8r0vvu8q7382ccawlwz50xqu0e3gvs';
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
