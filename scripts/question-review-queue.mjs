import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { questionBankReadiness } from '../server/question-bank-readiness.js';

// Triage directs human review; no signal is a factual verdict or approval.
export const reviewSignals = q => {
  const flags = [];
  if (/\b(?:diagnos\w*|treatments?|symptoms?|antibiotic\w*|rheumatoid|otitis|epispadias)\b/i.test(q.prompt)) flags.push('clinical-scope-review');
  if (/\b(?:first|oldest|earliest|largest|smallest|only|most|least|best|worst)\b/i.test(q.prompt)) flags.push('superlative-scope-review');
  if (/\b(?:quarts?|gallons?|ounces?|tons?|pounds?|miles?)\b/i.test(q.prompt)) flags.push('unit-system-review');
  if (!q.funFact?.trim()) flags.push('missing-explanation');
  if (q.reviewStatus !== 'source-checked') flags.push('primary-source-review-needed');
  return flags;
};
export function buildReviewQueue(banks, readiness) {
  const categories = readiness.categories.map(c => {
    const questions = banks[c.id];
    assert.ok(Array.isArray(questions));
    const rawTagged = questions.filter(q => q.reviewStatus === 'source-checked').length;
    const candidates = questions.filter(q => !q.practiceOnly && q.reviewStatus !== 'source-checked').map(q => ({ id: q.id, flags: reviewSignals(q) }));
    const priority = row => row.flags.reduce((score, flag) => score + ({ 'clinical-scope-review': 8, 'superlative-scope-review': 4, 'unit-system-review': 2 }[flag] || 0), 0);
    candidates.sort((a,b) => priority(b)-priority(a) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { id: c.id, name: c.name, total: c.active, practiceOnly: c.practiceOnly,
      selectable: c.active-c.practiceOnly, rawSourceCheckTags: rawTagged,
      readinessQualified: c.reviewed, draftRows: questions.length-rawTagged,
      selectableDraftRows: candidates.length, reviewTargetDeficit: c.remaining,
      signals: Object.fromEntries(['clinical-scope-review','superlative-scope-review','unit-system-review','missing-explanation','primary-source-review-needed'].map(flag => [flag,candidates.filter(q=>q.flags.includes(flag)).length])),
      nextBatch: candidates.slice(0,25) };
  });
  return { schema: 1, method: 'existing-bank-review-queue-v1', factualAuditComplete: false,
    automaticApproval: false, automaticRetirement: false,
    scope: 'Existing public static bank only; private ranked content is never read.',
    limit: 'Review signals are prompts for source/wording checks, not proof a question is wrong. Unflagged drafts still require review. Readiness-qualified records are internal evidence, not independent acceptance.',
    totals: { rows: readiness.active, practiceOnly: readiness.practiceOnly,
      selectable: readiness.active-readiness.practiceOnly,
      rawSourceCheckTags: categories.reduce((n,c)=>n+c.rawSourceCheckTags,0),
      readinessQualified: readiness.reviewed,
      draftRows: categories.reduce((n,c)=>n+c.draftRows,0),
      selectableDraftRows: categories.reduce((n,c)=>n+c.selectableDraftRows,0),
      reviewTargetDeficit: readiness.remaining }, categories };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  assert.ok(process.argv.slice(2).every(a=>a==='--write'), 'Usage: node scripts/question-review-queue.mjs [--write]');
  const banks = Object.fromEntries(Object.keys(categoryFiles).map(c=>[c,loadQuestionBank(c).questions]));
  const report = buildReviewQueue(banks, questionBankReadiness());
  const text = JSON.stringify(report,null,2)+'\n', path='server/question-audit/review-queue.json';
  if (process.argv.includes('--write')) writeFileSync(path,text);
  else assert.equal(readFileSync(path,'utf8'),text,'Stale review queue: npm run questions:triage -- --write');
  console.log(JSON.stringify({ ...report.totals, factualAuditComplete: false, automaticApproval: false }));
}
