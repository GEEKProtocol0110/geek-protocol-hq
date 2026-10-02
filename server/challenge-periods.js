import { createHash } from 'node:crypto';
import { studyBank, studyTopics } from './study-curriculum.js';

export const CHALLENGE_RETENTION_SECONDS = 60 * 60 * 24 * 60;
export const CHALLENGE_CAP = 5000;
const DAY = 86400000;
export const challengeConfigs = {
  weekly: { title: 'Weekly Signal', questionCount: 10, budgetMs: 5 * 60 * 1000, quotas: { easy: 4, medium: 4, hard: 2 } },
  monthly: { title: 'Monthly Circuit', questionCount: 20, budgetMs: 10 * 60 * 1000, quotas: { easy: 8, medium: 8, hard: 4 } }
};

export const challengePeriod = (kind, now = Date.now(), previous = false) => {
  if (!Object.hasOwn(challengeConfigs, kind)) throw new Error('INVALID_REQUEST');
  const day = new Date(now);
  let opensAt, closesAt, label;
  if (kind === 'weekly') {
    opensAt = Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate()) - ((day.getUTCDay() + 6) % 7 + (previous ? 7 : 0)) * DAY;
    closesAt = opensAt + 7 * DAY;
    label = new Date(opensAt).toISOString().slice(0, 10);
  } else {
    opensAt = Date.UTC(day.getUTCFullYear(), day.getUTCMonth() - (previous ? 1 : 0), 1);
    const start = new Date(opensAt);
    closesAt = Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1);
    label = start.toISOString().slice(0, 7);
  }
  return { id: `${kind}:${label}`, kind, title: challengeConfigs[kind].title, opensAt, closesAt, questionCount: challengeConfigs[kind].questionCount, questionMs: 15000, budgetMs: challengeConfigs[kind].budgetMs, capacity: CHALLENGE_CAP };
};

export const periodFromId = id => {
  if (typeof id !== 'string' || !/^(weekly:\d{4}-\d{2}-\d{2}|monthly:\d{4}-\d{2})$/.test(id)) throw new Error('INVALID_REQUEST');
  const [kind, label] = id.split(':');
  const date = Date.parse(`${label}${kind === 'monthly' ? '-01' : ''}T00:00:00Z`);
  if (!Number.isFinite(date)) throw new Error('INVALID_REQUEST');
  const period = challengePeriod(kind, date);
  if (period.id !== id) throw new Error('INVALID_REQUEST');
  return period;
};

// Source-checked canonical concepts only. A stored period snapshot wins across releases.
export const buildChallengePack = period => {
  const seed = `geek-challenge-v1:${period.id}`;
  const hash = q => createHash('sha256').update(`${seed}:${q.conceptId}`).digest('hex');
  const pool = studyBank().sort((a, b) => hash(a).localeCompare(hash(b)) || a.id.localeCompare(b.id));
  const quotas = challengeConfigs[period.kind].quotas;
  const counts = { easy: 0, medium: 0, hard: 0 };
  const selected = [];
  const add = q => { selected.push(q); counts[q.difficulty]++; };
  for (const topic of studyTopics) {
    const q = pool.find(q => q.topic === topic.category && counts[q.difficulty] < quotas[q.difficulty]);
    if (!q) throw new Error('CHALLENGE_CONTENT_UNAVAILABLE');
    add(q);
  }
  for (const q of pool) if (!selected.some(s => s.conceptId === q.conceptId) && counts[q.difficulty] < quotas[q.difficulty]) add(q);
  if (selected.length !== period.questionCount) throw new Error('CHALLENGE_CONTENT_UNAVAILABLE');
  const order = { easy: 0, medium: 1, hard: 2 };
  selected.sort((a, b) => order[a.difficulty] - order[b.difficulty] || hash(a).localeCompare(hash(b)));
  return { version: 1, period, questions: selected };
};

export const challengeTtl = (period, now = Date.now()) => Math.max(1, Math.ceil((period.closesAt - now) / 1000) + CHALLENGE_RETENTION_SECONDS);
