import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { categoryFiles, loadQuestionBank, questionById, selectRoundQuestionIds } from '../server/questions.js';
import { promptIdentity, similarQuestion } from '../server/question-identity.js';
import { studyBank, studyQuestionById } from '../server/study-curriculum.js';
import { readStudyRecords, studyProgressKey } from '../server/study-progress.js';
import { redisFixture } from './helpers/redis-fixture.js';

let fixture;
try { fixture = await redisFixture(); }
catch (error) { if (process.env.DUEL_REQUIRE_REDIS === '1' || error.code !== 'ENOENT') throw error; }
const run = fixture ? test : (name, fn) => test(name, { skip: 'Redis integration required in CI.' }, fn);
const originalFetch = globalThis.fetch;
if (fixture) {
  process.env.UPSTASH_REDIS_REST_URL = 'https://redis.questions.test';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fixture-token';
  globalThis.fetch = async (url, options) => {
    assert.match(String(url), /^https:\/\/redis\.questions\.test/);
    const args = JSON.parse(options.body);
    const payload = String(url).endsWith('/pipeline')
      ? (await fixture.commands(args)).map(result => ({ result }))
      : { result: await fixture.command(...args) };
    return new Response(JSON.stringify(payload));
  };
}
after(async () => { globalThis.fetch = originalFetch; if (fixture) await fixture.close(); });

test('question identity detects shuffled choices, wrappers, and semantic rewordings', () => {
  const first = { prompt: 'What was the first state to secede from the Union?', options: ['South Carolina', 'Virginia', 'Georgia', 'Texas'], correctIndex: 0 };
  const repeat = { prompt: 'Name the first state to secede from the Union.', options: ['Texas', 'Virginia', 'South Carolina', 'Georgia'], correctIndex: 2 };
  assert.equal(similarQuestion(first, repeat), true);
  assert.equal(promptIdentity('Proof-of-Learning challenge: What is KAS?'), promptIdentity('What is KAS?'));
  const distinct = { prompt: 'Which state hosted the first battle of the Texas Revolution?', options: ['South Carolina', 'Virginia', 'Georgia', 'Texas'], correctIndex: 3 };
  assert.equal(similarQuestion(first, distinct), false);
});

test('public counts match only active questions and contain no answer keys', () => {
  const window = {};
  vm.runInNewContext(readFileSync('public/play/assets/question-catalog.js', 'utf8'), { window });
  const html = readFileSync('public/play/index.html', 'utf8');
  assert.ok(html.indexOf('question-catalog.js') < html.indexOf('assets/game.js'));
  for (const category of Object.keys(categoryFiles)) assert.equal(window.GEEK_QUESTION_COUNTS[category], loadQuestionBank(category).questions.length);
  assert.deepEqual(Object.values(window.GEEK_QUESTION_COUNTS).map(value => typeof value), Array(8).fill('number'));
  assert.ok(!JSON.stringify(window).includes('correctIndex'));
});

test('retired answer keys remain available while Study selects only canonical active concepts', async () => {
  const q = await questionById('kaspa', 'KASPA-0381');
  assert.equal(q.id, 'KASPA-0381');
  assert.equal(q.conceptId, 'KASPA-0003');
  assert.equal(q.options[q.correctIndex], 'None');
  assert.equal(studyQuestionById(q.id).prompt, q.prompt);
  assert.equal(studyBank().some(active => active.id === q.id), false);
  assert.equal(new Set(studyBank().map(item => item.conceptId)).size, studyBank().length);
});

run('every category completes all ten Gauntlet rounds with 100 distinct concepts', async () => {
  for (const category of Object.keys(categoryFiles)) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const used = [], concepts = new Set(), prompts = new Set();
      for (let round = 1; round <= 10; round++) {
        const ids = await selectRoundQuestionIds(category, round, used, category === 'kaspa' ? ['ghostdag', 'builders'][attempt] : '');
        assert.equal(ids.length, 10);
        for (const id of ids) {
          const q = await questionById(category, id);
          assert.ok(!concepts.has(q.conceptId) && !prompts.has(promptIdentity(q.prompt)), `${category}/${round}: ${id}`);
          assert.equal(q.difficulty, round <= 3 ? 'easy' : round <= 7 ? 'medium' : 'hard');
          assert.equal(q.retiredReason, undefined);
          concepts.add(q.conceptId); prompts.add(promptIdentity(q.prompt)); used.push(id);
        }
      }
      assert.equal(concepts.size, 100);
    }
  }
});

run('previously issued variant IDs exclude their canonical facts from later selections', async () => {
  const excluded = ['KASPA-0261', 'KCUR-0005', 'KASPA-0381'];
  const concepts = new Set((await Promise.all(excluded.map(id => questionById('kaspa', id)))).map(q => q.conceptId));
  const ids = await selectRoundQuestionIds('kaspa', 1, excluded);
  for (const id of ids) assert.ok(!concepts.has((await questionById('kaspa', id)).conceptId));
});

run('Study keeps the latest saved observation when retired concepts are consolidated', async () => {
  const session = { id: 'maintenance-player' };
  const key = studyProgressKey(session);
  const old = { attempts: 2, correctAttempts: 1, lastCorrect: false, lastAnsweredAt: 100, streak: 0 };
  const latest = { attempts: 3, correctAttempts: 2, lastCorrect: true, lastAnsweredAt: 200, streak: 1 };
  await fixture.command('HSET', key, 'KASPA-0003', JSON.stringify(old), 'KASPA-0381', JSON.stringify(latest));
  await fixture.command('EXPIRE', key, 120);
  const records = await readStudyRecords(session);
  assert.deepEqual(records['KASPA-0003'], latest);
  assert.equal(records['KASPA-0381'], undefined);
  assert.ok(Number(await fixture.command('TTL', key)) <= 120);
});

run('community rewordings cannot repeat static or community facts in later rounds', async () => {
  const original = loadQuestionBank('kaspa').byId.get('KASPA-0002');
  const id = 'cce_' + 'a'.repeat(24);
  const community = { id, category: 'kaspa', topic: original.topic, difficulty: 'easy', status: 'published',
    prompt: 'Which year did Kaspa mainnet launch?', options: original.options, correctIndex: original.correctIndex,
    explanation: original.funFact, source: original.source };
  await fixture.command('SET', `geek:cce:submission:${id}`, JSON.stringify(community));
  await fixture.command('ZADD', 'geek:cce:published:kaspa', 1, id);
  try {
    const sameRound = await selectRoundQuestionIds('kaspa', 1);
    assert.ok(sameRound.includes(id));
    assert.ok(!sameRound.includes(original.id));
    const afterStatic = await selectRoundQuestionIds('kaspa', 2, [original.id]);
    assert.ok(!afterStatic.includes(id));
    const afterCommunity = await selectRoundQuestionIds('kaspa', 2, [id]);
    assert.ok(!afterCommunity.includes(original.id) && !afterCommunity.includes(id));
  } finally {
    await fixture.command('DEL', `geek:cce:submission:${id}`, 'geek:cce:published:kaspa');
  }
});
