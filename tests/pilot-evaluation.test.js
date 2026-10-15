import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePilot } from '../server/pilot-evaluation.js';
const baseline = { correct:1,total:5,at:'2026-10-15T12:00:00Z' }, immediate = { correct:4,total:5,at:'2026-10-15T13:00:00Z' }, delayed = { correct:3,total:5,at:'2026-10-16T13:00:00Z' };
test('pilot reporting retains missing follow-ups and computes paired change only for observed pairs', () => {
  const result = evaluatePilot({ schema:1,participants:[{ id:'synthetic-a',baseline,immediate,delayed },{ id:'synthetic-b',baseline,immediate,delayed:null }] });
  assert.equal(result.started,2);assert.equal(result.phases.delayed.missing,1);assert.equal(result.delayedPairedCount,1);assert.equal(result.meanPairedChange,2);
  const empty = evaluatePilot({schema:1,participants:[]}); assert.equal(empty.meanPairedChange,null);
});
test('pilot reporting rejects early delayed checks, duplicate identities and impossible scores', () => {
  const p = {id:'synthetic',baseline,immediate,delayed};
  for (const participants of [[p,p],[{...p,delayed:{...delayed,at:'2026-10-15T14:00:00Z'}}],[{...p,baseline:{...baseline,correct:6}}]]) assert.throws(()=>evaluatePilot({schema:1,participants}));
});
