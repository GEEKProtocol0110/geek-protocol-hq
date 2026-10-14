import test from 'node:test';
import assert from 'node:assert/strict';
import { modelGauntlet, modelFreeRounds, modelReserve, parseStressScenario, defaultStressScenario, stressExamples } from '../server/economy-stress.js';
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
});
