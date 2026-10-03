import { randomBytes } from 'node:crypto';
import { handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from './http.js';
import { loadQuestionBank, shuffleOptions } from './questions.js';
import { rateLimit, redis } from './redis.js';
import { playerIdFor, requireSession } from './session.js';

export const practiceRules = Object.freeze({ questionCount: 10, questionMs: 15000, extraTimeMs: 10000, usesPerSession: 1, ranked: false, rewardsEnabled: false, purchasesEnabled: false });
export const practiceCasScript = `-- geek-assisted-practice-v1
local raw = redis.call('GET', KEYS[1])
if (raw or '') ~= ARGV[1] then return 0 end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1`;
const key = id => `geek:assisted:run:${id}`;
const questionFor = state => loadQuestionBank('kaspa').byId.get(state.ids[state.index]);
const issue = (state, now) => { const q = questionFor(state); state.current = { token: randomBytes(16).toString('hex'), options: shuffleOptions(q.options), removed: [], deadline: now + practiceRules.questionMs }; };
const failure = code => { throw Error('PRACTICE_' + code); };
export const decodePractice = raw => {
  try {
    const state = JSON.parse(raw);
    const bank = loadQuestionBank('kaspa').byId;
    if (state.version !== 1 || !/^[a-f0-9]{32}$/.test(state.playerId) || !/^[a-f0-9]{40}$/.test(state.id) || !Array.isArray(state.ids) || state.ids.length !== 10 || new Set(state.ids).size !== 10 || state.ids.some(id => !bank.has(id)) || !Number.isInteger(state.index) || state.index < 0 || state.index > 10 || !Array.isArray(state.history) || state.history.length !== state.index || !state.used || typeof state.used['fifty-fifty'] !== 'boolean' || typeof state.used['extra-time'] !== 'boolean') throw Error();
    if (state.current) {
      const c = state.current, q = questionFor(state);
      if (state.index >= 10 || !/^[a-f0-9]{32}$/.test(c.token) || (!Number.isSafeInteger(c.deadline) || c.deadline < 0) || !Array.isArray(c.options) || c.options.length !== 4 || new Set(c.options).size !== 4 || c.options.some(option => !q.options.includes(option)) || !Array.isArray(c.removed) || ![0,2].includes(c.removed.length) || new Set(c.removed).size !== c.removed.length || c.removed.some(i => !Number.isInteger(i) || i < 0 || i > 3 || c.options[i] === q.options[q.correctIndex])) throw Error();
    } else if (state.current !== null || state.index === 0) throw Error();
    if (state.history.some((h,i) => !h || !/^[a-f0-9]{32}$/.test(h.token) || !Number.isInteger(h.selectedIndex) || h.selectedIndex < -1 || h.selectedIndex > 3 || !Number.isInteger(h.correctIndex) || h.correctIndex < 0 || h.correctIndex > 3 || h.correct !== (h.selectedIndex === h.correctIndex) || h.prompt !== bank.get(state.ids[i]).prompt || h.answer !== bank.get(state.ids[i]).options[bank.get(state.ids[i]).correctIndex]) || new Set(state.history.map(h=>h.token)).size !== state.history.length || (state.current?.removed.length && !state.used['fifty-fifty'])) throw Error();
    return state;
  } catch { failure('STATE_INVALID'); }
};
export const practiceView = (state, now = Date.now()) => ({
  id: state.id, rules: practiceRules, finished: state.index === 10, answered: state.index,
  correct: state.history.filter(item => item.correct).length, used: state.used,
  feedback: state.history.at(-1) || null,
  question: state.current ? { token: state.current.token, number: state.index + 1, prompt: questionFor(state).prompt, options: state.current.options, removed: state.current.removed, expiresAt: state.current.deadline, serverNow: now, durationMs: Math.max(0, state.current.deadline - now) } : null,
  history: state.index === 10 ? state.history : []
});
export const transitionPractice = (state, body, now = Date.now()) => {
  state = decodePractice(JSON.stringify(state));
  if (body.action === 'answer' && state.history.some(item => item.token === body.questionToken)) return state;
  if (body.action === 'next') {
    if (!state.history.length || body.questionToken !== state.history.at(-1).token || state.index === 10) failure('QUESTION_CHANGED');
    if (!state.current) issue(state, now);
    return state;
  }
  if (!state.current || body.questionToken !== state.current.token) failure('QUESTION_CHANGED');
  if (body.action === 'lifeline') {
    if (!['fifty-fifty','extra-time'].includes(body.item)) failure('INVALID_REQUEST');
    if (state.used[body.item]) return state;
    if (now >= state.current.deadline) failure('TIME_CLOSED');
    if (body.item === 'extra-time') state.current.deadline += practiceRules.extraTimeMs;
    else { const q = questionFor(state); state.current.removed = shuffleOptions([0,1,2,3].filter(i => state.current.options[i] !== q.options[q.correctIndex])).slice(0,2).sort(); }
    state.used[body.item] = true;
  } else if (body.action === 'answer') {
    if (!Number.isInteger(body.selectedIndex) || body.selectedIndex < -1 || body.selectedIndex > 3 || state.current.removed.includes(body.selectedIndex)) failure('INVALID_REQUEST');
    const q = questionFor(state), correctIndex = state.current.options.indexOf(q.options[q.correctIndex]);
    const selectedIndex = now > state.current.deadline + 350 ? -1 : body.selectedIndex;
    state.history.push({ token: state.current.token, prompt: q.prompt, selectedIndex, correctIndex, correct: selectedIndex === correctIndex, answer: q.options[q.correctIndex], explanation: q.funFact, source: q.source });
    state.index++; state.current = null;
  } else failure('INVALID_REQUEST');
  return state;
};
export default async function assistedPracticeHandler(req, res) {
  setApiHeaders(res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (!['GET','POST'].includes(req.method)) return methodNotAllowed(res, 'GET, POST, OPTIONS');
  try {
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, rules: practiceRules });
    const session = await requireSession(req), playerId = playerIdFor(session);
    await rateLimit('assisted-practice', playerId, 120, 600);
    const body = parseBody(req);
    if (body.action === 'start') {
      const ids = shuffleOptions(loadQuestionBank('kaspa').questions.filter(q => q.difficulty === 'easy').map(q => q.id)).slice(0,10);
      const state = { version: 1, id: randomBytes(20).toString('hex'), playerId, ids, index: 0, used: { 'fifty-fifty': false, 'extra-time': false }, history: [], current: null };
      issue(state, Date.now());
      const result = await redis('SET', key(state.id), JSON.stringify(state), 'EX', 7200, 'NX');
      if (result !== 'OK') failure('BUSY');
      return sendJson(res, 200, { ok: true, practice: practiceView(state) });
    }
    if (!['view','lifeline','answer','next'].includes(body.action) || !/^[a-f0-9]{40}$/.test(String(body.runId || ''))) failure('INVALID_REQUEST');
    for (let attempt = 0; attempt < 8; attempt++) {
      const raw = await redis('GET', key(body.runId));
      if (!raw) failure('NOT_FOUND');
      const state = decodePractice(raw);
      if (state.playerId !== playerId) failure('NOT_FOUND');
      if (body.action === 'view') return sendJson(res, 200, { ok: true, practice: practiceView(state) });
      const next = transitionPractice(state, body);
      if (JSON.stringify(next) === raw || await redis('EVAL', practiceCasScript, 1, key(body.runId), raw, JSON.stringify(next), 7200) === 1) return sendJson(res, 200, { ok: true, practice: practiceView(next) });
    }
    failure('BUSY');
  } catch (error) {
    const errors = { PRACTICE_NOT_FOUND: [404,'That practice session expired or is unavailable. Start a new one.'], PRACTICE_STATE_INVALID: [503,'This practice session could not be verified.'], PRACTICE_QUESTION_CHANGED: [409,'The question changed. Reload the current question.'], PRACTICE_TIME_CLOSED: [409,'Time is up. A lifeline cannot extend an expired question.'], PRACTICE_INVALID_REQUEST: [400,'Choose an available answer or lifeline.'], PRACTICE_BUSY: [409,'Practice is busy. Please retry.'] };
    if (errors[error.message]) { const [status,message] = errors[error.message]; return sendJson(res,status,{ok:false,code:error.message,error:message}); }
    return handleApiError(res,error);
  }
}
