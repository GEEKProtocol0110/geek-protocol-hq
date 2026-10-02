import test from 'node:test';
import assert from 'node:assert/strict';
import { challengePeriod, periodFromId, buildChallengePack } from '../server/challenge-periods.js';

test('UTC challenge boundaries handle Mondays, month ends, leap years, and year rollover', () => {
  const sunday = challengePeriod('weekly', Date.parse('2026-10-04T23:59:59.999Z'));
  assert.equal(sunday.id, 'weekly:2026-09-28');
  assert.equal(sunday.closesAt, Date.parse('2026-10-05T00:00:00Z'));
  assert.equal(challengePeriod('weekly', sunday.closesAt).id, 'weekly:2026-10-05');
  assert.equal(challengePeriod('weekly', sunday.closesAt, true).id, sunday.id);
  const feb = challengePeriod('monthly', Date.parse('2028-02-29T20:00:00Z'));
  assert.equal(feb.id, 'monthly:2028-02');
  assert.equal(feb.closesAt, Date.parse('2028-03-01T00:00:00Z'));
  assert.equal(challengePeriod('monthly', Date.parse('2027-01-01T00:00:00Z'), true).id, 'monthly:2026-12');
  for (const id of ['weekly:2026-10-02', 'weekly:2026-02-30', 'monthly:2026-13', 'other:2026-10', null]) assert.throws(() => periodFromId(id), /INVALID_REQUEST/);
  assert.deepEqual(periodFromId(sunday.id), sunday);
});

test('period packs are deterministic, cover eight topics, and contain distinct reviewed concepts', () => {
  for (let month = 0; month < 24; month++) for (const kind of ['weekly', 'monthly']) {
    const period = challengePeriod(kind, Date.UTC(2026, month, 12));
    const pack = buildChallengePack(period);
    assert.deepEqual(pack, buildChallengePack(period));
    assert.equal(pack.questions.length, period.questionCount);
    assert.equal(new Set(pack.questions.map(q => q.conceptId)).size, period.questionCount);
    assert.equal(new Set(pack.questions.map(q => q.topic)).size, 8);
    assert.ok(pack.questions.every(q => q.reviewStatus === 'source-checked' && q.id === q.conceptId));
    const counts = Object.fromEntries(['easy', 'medium', 'hard'].map(t => [t, pack.questions.filter(q => q.difficulty === t).length]));
    assert.deepEqual(counts, kind === 'weekly' ? { easy: 4, medium: 4, hard: 2 } : { easy: 8, medium: 8, hard: 4 });
  }
  assert.notDeepEqual(buildChallengePack(challengePeriod('weekly', Date.parse('2026-10-01'))).questions.map(q => q.id), buildChallengePack(challengePeriod('weekly', Date.parse('2026-10-10'))).questions.map(q => q.id));
});
