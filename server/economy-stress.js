import { ROUND_CONFIG, RANKED_START_IP_LIMIT } from './game-economy.js';
import { rawAmount, splitFee, MAX_RAW, decimalToRaw } from '../public/economy/assets/amounts.js';
import { economyPolicy } from '../public/economy/assets/catalog.js';

export const STRESS_MODEL = 'economy-stress-v2';
export const proposedRoundReward = Object.freeze({ rewardGeek: '100', basis: 'One qualifying completed round, not each correct answer or each day.', status: 'proposal', eligibilityFinalized: false, dailyLimitsFinalized: false, transfersEnabled: false });
const count = value => { if (!Number.isSafeInteger(value) || value < 0 || value > 1000000) throw new Error('STRESS_INPUT_INVALID'); return BigInt(value); };
const minimum = (a, b) => a < b ? a : b;
const positive = n => n > 0n ? n : 0n;
const ceilDivide = (a, b) => (a + b - 1n) / b;
export function modelGauntlet({ startingCredits = '0', correctByRound = Array(10).fill(10) } = {}) {
  if (typeof startingCredits !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(startingCredits) || BigInt(startingCredits) > BigInt(Number.MAX_SAFE_INTEGER) ||
      !Array.isArray(correctByRound) || correctByRound.length !== ROUND_CONFIG.length || correctByRound.some(n => !Number.isInteger(n) || n < 0 || n > 10)) throw new Error('STRESS_INPUT_INVALID');
  let balance = BigInt(startingCredits), issued = 0n, spent = 0n; const rounds = [];
  for (const config of ROUND_CONFIG) {
    const entry = BigInt(config.entry), before = balance;
    if (balance < entry) return { currency: 'ALPHA-CREDITS', startingCredits, issued: issued.toString(), spent: spent.toString(), closingCredits: balance.toString(), netCreated: (issued - spent).toString(), completedRounds: rounds.length, stoppedAtRound: config.round, rounds };
    const grant = BigInt(config.reward) * BigInt(correctByRound[config.round - 1]);
    if (balance + grant - entry > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('STRESS_CREDIT_CEILING');
    issued += grant; spent += entry; balance += grant - entry;
    rounds.push({ round: config.round, correct: correctByRound[config.round - 1], beforeCredits: before.toString(), entryCredits: entry.toString(), issuedCredits: grant.toString(), afterCredits: balance.toString() });
  }
  return { currency: 'ALPHA-CREDITS', startingCredits, issued: issued.toString(), spent: spent.toString(), closingCredits: balance.toString(), netCreated: (issued - spent).toString(), completedRounds: rounds.length, stoppedAtRound: null, rounds };
}
export function modelFreeRounds(completions = 1000, correct = 10) {
  const n = count(completions);
  if (!Number.isInteger(correct) || correct < 0 || correct > 10 || ROUND_CONFIG[0].entry !== 0) throw new Error('STRESS_INPUT_INVALID');
  return { currency: 'ALPHA-CREDITS', completions, correct, entryCredits: '0', issuedCredits: (n * BigInt(correct) * BigInt(ROUND_CONFIG[0].reward)).toString(),
    startLimit: RANKED_START_IP_LIMIT, startWindowsPerUnchangedFingerprint: ceilDivide(n, BigInt(RANKED_START_IP_LIMIT.maximum)).toString(),
    scope: 'Aggregate completions across players/time, not a same-hour per-person forecast. Starts share the existing network-fingerprint limit across ranked modes; no lifetime credit-grant cap is modeled.' };
}
export function modelReserve({ openingReserveRaw, feeCount, feePerReceiptRaw, claimCount, rewardPerClaimRaw, rewardCapRaw }) {
  const opening = rawAmount(openingReserveRaw), fees = count(feeCount), fee = rawAmount(feePerReceiptRaw), claims = count(claimCount), reward = rawAmount(rewardPerClaimRaw), cap = rawAmount(rewardCapRaw);
  if (reward === 0n) throw new Error('STRESS_INPUT_INVALID');
  const feeTotal = fees * fee;
  // This batch assumes all fees arrive before claims; it does not model recirculating tokens.
  if (opening + feeTotal > MAX_RAW) throw new Error('STRESS_SUPPLY_EXCEEDED');
  const split = fee > 0n ? splitFee(feePerReceiptRaw, feePerReceiptRaw) : { recyclePendingRaw: '0', burnPendingRaw: '0' };
  const perRecycle = BigInt(split.recyclePendingRaw), recycle = fees * perRecycle, burn = fees * BigInt(split.burnPendingRaw);
  const available = opening + recycle, requested = claims * reward, budget = minimum(available, cap);
  const covered = minimum(claims, budget / reward), coveredAmount = covered * reward;
  const needed = positive(requested - opening);
  const aggregateRecycle = feeTotal * BigInt(economyPolicy.recyclePercent) / 100n;
  return { model: STRESS_MODEL, currency: 'GEEK', decimals: 8, policy: economyPolicy.id, mode: 'planning-only', fundingVerified: false, transfersEnabled: false, burnsConfirmed: false,
    input: { openingReserveRaw, feeCount, feePerReceiptRaw, claimCount, rewardPerClaimRaw, rewardCapRaw },
    feeTotalRaw: feeTotal.toString(), recyclePendingRaw: recycle.toString(), burnPendingRaw: burn.toString(), aggregateRecycleComparisonRaw: aggregateRecycle.toString(), roundingDifferenceRaw: (aggregateRecycle - recycle).toString(),
    modeledAvailableRaw: available.toString(), requestedRewardsRaw: requested.toString(), coveredClaims: covered.toString(), blockedClaims: (claims - covered).toString(), coveredRewardsRaw: coveredAmount.toString(), closingReserveRaw: (available - coveredAmount).toString(),
    fundingGapRaw: positive(requested - available).toString(), capGapRaw: positive(requested - cap).toString(), capLimited: requested > cap && cap < available,
    feeReceiptsToCoverDemand: needed === 0n ? '0' : perRecycle === 0n ? null : ceilDivide(needed, perRecycle).toString(),
    scope: 'Hypothetical one-batch token budget: fees arrive first, all recycling is assigned to this reserve, then distinct equal-sized proposed claims. Burns remain pending and cannot fund rewards. This is not actual reserve funding, credit conversion or settlement.' };
}
export function modelRunway(input) {
  const day = modelReserve(input), opening = BigInt(input.openingReserveRaw), reward = BigInt(input.rewardPerClaimRaw);
  const requested = BigInt(input.claimCount), admitted = minimum(requested, BigInt(input.rewardCapRaw) / reward);
  const scheduled = admitted * reward, recycle = BigInt(day.recyclePendingRaw), netDraw = scheduled - recycle;
  const status = admitted === 0n ? 'no-rewards-budgeted' : netDraw <= 0n ? 'no-modeled-depletion' : 'finite';
  const days = status === 'finite' ? opening / netDraw : null;
  const remaining = days === null ? null : opening - days * netDraw;
  return { model: STRESS_MODEL, mode: 'planning-only', currency: 'GEEK', fundingVerified: false, transfersEnabled: false,
    status, input, requestedRoundsPerDay: requested.toString(), budgetedRoundsPerDay: admitted.toString(), capBlockedRoundsPerDay: (requested - admitted).toString(),
    scheduledRewardsPerDayRaw: scheduled.toString(), recyclePerDayRaw: recycle.toString(), burnPendingPerDayRaw: day.burnPendingRaw,
    netReserveDrawPerDayRaw: netDraw.toString(), fullBudgetDays: days?.toString() ?? null,
    reserveAfterFullDaysRaw: remaining?.toString() ?? null,
    roundsCoveredOnNextDay: days === null ? null : minimum(admitted, (remaining + recycle) / reward).toString(),
    scope: 'Constant daily assumptions, with all eligible fees received before rewards each day and all recycling assigned to this reserve. Full budget days count days that can pay every budgeted round; a later partial day is separate. Recurring fees are assumed, not guaranteed. Cumulative circulation may reuse tokens. Creator/event/developer spending and KAS transaction costs are excluded. This does not enforce live payout caps, eligibility or per-player limits.' };
}
export function parseStressScenario(body) {
  if (!body || Object.keys(body).some(k => !['startingCredits', 'correctByRound', 'freeCompletions', 'freeCorrect', 'reserve', 'period'].includes(k)) || !body.reserve ||
      (body.period !== undefined && !['once', 'daily'].includes(body.period)) ||
      Object.keys(body.reserve).some(k => !['openingReserve', 'feeCount', 'feeEach', 'claimCount', 'rewardEach', 'rewardCap'].includes(k))) throw new Error('STRESS_INPUT_INVALID');
  const input = {
    openingReserveRaw: decimalToRaw(body.reserve.openingReserve), feeCount: body.reserve.feeCount, feePerReceiptRaw: decimalToRaw(body.reserve.feeEach),
    claimCount: body.reserve.claimCount, rewardPerClaimRaw: decimalToRaw(body.reserve.rewardEach), rewardCapRaw: decimalToRaw(body.reserve.rewardCap)
  };
  return { gauntlet: modelGauntlet(body), freeRounds: modelFreeRounds(body.freeCompletions, body.freeCorrect), reserve: modelReserve(input),
    runway: body.period === 'daily' ? modelRunway(input) : null, proposedRoundReward,
    mode: 'planning-only', transfersEnabled: false, creditConversionEnabled: false, gameConfigurationChanged: false };
}
export const defaultStressScenario = () => ({ startingCredits: '0', correctByRound: Array(10).fill(10), freeCompletions: 1000, freeCorrect: 10, period: 'daily',
  reserve: { openingReserve: '1000000000', feeCount: 0, feeEach: '1', claimCount: 1000, rewardEach: proposedRoundReward.rewardGeek, rewardCap: '100000' } });
export const stressExamples = () => ({ model: STRESS_MODEL, mode: 'planning-only', roundConfiguration: ROUND_CONFIG, startLimit: RANKED_START_IP_LIMIT, proposedRoundReward,
  gauntlet: [10, 5, 4, 0].map(correct => ({ correctPerRound: correct, ...modelGauntlet({ correctByRound: Array(10).fill(correct) }) })),
  repeatedFreeRounds: modelFreeRounds(1000000, 10),
  reserve: {
    feesOnly: modelReserve({ openingReserveRaw: '0', feeCount: 1000, feePerReceiptRaw: '100000000', claimCount: 1000, rewardPerClaimRaw: '100000000', rewardCapRaw: '100000000000' }),
    tinyFees: modelReserve({ openingReserveRaw: '0', feeCount: 1000000, feePerReceiptRaw: '1', claimCount: 1, rewardPerClaimRaw: '1', rewardCapRaw: '1' }),
    depleted: modelReserve({ openingReserveRaw: '0', feeCount: 0, feePerReceiptRaw: '0', claimCount: 1000000, rewardPerClaimRaw: '100000000', rewardCapRaw: '100000000000000' }),
    capped: modelReserve({ openingReserveRaw: '100000000000', feeCount: 0, feePerReceiptRaw: '0', claimCount: 1000, rewardPerClaimRaw: '100000000', rewardCapRaw: '10000000000' })
  }, runway: [1000, 10000, 100000].map(rounds => modelRunway({ openingReserveRaw: '100000000000000000', feeCount: 0, feePerReceiptRaw: '0', claimCount: rounds, rewardPerClaimRaw: '10000000000', rewardCapRaw: (BigInt(rounds) * 10000000000n).toString() })),
  transfersEnabled: false, creditConversionEnabled: false });
