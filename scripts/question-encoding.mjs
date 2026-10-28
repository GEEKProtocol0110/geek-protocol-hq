import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const encoder = new TextEncoder(), windows = new TextDecoder('windows-1252');
const substitutions = new Map();
const characters = [...Array.from({length: 0x250-0xa0},(_,i)=>String.fromCodePoint(i+0xa0)), ...'–—‘’“”…€™'];
for (const character of characters) {
  const bytes = encoder.encode(character);
  for (const broken of [windows.decode(bytes),String.fromCharCode(...bytes)]) {
    if (broken !== character) substitutions.set(broken,character);
  }
}
const escaped = s => s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const pattern = new RegExp([...substitutions.keys()].sort((a,b)=>b.length-a.length).map(escaped).join('|'),'gu');
const compact = s => s.normalize('NFKC').replace(/\s+/gu,' ').trim();

// A proposal aid for a reviewed source record, never a runtime display filter.
// Preserve legitimate Unicode; reverse only known misdecoded UTF-8 sequences.
export const repairEncodingText = text => String(text).replace(pattern,s=>substitutions.get(s));
export const hasRepairableEncoding = text => repairEncodingText(text) !== text;

export function encodingDraftCorrection(q, sourcePrompt, sourceOptions) {
  assert.equal(q.reviewStatus,'draft-needs-human-review','Encoding repair cannot source-certify a question');
  assert.ok(Array.isArray(sourceOptions) && sourceOptions.length===4 && q.options.length===4);
  assert.equal(compact(q.prompt),compact(sourcePrompt),'Source prompt mismatch');
  for (const [i,option] of q.options.entries()) assert.equal(compact(option),compact(sourceOptions[i]),'Source option mismatch');
  const clean = s => repairEncodingText(s).replace(/\s+/gu,' ').trim();
  const prompt=clean(sourcePrompt), options=sourceOptions.map(clean);
  assert.ok(prompt!==q.prompt || options.some((o,i)=>o!==q.options[i]),'No encoding correction');
  assert.ok(![prompt,...options].some(s=>hasRepairableEncoding(s)||s.includes('\uFFFD')),'Unresolved encoding damage');
  assert.equal(new Set(options.map(compact)).size,4,'Repair collapsed distinct options');
  const hash=createHash('sha256').update(JSON.stringify([prompt,options,q.correctIndex])).digest('hex');
  const id=q.id+'-E'+hash.slice(0,10);
  assert.ok(id.length<=64);
  return {...q,id,conceptId:id,prompt,options};
}
