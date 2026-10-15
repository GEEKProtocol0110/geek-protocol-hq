import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { categoryFiles } from './question-categories.js';
import { promptIdentity } from './question-identity.js';

export const reviewedTarget = 1000;
export const categoryNames = Object.freeze({ kaspa: 'Kaspa', 'video-games': 'Video games', 'science-fiction': 'Science fiction', technology: 'Technology', movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop culture' });
const dateValid = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const https = value => { try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };

// Counts review records; it cannot prove factual correctness or replace source review.
export function evaluateBankReadiness(banks, today = new Date().toISOString().slice(0, 10)) {
  const ids = new Set(), concepts = new Set(), prompts = new Set();
  const categories = Object.keys(categoryFiles).map(id => {
    if (!Array.isArray(banks[id])) throw new Error('QUESTION_READINESS_UNAVAILABLE');
    const tiers = { easy: 0, medium: 0, hard: 0 };
    let reviewed = 0;
    for (const q of banks[id]) {
      if (!q || typeof q !== 'object' || typeof q.id !== 'string' || typeof q.prompt !== 'string') throw new Error('QUESTION_READINESS_UNAVAILABLE');
      const concept = q.conceptId || q.id, prompt = promptIdentity(q.prompt);
      const unique = !ids.has(q.id) && !concepts.has(concept) && !prompts.has(prompt);
      ids.add(q.id); concepts.add(concept); prompts.add(prompt);
      if (!unique) throw new Error('QUESTION_READINESS_UNAVAILABLE');
      const eligible = q.reviewStatus === 'source-checked' && dateValid(q.reviewedAt) && q.reviewedAt <= today &&
        q.id === concept && !q.retiredReason && !q.derivedVariant && https(q.source) &&
        typeof q.funFact === 'string' && q.funFact.trim().length >= 8 && q.prompt.trim().length >= 12 &&
        Array.isArray(q.options) && q.options.length === 4 && q.options.every(o => typeof o === 'string' && o.trim()) &&
        new Set(q.options.map(promptIdentity)).size === 4 && Number.isInteger(q.correctIndex) && q.correctIndex >= 0 && q.correctIndex < 4 && Object.hasOwn(tiers, q.difficulty);
      if (eligible) { reviewed++; tiers[q.difficulty]++; }
    }
    const remaining = Math.max(0, reviewedTarget - reviewed);
    const tierCapacity = tiers.easy >= 30 && tiers.medium >= 40 && tiers.hard >= 30;
    return { id, name: categoryNames[id], active: banks[id].length, reviewed, needsReview: banks[id].length - reviewed, target: reviewedTarget, remaining, additionalQuestionsNeeded: Math.max(0, reviewedTarget - banks[id].length), tiers, ready: remaining === 0 && tierCapacity };
  });
  return { schema: 1, targetPerCategory: reviewedTarget, requiredCategories: categories.length, bankReady: categories.every(c => c.ready), active: categories.reduce((n, c) => n + c.active, 0), reviewed: categories.reduce((n, c) => n + c.reviewed, 0), remaining: categories.reduce((n, c) => n + c.remaining, 0), categories };
}

let cached, cachedDate;
export function questionBankReadiness() {
  const today = new Date().toISOString().slice(0, 10);
  if (cached && cachedDate === today) return structuredClone(cached);
  const banks = Object.fromEntries(Object.entries(categoryFiles).map(([id, files]) => [id, files.flatMap(file => {
    const data = JSON.parse(readFileSync(join(process.cwd(), 'server/questions', file), 'utf8'));
    if (!Array.isArray(data.questions)) throw new Error('QUESTION_READINESS_UNAVAILABLE');
    return data.questions;
  })]));
  cached = evaluateBankReadiness(banks, today); cachedDate = today;
  return structuredClone(cached);
}

export function cceReadiness() {
  const bank = questionBankReadiness();
  // Founder decision: bank first; the creator reward/economy specification is unresolved.
  // A future reviewed release must approve that specification; no environment override.
  return { stage: 'bank-and-economy-hold', submissionsEnabled: false, publishingEnabled: false, newCreditsEnabled: false, economyApproved: false, rewardAmount: null, bank };
}
export function requireCceIntake() {
  if (!cceReadiness().submissionsEnabled) throw new Error('CCE_BANK_AND_ECONOMY_HOLD');
}
export function requireCcePublication() {
  if (!cceReadiness().publishingEnabled) throw new Error('CCE_BANK_AND_ECONOMY_HOLD');
}
