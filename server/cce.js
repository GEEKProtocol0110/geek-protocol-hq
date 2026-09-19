import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { categories, cleanName } from './http.js';
import { pipeline, parseStoredJson, redis } from './redis.js';

const SUBMISSION_PREFIX = 'geek:cce:submission:';
const REVIEW_QUEUE = 'geek:cce:review';
const REWARD_LEDGER = 'geek:cce:reward-ledger';
const difficultyLevels = new Set(['easy', 'medium', 'hard']);
const contributionStates = new Set(['submitted', 'changes-requested', 'approved', 'published', 'rejected']);

const submissionKey = (id) => `${SUBMISSION_PREFIX}${id}`;
const contributorIndex = (sessionId) => `geek:cce:contributor:${sessionId}:submissions`;
const contributorStats = (sessionId) => `geek:cce:contributor:${sessionId}:stats`;
const publishedIndex = (category) => `geek:cce:published:${category}`;
const duplicateKey = (fingerprint) => `geek:cce:duplicate:${fingerprint}`;
const cleanText = (value, maximum) => String(value || '').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, maximum);
const rewardAmount = () => {
  const configured = Number(process.env.CCE_REWARD_AMOUNT || 25);
  return Number.isInteger(configured) && configured > 0 && configured <= 10_000 ? configured : 25;
};

const validHttpsUrl = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname);
  } catch {
    return false;
  }
};

const normalizeSubmission = (body) => {
  const category = categories.has(body.category) ? body.category : '';
  const difficulty = difficultyLevels.has(body.difficulty) ? body.difficulty : '';
  const topic = cleanText(body.topic, 60);
  const prompt = cleanText(body.prompt, 280);
  const options = Array.isArray(body.options) ? body.options.map((option) => cleanText(option, 140)) : [];
  const correctIndex = Number(body.correctIndex);
  const explanation = cleanText(body.explanation, 500);
  const source = cleanText(body.source, 500);
  const displayName = cleanName(body.displayName, 'Community Geek');
  const original = body.original === true;
  const uniqueOptions = new Set(options.map((option) => option.toLocaleLowerCase()));
  if (!category || !difficulty || topic.length < 2 || prompt.length < 18 || options.length !== 4 || options.some((option) => option.length < 1) || uniqueOptions.size !== 4 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex > 3 || explanation.length < 12 || !validHttpsUrl(source) || !original) {
    throw new Error('CCE_INVALID_SUBMISSION');
  }
  return { category, difficulty, topic, prompt, options, correctIndex, explanation, source, displayName };
};

const fingerprintFor = (submission) => createHash('sha256')
  .update(`${submission.category}|${submission.prompt.toLocaleLowerCase()}|${submission.options.map((option) => option.toLocaleLowerCase()).sort().join('|')}`)
  .digest('hex');

const loadSubmission = async (id) => {
  if (!/^cce_[a-f0-9]{24}$/.test(String(id || ''))) throw new Error('CCE_NOT_FOUND');
  const submission = parseStoredJson(await redis('GET', submissionKey(id)));
  if (!submission) throw new Error('CCE_NOT_FOUND');
  return submission;
};

const publicSubmission = (submission, moderator = false) => {
  const result = {
    id: submission.id,
    category: submission.category,
    difficulty: submission.difficulty,
    topic: submission.topic,
    prompt: submission.prompt,
    options: submission.options,
    correctIndex: submission.correctIndex,
    explanation: submission.explanation,
    source: submission.source,
    displayName: submission.displayName,
    status: contributionStates.has(submission.status) ? submission.status : 'submitted',
    submittedAt: submission.submittedAt,
    updatedAt: submission.updatedAt,
    publishedAt: submission.publishedAt || null,
    firstUsedAt: submission.firstUsedAt || null,
    reviewNote: submission.reviewNote || '',
    reward: submission.reward
  };
  if (moderator) result.contributorSessionId = submission.contributorSessionId;
  return result;
};

const readStats = async (sessionId) => {
  const key = contributorStats(sessionId);
  const [submitted, accepted, used, earned] = await pipeline([
    ['HGET', key, 'submitted'],
    ['HGET', key, 'accepted'],
    ['HGET', key, 'used'],
    ['HGET', key, 'earned']
  ]);
  return {
    submitted: Number(submitted || 0),
    accepted: Number(accepted || 0),
    used: Number(used || 0),
    earned: Number(earned || 0),
    paid: 0,
    unit: 'GEEK',
    settlement: 'launch-gated'
  };
};

export const createContribution = async (session, body) => {
  const normalized = normalizeSubmission(body);
  const now = Date.now();
  const id = `cce_${randomBytes(12).toString('hex')}`;
  const fingerprint = fingerprintFor(normalized);
  const claimed = await redis('SET', duplicateKey(fingerprint), id, 'EX', 60 * 60 * 24 * 30, 'NX');
  if (claimed !== 'OK') throw new Error('CCE_DUPLICATE');
  const submission = {
    ...normalized,
    id,
    fingerprint,
    contributorSessionId: session.id,
    status: 'submitted',
    submittedAt: now,
    updatedAt: now,
    reviewNote: '',
    reward: { amount: rewardAmount(), unit: 'GEEK', status: 'pending-use', settlement: 'launch-gated' }
  };
  await pipeline([
    ['SET', submissionKey(id), JSON.stringify(submission)],
    ['ZADD', contributorIndex(session.id), now, id],
    ['ZADD', REVIEW_QUEUE, now, id],
    ['HINCRBY', contributorStats(session.id), 'submitted', 1]
  ], true);
  return publicSubmission(submission);
};

export const reviseContribution = async (session, body) => {
  const existing = await loadSubmission(body.id);
  if (existing.contributorSessionId !== session.id) throw new Error('CCE_NOT_FOUND');
  if (existing.status !== 'changes-requested') throw new Error('CCE_STATE_INVALID');
  const normalized = normalizeSubmission(body);
  const updated = {
    ...existing,
    ...normalized,
    status: 'submitted',
    updatedAt: Date.now(),
    reviewNote: ''
  };
  await pipeline([
    ['SET', submissionKey(existing.id), JSON.stringify(updated)],
    ['ZADD', REVIEW_QUEUE, updated.updatedAt, existing.id]
  ], true);
  return publicSubmission(updated);
};

export const contributorDashboard = async (sessionId) => {
  const ids = await redis('ZREVRANGE', contributorIndex(sessionId), 0, 49);
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', submissionKey(id)])) : [];
  const submissions = stored.map(parseStoredJson).filter(Boolean).map((item) => publicSubmission(item));
  return { submissions, stats: await readStats(sessionId) };
};

const providedAdminToken = (req) => {
  const explicit = String(req.headers?.['x-cce-admin'] || '');
  const authorization = String(req.headers?.authorization || '');
  return explicit || (authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
};

export const requireCceModerator = (req) => {
  const expected = String(process.env.CCE_ADMIN_TOKEN || '');
  const provided = providedAdminToken(req);
  if (expected.length < 24) throw new Error('CCE_MODERATION_NOT_CONFIGURED');
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) throw new Error('CCE_FORBIDDEN');
};

export const moderationQueue = async () => {
  const ids = await redis('ZREVRANGE', REVIEW_QUEUE, 0, 99);
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', submissionKey(id)])) : [];
  return stored.map(parseStoredJson).filter(Boolean).map((item) => publicSubmission(item, true));
};

export const moderateContribution = async (body) => {
  const action = String(body.action || '');
  const note = cleanText(body.note, 400);
  const submission = await loadSubmission(body.id);
  const now = Date.now();
  if (action === 'approve') {
    if (!['submitted', 'changes-requested'].includes(submission.status)) throw new Error('CCE_STATE_INVALID');
    submission.status = 'approved';
    submission.reviewNote = note;
  } else if (action === 'request-changes') {
    if (!['submitted', 'approved'].includes(submission.status) || note.length < 6) throw new Error('CCE_STATE_INVALID');
    submission.status = 'changes-requested';
    submission.reviewNote = note;
  } else if (action === 'reject') {
    if (!['submitted', 'approved', 'changes-requested'].includes(submission.status) || note.length < 6) throw new Error('CCE_STATE_INVALID');
    submission.status = 'rejected';
    submission.reviewNote = note;
  } else if (action === 'publish') {
    if (submission.status !== 'approved') throw new Error('CCE_STATE_INVALID');
    submission.status = 'published';
    submission.publishedAt = now;
    submission.reviewNote = note || submission.reviewNote;
  } else {
    throw new Error('INVALID_REQUEST');
  }
  submission.updatedAt = now;
  const commands = [
    ['SET', submissionKey(submission.id), JSON.stringify(submission)],
    ['ZREM', REVIEW_QUEUE, submission.id]
  ];
  if (submission.status === 'approved') commands.push(['ZADD', REVIEW_QUEUE, now, submission.id]);
  if (submission.status === 'published') {
    commands.push(['ZADD', publishedIndex(submission.category), now, submission.id]);
    commands.push(['HINCRBY', contributorStats(submission.contributorSessionId), 'accepted', 1]);
  }
  await pipeline(commands, true);
  return publicSubmission(submission, true);
};

const rankedQuestionFrom = (submission) => ({
  id: submission.id,
  category: submission.category,
  topic: submission.topic,
  difficulty: submission.difficulty,
  prompt: submission.prompt,
  options: submission.options,
  correctIndex: submission.correctIndex,
  funFact: submission.explanation,
  source: submission.source,
  volatile: false,
  priority: false,
  tags: ['community-content-engine'],
  community: true,
  contributorSessionId: submission.contributorSessionId,
  rewardAmount: Number(submission.reward?.amount || rewardAmount())
});

export const publishedCommunityQuestions = async (category, difficulty = '') => {
  if (!categories.has(category)) return [];
  const ids = await redis('ZRANGEBYSCORE', publishedIndex(category), '-inf', '+inf');
  const stored = ids.length ? await pipeline(ids.map((id) => ['GET', submissionKey(id)])) : [];
  return stored.map(parseStoredJson)
    .filter((item) => item?.status === 'published' && (!difficulty || item.difficulty === difficulty))
    .map(rankedQuestionFrom);
};

export const publishedCommunityQuestionById = async (id) => {
  const submission = await loadSubmission(id);
  if (submission.status !== 'published') throw new Error('QUESTION_NOT_FOUND');
  return rankedQuestionFrom(submission);
};

const CREDIT_USE_SCRIPT = `
local added = redis.call('HSETNX', KEYS[1], ARGV[1], ARGV[2])
if added == 1 then
  redis.call('HINCRBY', KEYS[2], 'earned', ARGV[3])
  redis.call('HINCRBY', KEYS[2], 'used', 1)
  local raw = redis.call('GET', KEYS[3])
  if raw then
    local item = cjson.decode(raw)
    item.firstUsedAt = tonumber(ARGV[4])
    item.updatedAt = tonumber(ARGV[4])
    item.reward.status = 'earned'
    redis.call('SET', KEYS[3], cjson.encode(item))
  end
end
return added`;

export const recordCommunityQuestionUse = async (question, runId) => {
  if (!question?.community || !question.contributorSessionId) return false;
  const now = Date.now();
  const ledger = JSON.stringify({
    questionId: question.id,
    contributorSessionId: question.contributorSessionId,
    amount: question.rewardAmount,
    unit: 'GEEK',
    status: 'earned',
    settlement: 'launch-gated',
    firstRunId: runId,
    createdAt: now
  });
  const added = await redis(
    'EVAL', CREDIT_USE_SCRIPT, 3,
    REWARD_LEDGER,
    contributorStats(question.contributorSessionId),
    submissionKey(question.id),
    question.id,
    ledger,
    question.rewardAmount,
    now
  );
  return Number(added) === 1;
};
