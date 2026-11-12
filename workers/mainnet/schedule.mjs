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
// Perfect-round ladder from game-economy.js ROUND_CONFIG.max, once per finished round.
export const GAUNTLET_PERFECT_WHOLE = Object.freeze([100, 200, 400, 800, 1500, 2800, 4500, 7000, 11000, 18000]);
export const PERFECT_GAUNTLET_WHOLE = GAUNTLET_PERFECT_WHOLE.reduce((sum, value) => sum + value, 0);
const RAW_SCALE = 10n ** BigInt(GEEK_DECIMALS);

export const toRaw = (whole) => {
  if (!Number.isSafeInteger(whole) || whole <= 0) throw new Error('MAINNET_PAYOUT_AMOUNT_INVALID');
  return (BigInt(whole) * RAW_SCALE).toString();
};

export const allowedRawAmounts = Object.freeze([toRaw(DAILY_WHOLE), ...GAUNTLET_PERFECT_WHOLE.map(toRaw)]);

export function expectedRaw(proof) {
  if (!proof || typeof proof !== 'object') return null;
  if (proof.kind === 'daily' && proof.round === 1) return toRaw(DAILY_WHOLE);
  if (proof.kind === 'gauntlet' && Number.isInteger(proof.round) && proof.round >= 1 && proof.round <= GAUNTLET_PERFECT_WHOLE.length) {
    return toRaw(GAUNTLET_PERFECT_WHOLE[proof.round - 1]);
  }
  return null;
}

// Qualifying Daily: the five-question round is finished and at least one answer is correct.
// A retry of that UTC day is the same earning. Gauntlet pays the ladder amount once for the
// finished round, including a round that was not perfect, and not once per correct answer.
export function quoteGeekReward(run) {
  if (!run || typeof run !== 'object') return null;
  const answers = Array.isArray(run.roundAnswers) ? run.roundAnswers : null;
  if (run.mode === 'daily') {
    if (run.status !== 'finished' || run.completedRound !== 1 || run.questionCount !== 5 || !answers || answers.length !== 5) return null;
    if (!Number.isInteger(run.correct) || run.correct < 1 || run.correct > 5) return null;
    if (answers.filter((answer) => answer?.correct === true).length !== run.correct) return null;
    return { kind: 'daily', round: 1, whole: DAILY_WHOLE, raw: toRaw(DAILY_WHOLE) };
  }
  if (run.mode !== 'gauntlet' || run.status !== 'between-rounds') return null;
  const round = run.completedRound;
  if (!Number.isInteger(round) || round < 1 || round > GAUNTLET_PERFECT_WHOLE.length || round !== run.round) return null;
  if (run.questionCount !== 10 || !answers || answers.length !== 10) return null;
  const whole = GAUNTLET_PERFECT_WHOLE[round - 1];
  return { kind: 'gauntlet', round, whole, raw: toRaw(whole) };
}
