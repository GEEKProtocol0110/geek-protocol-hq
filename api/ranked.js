import { randomBytes } from 'node:crypto';
import { recordCommunityQuestionUse } from '../server/cce.js';
import { categories, clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { recordVerifiedScore } from '../server/leaderboard.js';
import { loadProfile, saveProfile } from '../server/profile.js';
import { questionById, selectRoundQuestionIds, shuffleOptions } from '../server/questions.js';
import { rateLimit, redis } from '../server/redis.js';
import { requireSession } from '../server/session.js';

const RUN_TTL = 60 * 60 * 2;
const QUESTION_MS = 15_000;
const NETWORK_GRACE_MS = 350;
const runKey = (id) => `geek:run:${id}`;
const runIdPattern = /^[a-f0-9]{40}$/;
const ROUND_CONFIG = [
  { round: 1, entry: 0, reward: 10, max: 100, label: 'INITIATION' },
  { round: 2, entry: 40, reward: 20, max: 200, label: 'BASIC PROTOCOLS' },
  { round: 3, entry: 100, reward: 40, max: 400, label: 'NETWORK LAYER' },
  { round: 4, entry: 200, reward: 80, max: 800, label: 'DATA STREAMS' },
  { round: 5, entry: 400, reward: 150, max: 1500, label: 'GRID ACCESS' },
  { round: 6, entry: 750, reward: 280, max: 2800, label: 'DEEP PROTOCOL' },
  { round: 7, entry: 1250, reward: 450, max: 4500, label: 'CIPHER DESCENT' },
  { round: 8, entry: 2000, reward: 700, max: 7000, label: 'CORE BREACH' },
  { round: 9, entry: 3500, reward: 1100, max: 11000, label: 'OMNISCIENT GATE' },
  { round: 10, entry: 6000, reward: 1800, max: 18000, label: 'APEX PROTOCOL' }
];
const MODE_CONFIG = {
  gauntlet: { questionCount: 10, questionMs: QUESTION_MS, maxRounds: 10, rewards: true, label: '' },
  daily: { questionCount: 5, questionMs: QUESTION_MS, maxRounds: 1, rewards: false, label: 'DAILY SIGNAL' },
  speed: { questionCount: 10, questionMs: QUESTION_MS, maxRounds: 1, rewards: false, label: 'SPEED SIGNAL', overallMs: 30_000 }
};
const modeConfig = (mode) => Object.hasOwn(MODE_CONFIG, mode) ? MODE_CONFIG[mode] : MODE_CONFIG.gauntlet;

const safeRun = (run) => ({
  id: run.id,
  mode: run.mode,
  category: run.category,
  round: run.round,
  questionIndex: run.questionIndex,
  correct: run.correct,
  streak: run.streak,
  roundScore: run.roundScore,
  totalScore: run.totalScore,
  maxStreak: run.maxStreak,
  startBalance: run.startBalance,
  fees: run.fees,
  rewards: run.rewards,
  questionCount: run.questionCount,
  maxRounds: run.maxRounds,
  status: run.status
});

const loadRun = async (id, session) => {
  if (!runIdPattern.test(String(id || ''))) throw new Error('RUN_NOT_FOUND');
  const raw = await redis('GET', runKey(id));
  if (!raw) throw new Error('RUN_NOT_FOUND');
  const run = JSON.parse(raw);
  if (run.sessionId !== session.id) throw new Error('RUN_NOT_FOUND');
  return run;
};

const saveRun = async (run, ttl = RUN_TTL) => {
  await redis('SET', runKey(run.id), JSON.stringify(run), 'EX', ttl);
  return run;
};

const publicQuestion = (run, question) => ({
  token: run.current.token,
  number: run.questionIndex + 1,
  prompt: question.prompt,
  options: run.current.options,
  topic: question.topic,
  difficulty: question.difficulty,
  sourceState: question.community ? 'COMMUNITY-REVIEWED' : question.priority ? 'SOURCE-REVIEWED' : question.volatile ? 'TIME-SENSITIVE' : run.category === 'kaspa' ? 'SOURCE-LINKED' : 'DRAFT BANK',
  durationMs: Math.max(0, run.current.deadline - Date.now()),
  expiresAt: run.current.deadline,
  serverNow: Date.now()
});

const issueQuestion = async (run) => {
  const question = await questionById(run.category, run.roundQuestionIds[run.questionIndex]);
  const config = modeConfig(run.mode);
  const questionDeadline = Date.now() + config.questionMs;
  run.current = {
    token: randomBytes(16).toString('hex'),
    questionId: question.id,
    options: shuffleOptions(question.options),
    deadline: config.overallMs ? Math.min(questionDeadline, run.overallDeadline) : questionDeadline
  };
  run.status = 'question';
  run.lastResponse = null;
  return publicQuestion(run, question);
};

const startRound = async (run, profile) => {
  const mode = modeConfig(run.mode);
  const config = ROUND_CONFIG[run.round - 1];
  const entry = mode.rewards ? config?.entry : 0;
  if (!config || profile.balance < entry) throw new Error('INSUFFICIENT_BALANCE');
  profile.balance -= entry;
  run.fees += entry;
  run.questionIndex = 0;
  run.correct = 0;
  run.roundScore = 0;
  run.roundAnswers = [];
  run.roundQuestionIds = (await selectRoundQuestionIds(run.category, run.round, run.usedQuestionIds, run.focus)).slice(0, mode.questionCount);
  run.usedQuestionIds.push(...run.roundQuestionIds);
  if (mode.overallMs) run.overallDeadline = Date.now() + mode.overallMs;
  return issueQuestion(run);
};

const finishRun = async (run, session, profile) => {
  if (run.status === 'finished') return { leaderboard: await recordVerifiedScore({ session, category: run.category, score: run.totalScore, round: Math.max(1, run.completedRound || 0), mode: run.mode }) };
  profile.totalRuns += 1;
  await saveProfile(session.id, profile);
  const leaderboard = await recordVerifiedScore({ session, category: run.category, score: run.totalScore, round: Math.max(1, run.completedRound || 0), mode: run.mode });
  run.status = 'finished';
  run.current = null;
  await saveRun(run, 300);
  return { leaderboard };
};

const answerQuestion = async (run, session, profile, body) => {
  if (run.lastResponse?.questionToken === body.questionToken && ['awaiting-next', 'between-rounds'].includes(run.status)) return run.lastResponse;
  if (run.status !== 'question' || run.current?.token !== body.questionToken) throw new Error('RUN_STATE_INVALID');
  const claimKey = `geek:answer-claim:${run.id}:${body.questionToken}`;
  const claimed = await redis('SET', claimKey, session.id, 'EX', 10, 'NX');
  if (claimed !== 'OK') {
    const latest = await loadRun(run.id, session);
    if (latest.lastResponse?.questionToken === body.questionToken) return latest.lastResponse;
    throw new Error('ANSWER_IN_PROGRESS');
  }
  const question = await questionById(run.category, run.current.questionId);
  const now = Date.now();
  const timedOut = now > run.current.deadline + NETWORK_GRACE_MS;
  const selectedIndex = timedOut ? -1 : Number(body.selectedIndex);
  if (!Number.isInteger(selectedIndex) || selectedIndex < -1 || selectedIndex > 3) throw new Error('INVALID_REQUEST');
  const answer = question.options[question.correctIndex];
  const correctIndex = run.current.options.indexOf(answer);
  const isCorrect = selectedIndex === correctIndex;
  let scoreAdded = 0;
  if (isCorrect) {
    run.streak += 1;
    run.maxStreak = Math.max(run.maxStreak, run.streak);
    const remaining = Math.max(0, Math.min(QUESTION_MS, run.current.deadline - now));
    scoreAdded = 1000 + Math.round((remaining / 1000) * 30) + Math.min(run.streak, 5) * 100;
    run.correct += 1;
    run.roundScore += scoreAdded;
  } else {
    run.streak = 0;
  }
  const result = {
    correct: isCorrect,
    correctIndex,
    answer,
    timedOut,
    scoreAdded,
    streak: run.streak,
    funFact: question.funFact,
    source: question.source,
    sourceState: question.community ? 'Community-reviewed contribution' : question.priority ? 'Reviewed current item' : question.volatile ? 'Time-sensitive item' : run.category === 'kaspa' ? 'Source-linked practice item' : 'Draft practice item',
    contributorCredit: await recordCommunityQuestionUse(question, run.id)
  };
  run.current = null;
  let roundResult = null;
  const mode = modeConfig(run.mode);
  const modeClockExpired = Boolean(mode.overallMs && now >= run.overallDeadline);
  if (run.questionIndex === run.questionCount - 1 || modeClockExpired) {
    const config = ROUND_CONFIG[run.round - 1];
    const reward = mode.rewards ? run.correct * config.reward : 0;
    const xpEarned = run.correct * 10 + Math.round(run.roundScore / 1000);
    run.totalScore += run.roundScore;
    run.rewards += reward;
    profile.balance += reward;
    profile.xp += xpEarned;
    profile.totalCorrect += run.correct;
    if (run.mode === 'gauntlet') {
      profile.bestRound = Math.max(profile.bestRound, run.round);
      profile.bestScore = Math.max(profile.bestScore, run.totalScore);
    } else if (run.mode === 'daily') {
      profile.bestDailyScore = Math.max(profile.bestDailyScore, run.totalScore);
    } else if (run.mode === 'speed') {
      profile.bestSpeedScore = Math.max(profile.bestSpeedScore, run.totalScore);
    }
    run.completedRound = run.round;
    run.status = 'between-rounds';
    roundResult = {
      label: mode.label || config.label,
      correct: run.correct,
      answered: run.questionIndex + 1,
      questionCount: run.questionCount,
      roundScore: run.roundScore,
      xpEarned,
      reward,
      canContinue: run.mode === 'gauntlet' && (run.round === 10 || profile.balance >= ROUND_CONFIG[run.round].entry),
      modeComplete: run.mode !== 'gauntlet',
      nextEntry: run.mode !== 'gauntlet' || run.round === 10 ? 0 : ROUND_CONFIG[run.round].entry,
      nextMax: run.mode !== 'gauntlet' || run.round === 10 ? 0 : ROUND_CONFIG[run.round].max
    };
    await saveProfile(session.id, profile);
  } else {
    run.status = 'awaiting-next';
  }
  const response = {
    questionToken: body.questionToken,
    result,
    roundResult,
    run: safeRun(run),
    profile
  };
  run.lastResponse = response;
  await saveRun(run);
  return response;
};

export default async function handler(req, res) {
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    if (req.method === 'GET') return sendJson(res, 200, { ok: true, profile: await loadProfile(session.id), verified: true });
    if (req.method !== 'POST') return methodNotAllowed(res);
    const body = parseBody(req);
    const action = String(body.action || '');
    await rateLimit('ranked', session.id, 240, 60 * 5);
    if (action === 'start') {
      await rateLimit('ranked-start-ip', clientFingerprint(req), 20, 60 * 60);
      const category = categories.has(body.category) ? body.category : 'kaspa';
      const mode = Object.hasOwn(MODE_CONFIG, body.mode) ? body.mode : 'gauntlet';
      const focus = ['ghostdag', 'builders'].includes(body.focus) ? body.focus : '';
      const profile = await loadProfile(session.id);
      const run = {
        id: randomBytes(20).toString('hex'), sessionId: session.id, category, focus, mode, round: 1,
        questionIndex: 0, correct: 0, roundScore: 0, totalScore: 0, streak: 0, maxStreak: 0,
        completedRound: 0, startBalance: profile.balance, fees: 0, rewards: 0, usedQuestionIds: [], status: 'starting',
        questionCount: modeConfig(mode).questionCount, maxRounds: modeConfig(mode).maxRounds, overallDeadline: 0
      };
      if (mode === 'daily') {
        const day = new Date().toISOString().slice(0, 10);
        const claimed = await redis('SET', `geek:daily:${session.id}:${day}`, run.id, 'EX', 60 * 60 * 48, 'NX');
        if (claimed !== 'OK') throw new Error('DAILY_ALREADY_PLAYED');
      }
      const question = await startRound(run, profile);
      await Promise.all([saveRun(run), saveProfile(session.id, profile)]);
      return sendJson(res, 201, { ok: true, verified: true, run: safeRun(run), profile, question });
    }
    const run = await loadRun(body.runId, session);
    const profile = await loadProfile(session.id);
    if (action === 'answer') {
      const answer = await answerQuestion(run, session, profile, body);
      return sendJson(res, 200, { ok: true, verified: true, ...answer });
    }
    if (action === 'next') {
      if (run.status !== 'awaiting-next') throw new Error('RUN_STATE_INVALID');
      run.questionIndex += 1;
      const question = await issueQuestion(run);
      await saveRun(run);
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile, question });
    }
    if (action === 'continue') {
      if (run.mode !== 'gauntlet' || run.status !== 'between-rounds' || run.round >= run.maxRounds) throw new Error('RUN_STATE_INVALID');
      run.round += 1;
      const question = await startRound(run, profile);
      await Promise.all([saveRun(run), saveProfile(session.id, profile)]);
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile, question });
    }
    if (action === 'finish') {
      if (!['between-rounds', 'question', 'awaiting-next', 'finished'].includes(run.status)) throw new Error('RUN_STATE_INVALID');
      const finished = await finishRun(run, session, profile);
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile, ...finished });
    }
    throw new Error('INVALID_REQUEST');
  } catch (error) {
    return handleApiError(res, error);
  }
}
