import { readFile } from 'node:fs/promises';
import { serializeCollectionManifest } from './generate-geek-collection.mjs';

const path = new URL('../public/data/geek-500.json', import.meta.url);
const expected = serializeCollectionManifest();
const actual = await readFile(path, 'utf8').catch(() => '');

if (actual !== expected) {
  console.error('Collection manifest is missing or stale. Run: npm run collection:generate');
  process.exitCode = 1;
} else {
  console.log('Collection manifest matches the deterministic source.');
}
