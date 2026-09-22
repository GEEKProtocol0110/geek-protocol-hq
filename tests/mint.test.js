import test from 'node:test';
import assert from 'node:assert/strict';
import { GEEK_DEPLOYMENT, geekMintInscription, createGeekMintStatusLoader, parseGeekMintStatus } from '../server/mint.js';

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
  const load = createGeekMintStatusLoader({ fetchImpl, logger: () => {} });
  await assert.rejects(load({ force: true }), /MINT_STATUS_UNAVAILABLE/);
});

test('primary DNS failure uses only the documented mainnet fallback and validates its record', async () => {
  const requests = [];
  const logs = [];
  const load = createGeekMintStatusLoader({
    logger: (event) => logs.push(event),
    fetchImpl: async (url, options) => {
      requests.push(url);
      assert.equal(options.redirect, 'error');
      assert.equal(options.cache, 'no-store');
      assert.ok(options.signal instanceof AbortSignal);
      return requests.length === 1
        ? new Response('Origin DNS error', { status: 530 })
        : Response.json(fixture());
    }
  });
  const status = await load({ force: true });
  assert.deepEqual(requests, [
    'https://api.kasplex.org/v1/krc20/token/GEEK',
    'https://api-fallback.kasplex.org/v1/krc20/token/GEEK'
  ]);
  assert.equal(status.sourceUrl, requests[1]);
  assert.equal(status.mint.open, true);
  assert.deepEqual(logs[0], { event: 'geek_mint_status_failure', sourceUrl: requests[0], reason: 'http_error', httpStatus: 530 });
});

test('reachable bad records cannot be overridden by a more permissive fallback', async () => {
  for (const body of [fixture({ hashRev: '0'.repeat(64) }), fixture({ minted: '-1' }), fixture({ minted: '1' }), {}, null]) {
    let calls = 0;
    const load = createGeekMintStatusLoader({ logger: () => {}, fetchImpl: async () => {
      calls++;
      return Response.json(calls === 1 ? body : fixture());
    } });
    await assert.rejects(load({ force: true }), /MINT_(DEPLOYMENT_MISMATCH|STATUS_UNAVAILABLE)/);
    assert.equal(calls, 1);
  }
});

test('fallback cannot replace an exhausted supply with an open record', async () => {
  let calls = 0;
  const load = createGeekMintStatusLoader({ logger: () => {}, fetchImpl: async () => {
    calls++;
    return Response.json(fixture({ minted: GEEK_DEPLOYMENT.maxRaw, state: 'finished' }));
  } });
  const status = await load();
  assert.equal(status.mint.open, false);
  assert.equal(calls, 1);
});

test('fallback responses must pass the same deployment validation', async () => {
  let calls = 0;
  const load = createGeekMintStatusLoader({ logger: () => {}, fetchImpl: async () => {
    if (++calls === 1) throw new DOMException('timeout', 'TimeoutError');
    return Response.json(fixture({ to: 'kaspa:substituted' }));
  } });
  await assert.rejects(load(), /MINT_DEPLOYMENT_MISMATCH/);
  assert.equal(calls, 2);
});

test('a failed fresh check invalidates cached success, then a later live request can recover', async () => {
  let unavailable = false;
  let calls = 0;
  const load = createGeekMintStatusLoader({ logger: () => {}, clock: () => 1000, fetchImpl: async () => {
    calls++;
    return unavailable ? new Response('', { status: 503 }) : Response.json(fixture());
  } });
  assert.equal((await load()).mint.open, true);
  assert.equal((await load()).mint.open, true);
  assert.equal(calls, 1);
  unavailable = true;
  await assert.rejects(load({ force: true }), /MINT_STATUS_UNAVAILABLE/);
  await assert.rejects(load(), /MINT_STATUS_UNAVAILABLE/);
  assert.equal(calls, 5);
  unavailable = false;
  assert.equal((await load()).mint.open, true);
  assert.equal(calls, 6);
});

test('display cache expires and fresh preflight always makes a network request', async () => {
  let now = 1000;
  let calls = 0;
  const load = createGeekMintStatusLoader({ logger: () => {}, clock: () => now, fetchImpl: async () => {
    calls++;
    return Response.json(fixture());
  } });
  await load();
  await load();
  assert.equal(calls, 1);
  await load({ force: true });
  assert.equal(calls, 2);
  now += 10_000;
  await load();
  assert.equal(calls, 3);
});
