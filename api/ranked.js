import { ROUND_CONFIG, RANKED_START_IP_LIMIT } from '../server/game-economy.js';
import { randomBytes } from 'node:crypto';
import { recordCommunityQuestionUse } from '../server/cce.js';
import { categories, clientFingerprint, handleApiError, methodNotAllowed, parseBody, sendJson, setApiHeaders } from '../server/http.js';
import { recordVerifiedScore } from '../server/leaderboard.js';
import { loadProfile } from '../server/profile.js';
import { commitRankedState } from '../server/ranked-state.js';
import { recordRoundJourney, withProgression } from '../server/progression.js';
import { questionById, selectRoundQuestionIds, shuffleOptions } from '../server/questions.js';
import { rateLimit, redis } from '../server/redis.js';
import { playerIdFor, requireSession } from '../server/session.js';
import questHandler from '../server/quest.js';
import studyHandler from '../server/study.js';
import challengesHandler from '../server/challenges.js';
import assistedPracticeHandler from '../server/assisted-practice.js';
import rewardedChallengesHandler from '../server/rewarded-challenges.js';
import { careerChallengeState } from '../server/career-challenges.js';

const RUN_TTL = 60 * 60 * 2;
const QUESTION_MS = 15_000;
const NETWORK_GRACE_MS = 350;
const runKey = (id) => `geek:run:${id}`;
const runSnapshots = new WeakMap();
const runIdPattern = /^[a-f0-9]{40}$/;

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
  completedRound: run.completedRound || 0,
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
  status: run.status,
  answeredReview: run.roundAnswers || []
});

const loadRun = async (id, session) => {
  if (!runIdPattern.test(String(id || ''))) throw new Error('RUN_NOT_FOUND');
  const raw = await redis('GET', runKey(id));
  if (!raw) throw new Error('RUN_NOT_FOUND');
  const run = JSON.parse(raw);
  if (run.sessionId !== session.id) throw new Error('RUN_NOT_FOUND');
  runSnapshots.set(run, raw);
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
  if (run.mode === 'gauntlet' && run.completedRound >= 10) profile.gauntletsCompleted += 1;
  run.status = 'finished';
  run.current = null;
  await commitRankedState({ playerId: playerIdFor(session), run, previousRun: runSnapshots.get(run), profile, ttl: 300 });
  const leaderboard = await recordVerifiedScore({ session, category: run.category, score: run.totalScore, round: Math.max(1, run.completedRound || 0), mode: run.mode });
  return { leaderboard };
};

const answerQuestion = async (run, session, profile, body) => {
  if (run.lastResponse?.questionToken === body.questionToken && ['awaiting-next', 'between-rounds'].includes(run.status)) return run.lastResponse;
  if (run.status !== 'question' || run.current?.token !== body.questionToken) throw new Error('RUN_STATE_INVALID');
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
  run.roundAnswers ||= [];
  run.roundAnswers.push({ prompt: question.prompt, selected: selectedIndex < 0 ? 'No answer' : run.current.options[selectedIndex], answer, correct: isCorrect, source: question.source, sourceState: result.sourceState });
  run.current = null;
  let roundResult = null, auditInput = null;
  const mode = modeConfig(run.mode);
  const modeClockExpired = Boolean(mode.overallMs && now >= run.overallDeadline);
  if (run.questionIndex === run.questionCount - 1 || modeClockExpired) {
    const earlierAchievements=new Set(careerChallengeState(profile).tasks.filter(t=>t.complete).map(t=>t.id));
    const config = ROUND_CONFIG[run.round - 1];
    const reward = mode.rewards ? run.correct * config.reward : 0;
    const xpEarned = run.correct * 10 + Math.round(run.roundScore / 1000);
    run.totalScore += run.roundScore;
    run.rewards += reward;
    profile.balance += reward;
    profile.xp += xpEarned;
    profile.totalCorrect += run.correct;
    recordRoundJourney(profile, {
      runId: run.id,
      mode: run.mode,
      category: run.category,
      round: run.round,
      correct: run.correct,
      answered: run.questionIndex + 1,
      score: run.roundScore,
      xpEarned,
      reward,
      maxStreak: run.maxStreak
    });
    const career=careerChallengeState(profile);
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
      newAchievements: career.tasks.filter(t=>t.complete&&!earlierAchievements.has(t.id)).map(({id,name,tierName})=>({id,name,tierName})),
      careerRewardsReady: career.ready,
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
    if (reward > 0) {
      auditInput = {
        type: 'alpha.balance.reward-credited',
        severity: 'info',
        objectType: 'ranked-run',
        objectId: run.id,
        outcome: 'success',
        reason: 'server-scored-round',
        interactionId: run.id,
        details: {
          amount: reward,
          unit: 'ALPHA_GEEK',
          mode: run.mode,
          category: run.category,
          round: run.round,
          correct: run.correct,
          balanceAfter: profile.balance,
          settlement: 'disabled'
        }
      };
    }
  } else {
    run.status = 'awaiting-next';
  }
  const response = {
    questionToken: body.questionToken,
    result,
    roundResult,
    run: safeRun(run),
    profile: withProgression(profile)
  };
  run.lastResponse = response;
  await commitRankedState({ playerId: playerIdFor(session), run, previousRun: runSnapshots.get(run), profile, auditInput });
  return response;
};

export default async function handler(req, res) {
  if (req.query?.service === 'discoveries') return rewardedChallengesHandler(req, res);
  if (req.query?.service === 'quest') return questHandler(req, res);
  if (req.query?.service === 'practice') return assistedPracticeHandler(req, res);
  if (req.query?.service === 'study') return studyHandler(req, res);
  if (req.query?.service === 'challenges') return challengesHandler(req, res);
  setApiHeaders(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  try {
    const session = await requireSession(req);
    const playerId = playerIdFor(session);
    if (req.method === 'GET') {
      const profile = withProgression(await loadProfile(playerId));
      if (!req.query?.runId && req.query?.resume !== '1') return sendJson(res, 200, { ok: true, profile, verified: true });
      const id = req.query?.resume === '1' ? await redis('GET', `geek:ranked:active:${session.id}`) : req.query.runId;
      const run = await loadRun(id, session);
      const question = run.current ? publicQuestion(run, await questionById(run.category, run.current.questionId)) : null;
      // Only the latest committed grade is available here; never future answers.
      return sendJson(res, 200, { ok: true, verified: true, ...(run.lastResponse || {}), run: safeRun(run), profile, question });
    }
    if (req.method !== 'POST') return methodNotAllowed(res);
    const body = parseBody(req);
    const action = String(body.action || '');
    await rateLimit('ranked', playerId, 240, 60 * 5);
    if (action === 'start') {
      await rateLimit('ranked-start-ip', clientFingerprint(req), RANKED_START_IP_LIMIT.maximum, RANKED_START_IP_LIMIT.seconds);
      const category = categories.has(body.category) ? body.category : 'kaspa';
      const mode = Object.hasOwn(MODE_CONFIG, body.mode) ? body.mode : 'gauntlet';
      const focus = ['ghostdag', 'builders'].includes(body.focus) ? body.focus : '';
      const profile = await loadProfile(playerId);
      const run = {
        id: randomBytes(20).toString('hex'), sessionId: session.id, category, focus, mode, round: 1,
        questionIndex: 0, correct: 0, roundScore: 0, totalScore: 0, streak: 0, maxStreak: 0,
        completedRound: 0, startBalance: profile.balance, fees: 0, rewards: 0, usedQuestionIds: [], status: 'starting',
        questionCount: modeConfig(mode).questionCount, maxRounds: modeConfig(mode).maxRounds, overallDeadline: 0
      };
      const dailyKey = mode === 'daily' ? `geek:daily:${playerId}:${new Date().toISOString().slice(0, 10)}` : undefined;
      const question = await startRound(run, profile);
      await commitRankedState({ playerId, run, profile, dailyKey, activeKey: `geek:ranked:active:${session.id}` });
      return sendJson(res, 201, { ok: true, verified: true, run: safeRun(run), profile: withProgression(profile), question });
    }
    const run = await loadRun(body.runId, session);
    const profile = await loadProfile(playerId);
    if (action === 'answer') {
      let answer;
      try { answer = await answerQuestion(run, session, profile, body); }
      catch (error) {
        if (error.message !== 'RANKED_STATE_CHANGED') throw error;
        const latest = await loadRun(run.id, session);
        if (latest.lastResponse?.questionToken !== body.questionToken) throw error;
        answer = latest.lastResponse;
      }
      return sendJson(res, 200, { ok: true, verified: true, ...answer });
    }
    if (action === 'next') {
      if (run.status !== 'awaiting-next') throw new Error('RUN_STATE_INVALID');
      run.questionIndex += 1;
      const question = await issueQuestion(run);
      await commitRankedState({ playerId, run, previousRun: runSnapshots.get(run), profile });
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile: withProgression(profile), question });
    }
    if (action === 'continue') {
      if (run.mode !== 'gauntlet' || run.status !== 'between-rounds' || run.round >= run.maxRounds) throw new Error('RUN_STATE_INVALID');
      const balanceBefore = profile.balance;
      run.round += 1;
      const question = await startRound(run, profile);
      const entry = balanceBefore - profile.balance;
      const auditInput = entry > 0 ? {
            type: 'alpha.balance.entry-debited',
            severity: 'info',
            objectType: 'ranked-run',
            objectId: run.id,
            outcome: 'success',
            reason: 'gauntlet-round-entry',
            interactionId: run.id,
            details: {
              amount: entry,
              unit: 'ALPHA_GEEK',
              mode: run.mode,
              category: run.category,
              round: run.round,
              balanceBefore,
              balanceAfter: profile.balance,
              settlement: 'disabled'
            }
      } : null;
      await commitRankedState({ playerId, run, previousRun: runSnapshots.get(run), profile, auditInput });
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile: withProgression(profile), question });
    }
    if (action === 'finish') {
      if (!['between-rounds', 'question', 'awaiting-next', 'finished'].includes(run.status)) throw new Error('RUN_STATE_INVALID');
      const finished = await finishRun(run, session, profile);
      return sendJson(res, 200, { ok: true, verified: true, run: safeRun(run), profile: withProgression(profile), ...finished });
    }
    throw new Error('INVALID_REQUEST');
  } catch (error) {
    return handleApiError(res, error);
  }
}
