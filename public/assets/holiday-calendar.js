// Shared display catalog and celebration dates. Settings cannot add entries, CSS or URLs.
export const HOLIDAY_TIMEZONE = 'America/Detroit';

const entry = holiday => Object.freeze({
  ...holiday,
  motifs: Object.freeze([...holiday.motifs]),
  window: Object.freeze({
    ...holiday.window,
    ...(holiday.window.start ? { start: Object.freeze([...holiday.window.start]), end: Object.freeze([...holiday.window.end]) } : {})
  }),
  ...(holiday.tokens ? { tokens: Object.freeze({ ...holiday.tokens }) } : {})
});

// Priority bands: 90 Kaspa birthday and Geek Protocol birthday, 80 other Kaspa milestones, 70 other crypto days,
// 50 short civic days, 30 medium windows, 20 long seasonal windows, 0 manual-only.
// Existing civic and seasonal palettes stay in holiday-theme.css; tokens below are only for days added with this catalog.
export const HOLIDAYS = Object.freeze([
  { id: 'new-year', label: "New Year's", group: 'seasonal', icon: '✦', greeting: 'A new year of discovery', when: 'Dec 29–Jan 2', priority: 30, motifs: ['✦', '✧', '✦'], window: { type: 'annual', start: [12, 29], end: [1, 2] } },
  { id: 'valentines', label: "Valentine's Day", group: 'seasonal', icon: '♡', greeting: 'Share a little knowledge and kindness', when: 'Feb 12–15', priority: 30, motifs: ['♡', '♥', '♡'], window: { type: 'annual', start: [2, 12], end: [2, 15] } },
  { id: 'presidents-day', label: "Presidents' Day", group: 'civic', icon: '★', greeting: 'Discover the stories that shaped us', when: 'Third Monday in February', priority: 50, motifs: ['★', '☆', '★'], window: { type: 'nth-weekday', month: 2, weekday: 1, nth: 3 } },
  { id: 'st-patricks', label: "St. Patrick's Day", group: 'seasonal', icon: '☘', greeting: 'A little luck. A lot of learning.', when: 'Mar 16–18', priority: 50, motifs: ['☘', '✧', '☘'], window: { type: 'annual', start: [3, 16], end: [3, 18] } },
  { id: 'easter', label: 'Easter', group: 'seasonal', icon: '✝', greeting: 'Hope, renewal, and new beginnings', when: 'Palm Sunday–Easter Monday', priority: 20, motifs: ['✝', '🌷', '✧'], window: { type: 'easter-relative', from: -7, to: 1 } },
  { id: 'memorial-day', label: 'Memorial Day', group: 'civic', icon: '★', greeting: 'Remember and honor', when: 'Friday–last Monday in May', priority: 30, motifs: ['★', '❧', '★'], window: { type: 'nth-weekday', month: 5, weekday: 1, nth: 'last', from: -3, to: 0 } },
  { id: 'independence-day', label: 'Independence Day', group: 'civic', icon: '★', greeting: 'Celebrate independence and curiosity', when: 'Jul 1–5', priority: 30, motifs: ['★', '✦', '☆'], window: { type: 'annual', start: [7, 1], end: [7, 5] } },
  { id: 'labor-day', label: 'Labor Day', group: 'civic', icon: '⚒', greeting: 'Celebrate the people who build', when: 'Friday–first Monday in September', priority: 30, motifs: ['⚒', '⚙', '✦'], window: { type: 'nth-weekday', month: 9, weekday: 1, nth: 1, from: -3, to: 0 } },
  { id: 'halloween', label: 'Halloween', group: 'seasonal', icon: '🎃', greeting: 'A little spooky. A lot of Geek.', when: 'Oct 24–30', priority: 20, motifs: ['🎃', '☾', '✧'], window: { type: 'annual', start: [10, 24], end: [10, 30] } },
  { id: 'veterans-day', label: 'Veterans Day', group: 'civic', icon: '★', greeting: 'Honor those who served', when: 'Nov 10–12', priority: 50, motifs: ['★', '❧', '★'], window: { type: 'annual', start: [11, 10], end: [11, 12] } },
  { id: 'thanksgiving', label: 'Thanksgiving', group: 'seasonal', icon: '🍂', greeting: 'Grateful for every curious mind', when: 'Monday–Sunday of Thanksgiving week', priority: 30, motifs: ['🍂', '❧', '🍁'], window: { type: 'nth-weekday', month: 11, weekday: 4, nth: 4, from: -3, to: 3 } },
  { id: 'christmas', label: 'Christmas', group: 'seasonal', icon: '🎄', greeting: 'Merry Christmas, Geeks', when: 'Dec 1–26', priority: 20, motifs: ['❄', '✦', '🎄'], window: { type: 'annual', start: [12, 1], end: [12, 26] } },
  {
    id: 'kaspa-birthday', label: "Kaspa's Birthday", group: 'kaspa', icon: '✦', greeting: 'Happy Birthday, Kaspa.', when: 'Nov 6–8', priority: 90,
    motifs: ['✦', '◇', '⬡'], window: { type: 'annual', start: [11, 6], end: [11, 8] },
    tokens: { gold: '#d9fff6', goldBright: '#f4fffc', cyan: '#7dffe6', glow: 'rgba(73, 234, 203, .22)', cool: 'rgba(56, 147, 135, .18)', fringe: 'repeating-linear-gradient(105deg,#49eacb 0 10px,#0b1210 10px 22px,#70e6dc 22px 26px)' },
    source: 'https://wiki.kaspa.org/en/tokenomics'
  },
  {
    id: 'bitcoin-genesis', label: 'Bitcoin Genesis', group: 'bitcoin', icon: '▣', greeting: 'The first block.', when: 'Jan 3', priority: 70,
    motifs: ['▣', '✦', '▣'], window: { type: 'one-day', month: 1, day: 3 },
    tokens: { gold: '#ffe7a8', goldBright: '#fff3cc', cyan: '#d5e2ff', glow: 'rgba(196, 154, 62, .16)', cool: 'rgba(36, 58, 112, .20)', fringe: 'repeating-linear-gradient(90deg,#142033 0 16px,#e6c56a 16px 20px,#142033 20px 36px)' },
    source: 'https://help.blockstream.com/education/glossary/genesis-block'
  },
  {
    id: 'bitcoin-pizza-day', label: 'Bitcoin Pizza Day', group: 'bitcoin', icon: '◔', greeting: 'A first meal, paid on a new network.', when: 'May 22', priority: 70,
    motifs: ['◔', '▭', '✦'], window: { type: 'one-day', month: 5, day: 22 },
    tokens: { gold: '#ffd7a3', goldBright: '#ffe8c6', cyan: '#ffd0a8', glow: 'rgba(176, 98, 32, .18)', cool: 'rgba(120, 64, 24, .14)', fringe: 'repeating-linear-gradient(105deg,#e0a15a 0 14px,#3a2416 14px 28px,#f0c48a 28px 32px)' },
    source: 'https://www.guinnessworldrecords.com/world-records/696240-first-commercial-bitcoin-transaction'
  },
  {
    id: 'ethereum-launch', label: 'Ethereum Launch', group: 'ethereum', icon: '◆', greeting: 'A world computer, still being learned.', when: 'Jul 29–31', priority: 70,
    motifs: ['◆', '✦', '◇'], window: { type: 'annual', start: [7, 29], end: [7, 31] },
    tokens: { gold: '#e6d4ff', goldBright: '#f4ebff', cyan: '#9af0e2', glow: 'rgba(124, 82, 186, .18)', cool: 'rgba(56, 147, 135, .16)', fringe: 'repeating-linear-gradient(105deg,#8d6cc4 0 14px,#12302c 14px 28px,#49eacb 28px 32px)' },
    source: 'https://blog.ethereum.org/2015/07/30/ethereum-launches'
  },
  {
    id: 'krc20-launch', label: 'KRC-20 Launch', group: 'kaspa', icon: '⌬', greeting: 'Tokens on Kaspa, made for building.', when: 'Sep 14–16', priority: 80,
    motifs: ['⌬', '▣', '✦'], window: { type: 'annual', start: [9, 14], end: [9, 16] },
    tokens: { gold: '#d4fff3', goldBright: '#f0fffb', cyan: '#b7e7ff', glow: 'rgba(73, 234, 203, .16)', cool: 'rgba(70, 140, 190, .14)', fringe: 'repeating-linear-gradient(105deg,#49eacb 0 8px,#123038 8px 18px,#b7e7ff 18px 22px,#123038 22px 34px)' },
    source: 'https://minerbases.com/krc-20-mainnet-launch-announcement/'
  },
  {
    id: 'bitcoin-whitepaper', label: 'Bitcoin Whitepaper Day', group: 'bitcoin', icon: '§', greeting: 'A peer-to-peer electronic cash system.', when: 'Oct 31', priority: 70,
    motifs: ['§', '✦', '¶'], window: { type: 'one-day', month: 10, day: 31 },
    tokens: { gold: '#f3e2b8', goldBright: '#fff6e2', cyan: '#ead7b0', glow: 'rgba(168, 132, 64, .16)', cool: 'rgba(90, 70, 40, .14)', fringe: 'repeating-linear-gradient(90deg,#3a3224 0 12px,#e6d2a4 12px 14px,#3a3224 14px 26px)' },
    source: 'https://www.metzdowd.com/pipermail/cryptography/2008-October/014810.html'
  },
  {
    id: 'crescendo', label: 'Crescendo', group: 'kaspa', icon: '♩', greeting: 'Ten blocks a second.', when: 'May 4–6', priority: 80,
    motifs: ['♩', '♪', '✦'], window: { type: 'annual', start: [5, 4], end: [5, 6] },
    tokens: { gold: '#cffff6', goldBright: '#f2fffc', cyan: '#8ef3ea', glow: 'rgba(73, 234, 203, .20)', cool: 'rgba(32, 90, 84, .16)', fringe: 'repeating-linear-gradient(105deg,#49eacb 0 6px,#0d1c18 6px 12px,#49eacb 12px 18px,#0d1c18 18px 30px)' },
    source: 'https://github.com/kaspanet/rusty-kaspa/releases/tag/v1.0.0'
  },
  {
    // Named day is June 22 in America/Detroit. deploymentHash is the canonical pin in server/geek-deployment.js, not a second hash.
    id: 'geek-birthday', label: "Geek Protocol's Birthday", group: 'geek', icon: '✦', greeting: 'Deployed on Kaspa. Built for curious minds.', when: 'Jun 21–23', priority: 90,
    motifs: ['✦', '⬡', '◇'], window: { type: 'annual', start: [6, 21], end: [6, 23] },
    deploymentHash: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1',
    tokens: { gold: '#e8c56e', goldBright: '#f3df9a', cyan: '#c8fff4', glow: 'rgba(73,234,203,.20)', cool: 'rgba(180,140,50,.14)', fringe: 'repeating-linear-gradient(105deg,#6fc7ba 0 10px,#0b1210 10px 20px,#e8c56e 20px 24px,#b9f1e2 24px 28px)' },
    source: 'https://api.kasplex.org/v1/krc20/token/GEEK'
  },
  {
    id: 'toccata', label: 'Toccata', group: 'kaspa', icon: '♫', greeting: 'Programmability on the first layer.', when: 'Jun 29–30', priority: 80,
    motifs: ['♫', '♩', '✦'], window: { type: 'annual', start: [6, 29], end: [6, 30] },
    tokens: { gold: '#f0e2b0', goldBright: '#fff6d4', cyan: '#9ee6d6', glow: 'rgba(180, 150, 70, .14)', cool: 'rgba(56, 147, 135, .16)', fringe: 'repeating-linear-gradient(105deg,#d7c07a 0 8px,#12302c 8px 20px,#49eacb 20px 24px,#12302c 24px 36px)' },
    source: 'https://kaspa.org/lore'
  },
  {
    id: 'satoshi-birthday', label: "Satoshi's Birthday", group: 'bitcoin', icon: '✧', greeting: 'For the curious minds who start things.', when: 'Apr 5', priority: 0, manualOnly: true,
    motifs: ['✧', '·', '✧'], window: { type: 'one-day', month: 4, day: 5 },
    tokens: { gold: '#efe6cf', goldBright: '#f8f3e6', cyan: '#d5ebe4', glow: 'rgba(120, 110, 70, .12)', cool: 'rgba(56, 147, 135, .10)', fringe: 'linear-gradient(90deg,#2a3330,#d9d0b8,#243833)' },
    source: 'https://web.archive.org/web/20120529203623/p2pfoundation.ning.com/profile/SatoshiNakamoto'
  }
].map(entry));

export const holidayById = id => HOLIDAYS.find(holiday => holiday.id === id) || null;
const DAY = 86_400_000;
const date = (year, month, day) => Date.UTC(year, month - 1, day);
const iso = value => new Date(value).toISOString().slice(0, 10);
const nthWeekday = (year, month, weekday, nth) => {
  if (nth === 'last') {
    const last = Date.UTC(year, month, 0);
    return last - ((new Date(last).getUTCDay() - weekday + 7) % 7) * DAY;
  }
  const first = date(year, month, 1);
  return first + (((weekday - new Date(first).getUTCDay() + 7) % 7) + (nth - 1) * 7) * DAY;
};
const annualRange = (year, start, end) => {
  const wraps = start[0] > end[0] || (start[0] === end[0] && start[1] > end[1]);
  return [date(wraps ? year - 1 : year, start[0], start[1]), date(year, end[0], end[1])];
};
// Gregorian computus; this is the Western Easter calendar.
export const easterDay = year => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return date(year, month, day);
};
const resolveRange = (holiday, year) => {
  if (holiday.manualOnly) return null;
  const rule = holiday.window;
  if (rule.type === 'one-day') return annualRange(year, [rule.month, rule.day], [rule.month, rule.day]);
  if (rule.type === 'annual') return annualRange(year, rule.start, rule.end);
  if (rule.type === 'nth-weekday') {
    const anchor = nthWeekday(year, rule.month, rule.weekday, rule.nth);
    return [anchor + (rule.from || 0) * DAY, anchor + (rule.to || 0) * DAY];
  }
  if (rule.type === 'easter-relative') {
    const easter = easterDay(year);
    return [easter + rule.from * DAY, easter + rule.to * DAY];
  }
  return null;
};
export const localHolidayDay = (now = Date.now()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: HOLIDAY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return date(parts.year, parts.month, parts.day);
};
export const holidayWindows = year => HOLIDAYS.flatMap(holiday => {
  const range = resolveRange(holiday, year);
  if (!range) return [];
  return [{ ...holiday, start: iso(range[0]), end: iso(range[1]) }];
});
// Highest priority, then the shortest inclusive window, then id.
export const compareHolidayWindows = (a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0)
  || (Date.parse(a.end) - Date.parse(a.start)) - (Date.parse(b.end) - Date.parse(b.start))
  || String(a.id).localeCompare(String(b.id));
export const automaticHoliday = (now = Date.now()) => {
  const day = localHolidayDay(now), year = new Date(day).getUTCFullYear(), today = iso(day);
  // Adjacent years cover New Year's window across the December boundary.
  return [year - 1, year, year + 1].flatMap(holidayWindows).filter(window => window.start <= today && window.end >= today).sort(compareHolidayWindows)[0] || null;
};
export const effectiveHoliday = (config, now = Date.now()) => config.mode === 'manual' ? holidayById(config.holiday) : config.mode === 'auto' ? automaticHoliday(now) : null;
export const upcomingHolidayWindows = (now = Date.now()) => {
  const day = localHolidayDay(now), year = new Date(day).getUTCFullYear(), today = iso(day);
  return [year, year + 1].flatMap(holidayWindows).filter(window => window.end >= today).sort((a, b) => a.start.localeCompare(b.start) || compareHolidayWindows(a, b)).slice(0, 6);
};
