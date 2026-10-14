import test from 'node:test';
import assert from 'node:assert/strict';
import { modelGauntlet, modelFreeRounds, modelReserve, modelRunway, parseStressScenario, defaultStressScenario, stressExamples } from '../server/economy-stress.js';
import { ROUND_CONFIG } from '../server/game-economy.js';
import { MAX_RAW } from '../public/economy/assets/amounts.js';
const pool = extra => modelReserve({ openingReserveRaw: '0', feeCount: 1000, feePerReceiptRaw: '100000000', claimCount: 1000, rewardPerClaimRaw: '100000000', rewardCapRaw: '100000000000', ...extra });
test('current internal credit paths account for entry affordability and grant only completed modeled rounds', () => {
  const perfect = modelGauntlet(); assert.equal(perfect.issued, '46300'); assert.equal(perfect.spent, '14240'); assert.equal(perfect.netCreated, '32060'); assert.equal(perfect.completedRounds, 10);
  const half = modelGauntlet({ correctByRound: Array(10).fill(5) }); assert.equal(half.completedRounds, 9); assert.equal(half.stoppedAtRound, 10); assert.equal(half.closingCredits, '5910');
  const low = modelGauntlet({ correctByRound: Array(10).fill(4) }); assert.equal(low.completedRounds, 2); assert.equal(low.stoppedAtRound, 3); assert.equal(low.closingCredits, '80');
  for (const run of stressExamples().gauntlet) assert.equal(BigInt(run.startingCredits) + BigInt(run.issued) - BigInt(run.spent), BigInt(run.closingCredits));
  assert.ok(Object.isFrozen(ROUND_CONFIG) && ROUND_CONFIG.every(Object.isFrozen));
});
test('free-round issuance is aggregate internal credit math with current start limits, not token funding', () => {
  const free = modelFreeRounds(1000000, 10); assert.equal(free.issuedCredits, '100000000'); assert.equal(free.currency, 'ALPHA-CREDITS'); assert.equal(free.startLimit.maximum, 20);
  assert.equal(modelFreeRounds(1000, 10).startWindowsPerUnchangedFingerprint, '50');
  assert.equal(modelFreeRounds(0, 0).issuedCredits, '0');
});
test('fee-only recycling cannot cover equal-sized claims and burn pending is never reward funding', () => {
  const r = pool(); assert.equal(r.recyclePendingRaw, '70000000000'); assert.equal(r.burnPendingRaw, '30000000000'); assert.equal(r.coveredClaims, '700'); assert.equal(r.blockedClaims, '300'); assert.equal(r.fundingGapRaw, '30000000000'); assert.equal(r.closingReserveRaw, '0');
  assert.equal(r.feeReceiptsToCoverDemand, '1429'); assert.equal(r.transfersEnabled, false); assert.equal(r.fundingVerified, false); assert.equal(r.burnsConfirmed, false);
  const capped = pool({ openingReserveRaw: '100000000000', feeCount: 0, rewardCapRaw: '10000000000' }); assert.equal(capped.coveredClaims, '100'); assert.equal(capped.capLimited, true); assert.equal(capped.closingReserveRaw, '90000000000');
});
test('a million smallest-unit fees expose per-receipt rounding and cannot recycle an indivisible fraction', () => {
  const r = pool({ feeCount: 1000000, feePerReceiptRaw: '1', claimCount: 1, rewardPerClaimRaw: '1', rewardCapRaw: '1' });
  assert.equal(r.recyclePendingRaw, '0'); assert.equal(r.burnPendingRaw, '1000000'); assert.equal(r.roundingDifferenceRaw, '700000'); assert.equal(r.feeReceiptsToCoverDemand, null); assert.equal(r.blockedClaims, '1');
});
test('depletion, zero caps, indivisible remaining budgets and large exact values never overspend', () => {
  for (const extra of [{ feeCount: 0, claimCount: 1000000 }, { rewardCapRaw: '0' }, { openingReserveRaw: '7', feeCount: 0, rewardPerClaimRaw: '3', claimCount: 3 }, { openingReserveRaw: '9007199254740993', feeCount: 0, rewardPerClaimRaw: '1', claimCount: 1000000, rewardCapRaw: MAX_RAW.toString() }]) {
    const r = pool(extra); assert.equal(BigInt(r.modeledAvailableRaw), BigInt(r.coveredRewardsRaw) + BigInt(r.closingReserveRaw)); assert.ok(BigInt(r.coveredRewardsRaw) <= BigInt(r.input.rewardCapRaw)); assert.ok(BigInt(r.closingReserveRaw) >= 0n);
  }
  const large = pool({ openingReserveRaw: '9007199254740993', feeCount: 0, rewardPerClaimRaw: '1', claimCount: 1000000, rewardCapRaw: MAX_RAW.toString() }); assert.equal(large.closingReserveRaw, '9007199253740993');
});
test('generated receipt batches conserve every unit, with bounded rounding differences and no implicit conversion', () => {
  for (let fee = 0; fee < 200; fee++) for (const n of [0, 1, 7, 1000, 1000000]) {
    const r = pool({ feeCount: n, feePerReceiptRaw: String(fee), claimCount: 37, rewardPerClaimRaw: '3', rewardCapRaw: '101' });
    assert.equal(BigInt(r.feeTotalRaw), BigInt(r.recyclePendingRaw) + BigInt(r.burnPendingRaw));
    assert.ok(BigInt(r.roundingDifferenceRaw) >= 0n); assert.ok(BigInt(r.roundingDifferenceRaw) < BigInt(n || 1));
    assert.equal(BigInt(r.modeledAvailableRaw), BigInt(r.coveredRewardsRaw) + BigInt(r.closingReserveRaw));
  }
  assert.equal(parseStressScenario(defaultStressScenario()).creditConversionEnabled, false);
});
test('bad inputs, impossible one-batch supply and live credit-counter overflow are rejected', () => {
  for (const bad of [1, '-1', '01', '1e3']) assert.throws(() => modelGauntlet({ startingCredits: bad }));
  assert.throws(() => modelGauntlet({ startingCredits: String(Number.MAX_SAFE_INTEGER) }), /CREDIT_CEILING/);
  assert.throws(() => modelGauntlet({ correctByRound: [10] }));
  assert.throws(() => pool({ openingReserveRaw: MAX_RAW.toString() }), /SUPPLY_EXCEEDED/);
  for (const bad of [-1, 1000001, 1.5, '1000']) assert.throws(() => pool({ feeCount: bad }));
  assert.throws(() => pool({ rewardPerClaimRaw: '0' }));
  assert.throws(() => parseStressScenario({ ...defaultStressScenario(), transfersEnabled: true }));
  const scientific = defaultStressScenario(); scientific.reserve.feeEach = '1e3'; assert.throws(() => parseStressScenario(scientific));
  assert.throws(() => parseStressScenario({ ...defaultStressScenario(), period: 'weekly' }));
});
const runway = extra => modelRunway({ openingReserveRaw: '100000000000000000', feeCount: 0, feePerReceiptRaw: '0', claimCount: 1000, rewardPerClaimRaw: '10000000000', rewardCapRaw: '10000000000000', ...extra });
test('100 GEEK per qualifying round gives ten million rounds and exact full-day runway before recycling', () => {
  assert.deepEqual(stressExamples().runway.map(r => r.fullBudgetDays), ['10000', '1000', '100']);
  const r = runway(); assert.equal(r.scheduledRewardsPerDayRaw, '10000000000000'); assert.equal(r.roundsCoveredOnNextDay, '0'); assert.equal(r.transfersEnabled, false);
  const scenario = defaultStressScenario(), parsed = parseStressScenario(scenario); assert.equal(parsed.proposedRoundReward.rewardGeek, '100'); assert.equal(parsed.runway.fullBudgetDays, '10000');
  assert.equal(parseStressScenario({ ...scenario, period: 'once' }).runway, null);
  delete scenario.period; assert.equal(parseStressScenario(scenario).runway, null);
});
test('daily caps round down to whole rewards and zero cap or zero demand never claims an infinite reward runway', () => {
  const capped = runway({ rewardCapRaw: '25000000000' }); assert.equal(capped.budgetedRoundsPerDay, '2'); assert.equal(capped.capBlockedRoundsPerDay, '998'); assert.equal(capped.scheduledRewardsPerDayRaw, '20000000000'); assert.equal(capped.fullBudgetDays, '5000000');
  for (const extra of [{ rewardCapRaw: '0' }, { claimCount: 0 }, { rewardCapRaw: '9999999999' }]) { const r = runway(extra); assert.equal(r.status, 'no-rewards-budgeted'); assert.equal(r.fullBudgetDays, null); assert.equal(r.roundsCoveredOnNextDay, null); }
});
test('daily recycling extends full-budget coverage while first-day insolvency and partial days remain visible', () => {
  const recycled = runway({ feeCount: 50000, feePerReceiptRaw: '100000000' }); assert.equal(recycled.recyclePerDayRaw, '3500000000000'); assert.equal(recycled.burnPendingPerDayRaw, '1500000000000'); assert.equal(recycled.netReserveDrawPerDayRaw, '6500000000000'); assert.equal(recycled.fullBudgetDays, '15384'); assert.equal(recycled.roundsCoveredOnNextDay, '750');
  const short = runway({ openingReserveRaw: '15000000000' }); assert.equal(short.fullBudgetDays, '0'); assert.equal(short.roundsCoveredOnNextDay, '1');
  const even = runway({ openingReserveRaw: '0', feeCount: 1000, feePerReceiptRaw: '100000000', claimCount: 7, rewardCapRaw: '70000000000' }); assert.equal(even.status, 'no-modeled-depletion'); assert.equal(even.netReserveDrawPerDayRaw, '0'); assert.equal(even.fullBudgetDays, null);
  const growing = runway({ openingReserveRaw: '0', feeCount: 1000, feePerReceiptRaw: '100000000', claimCount: 1 }); assert.equal(growing.status, 'no-modeled-depletion'); assert.equal(growing.netReserveDrawPerDayRaw, '-60000000000');
});
test('generated daily budgets agree with direct simulation through the last full day and preserve raw-unit rounding', () => {
  for (let opening = 0; opening <= 37; opening++) for (const fee of ['0', '1', '3', '10']) {
    const r = runway({ openingReserveRaw: String(opening), feeCount: 2, feePerReceiptRaw: fee, claimCount: 5, rewardPerClaimRaw: '3', rewardCapRaw: '14' });
    const pay = BigInt(r.scheduledRewardsPerDayRaw), recycle = BigInt(r.recyclePerDayRaw); assert.equal(pay, 12n);
    if (pay <= recycle) { assert.equal(r.status, 'no-modeled-depletion'); continue; }
    let available = BigInt(opening), days = 0n;
    while (available + recycle >= pay) { available += recycle - pay; days++; }
    assert.equal(r.fullBudgetDays, String(days)); assert.equal(r.reserveAfterFullDaysRaw, String(available)); assert.equal(r.roundsCoveredOnNextDay, String((available + recycle) / 3n));
    assert.equal(BigInt(r.recyclePerDayRaw) + BigInt(r.burnPendingPerDayRaw), BigInt(fee) * 2n);
  }
});
