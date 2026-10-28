import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { promptIdentity, promptTerms } from '../server/question-identity.js';

const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const gradingHash = q => digest([q.prompt, q.options, q.correctIndex]);
export const pairIdentity = ids => [...ids].sort().join('|');
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const round = n => Math.round(n * 10000) / 10000;

// These are review candidates, never automatic proof of duplication or bad facts.
// A shared answer alone is insufficient: subject and relation still need reading.
export function auditQuestionBanks(banks, decisions = []) {
  const rows = [], ids = new Set(), categories = [];
  for (const [category, questions] of Object.entries(banks)) {
    assert.ok(Array.isArray(questions), 'Invalid audit bank');
    for (const q of questions) {
      assert.ok(q && typeof q.id === 'string' && !ids.has(q.id) && typeof q.prompt === 'string' &&
        Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string') &&
        Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4 && !q.retiredReason,
      'Audit requires unique, active, structurally valid rows');
      ids.add(q.id); rows.push({ category, q, terms: promptTerms(q.prompt), answer: promptIdentity(q.options[q.correctIndex]) });
    }
    categories.push({ category, active: questions.length, recordedSourceChecks: questions.filter(q => q.reviewStatus === 'source-checked').length,
      needsFactualReview: questions.filter(q => q.reviewStatus !== 'source-checked').length,
      missingExplanation: questions.filter(q => !q.funFact?.trim()).length });
  }
  rows.sort((a, b) => compare(a.q.id, b.q.id));
  const activeById = new Map(rows.map(r => [r.q.id,r.q]));
  for (const d of decisions) {
    assert.ok(Array.isArray(d.ids) && d.ids.length === 2 && d.ids[0] < d.ids[1] && d.gradingHashes?.length === 2, 'Invalid pair decision');
    assert.ok(['retained-distinct', 'needs-scope-review', 'cross-category-review', 'retire-duplicate'].includes(d.disposition), 'Invalid pair decision');
    // A changed prompt can leave the candidate set; it still invalidates its old decision.
    for (const [i,id] of d.ids.entries()) if (activeById.has(id)) assert.equal(gradingHash(activeById.get(id)),d.gradingHashes[i],'Stale pair decision');
  }
  const itemSignals = [];
  for (const { category, q } of rows) {
    const text = [q.prompt, ...q.options].join(' '), reasons = [];
    if (/[ÃÂ]|â[€\u0080-\u00bf]|\uFFFD/u.test(text)) reasons.push('suspected-encoding-damage');
    if (/&(?:#\d+|#x[a-f\d]+|[a-z]+);/i.test(text)) reasons.push('unrendered-entity');
    if (/\b(?:pictured|shown below|shown above|image below|audio clip|sound clip|in the picture|following (?:picture|image|poem|lyrics))\b/i.test(q.prompt)) reasons.push('possible-missing-media-context');
    if (/\b(?:currently|at present|nowadays|last year|this year|today|latest|most recent)\b/i.test(q.prompt)) reasons.push('time-scope-review');
    if (new Set(q.options.map(promptIdentity)).size !== 4) reasons.push('equivalent-option-text');
    if (reasons.length) itemSignals.push({ category, id: q.id, gradingHash: gradingHash(q), reasons });
  }
  const answers = new Map(), prompts = new Map(), pairMap = new Map();
  const addPair = (a, b, reason, shared, jaccard, containment) => {
    const key = pairIdentity([a.q.id, b.q.id]);
    if (!pairMap.has(key)) pairMap.set(key, { ids: [a.q.id, b.q.id].sort(), categories: [a, b].sort((x,y) => compare(x.q.id,y.q.id)).map(r=>r.category),
      gradingHashes: [a, b].sort((x,y) => compare(x.q.id,y.q.id)).map(r=>gradingHash(r.q)),
      scope: a.category === b.category ? 'within-category' : 'cross-category', reasons: [], sharedTerms: shared, jaccard: round(jaccard), containment: round(containment) });
    pairMap.get(key).reasons.push(reason);
  };
  for (const row of rows) {
    const p = promptIdentity(row.q.prompt);
    for (const previous of prompts.get(p) || []) addPair(previous, row,
      previous.answer === row.answer ? 'same-normalized-prompt' : 'same-prompt-different-key', row.terms.size, 1, 1);
    if (!prompts.has(p)) prompts.set(p, []);
    prompts.get(p).push(row);
    for (const previous of answers.get(row.answer) || []) {
      const shared = [...row.terms].filter(t => previous.terms.has(t)).length;
      const jaccard = shared / Math.max(1, row.terms.size + previous.terms.size - shared);
      const containment = shared / Math.max(1, Math.min(row.terms.size, previous.terms.size));
      if (shared >= 3 && (jaccard >= 0.34 || containment >= 0.75)) addPair(previous, row, 'shared-answer-related-wording', shared, jaccard, containment);
    }
    if (!answers.has(row.answer)) answers.set(row.answer, []);
    answers.get(row.answer).push(row);
  }
  const byPair = new Map(decisions.map(d => [pairIdentity(d.ids), d]));
  assert.equal(byPair.size, decisions.length, 'Duplicate pair decisions');
  const pairs = [...pairMap.entries()].sort(([a],[b]) => compare(a,b)).map(([key, p]) => {
    const decision = byPair.get(key);
    if (decision) {
      assert.deepEqual(decision.gradingHashes, p.gradingHashes, 'Stale pair decision');
      assert.ok(['retained-distinct', 'needs-scope-review', 'cross-category-review', 'retire-duplicate'].includes(decision.disposition), 'Invalid pair decision');
    }
    return { ...p, disposition: decision?.disposition || 'unreviewed-candidate' };
  });
  return { schema: 1, method: 'bank-audit-v1', automaticRetirement: false, independentReview: false,
    scope: 'All active static rows in the category registry, including source-checked rows; excludes retired lookup-only and held CCE rows.',
    limit: 'Heuristic screening and internal pair triage are not exhaustive semantic, factual, category, licensing or difficulty review. Unflagged drafts still need item-by-item primary-source review.',
    corpusHash: digest(rows.map(({category,q}) => [category,q])), active: rows.length,
    recordedSourceChecks: categories.reduce((n,c)=>n+c.recordedSourceChecks,0),
    needsFactualReview: categories.reduce((n,c)=>n+c.needsFactualReview,0), categories,
    signals: { items: itemSignals.length, pairs: pairs.length, withinCategoryPairs: pairs.filter(p=>p.scope==='within-category').length,
      crossCategoryPairs: pairs.filter(p=>p.scope==='cross-category').length,
      byReason: Object.fromEntries([...new Set(itemSignals.flatMap(s=>s.reasons))].sort().map(reason=>[reason,itemSignals.filter(s=>s.reasons.includes(reason)).length])) },
    itemSignals, pairs };
}

function main() {
  assert.ok(process.argv.slice(2).every(a=>a==='--write'), 'Usage: node scripts/audit-question-banks.mjs [--write]');
  const banks = Object.fromEntries(Object.keys(categoryFiles).map(c=>[c,loadQuestionBank(c).questions]));
  const ledger = JSON.parse(readFileSync('server/question-audit/decisions-2026-10-27.json','utf8'));
  for (const d of ledger.pairs) for (const [i,id] of d.ids.entries()) {
    const q = loadQuestionBank(d.categories[i]).byId.get(id);
    assert.ok(q && gradingHash(q)===d.gradingHashes[i], 'Changed audit evidence: '+id);
  }
  const report = auditQuestionBanks(banks, ledger.pairs);
  const text = JSON.stringify(report,null,2)+'\n', path='server/question-audit/latest.json';
  if (process.argv.includes('--write')) writeFileSync(path,text);
  else assert.equal(readFileSync(path,'utf8'),text,'Stale question audit: run npm run questions:audit -- --write');
  console.log(JSON.stringify({active:report.active,recordedSourceChecks:report.recordedSourceChecks,needsFactualReview:report.needsFactualReview,signals:report.signals,automaticRetirement:false}));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main();
