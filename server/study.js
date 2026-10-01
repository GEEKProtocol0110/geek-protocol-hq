import { randomBytes } from 'node:crypto';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { redis, rateLimit } from './redis.js';
import { requireSession, playerIdFor } from './session.js';
import { shuffleOptions } from './questions.js';
import { pickStudyQuestions, studyCatalog, studyQuestionById, studyTopics } from './study-curriculum.js';

const TTL = 60 * 60 * 24;
const keyFor = id => `geek:study:${id}`;
const idPattern = /^[a-f0-9]{40}$/;
const compareAndSet = `-- geek-study-state-v1
if redis.call('GET', KEYS[1]) ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;

const issue = run => {
  const q = studyQuestionById(run.ids[run.index]);
  run.current = { token: randomBytes(16).toString('hex'), options: shuffleOptions(q.options) };
  run.status = 'question';
  run.result = null;
};

const summary = run => {
  const topic = studyTopics.find(t => t.id === run.topic);
  const missed = run.answers.filter(a => !a.correct).map(a => ({ prompt: a.prompt, answer: a.answer, explanation: a.explanation, source: a.source }));
  return {
    answered: run.answers.length,
    correct: run.answers.filter(a => a.correct).length,
    missed,
    recommendation: missed.length
      ? { topic: topic.id, name: topic.name, message: `Let's revisit ${topic.name.toLowerCase()}. Read the explanation for each missed concept, then practice it again.` }
      : { topic: topic.next, name: studyTopics.find(t => t.id === topic.next).name, message: 'You answered every question in this session correctly. Try the next topic, or repeat this one to check your understanding.' }
  };
};

const publicState = run => {
  const topic = studyTopics.find(t => t.id === run.topic);
  const out = { run: { id: run.id, topic: run.topic, status: run.status, number: run.index + 1, total: run.ids.length }, topic: { name: topic.name, lesson: topic.lesson, sources: topic.sources }, ranked: false, rewardsEnabled: false };
  if (run.status === 'question') {
    const q = studyQuestionById(run.ids[run.index]);
    out.question = { token: run.current.token, prompt: q.prompt, options: run.current.options, difficulty: q.difficulty };
  }
  if (run.result) out.result = run.result;
  if (run.status === 'complete') out.summary = summary(run);
  return out;
};

const load = async (id, session) => {
  if (!idPattern.test(String(id || ''))) throw new Error('STUDY_NOT_FOUND');
  const raw = await redis('GET', keyFor(id));
  if (!raw) throw new Error('STUDY_NOT_FOUND');
  const run = JSON.parse(raw);
  if (run.sessionId !== session.id) throw new Error('STUDY_NOT_FOUND');
  return { raw, run };
};

export default async function studyHandler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, ...studyCatalog(), ranked: false, rewardsEnabled: false });
    if (req.method !== 'POST') return methodNotAllowed(res);
    const session = await requireSession(req);
    const body = parseBody(req);
    const action = String(body.action || '');
    await rateLimit('study', playerIdFor(session), 150, 60 * 5);
    if (action === 'start') {
      await rateLimit('study-start-ip', clientFingerprint(req), 40, 60 * 60);
      let ids;
      if (body.practiceRunId) {
        const previous = (await load(body.practiceRunId, session)).run;
        if (previous.status !== 'complete' || previous.topic !== body.topic) throw new Error('INVALID_REQUEST');
        ids = previous.answers.filter(a => !a.correct).map(a => a.questionId);
      } else ids = pickStudyQuestions(body.topic);
      if (!ids.length || ids.length > 5) throw new Error('INVALID_REQUEST');
      const run = { id: randomBytes(20).toString('hex'), sessionId: session.id, topic: body.topic, ids, index: 0, answers: [], status: 'starting', result: null, nextFromToken: null };
      issue(run);
      await redis('SET', keyFor(run.id), JSON.stringify(run), 'EX', TTL);
      return sendJson(res, 201, { ok: true, ...publicState(run) });
    }
    const { raw, run } = await load(body.runId, session);
    if (action === 'resume') return sendJson(res, 200, { ok: true, ...publicState(run) });
    if (action === 'answer') {
      if (typeof body.selectedIndex !== 'number' || !Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 3) throw new Error('INVALID_REQUEST');
      if (run.result?.questionToken === body.questionToken) return sendJson(res, 200, { ok: true, ...publicState(run) });
      if (run.status !== 'question' || run.current.token !== body.questionToken) throw new Error('STUDY_STATE_CHANGED');
      const q = studyQuestionById(run.ids[run.index]);
      const answer = q.options[q.correctIndex];
      const correctIndex = run.current.options.indexOf(answer);
      const correct = correctIndex === body.selectedIndex;
      run.result = { questionToken: body.questionToken, correct, correctIndex, answer, explanation: q.funFact, source: q.source, prompt: q.prompt, selectedAnswer: run.current.options[body.selectedIndex], message: correct ? 'Good reasoning. Read the explanation to connect this answer to the bigger idea.' : 'This is a useful place to learn. Compare your answer with the explanation, then come back to the concept.' };
      run.answers.push({ questionId: q.id, correct, prompt: q.prompt, answer, explanation: q.funFact, source: q.source });
      run.current = null;
      run.status = run.index === run.ids.length - 1 ? 'complete' : 'review';
    } else if (action === 'next') {
      if (run.status === 'question' && run.nextFromToken === body.questionToken) return sendJson(res, 200, { ok: true, ...publicState(run) });
      if (run.status !== 'review' || run.result.questionToken !== body.questionToken) throw new Error('STUDY_STATE_CHANGED');
      run.nextFromToken = body.questionToken;
      run.index += 1;
      issue(run);
    } else throw new Error('INVALID_REQUEST');
    const saved = await redis('EVAL', compareAndSet, 1, keyFor(run.id), raw, JSON.stringify(run), TTL);
    if (Number(saved) !== 1) {
      const latest = (await load(body.runId, session)).run;
      if ((action === 'answer' && latest.result?.questionToken === body.questionToken) || (action === 'next' && latest.status === 'question' && latest.nextFromToken === body.questionToken)) return sendJson(res, 200, { ok: true, ...publicState(latest) });
      throw new Error('STUDY_STATE_CHANGED');
    }
    return sendJson(res, 200, { ok: true, ...publicState(run) });
  } catch (error) {
    if (error.message === 'STUDY_NOT_FOUND') return sendJson(res, 404, { ok: false, error: 'This study session has expired or belongs to another browser session. Choose a topic to start again.' });
    if (error.message === 'STUDY_STATE_CHANGED') return sendJson(res, 409, { ok: false, error: 'Your study session moved forward. Resume it to see the current question.' });
    return handleApiError(res, error);
  }
}
