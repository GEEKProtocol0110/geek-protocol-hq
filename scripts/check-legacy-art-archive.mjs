import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { legacyArtManifest, listLegacyArtRecords } from '../server/legacy-art-archive.js';

const hashes = {};
for (const record of listLegacyArtRecords()) {
  const bytes = await readFile(new URL(`../public/collection/archive/legacy-art/${record.fileName}`, import.meta.url));
  hashes[record.fileName] = createHash('sha256').update(bytes).digest('hex');
}

const expected = `${JSON.stringify(legacyArtManifest(hashes), null, 2)}\n`;
const actual = await readFile(new URL('../public/data/legacy-geek-art.json', import.meta.url), 'utf8');
if (actual !== expected) {
  console.error('Legacy art archive drift detected. Run npm run archive:generate and review the resulting provenance changes.');
  process.exitCode = 1;
} else {
  console.log(`Legacy art archive verified (${Object.keys(hashes).length} assets, hashes current).`);
}
