import { readFileSync } from 'node:fs';
import { evaluatePilot } from '../server/pilot-evaluation.js';
if (!process.argv[2]) throw new Error('Usage: node scripts/evaluate-pilot.mjs /private/path/pilot.json');
console.log(JSON.stringify(evaluatePilot(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2));
