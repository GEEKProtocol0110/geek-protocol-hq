import { redis } from './redis.js';
import { playerIdFor } from './session.js';
import { studyBank, studyTopics } from './study-curriculum.js';

export const STUDY_PROGRESS_TTL = 60 * 60 * 24 * 180;
export const studyProgressKey = session => `geek:study-progress:${playerIdFor(session)}`;

export const readStudyRecords = async session => {
  const raw = await redis('HGETALL', studyProgressKey(session));
  const entries = Array.isArray(raw) ? Array.from({ length: raw.length / 2 }, (_, i) => [raw[i * 2], raw[i * 2 + 1]]) : Object.entries(raw || {});
  const allowed = new Set(studyBank().map(q => q.conceptId));
  const records = {};
  for (const [id, value] of entries) {
    if (!allowed.has(id)) continue;
    try { const r = JSON.parse(value); if (Number.isInteger(r.attempts) && r.attempts > 0 && typeof r.lastCorrect === 'boolean') records[id] = r; } catch { /* Ignore malformed historical records. */ }
  }
  return records;
};

export const studyProgress = records => {
  const concepts = studyBank().filter(q => records[q.conceptId]).map(q => {
    const r = records[q.conceptId];
    return { id: q.conceptId, topic: studyTopics.find(t => t.category === q.topic).id, prompt: q.prompt, attempts: r.attempts, correctAttempts: r.correctAttempts, lastAnsweredAt: r.lastAnsweredAt, stage: !r.lastCorrect ? 'review' : r.streak >= 2 ? 'confidence' : 'practicing' };
  });
  const topics = studyTopics.map(t => {
    const own = concepts.filter(c => c.topic === t.id);
    return { id: t.id, total: studyBank().filter(q => q.topic === t.category).length, explored: own.length, review: own.filter(c => c.stage === 'review').length, confidence: own.filter(c => c.stage === 'confidence').length };
  });
  const next = topics.find(t => t.review) || topics.find(t => t.explored < t.total) || topics.find(t => t.confidence < t.total) || topics[0];
  return { total: studyBank().length, explored: concepts.length, review: concepts.filter(c => c.stage === 'review').length, confidence: concepts.filter(c => c.stage === 'confidence').length, topics, concepts, next: { topic: next.id, name: studyTopics.find(t => t.id === next.id).name, review: next.review > 0 }, retentionDays: 180, note: 'Practice feedback, not a qualification or proof of mastery. Confidence means correct answers in at least two separate practice runs since the last mistake.' };
};
