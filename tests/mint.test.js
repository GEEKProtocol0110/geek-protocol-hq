import test from 'node:test';
import assert from 'node:assert/strict';
import { GEEK_DEPLOYMENT, geekMintInscription, loadGeekMintStatus, parseGeekMintStatus } from '../server/mint.js';

const fixture = (overrides = {}) => ({
  message: 'successful',
  result: [{
    tick: 'GEEK',
    max: '14400000000000000000',
    lim: '10000000000000',
    pre: '0',
    dec: '8',
    mod: 'mint',
    to: 'kaspa:qzj0e55rlxpm0knvra9wvgckpkyq9h8hv8wl0lh2ngjad9a4cedmj24cy07ew',
    hashRev: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1',
    minted: '174500000000000000',
    burned: '0',
    state: 'deployed',
    mtsMod: '1789876800000',
    ...overrides
  }]
});

test('GEEK mint status computes gross capacity from the pinned live deployment', () => {
  const status = parseGeekMintStatus(fixture(), 1_789_876_800_000);
  assert.equal(status.deployment.verified, true);
  assert.equal(status.deployment.deploymentHash, GEEK_DEPLOYMENT.deploymentHash);
  assert.equal(status.mint.open, true);
  assert.equal(status.mint.perMint, '100000');
  assert.equal(status.mint.minted, '1745000000');
  assert.equal(status.mint.maximum, '144000000000');
  assert.equal(status.mint.completedMints, '17450');
  assert.equal(status.mint.totalMints, '1440000');
  assert.equal(status.mint.remainingMints, '1422550');
  assert.equal(status.mint.progressBasisPoints, 121);
});

test('GEEK mint inscription is exact and contains no destination or variable amount', () => {
  assert.equal(geekMintInscription(), '{"p":"KRC-20","op":"mint","tick":"GEEK"}');
  assert.deepEqual(JSON.parse(geekMintInscription()), { p: 'KRC-20', op: 'mint', tick: 'GEEK' });
});

test('GEEK mint status blocks a substituted deployment', () => {
  assert.throws(
    () => parseGeekMintStatus(fixture({ hashRev: '0'.repeat(64) })),
    /MINT_DEPLOYMENT_MISMATCH/
  );
});

test('GEEK mint status closes permanently at gross maximum supply', () => {
  const status = parseGeekMintStatus(fixture({ minted: '14400000000000000000', state: 'finished' }));
  assert.equal(status.mint.open, false);
  assert.equal(status.mint.remainingMints, '0');
  assert.equal(status.mint.progressBasisPoints, 10000);
});

test('GEEK mint status fails closed when the indexer is unavailable', async () => {
  const fetchImpl = async () => new Response('upstream unavailable', { status: 503 });
  await assert.rejects(loadGeekMintStatus({ fetchImpl, force: true }), /MINT_STATUS_UNAVAILABLE/);
});
