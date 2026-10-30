// Ranked seasons.
//
// Season 0 — Public-bank Alpha is the historical board (legacy Redis keys).
// Private-bank seasons are numbered 1, 2, 3, ... and roll over monthly in UTC:
//
//   GEEK_SEASON_1_START_MONTH=YYYY-MM   (UTC calendar month in which Season 1 starts)
//
//   season number = max(1, (UTC month of `now`) - (start month) + 1)
//
// When the variable is unset, monthly rollover is OFF and every private-bank run
// stays in Season 1 (the pre-monthly behaviour). An invalid value fails closed for
// new ranked runs (SEASON_CONFIG_INVALID) instead of guessing a season.
//
// A run's season is bound once, server-side, when the run starts; finishing later
// (even after a month rollover) always scores into that bound season.

export const SEASON_ZERO = Object.freeze({ id: 'season-0', number: 0, label: 'Season 0 — Public-bank Alpha', leaderboard: 'legacy', month: null });
export const MAX_SEASON_NUMBER = 9999;
const START_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;
const SEASON_ID_PATTERN = /^season-([1-9]\d{0,3})$/;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const seasonConfig = (env = process.env) => {
  const raw = env.GEEK_SEASON_1_START_MONTH;
  if (raw === undefined || raw === '') return Object.freeze({ monthly: false });
  const match = START_PATTERN.exec(String(raw).trim());
  if (!match || Number(match[1]) < 2000) throw new Error('SEASON_CONFIG_INVALID');
  return Object.freeze({ monthly: true, startIndex: Number(match[1]) * 12 + Number(match[2]) - 1 });
};

const monthIndexAt = (now) => {
  const date = new Date(now);
  if (Number.isNaN(date.getTime())) throw new Error('SEASON_CLOCK_INVALID');
  return date.getUTCFullYear() * 12 + date.getUTCMonth();
};

export const currentSeasonNumber = (now = Date.now(), env = process.env) => {
  const config = seasonConfig(env);
  if (!config.monthly) return 1;
  return Math.min(MAX_SEASON_NUMBER, Math.max(1, monthIndexAt(now) - config.startIndex + 1));
};

const monthLabel = (index) => `${MONTHS[index % 12]} ${Math.floor(index / 12)}`;
const monthKey = (index) => `${Math.floor(index / 12)}-${String(index % 12 + 1).padStart(2, '0')}`;

// Descriptor for private-bank season `number` (>= 1). Labels keep the
// "Season N — Private-bank" prefix; monthly seasons add their UTC month.
export const privateSeason = (number, env = process.env) => {
  if (!Number.isInteger(number) || number < 1 || number > MAX_SEASON_NUMBER) throw new Error('SEASON_UNSUPPORTED');
  let config;
  try { config = seasonConfig(env); } catch { config = { monthly: false }; }
  const index = config.monthly ? config.startIndex + number - 1 : null;
  return Object.freeze({
    id: `season-${number}`,
    number,
    label: `Season ${number} — Private-bank${index === null ? '' : ` · ${monthLabel(index)}`}`,
    leaderboard: `season-${number}`,
    month: index === null ? null : monthKey(index)
  });
};

// Run season ids: 'season-0' (public-bank Alpha) or 'season-N'.
export const parseRunSeasonId = (id) => {
  if (id === SEASON_ZERO.id) return 0;
  const match = typeof id === 'string' ? SEASON_ID_PATTERN.exec(id) : null;
  return match ? Number(match[1]) : null;
};

// Resolve a stored run's season. Runs created before seasons existed carry no
// season field and are Season 0. Any other unknown value is rejected and must
// never be coerced into Season 0.
export const seasonForRun = (run, env = process.env) => {
  if (run?.season === undefined || run?.season === null) return SEASON_ZERO;
  const number = parseRunSeasonId(run.season);
  if (number === null) throw new Error('SEASON_UNSUPPORTED');
  return number === 0 ? SEASON_ZERO : privateSeason(number, env);
};

// Leaderboard ids: 'legacy' (Season 0) or 'season-N'. Format-only check.
export const isLeaderboardSeasonId = (id) => id === 'legacy' || (typeof id === 'string' && SEASON_ID_PATTERN.test(id));

// Writes must name a well-formed season; unknown values throw instead of
// falling back to the Season 0 board.
export const assertWritableLeaderboardSeason = (id) => {
  if (!isLeaderboardSeasonId(id)) throw new Error('SEASON_UNSUPPORTED');
  return id;
};

// Viewable boards: Season 0 plus every private season up to the current one.
export const leaderboardSeasonIds = (now = Date.now(), env = process.env) => {
  let current = 1;
  try { current = currentSeasonNumber(now, env); } catch { current = 1; }
  return ['legacy', ...Array.from({ length: current }, (_, i) => `season-${i + 1}`)];
};

export const leaderboardSeasonLabel = (id, env = process.env) => {
  if (id === 'legacy') return SEASON_ZERO.label;
  const number = parseRunSeasonId(id);
  return number ? privateSeason(number, env).label : null;
};

// Environment namespace for season-scoped write keys (season-bank pins and
// Season 1+ leaderboards). Production keeps the original `geek:` keys so existing
// data and Season 0 history are untouched; every other environment (Vercel
// preview, local development, tests) writes under `geek:<env>:` so it can never
// land on production keys even when pointed at the same database.
const ENV_NAME = /^[a-z0-9-]{1,32}$/;
export const seasonKeyNamespace = (env = process.env) => {
  if (env.VERCEL_ENV === 'production') return 'geek:';
  return `geek:${ENV_NAME.test(env.VERCEL_ENV || '') ? env.VERCEL_ENV : 'development'}:`;
};
export const seasonScopedKey = (suffix, env = process.env) => `${seasonKeyNamespace(env)}${suffix}`;
export const seasonBankKey = (seasonId, env = process.env) => {
  if (!SEASON_ID_PATTERN.test(seasonId || '')) throw new Error('SEASON_UNSUPPORTED');
  return seasonScopedKey(`season-bank:${seasonId}`, env);
};

// Optional operator config: GEEK_SEASON_BANK_VERSIONS='{"season-2":"<bank version>"}'
// sets the expected bank version per season and overrides first-run-wins pins.
// Invalid JSON or entries fail closed (SEASON_CONFIG_INVALID).
export const configuredSeasonBankVersion = (seasonId, env = process.env) => {
  const raw = env.GEEK_SEASON_BANK_VERSIONS;
  if (!raw) return null;
  let map;
  try { map = JSON.parse(raw); } catch { throw new Error('SEASON_CONFIG_INVALID'); }
  if (!map || typeof map !== 'object' || Array.isArray(map)) throw new Error('SEASON_CONFIG_INVALID');
  for (const [key, value] of Object.entries(map)) {
    if (!SEASON_ID_PATTERN.test(key) || typeof value !== 'string' || !value || value.length > 200) throw new Error('SEASON_CONFIG_INVALID');
  }
  return Object.hasOwn(map, seasonId) ? map[seasonId] : null;
};
