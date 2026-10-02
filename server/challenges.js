import { createHash, randomBytes } from 'node:crypto';
import { clientFingerprint, cleanName, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { redis, pipeline } from './redis.js';
import { playerIdFor, requireSession } from './session.js';
import { rateLimit } from './redis.js';
import { shuffleOptions } from './questions.js';
import { challengeConfigs, challengePeriod, periodFromId, buildChallengePack, challengeTtl, CHALLENGE_CAP } from './challenge-periods.js';

const keys = (period, playerId = '') => ({ pack: `geek:challenge:pack:${period.id}`, attempt: `geek:challenge:attempt:${period.id}:${playerId}`, starts: `geek:challenge:starts:${period.id}`, board: `geek:challenge:board:${period.id}`, meta: `geek:challenge:meta:${period.id}` });
const startScript = `-- geek-challenge-start-v1
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
if tonumber(ARGV[4]) >= tonumber(ARGV[5]) then return -2 end
if tonumber(redis.call('GET', KEYS[2]) or '0') >= tonumber(ARGV[3]) then return -1 end
redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])
redis.call('INCR', KEYS[2])
redis.call('EXPIRE', KEYS[2], ARGV[2])
return 1`;
const transitionScript = `-- geek-challenge-transition-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
if tonumber(ARGV[4]) >= tonumber(ARGV[5]) then return -1 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
if ARGV[6] == '1' then
  redis.call('ZADD', KEYS[2], ARGV[7], ARGV[8])
  redis.call('HSET', KEYS[3], ARGV[8], ARGV[9])
  redis.call('EXPIRE', KEYS[2], ARGV[3])
  redis.call('EXPIRE', KEYS[3], ARGV[3])
end
return 1`;

const packHash = pack => createHash('sha256').update(JSON.stringify(pack.questions)).digest('hex');
const loadPack = async (period, create = false) => {
  const key = keys(period).pack;
  let raw = await redis('GET', key);
  if (!raw) {
    if (!create) throw new Error('CHALLENGE_CONTENT_UNAVAILABLE');
    await redis('SET', key, JSON.stringify(buildChallengePack(period)), 'EX', challengeTtl(period), 'NX');
    raw = await redis('GET', key);
  }
  const pack = JSON.parse(raw);
  if (pack.version !== 1 || pack.period.id !== period.id || pack.questions.length !== period.questionCount) throw new Error('CHALLENGE_CONTENT_UNAVAILABLE');
  return pack;
};

const attemptPack = async run => {
  const pack = await loadPack(run.period);
  if (packHash(pack) !== run.packHash) throw new Error('CHALLENGE_CONTENT_UNAVAILABLE');
  return pack;
};

export const listChallengeBoard = async period => {
  const key = keys(period);
  const raw = await redis('ZREVRANGE', key.board, 0, 9, 'WITHSCORES');
  const members = Array.isArray(raw) ? raw.filter((_, i) => i % 2 === 0) : [];
  const scores = Array.isArray(raw) ? raw.filter((_, i) => i % 2 === 1).map(Number) : [];
  const metadata = members.length ? await pipeline(members.map(id => ['HGET', key.meta, id])) : [];
  const ranks = scores.length ? await pipeline(scores.map(score => ['ZCOUNT', key.board, score + 1, '+inf'])) : [];
  return { completed: Number(await redis('ZCARD', key.board)), entries: members.map((_, i) => {
    const m = JSON.parse(metadata[i] || '{}');
    return { rank: Number(ranks[i]) + 1, name: cleanName(m.name), score: scores[i], correct: Number(m.correct || 0), answered: Number(m.answered || 0), submittedAt: Number(m.submittedAt || 0) };
  }) };
};

const loadAttempt = async (period, session, runId) => {
  const raw = await redis('GET', keys(period, playerIdFor(session)).attempt);
  if (!raw) throw new Error('CHALLENGE_NOT_FOUND');
  const run = JSON.parse(raw);
  if (runId && run.id !== runId) throw new Error('CHALLENGE_NOT_FOUND');
  return { raw, run };
};

const issue = (run, pack) => {
  const q = pack.questions[run.index];
  run.current = { token: randomBytes(16).toString('hex'), options: shuffleOptions(q.options), deadline: Math.min(Date.now() + run.period.questionMs, run.overallDeadline) };
  run.status = 'question'; run.result = null;
};

const finish = (run, reason) => { run.status = 'complete'; run.current = null; run.submittedAt = Date.now(); run.finishReason = reason; };

const publicState = async run => {
  const now = Date.now();
  const status = run.status !== 'complete' && now >= run.period.closesAt ? 'closed' : run.status;
  const out = { run: { id: run.id, periodId: run.period.id, status, number: run.index + 1, total: run.period.questionCount, correct: run.correct, answered: run.answers.length, score: run.score, overallDeadline: run.overallDeadline, startedAt: run.startedAt, submittedAt: run.submittedAt || 0 }, period: run.period, serverNow: now, rewardsEnabled: false, xpEnabled: false };
  if (status === 'question') out.question = { token: run.current.token, prompt: run.prompt, options: run.current.options, difficulty: run.difficulty, expiresAt: run.current.deadline };
  if (run.result) out.result = run.result;
  if (['complete', 'closed'].includes(status)) {
    const score = run.score;
    const k = keys(run.period);
    out.summary = { correct: run.correct, answered: run.answers.length, total: run.period.questionCount, score, reason: status === 'closed' ? 'period-closed' : run.finishReason, ranked: status === 'complete', rank: status === 'complete' ? Number(await redis('ZCOUNT', k.board, score + 1, '+inf')) + 1 : null, review: run.answers };
  }
  return out;
};

const setQuestionDisplay = (run, pack) => { run.prompt = pack.questions[run.index].prompt; run.difficulty = pack.questions[run.index].difficulty; };

const saveTransition = async (period, session, raw, run) => {
  const k = keys(period, playerIdFor(session));
  const meta = { name: run.playerName, correct: run.correct, answered: run.answers.length, submittedAt: run.submittedAt || 0 };
  const result = Number(await redis('EVAL', transitionScript, 3, k.attempt, k.board, k.meta, raw, JSON.stringify(run), challengeTtl(period), Date.now(), period.closesAt, run.status === 'complete' ? '1' : '0', run.score, playerIdFor(session), JSON.stringify(meta)));
  if (result === -1) throw new Error('CHALLENGE_CLOSED');
  return result === 1;
};

export default async function challengesHandler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') {
      await rateLimit('challenge-public', clientFingerprint(req), 90, 60);
      const previous = req.query?.previous === '1';
      const periods = ['weekly', 'monthly'].map(kind => challengePeriod(kind, Date.now(), previous));
      return sendJson(res, 200, { ok: true, serverNow: Date.now(), previous, periods: await Promise.all(periods.map(async period => ({ ...period, ...await listChallengeBoard(period) }))), rewardsEnabled: false, xpEnabled: false });
    }
    if (req.method !== 'POST') return methodNotAllowed(res);
    const session = await requireSession(req);
    await rateLimit('challenges', playerIdFor(session), 240, 300);
    const body = parseBody(req);
    if (body.action === 'status') {
      const periods = ['weekly', 'monthly'].flatMap(kind => [challengePeriod(kind), challengePeriod(kind, Date.now(), true)]);
      const attempts = [];
      for (const period of periods) {
        try { const { run } = await loadAttempt(period, session); const state = await publicState(run); attempts.push({ ...state.run, canResume: state.run.status !== 'closed' && state.run.status !== 'complete' }); }
        catch (error) { if (error.message !== 'CHALLENGE_NOT_FOUND') throw error; }
      }
      return sendJson(res, 200, { ok: true, attempts });
    }
    if (body.action === 'start') {
      if (!Object.hasOwn(challengeConfigs, body.kind)) throw new Error('INVALID_REQUEST');
      await rateLimit('challenge-start-ip', clientFingerprint(req), 12, 3600);
      const period = challengePeriod(body.kind);
      if (body.periodId !== period.id) throw new Error('CHALLENGE_PERIOD_CHANGED');
      const pack = await loadPack(period, true);
      if (Date.now() >= period.closesAt) throw new Error('CHALLENGE_PERIOD_CHANGED');
      const run = { id: randomBytes(20).toString('hex'), period, packHash: packHash(pack), playerName: cleanName(session.name), startedAt: Date.now(), overallDeadline: Math.min(Date.now() + period.budgetMs, period.closesAt), index: 0, answers: [], correct: 0, score: 0, result: null, nextFromToken: null };
      issue(run, pack); setQuestionDisplay(run, pack);
      const k = keys(period, playerIdFor(session));
      const started = Number(await redis('EVAL', startScript, 2, k.attempt, k.starts, JSON.stringify(run), challengeTtl(period), CHALLENGE_CAP, Date.now(), period.closesAt));
      if (started === -2) throw new Error('CHALLENGE_PERIOD_CHANGED');
      if (started === -1) throw new Error('CHALLENGE_FULL');
      const state = await publicState(started ? run : (await loadAttempt(period, session)).run);
      return sendJson(res, started ? 201 : 200, { ok: true, ...state });
    }
    const period = periodFromId(body.periodId);
    if (!/^[a-f0-9]{40}$/.test(String(body.runId || ''))) throw new Error('CHALLENGE_NOT_FOUND');
    const { raw, run } = await loadAttempt(period, session, body.runId);
    if (run.status === 'complete' && (body.action === 'finish' || (body.action === 'answer' && Number.isInteger(body.selectedIndex) && body.selectedIndex >= -1 && body.selectedIndex <= 3 && run.result?.questionToken === body.questionToken))) return sendJson(res, 200, { ok: true, ...await publicState(run) });
    if (body.action === 'resume' && (run.status === 'complete' || Date.now() < run.overallDeadline || Date.now() >= period.closesAt)) return sendJson(res, 200, { ok: true, ...await publicState(run) });
    if (Date.now() >= period.closesAt) throw new Error('CHALLENGE_CLOSED');
    if (body.action === 'answer') {
      if (!Number.isInteger(body.selectedIndex) || body.selectedIndex < -1 || body.selectedIndex > 3) throw new Error('INVALID_REQUEST');
      if (run.result?.questionToken === body.questionToken) return sendJson(res, 200, { ok: true, ...await publicState(run) });
      if (run.status !== 'question' || run.current.token !== body.questionToken) throw new Error('CHALLENGE_STATE_CHANGED');
      const pack = await attemptPack(run);
      const q = pack.questions[run.index];
      const answer = q.options[q.correctIndex];
      const correctIndex = run.current.options.indexOf(answer);
      const timedOut = Date.now() >= run.current.deadline;
      const correct = !timedOut && body.selectedIndex === correctIndex;
      if (correct) { run.correct++; run.score += 100; }
      run.result = { questionToken: body.questionToken, prompt: q.prompt, correct, timedOut, correctIndex, answer, selectedAnswer: body.selectedIndex < 0 ? 'No answer' : run.current.options[body.selectedIndex], explanation: q.funFact, source: q.source, scoreAdded: correct ? 100 : 0 };
      run.answers.push({ prompt: q.prompt, correct, timedOut, answer, explanation: q.funFact, source: q.source });
      run.current = null; run.status = 'review';
      if (run.index + 1 === period.questionCount || Date.now() >= run.overallDeadline) finish(run, run.index + 1 === period.questionCount ? 'all-answered' : 'time-limit');
    } else if (body.action === 'next') {
      if (run.status === 'question' && run.nextFromToken === body.questionToken) return sendJson(res, 200, { ok: true, ...await publicState(run) });
      if (run.status !== 'review' || run.result.questionToken !== body.questionToken) throw new Error('CHALLENGE_STATE_CHANGED');
      if (Date.now() >= run.overallDeadline) finish(run, 'time-limit');
      else { run.nextFromToken = body.questionToken; run.index++; const pack = await attemptPack(run); issue(run, pack); setQuestionDisplay(run, pack); }
    } else if (body.action === 'finish' || body.action === 'resume') {
      if (run.status === 'complete') return sendJson(res, 200, { ok: true, ...await publicState(run) });
      finish(run, Date.now() >= run.overallDeadline ? 'time-limit' : 'finished-early');
    } else throw new Error('INVALID_REQUEST');
    if (!await saveTransition(period, session, raw, run)) {
      const latest = (await loadAttempt(period, session, body.runId)).run;
      if ((body.action === 'answer' && latest.result?.questionToken === body.questionToken) || (body.action === 'next' && latest.nextFromToken === body.questionToken) || (['finish', 'resume'].includes(body.action) && latest.status === 'complete')) return sendJson(res, 200, { ok: true, ...await publicState(latest) });
      throw new Error('CHALLENGE_STATE_CHANGED');
    }
    return sendJson(res, 200, { ok: true, ...await publicState(run) });
  } catch (error) {
    const messages = {
      CHALLENGE_NOT_FOUND: [404, 'That attempt could not be found for your player.'],
      CHALLENGE_STATE_CHANGED: [409, 'Your attempt moved forward. Resume to see its current state.'],
      CHALLENGE_CLOSED: [409, 'This period has closed. Unsubmitted attempts do not enter its standings.'],
      CHALLENGE_PERIOD_CHANGED: [409, 'A new period has opened. Refresh the challenge cards before starting.'],
      CHALLENGE_FULL: [409, 'This period has reached its 5,000-player Alpha capacity.'],
      CHALLENGE_CONTENT_UNAVAILABLE: [503, 'This challenge’s question set is unavailable. Please try again later.']
    };
    if (messages[error.message]) { const [status, message] = messages[error.message]; return sendJson(res, status, { ok: false, code: error.message, error: message }); }
    return handleApiError(res, error);
  }
}
