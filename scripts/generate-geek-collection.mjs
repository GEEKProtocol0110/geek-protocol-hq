import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { collectionManifest } from '../server/geek-collection.js';

export const serializeCollectionManifest = () => `${JSON.stringify(collectionManifest(), null, 2)}\n`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const output = new URL('../public/data/geek-500.json', import.meta.url);
  await mkdir(new URL('../public/data/', import.meta.url), { recursive: true });
  await writeFile(output, serializeCollectionManifest(), 'utf8');
  console.log('Generated public/data/geek-500.json with 500 deterministic identities.');
}
