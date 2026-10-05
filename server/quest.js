import { createHash, randomBytes } from 'node:crypto';
import { firstSignal, questChapters, getChapter, checksFor } from '../public/quest/assets/chapter.js';
import { shuffleOptions } from './questions.js';
import { clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { redis, rateLimit } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

const chapterFor = id => { const chapter = getChapter(id); if (!chapter) throw new Error('INVALID_REQUEST'); return chapter; };
export const questKey = (playerId, chapterId = firstSignal.id) => `geek:quest:${playerId}:${chapterFor(chapterId).id}`;
const tokenPattern = /^[a-f0-9]{32}$/;
const token = () => randomBytes(16).toString('hex');
const validTime = n => Number.isSafeInteger(n) && n > 0;
const emptyState = chapter => ({ version: 1, ...(chapter.id !== firstSignal.id ? { chapterId: chapter.id } : {}), contentVersion: chapter.version, revision: 0, createdAt: 0, updatedAt: 0, run: null, badge: null, lastCompleted: null, lastMutation: '' });

const checkAnswers = (answers, questChecks) => {
  if (!Array.isArray(answers) || answers.length > questChecks.length) throw new Error('QUEST_STATE_INVALID');
  answers.forEach((a, index) => {
    const q = questChecks[index];
    if (!a || typeof a !== 'object' || a.checkpointId !== q.id || !Number.isInteger(a.selectedChoice) || a.selectedChoice < 0 || a.selectedChoice > 3
      || a.correct !== (a.selectedChoice === q.correctIndex) || !validTime(a.answeredAt)) throw new Error('QUEST_STATE_INVALID');
  });
};
export const decodeQuest = (raw, chapter = firstSignal) => {
  const questChecks = checksFor(chapter);
  if (!raw) return emptyState(chapter);
  let s;
  try { s = JSON.parse(raw); } catch { throw new Error('QUEST_STATE_INVALID'); }
  if (!s || s.version !== 1 || s.contentVersion !== chapter.version || (Object.hasOwn(s, 'chapterId') ? s.chapterId : firstSignal.id) !== chapter.id || !Number.isSafeInteger(s.revision) || s.revision < 1
    || !validTime(s.createdAt) || !validTime(s.updatedAt) || !/^[a-f0-9]{64}$/.test(s.lastMutation)) throw new Error('QUEST_STATE_INVALID');
  const r = s.run;
  if (!r || !tokenPattern.test(r.id) || !tokenPattern.test(r.token) || !validTime(r.startedAt) || !['lesson', 'question', 'feedback', 'complete'].includes(r.status)
    || !Number.isInteger(r.index) || r.index < 0 || r.index >= questChecks.length || !Array.isArray(r.orders) || r.orders.length !== questChecks.length) throw new Error('QUEST_STATE_INVALID');
  r.orders.forEach(order => { if (!Array.isArray(order) || order.length !== 4 || !order.every(Number.isInteger) || [...order].sort().join(',') !== '0,1,2,3') throw new Error('QUEST_STATE_INVALID'); });
  // Redis cjson represents an empty array as {}. Only normalize that exact
  // artifact; cursor validation below still requires zero accepted answers.
  if (r.answers && typeof r.answers === 'object' && !Array.isArray(r.answers) && Object.keys(r.answers).length === 0) r.answers = [];
  checkAnswers(r.answers, questChecks);
  const expectedAnswers = r.index + (['feedback', 'complete'].includes(r.status) ? 1 : 0);
  if (r.answers.length !== expectedAnswers || (r.status === 'lesson' && r.index % 2 !== 0) || (r.status === 'complete' && r.index !== questChecks.length - 1)) throw new Error('QUEST_STATE_INVALID');
  if (s.badge !== null && (!s.badge || s.badge.id !== chapter.badge.id || !validTime(s.badge.awardedAt) || !tokenPattern.test(s.badge.attemptId))) throw new Error('QUEST_STATE_INVALID');
  if (s.lastCompleted !== null) {
    const done = s.lastCompleted;
    if (!done || !tokenPattern.test(done.attemptId) || !validTime(done.completedAt)) throw new Error('QUEST_STATE_INVALID');
    checkAnswers(done.answers, questChecks);
    if (done.answers.length !== questChecks.length || !s.badge || s.badge.awardedAt > done.completedAt) throw new Error('QUEST_STATE_INVALID');
  }
  if (Boolean(s.badge) !== Boolean(s.lastCompleted) || (r.status === 'complete' && s.lastCompleted?.attemptId !== r.id)) throw new Error('QUEST_STATE_INVALID');
  return s;
};

// The cursor, answer, completed summary and one-time cosmetic badge share a CAS.
// Redis TIME stamps accepted activity. No ranked/profile/inventory key is touched.
export const QUEST_LUA = `
-- geek-quest-state-v1
local raw = redis.call('GET', KEYS[1]) or ''
if raw ~= ARGV[1] then return {0, raw} end
local next = cjson.decode(ARGV[2])
local time = redis.call('TIME')
local now = tonumber(time[1]) * 1000 + math.floor(tonumber(time[2]) / 1000)
if raw ~= '' then
  local previous = cjson.decode(raw)
  if previous.badge ~= cjson.null then next.badge = previous.badge end
end
if next.createdAt == 0 then next.createdAt = now end
next.updatedAt = now
if next.run.startedAt == 0 then next.run.startedAt = now end
if next.run.status == 'feedback' then
  local answer = next.run.answers[#next.run.answers]
  if answer.answeredAt == 0 then answer.answeredAt = now end
end
if next.run.status == 'complete' then
  if #next.run.answers ~= tonumber(ARGV[3]) then return {-1, raw} end
  next.lastCompleted.completedAt = now
  if next.badge == cjson.null then next.badge = {id=ARGV[4], awardedAt=now, attemptId=next.run.id} end
end
local encoded = cjson.encode(next)
redis.call('SET', KEYS[1], encoded)
return {1, encoded}
`;

const runFor = questChecks => ({ id: token(), token: token(), startedAt: 0, status: 'lesson', index: 0, orders: questChecks.map(() => shuffleOptions([0, 1, 2, 3])), answers: [] });
const answerView = (a, index, questChecks) => {
  const q = questChecks[index];
  return { checkpointId: q.id, prompt: q.prompt, correct: a.correct, selectedAnswer: q.choices[a.selectedChoice], answer: q.choices[q.correctIndex], explanation: q.explanation, source: q.source, answeredAt: a.answeredAt };
};
export const questView = (state, chapter = firstSignal) => {
  const questChecks = checksFor(chapter), viewAnswer = (answer, index) => answerView(answer, index, questChecks);
  const r = state.run;
  const out = { chapter: { id: chapter.id, title: chapter.title, version: chapter.version, objective: chapter.objective, sceneCount: chapter.scenes.length, checkCount: questChecks.length },
    revision: state.revision, updatedAt: state.updatedAt, attempt: r ? { id: r.id, token: r.token, status: r.status, index: r.index, sceneIndex: questChecks[r.index].sceneIndex, answered: r.answers.length, correct: r.answers.filter(a => a.correct).length } : null,
    badge: state.badge ? { ...chapter.badge, ...state.badge, transferable: false } : null,
    lastCompleted: state.lastCompleted ? { completedAt: state.lastCompleted.completedAt, correct: state.lastCompleted.answers.filter(a => a.correct).length, total: questChecks.length, missed: state.lastCompleted.answers.map(viewAnswer).filter(a => !a.correct) } : null,
    review: (r?.answers.length ? r.answers : state.lastCompleted?.answers || []).map(viewAnswer).filter(a => !a.correct),
    xpEnabled: false, creditsEnabled: false, tokensEnabled: false, ranked: false };
  if (r?.status === 'question') out.question = { id: questChecks[r.index].id, prompt: questChecks[r.index].prompt, options: r.orders[r.index].map(i => questChecks[r.index].choices[i]) };
  if (r?.status === 'feedback') out.feedback = viewAnswer(r.answers[r.index], r.index);
  return out;
};

const validateBody = (body, chapterId = firstSignal.id) => {
  const action = body.action;
  const allowed = action === 'begin' ? ['action', 'revision'] : action === 'answer' ? ['action', 'revision', 'attemptId', 'stepToken', 'selectedIndex'] : ['action', 'revision', 'attemptId', 'stepToken'];
  if (Object.hasOwn(body, 'chapterId')) {
    if (body.chapterId !== chapterId) throw new Error('INVALID_REQUEST');
    allowed.push('chapterId');
  } else if (chapterId !== firstSignal.id) throw new Error('INVALID_REQUEST');
  if (!['begin', 'continue', 'answer', 'replay'].includes(action) || Object.keys(body).length !== allowed.length || Object.keys(body).some(key => !allowed.includes(key))
    || !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision >= Number.MAX_SAFE_INTEGER) throw new Error('INVALID_REQUEST');
  if (action !== 'begin' && (!tokenPattern.test(body.attemptId) || !tokenPattern.test(body.stepToken))) throw new Error('INVALID_REQUEST');
  if (action === 'answer' && (!Number.isInteger(body.selectedIndex) || body.selectedIndex < 0 || body.selectedIndex > 3)) throw new Error('INVALID_REQUEST');
};
const fingerprint = body => createHash('sha256').update(JSON.stringify([body.action, body.revision, body.attemptId || '', body.stepToken || '', body.selectedIndex ?? null])).digest('hex');

export const mutateQuest = async (session, body, chapterId = firstSignal.id) => {
  const chapter = chapterFor(chapterId), questChecks = checksFor(chapter);
  validateBody(body, chapterId);
  const key = questKey(playerIdFor(session), chapterId), raw = await redis('GET', key) || '', state = decodeQuest(raw, chapter), mutation = fingerprint(body);
  if (state.lastMutation === mutation) return state;
  if (body.revision !== state.revision) throw new Error('QUEST_STATE_CHANGED');
  if (body.action === 'begin') {
    if (state.run) throw new Error('QUEST_STATE_CHANGED');
    state.run = runFor(questChecks);
  } else {
    const r = state.run;
    if (!r || r.id !== body.attemptId || r.token !== body.stepToken) throw new Error('QUEST_STATE_CHANGED');
    if (body.action === 'replay') {
      if (r.status !== 'complete') throw new Error('QUEST_STATE_CHANGED');
      state.run = runFor(questChecks);
    } else if (body.action === 'answer') {
      if (r.status !== 'question') throw new Error('QUEST_STATE_CHANGED');
      const q = questChecks[r.index], selectedChoice = r.orders[r.index][body.selectedIndex];
      r.answers.push({ checkpointId: q.id, selectedChoice, correct: selectedChoice === q.correctIndex, answeredAt: 0 });
      r.status = 'feedback'; r.token = token();
    } else {
      if (r.status === 'lesson') r.status = 'question';
      else if (r.status === 'feedback') {
        if (r.index === questChecks.length - 1) {
          r.status = 'complete';
          state.lastCompleted = { attemptId: r.id, completedAt: 0, answers: structuredClone(r.answers) };
        } else { r.index++; r.status = r.index % 2 === 0 ? 'lesson' : 'question'; }
      } else throw new Error('QUEST_STATE_CHANGED');
      r.token = token();
    }
  }
  state.revision++; state.lastMutation = mutation;
  const result = await redis('EVAL', QUEST_LUA, 1, key, raw, JSON.stringify(state), questChecks.length, chapter.badge.id);
  if (Number(result[0]) === 1) return decodeQuest(result[1], chapter);
  if (Number(result[0]) === 0) {
    const latest = decodeQuest(result[1], chapter);
    if (latest.lastMutation === mutation) return latest;
    throw new Error('QUEST_STATE_CHANGED');
  }
  throw new Error('QUEST_STATE_INVALID');
};

export const campaignChapter = (state, chapter) => ({
  chapterId: chapter.id, available: true, revision: state.revision,
  status: state.run?.status || 'unstarted', answered: state.run?.answers.length || 0,
  total: checksFor(chapter).length, badge: state.badge ? { id: chapter.badge.id, name: chapter.badge.name, awardedAt: state.badge.awardedAt } : null
});

export default async function questHandler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET', 'POST'].includes(req.method)) return methodNotAllowed(res);
  try {
    const session = await requireSession(req);
    await rateLimit('quest', playerIdFor(session), 120, 300);
    const campaign = req.query?.campaign;
    if (campaign !== undefined && (campaign !== '1' || req.method !== 'GET' || req.query?.chapter !== undefined)) throw new Error('INVALID_REQUEST');
    if (campaign === '1') {
      // Isolate unreadable records: one damaged chapter cannot hide the other.
      const chapters = await Promise.all(questChapters.map(async chapter => {
        try {
          const state = decodeQuest(await redis('GET', questKey(playerIdFor(session), chapter.id)), chapter);
          return campaignChapter(state, chapter);
        } catch { return { chapterId: chapter.id, available: false }; }
      }));
      return sendJson(res, 200, { ok: true, campaign: { chapters } });
    }
    const chapterId = req.query?.chapter === undefined ? firstSignal.id : req.query.chapter, chapter = chapterFor(chapterId);
    let state;
    if (req.method === 'GET') state = decodeQuest(await redis('GET', questKey(playerIdFor(session), chapterId)), chapter);
    else {
      const body = parseBody(req); validateBody(body, chapterId);
      if (['begin', 'replay'].includes(body.action)) await rateLimit('quest-start-ip', clientFingerprint(req), 40, 3600);
      state = await mutateQuest(session, body, chapterId);
    }
    return sendJson(res, 200, { ok: true, quest: questView(state, chapter) });
  } catch (error) {
    if (error.message === 'QUEST_STATE_CHANGED') return sendJson(res, 409, { ok: false, code: error.message, error: 'Your chapter moved forward in another request. Resume to see the saved step.' });
    if (error.message === 'QUEST_STATE_INVALID') return sendJson(res, 503, { ok: false, code: error.message, error: 'Your chapter record could not be verified. No progress or badge was changed.' });
    return handleApiError(res, error);
  }
}
