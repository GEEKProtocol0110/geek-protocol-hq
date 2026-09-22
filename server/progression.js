import { awardRoundStickers } from './collectibles.js';

const XP_PER_LEVEL = 250;
const LEVELS_PER_PRESTIGE = 25;
const XP_PER_PRESTIGE = XP_PER_LEVEL * LEVELS_PER_PRESTIGE;
const JOURNEY_LIMIT = 80;

const CATEGORY_LABELS = {
  kaspa: 'Kaspa',
  'video-games': 'Video Games',
  'science-fiction': 'Science Fiction',
  technology: 'Technology',
  movies: 'Movies',
  history: 'History',
  comics: 'Comics',
  'pop-culture': 'Pop Culture'
};

const numeric = (value) => Math.max(0, Number.isFinite(Number(value)) ? Number(value) : 0);

const rankTitle = (level, prestige) => {
  if (prestige >= 5) return 'DAG Sovereign';
  if (prestige >= 3) return 'Grid Architect';
  if (prestige >= 1) return 'Prestige Operator';
  if (level >= 20) return 'Signal Master';
  if (level >= 15) return 'Protocol Scholar';
  if (level >= 10) return 'DAG Pathfinder';
  if (level >= 5) return 'Block Explorer';
  return 'Initiate';
};

export const deriveProgression = (profile = {}) => {
  const xp = Math.floor(numeric(profile.xp));
  const prestige = Math.floor(xp / XP_PER_PRESTIGE);
  const cycleXp = xp % XP_PER_PRESTIGE;
  const level = Math.min(LEVELS_PER_PRESTIGE, Math.floor(cycleXp / XP_PER_LEVEL) + 1);
  const levelXp = cycleXp % XP_PER_LEVEL;
  const nextThreshold = prestige * XP_PER_PRESTIGE + level * XP_PER_LEVEL;
  return {
    xp,
    level,
    prestige,
    title: rankTitle(level, prestige),
    levelXp,
    levelXpRequired: XP_PER_LEVEL,
    progressPercent: Math.min(100, Math.round((levelXp / XP_PER_LEVEL) * 100)),
    nextThreshold,
    xpToNext: Math.max(0, nextThreshold - xp),
    levelsPerPrestige: LEVELS_PER_PRESTIGE
  };
};

const cleanCategoryStats = (value = {}) => ({
  rounds: Math.floor(numeric(value.rounds)),
  questions: Math.floor(numeric(value.questions)),
  correct: Math.floor(numeric(value.correct)),
  xp: Math.floor(numeric(value.xp)),
  bestScore: Math.floor(numeric(value.bestScore)),
  lastPlayedAt: Math.floor(numeric(value.lastPlayedAt))
});

const prependJourney = (profile, events) => {
  const existing = Array.isArray(profile.journey) ? profile.journey : [];
  profile.journey = [...events, ...existing]
    .filter((event, index, all) => event?.id && all.findIndex((candidate) => candidate?.id === event.id) === index)
    .slice(0, JOURNEY_LIMIT);
};

export const recordRoundJourney = (profile, input) => {
  const now = Date.now();
  const xpEarned = Math.floor(numeric(input.xpEarned));
  const before = deriveProgression({ ...profile, xp: numeric(profile.xp) - xpEarned });
  const after = deriveProgression(profile);
  const answered = Math.floor(numeric(input.answered));
  const correct = Math.min(answered, Math.floor(numeric(input.correct)));
  const category = Object.hasOwn(CATEGORY_LABELS, input.category) ? input.category : 'kaspa';
  const categoryStats = profile.categoryStats && typeof profile.categoryStats === 'object' ? { ...profile.categoryStats } : {};
  const previous = cleanCategoryStats(categoryStats[category]);

  profile.totalQuestions = Math.floor(numeric(profile.totalQuestions)) + answered;
  profile.longestStreak = Math.max(Math.floor(numeric(profile.longestStreak)), Math.floor(numeric(input.maxStreak)));
  categoryStats[category] = {
    rounds: previous.rounds + 1,
    questions: previous.questions + answered,
    correct: previous.correct + correct,
    xp: previous.xp + xpEarned,
    bestScore: Math.max(previous.bestScore, Math.floor(numeric(input.score))),
    lastPlayedAt: now
  };
  profile.categoryStats = categoryStats;

  const events = [{
    id: `${input.runId}:${input.round}:round`,
    type: 'round',
    at: now,
    mode: input.mode,
    category,
    categoryLabel: CATEGORY_LABELS[category],
    round: Math.floor(numeric(input.round)),
    correct,
    answered,
    score: Math.floor(numeric(input.score)),
    xp: xpEarned,
    reward: Math.floor(numeric(input.reward))
  }];

  const stickersAwarded = awardRoundStickers(profile, { ...input, answered, correct }, before, after);
  for (const stickerId of stickersAwarded) {
    events.unshift({
      id: `${input.runId}:${input.round}:sticker:${stickerId}`,
      type: 'sticker',
      at: now,
      stickerId
    });
  }

  if (after.prestige > before.prestige) {
    events.unshift({
      id: `${input.runId}:${input.round}:prestige:${after.prestige}`,
      type: 'prestige',
      at: now,
      prestige: after.prestige,
      title: after.title
    });
  } else if (after.level > before.level) {
    events.unshift({
      id: `${input.runId}:${input.round}:level:${after.level}`,
      type: 'level',
      at: now,
      level: after.level,
      title: after.title
    });
  }

  prependJourney(profile, events);
  return profile;
};

export const deriveAchievements = (profile = {}) => {
  const progression = deriveProgression(profile);
  const categories = profile.categoryStats && typeof profile.categoryStats === 'object' ? profile.categoryStats : {};
  const worldsPlayed = Object.keys(CATEGORY_LABELS).filter((key) => cleanCategoryStats(categories[key]).rounds > 0).length;
  const totalCorrect = Math.floor(numeric(profile.totalCorrect));
  const totalQuestions = Math.floor(numeric(profile.totalQuestions));
  const bestRound = Math.floor(numeric(profile.bestRound));
  const longestStreak = Math.floor(numeric(profile.longestStreak));
  return [
    { id: 'first-signal', name: 'First Signal', detail: 'Complete one verified round.', unlocked: totalQuestions > 0, progress: Math.min(1, totalQuestions), target: 1 },
    { id: 'kaspa-initiate', name: 'Kaspa Initiate', detail: 'Answer 25 Kaspa questions correctly.', unlocked: cleanCategoryStats(categories.kaspa).correct >= 25, progress: Math.min(25, cleanCategoryStats(categories.kaspa).correct), target: 25 },
    { id: 'signal-100', name: 'Century Signal', detail: 'Answer 100 questions correctly.', unlocked: totalCorrect >= 100, progress: Math.min(100, totalCorrect), target: 100 },
    { id: 'streak-10', name: 'Clean Channel', detail: 'Build a 10-answer streak.', unlocked: longestStreak >= 10, progress: Math.min(10, longestStreak), target: 10 },
    { id: 'round-five', name: 'Deep Protocol', detail: 'Reach Gauntlet round five.', unlocked: bestRound >= 5, progress: Math.min(5, bestRound), target: 5 },
    { id: 'apex', name: 'Apex Protocol', detail: 'Clear all ten Gauntlet rounds.', unlocked: bestRound >= 10, progress: Math.min(10, bestRound), target: 10 },
    { id: 'eight-worlds', name: 'Omniscient Grid', detail: 'Complete a round in all eight worlds.', unlocked: worldsPlayed >= 8, progress: worldsPlayed, target: 8 },
    { id: 'prestige-one', name: 'Prestige Operator', detail: 'Cross the first 25-level cycle.', unlocked: progression.prestige >= 1, progress: Math.min(1, progression.prestige), target: 1 }
  ];
};

export const buildJourneyProfile = (profile = {}, player = {}) => {
  const categories = profile.categoryStats && typeof profile.categoryStats === 'object' ? profile.categoryStats : {};
  const totalCorrect = Math.floor(numeric(profile.totalCorrect));
  const totalQuestions = Math.floor(numeric(profile.totalQuestions));
  return {
    player: {
      name: String(player.name || 'Guest Geek').slice(0, 24),
      memberSince: Math.floor(numeric(player.createdAt)),
      walletProtected: Boolean(player.identityVersion)
    },
    progression: deriveProgression(profile),
    stats: {
      xp: Math.floor(numeric(profile.xp)),
      alphaGeek: Math.floor(numeric(profile.balance)),
      totalRuns: Math.floor(numeric(profile.totalRuns)),
      totalQuestions,
      totalCorrect,
      accuracy: totalQuestions ? Math.round((totalCorrect / totalQuestions) * 100) : 0,
      longestStreak: Math.floor(numeric(profile.longestStreak)),
      bestRound: Math.floor(numeric(profile.bestRound)),
      bestScore: Math.floor(numeric(profile.bestScore)),
      gauntletsCompleted: Math.floor(numeric(profile.gauntletsCompleted))
    },
    categories: Object.entries(CATEGORY_LABELS).map(([key, label]) => ({ key, label, ...cleanCategoryStats(categories[key]) })),
    journey: (Array.isArray(profile.journey) ? profile.journey : []).slice(0, JOURNEY_LIMIT),
    achievements: deriveAchievements(profile)
  };
};

export const withProgression = (profile = {}) => ({ ...profile, progression: deriveProgression(profile) });
