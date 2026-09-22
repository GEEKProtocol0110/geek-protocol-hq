import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { legacyArtBlueprint, listLegacyArtRecords } from '../server/legacy-art-archive.js';

test('legacy archive preserves ten recovered concepts without inventing edition mappings', async () => {
  const records = listLegacyArtRecords();
  assert.equal(records.length, 10);
  assert.equal(new Set(records.map((record) => record.id)).size, 10);
  assert.equal(legacyArtBlueprint.recoveredAssetCount, 10);
  assert.equal(legacyArtBlueprint.approvedAssetCount, 0);
  assert.equal(legacyArtBlueprint.editionMapping, 'unmapped');
  assert.equal(legacyArtBlueprint.onChainOwnershipActive, false);

  const manifest = JSON.parse(await readFile(new URL('../public/data/legacy-geek-art.json', import.meta.url), 'utf8'));
  assert.equal(manifest.records.length, 10);
  for (const record of manifest.records) {
    assert.match(record.asset.sha256, /^[a-f0-9]{64}$/);
    assert.equal(record.production.status, 'legacy-recovered');
    assert.equal(record.production.approved, false);
    assert.equal(record.production.mintReady, false);
    assert.equal(record.production.mappedEdition, null);
    assert.equal(record.production.onChainOwnershipActive, false);
  }
});
