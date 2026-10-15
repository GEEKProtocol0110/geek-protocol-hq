import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { correction, questionRevision } from '../server/imported-review.js';

export function stageQuestionReviews(proposals, documents, report, editorial) {
  if (!Array.isArray(proposals) || !proposals.length || proposals.length > 100) throw new Error('Invalid proposal batch');
  const files = structuredClone(documents), counts = structuredClone(report), review = structuredClone(editorial), seen = new Set();
  for (const p of proposals) {
    if (!p || p.schema !== 1 || !Object.hasOwn(categoryFiles, p.category) || !['reviewed', 'correct', 'retire'].includes(p.decision) || p.sourceChecked !== true ||
        !/^[a-f0-9]{24}$/.test(p.version) || !/^[a-f0-9]{64}$/.test(p.questionRevision) || !/^\d{4}-\d{2}-\d{2}T/.test(p.checkedAt) || !Number.isFinite(Date.parse(p.checkedAt)) || Date.parse(p.checkedAt) > Date.now() + 300000 || seen.has(p.id)) throw new Error('Invalid proposal');
    seen.add(p.id);
    const q = loadQuestionBank(p.category).questions.find(q => q.id === p.id);
    if (!q || questionRevision(q) !== p.questionRevision) throw new Error('Source revision changed: ' + p.id);
    const filename = categoryFiles[p.category].find(f => files[f].questions.some(q => q.id === p.id)), date = p.checkedAt.slice(0, 10);
    const original = files[filename].questions.find(q => q.id === p.id);
    if (p.decision === 'reviewed') {
      correction({ prompt: q.prompt, options: q.options, correctIndex: q.correctIndex, difficulty: q.difficulty, source: q.source, funFact: q.funFact });
      original.reviewStatus = 'source-checked'; original.reviewedAt = date;
    } else {
      files[filename].questions = files[filename].questions.filter(q => q.id !== p.id);
      const reason = p.decision === 'correct' ? 'source-correction' : 'owner-review';
      const note = p.decision === 'correct' ? 'Replaced by an internally source-checked correction; original answer retained for saved runs.' : 'Retired following internal editorial review; original answer retained for saved runs.';
      files[`${p.category}-retired.json`].questions.push({ ...original, retiredReason: `editorial-${reason}`, retiredAt: date, editorialReviewNote: note });
      review.retirements.push({ category: p.category, id: p.id, reason, note, answerKeyHash: createHash('sha256').update(JSON.stringify([q.prompt, q.options, q.correctIndex])).digest('hex') });
      counts.categories[p.category].editorialRemoved = (counts.categories[p.category].editorialRemoved || 0) + 1;
      if (p.decision === 'correct') {
        const edit = correction(p.correction), id = `${p.id.slice(0, 45)}-R${createHash('sha256').update(JSON.stringify(edit)).digest('hex').slice(0, 10)}`;
        if (Object.values(files).some(f => f.questions.some(q => q.id === id))) throw new Error('Correction already exists');
        files[filename].questions.push({ ...original, ...edit, id, conceptId: id, reviewStatus: 'source-checked', reviewedAt: date });
        counts.categories[p.category].postReviewAdditions = (counts.categories[p.category].postReviewAdditions || 0) + 1;
      }
    }
  }
  for (const [category, filenames] of Object.entries(categoryFiles)) {
    const active = filenames.flatMap(f => files[f].questions), retired = files[`${category}-retired.json`].questions;
    for (const filename of [...filenames, `${category}-retired.json`]) {
      files[filename].metadata.questionCount = files[filename].questions.length;
      files[filename].metadata.conceptCount = files[filename].questions.length;
    }
    Object.assign(counts.categories[category], { after: active.length, removed: retired.length,
      difficultyDistribution: Object.fromEntries(['easy', 'medium', 'hard'].map(t => [t, active.filter(q => q.difficulty === t).length])) });
  }
  counts.activeQuestions = Object.values(counts.categories).reduce((n, c) => n + c.after, 0);
  counts.retiredRows = Object.values(counts.categories).reduce((n, c) => n + c.removed, 0);
  counts.postReviewAdditions = Object.values(counts.categories).reduce((n, c) => n + (c.postReviewAdditions || 0), 0);
  review.retirementCount = review.retirements.length; counts.editorialRetiredRows = review.retirementCount;
  return { files, report: counts, editorial: review };
}

async function main() {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) throw new Error('Usage: node scripts/stage-question-reviews.mjs PRIVATE_EXPORT.json NEW_PRIVATE_STAGING_DIRECTORY');
  const destination = resolve(output), publicPath = resolve('public');
  if (!relative(publicPath, destination).startsWith('..') || destination === resolve('.')) throw new Error('Stage outside the public directory and repository root');
  if ((await stat(input)).size > 1000000) throw new Error('Oversized export');
  const payload = JSON.parse(await readFile(input, 'utf8'));
  if (payload.schema !== 1) throw new Error('Unsupported export');
  const documents = {};
  for (const [category, filenames] of Object.entries(categoryFiles)) for (const filename of [...filenames, `${category}-retired.json`]) documents[filename] = JSON.parse(await readFile(`server/questions/${filename}`, 'utf8'));
  const result = stageQuestionReviews(payload.proposals, documents, JSON.parse(await readFile('docs/question-maintenance.json', 'utf8')), JSON.parse(await readFile('docs/editorial-review.json', 'utf8')));
  await mkdir(destination); // A new directory prevents overwriting an existing review.
  const outputs = { ...Object.fromEntries(Object.entries(result.files).map(([name, data]) => [`server/questions/${name}`, data])), 'docs/question-maintenance.json': result.report, 'docs/editorial-review.json': result.editorial };
  for (const [name, value] of Object.entries(outputs)) { const path = resolve(destination, name); await mkdir(dirname(path), { recursive: true }); await writeFile(path, JSON.stringify(value, null, 2) + '\n'); }
  console.log('Private staged bank files created. Review the diff, update the count catalog, run npm run verify, and publish through a source PR. No running service was changed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) main().catch(error => { console.error(error.message); process.exitCode = 1; });
