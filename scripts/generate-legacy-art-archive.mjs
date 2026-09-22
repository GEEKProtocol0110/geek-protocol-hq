import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { legacyArtManifest, listLegacyArtRecords } from '../server/legacy-art-archive.js';

const hashes = {};
for (const record of listLegacyArtRecords()) {
  const bytes = await readFile(new URL(`../public/collection/archive/legacy-art/${record.fileName}`, import.meta.url));
  hashes[record.fileName] = createHash('sha256').update(bytes).digest('hex');
}

const output = new URL('../public/data/legacy-geek-art.json', import.meta.url);
await writeFile(output, `${JSON.stringify(legacyArtManifest(hashes), null, 2)}\n`, 'utf8');
console.log(`Generated public/data/legacy-geek-art.json with ${Object.keys(hashes).length} recovered concepts.`);
