import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { categoryFiles, loadQuestionBank } from '../server/questions.js';
import { promptIdentity, promptTerms, similarQuestion } from '../server/question-identity.js';

export const checkQuestionBanks = () => {
  const report = JSON.parse(readFileSync('docs/question-maintenance.json', 'utf8'));
  const review = JSON.parse(readFileSync('docs/editorial-review.json', 'utf8'));
  const editorialIds = new Set(review.retirements.map(q => q.id));
  assert.equal(editorialIds.size, review.retirementCount);
  const ids = new Set(), concepts = new Set(), prompts = new Set();
  const termIndex = new Map(), questions = [];
  let active = 0, retired = 0, postReviewAdditions = 0;
  for (const [category, files] of Object.entries(categoryFiles)) {
    const bank = loadQuestionBank(category);
    const summary = report.categories[category];
    assert.equal(bank.questions.length, summary.after, category);
    // The expansion milestone is historical. Editorial removals must not be
    // padded with unreviewed replacements just to preserve a marketing count.
    const followUp = summary.postReviewAdditions || 0;
    assert.ok(Number.isSafeInteger(followUp) && followUp >= 0, `${category}: follow-up count`);
    postReviewAdditions += followUp;
    assert.equal(summary.after, summary.cleaned + summary.added + followUp - (summary.editorialRemoved || 0), `${category}: reviewed pool accounting`);
    assert.equal(summary.added, summary.cleaned, category);
    const tiers = { easy: 0, medium: 0, hard: 0 };
    for (const q of bank.questions) {
      const prompt = promptIdentity(q.prompt);
      assert.ok(!ids.has(q.id) && !concepts.has(q.conceptId) && !prompts.has(prompt), `Duplicate identity: ${q.id}`);
      ids.add(q.id); concepts.add(q.conceptId); prompts.add(prompt);
      assert.equal(q.id, q.conceptId, `${q.id}: active rows must be canonical`);
      assert.ok(q.prompt.trim().length >= 12 && q.prompt.length <= 280, q.id);
      assert.equal(q.options.length, 4, q.id);
      assert.equal(new Set(q.options.map(promptIdentity)).size, 4, q.id);
      assert.ok(q.options.every(o => typeof o === 'string' && o.trim() && o.length <= 180), q.id);
      assert.ok(Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4, q.id);
      assert.ok(Object.hasOwn(tiers, q.difficulty), q.id); tiers[q.difficulty]++;
      assert.equal(new URL(q.source).protocol, 'https:', q.id);
      assert.ok(['source-checked', 'draft-needs-human-review'].includes(q.reviewStatus), q.id);
      assert.ok(!q.derivedVariant && !q.retiredReason, q.id);
      assert.ok(!editorialIds.has(q.id), `${q.id}: editorial hold entered active pool`);
      assert.ok(!/Proof-of-Learning challenge:|knowledge check:/i.test(q.prompt), q.id);
      assert.ok(!/sound clip|audio clip|following poem|following lyrics|in the picture|\uFFFD/i.test(q.prompt), q.id);
      assert.ok(!q.options.some(o => /^(?:true|false)$/i.test(o.trim()) || /\b(?:all|none|both|neither) (?:of )?(?:these|the above)\b/i.test(o)), q.id);
      if (q.reviewStatus === 'source-checked') {
        assert.ok(q.funFact.trim() && /^\d{4}-\d{2}-\d{2}$/.test(q.reviewedAt), q.id);
      }
      const candidates = new Set();
      const terms = promptTerms(q.prompt);
      for (const term of terms) for (const index of termIndex.get(term) || []) candidates.add(index);
      for (const index of candidates) assert.ok(!similarQuestion(q, questions[index]), `Similar questions: ${q.id}, ${questions[index].id}`);
      for (const term of terms) {
        if (!termIndex.has(term)) termIndex.set(term, []);
        termIndex.get(term).push(questions.length);
      }
      questions.push(q);
    }
    // A complete Gauntlet consumes 30 easy, 40 medium and 30 hard questions.
    for (const [tier, minimum] of Object.entries({ easy: 30, medium: 40, hard: 30 })) assert.ok(tiers[tier] >= minimum, `${category}/${tier} capacity`);
    assert.deepEqual(tiers, summary.difficultyDistribution);
    for (const file of files) {
      const data = JSON.parse(readFileSync(`server/questions/${file}`, 'utf8'));
      assert.equal(data.metadata.questionCount, data.questions.length, file);
      assert.equal(data.metadata.conceptCount, data.questions.length, file);
    }
    const legacy = JSON.parse(readFileSync(`server/questions/${category}-retired.json`, 'utf8'));
    assert.equal(legacy.questions.length, summary.removed, category);
    assert.equal(legacy.metadata.questionCount, legacy.questions.length, category);
    for (const q of legacy.questions) {
      assert.ok(!bank.questions.some(active => active.id === q.id), `Retired row selected: ${q.id}`);
      assert.deepEqual(bank.byId.get(q.id).options, q.options, q.id);
      assert.equal(bank.byId.get(q.id).correctIndex, q.correctIndex, q.id);
    }
    for (const decision of review.retirements.filter(q => q.category === category)) {
      const q = legacy.questions.find(q => q.id === decision.id);
      assert.ok(q, `${decision.id}: missing retired compatibility record`);
      assert.equal(q.retiredReason, `editorial-${decision.reason}`, decision.id);
      assert.equal(q.editorialReviewNote, decision.note, decision.id);
      const hash = createHash('sha256').update(JSON.stringify([q.prompt, q.options, q.correctIndex])).digest('hex');
      assert.equal(hash, decision.answerKeyHash, `${decision.id}: previously issued answer changed`);
    }
    active += bank.questions.length; retired += legacy.questions.length;
  }
  assert.equal(active, report.activeQuestions);
  assert.equal(postReviewAdditions, report.postReviewAdditions || 0);
  assert.equal(active, report.cleanedBaseline + report.addedQuestions + postReviewAdditions - report.editorialRetiredRows);
  assert.equal(retired, report.retiredRows);
  assert.equal(report.originalRows - (retired - report.editorialRetiredRows), report.cleanedBaseline);
  assert.equal(report.editorialRetiredRows, review.retirementCount);
  return { categories: Object.keys(categoryFiles).length, active, retired };
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(checkQuestionBanks()));
