import test from 'node:test';
import assert from 'node:assert/strict';
import { collectionManifest, geekCollectionBlueprint, identityForNumber, listGeekIdentities } from '../server/geek-collection.js';

test('the Omniscient Grid contains exactly 500 stable, unique identities', () => {
  const identities = listGeekIdentities();
  assert.equal(identities.length, 500);
  assert.equal(new Set(identities.map((item) => item.id)).size, 500);
  assert.equal(new Set(identities.map((item) => item.name)).size, 500);
  assert.deepEqual(identities.map((item) => item.number), Array.from({ length: 500 }, (_, index) => index + 1));
});

test('tier allocations total 500 and preserve the two mythic anchors', () => {
  const identities = listGeekIdentities();
  const actual = Object.fromEntries(geekCollectionBlueprint.tiers.map((tier) => [tier.name, identities.filter((item) => item.tier === tier.name).length]));
  assert.deepEqual(actual, { Common: 250, Rare: 125, Epic: 75, Legendary: 40, Elite: 8, Mythic: 2 });
  assert.equal(identityForNumber(499).name, 'GIGA');
  assert.equal(identityForNumber(499).role, 'Community Heart');
  assert.equal(identityForNumber(499).districtName, 'GIGA District');
  assert.equal(identityForNumber(500).name, 'A.C.E.');
  assert.equal(identityForNumber(500).role, 'Protocol Mind');
  assert.equal(identityForNumber(500).districtName, 'A.C.E. Spine');
});

test('every identity has production, lore, metadata, and no pay-to-win utility', () => {
  for (const identity of listGeekIdentities()) {
    assert.match(identity.id, /^geek-\d{3}$/);
    assert.equal(identity.metadata.image, null);
    assert.equal(identity.production.approved, false);
    assert.equal(identity.production.imageSha256, null);
    assert.equal(identity.utility.competitiveAdvantage, false);
    assert.equal(identity.utility.payoutMultiplier, false);
    assert.equal(identity.utility.onChainOwnershipActive, false);
    assert.equal(identity.metadata.attributes.length, 8);
    assert.ok(identity.lore.dispatch.length > 40);
    assert.equal(identity.traits.palette.length, 3);
  }
});

test('the public manifest is deterministic and deployment remains disabled', () => {
  assert.deepEqual(collectionManifest(), collectionManifest());
  assert.equal(geekCollectionBlueprint.deployment.configured, false);
  assert.equal(geekCollectionBlueprint.deployment.metadataFrozen, false);
  assert.equal(geekCollectionBlueprint.deployment.independentlyAudited, false);
  assert.equal(geekCollectionBlueprint.artStatuses['design-pending'], 498);
});

test('out-of-range edition numbers fail closed', () => {
  assert.throws(() => identityForNumber(0), /GEEK_EDITION_INVALID/);
  assert.throws(() => identityForNumber(501), /GEEK_EDITION_INVALID/);
  assert.throws(() => identityForNumber(1.5), /GEEK_EDITION_INVALID/);
});
