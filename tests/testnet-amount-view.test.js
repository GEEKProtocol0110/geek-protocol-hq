import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotTransferView } from '../server/ops-ui/assets/ops-core.js';
test('pilot wallet amounts preserve exact integer precision and guide the same receipt through reconciliation', () => {
  const r = { network:'testnet-10',amount:'100000000',decimals:'8',ticker:'GEEKT',recipient:'synthetic',state:'queued' };
  assert.equal(pilotTransferView(r).amount,'1.00000000');
  assert.equal(pilotTransferView({...r,amount:'14400000000000000000'}).amount,'144000000000.00000000');
  assert.equal(pilotTransferView({...r,amount:'1',decimals:'18'}).amount,'0.000000000000000001');
  assert.match(pilotTransferView({...r,state:'awaiting-indexer'}).next,/same hash/);
  assert.match(pilotTransferView({...r,state:'indexed-confirmed'}).next,/not an independent finality/);
  assert.equal(pilotTransferView({...r,network:'mainnet'}),null);
  assert.equal(pilotTransferView({...r,decimals:'19'}),null);
});
