// Shared display catalog and celebration dates. Settings cannot add entries, CSS or URLs.
export const HOLIDAY_TIMEZONE = 'America/Detroit';

const entry = holiday => Object.freeze({
  ...holiday,
  motifs: Object.freeze([...holiday.motifs]),
  ...(holiday.marks ? { marks: Object.freeze([...holiday.marks]) } : {}),
  window: Object.freeze({
    ...holiday.window,
    ...(holiday.window.start ? { start: Object.freeze([...holiday.window.start]), end: Object.freeze([...holiday.window.end]) } : {})
  }),
  ...(holiday.tokens ? { tokens: Object.freeze({ ...holiday.tokens }) } : {})
});

// Priority bands: 90 Kaspa birthday and Geek Protocol birthday, 80 other Kaspa milestones, 70 other crypto days,
// 50 short civic days, 30 medium windows, 20 long seasonal windows, 0 manual-only.
// marks are in-repo stroke ids drawn by holiday-marks.js. tokens match holiday-theme.css.
export const HOLIDAYS = Object.freeze([
  { id: 'new-year', label: "New Year's", group: 'seasonal', icon: '✦', greeting: 'A new year of discovery', when: 'Dec 29–Jan 2', priority: 30, motifs: ['✦', '✧', '✦'], marks: ['terminal', 'star', 'hex'], window: { type: 'annual', start: [12, 29], end: [1, 2] }, tokens: { gold: '#ffe19b', goldBright: '#ffedc3', cyan: '#c8d8ff', glow: 'rgba(157,121,48,.18)', cool: 'rgba(91,110,191,.15)', fringe: 'repeating-linear-gradient(105deg,#ffe19b 0 10px,#152544 10px 23px,#b2caff 23px 26px)' } },
  { id: 'valentines', label: "Valentine's Day", group: 'seasonal', icon: '♡', greeting: 'Share a little knowledge and kindness', when: 'Feb 12–15', priority: 30, motifs: ['♡', '♥', '♡'], marks: ['heart', 'dag', 'hex'], window: { type: 'annual', start: [2, 12], end: [2, 15] }, tokens: { gold: '#ffc2d9', goldBright: '#ffdeeb', cyan: '#e0ccff', glow: 'rgba(172,64,109,.18)', cool: 'rgba(133,84,169,.12)', fringe: 'repeating-linear-gradient(105deg,#e681a9 0 10px,#42243e 10px 22px,#c2a1ed 22px 25px)' } },
  { id: 'presidents-day', label: "Presidents' Day", group: 'civic', icon: '★', greeting: 'Discover the stories that shaped us', when: 'Third Monday in February', priority: 50, motifs: ['★', '☆', '★'], marks: ['terminal', 'star', 'tablet'], window: { type: 'nth-weekday', month: 2, weekday: 1, nth: 3 }, tokens: { gold: '#e8d9a8', goldBright: '#f4ebc8', cyan: '#b9d4f5', glow: 'rgba(140,110,50,.16)', cool: 'rgba(45,80,130,.16)', fringe: 'repeating-linear-gradient(90deg,#e8d9a8 0 14px,#1c2430 14px 28px,#3d5f8a 28px 32px)' } },
  { id: 'st-patricks', label: "St. Patrick's Day", group: 'seasonal', icon: '☘', greeting: 'A little luck. A lot of learning.', when: 'Mar 16–18', priority: 50, motifs: ['☘', '✧', '☘'], marks: ['shamrock', 'hex', 'terminal'], window: { type: 'annual', start: [3, 16], end: [3, 18] }, tokens: { gold: '#e1ec9e', goldBright: '#f0f6c7', cyan: '#a9efbe', glow: 'rgba(60,146,86,.18)', cool: 'rgba(141,158,54,.12)', fringe: 'repeating-linear-gradient(105deg,#315f3c 0 16px,#c6d777 16px 20px,#123e2e 20px 36px)' } },
  { id: 'easter', label: 'Easter', group: 'seasonal', icon: '✝', greeting: 'Hope, renewal, and new beginnings', when: 'Palm Sunday–Easter Monday', priority: 20, motifs: ['✝', '🌷', '✧'], marks: ['cross', 'bud', 'hex'], window: { type: 'easter-relative', from: -7, to: 1 }, tokens: { gold: '#ead3ff', goldBright: '#f5e8ff', cyan: '#a9efe2', glow: 'rgba(141,104,181,.18)', cool: 'rgba(70,151,124,.12)', fringe: 'repeating-linear-gradient(105deg,#bba0da 0 18px,#8bcbbb 18px 36px,#e7d6a7 36px 54px)' } },
  { id: 'memorial-day', label: 'Memorial Day', group: 'civic', icon: '★', greeting: 'Remember and honor', when: 'Friday–last Monday in May', priority: 30, motifs: ['★', '❧', '★'], marks: ['star', 'line', 'hex'], window: { type: 'nth-weekday', month: 5, weekday: 1, nth: 'last', from: -3, to: 0 }, tokens: { gold: '#e6d3a3', goldBright: '#f0e6c4', cyan: '#c9d4ce', glow: 'rgba(110,90,50,.12)', cool: 'rgba(40,55,70,.16)', fringe: 'linear-gradient(90deg,#2a3544,#e6d3a3,#1e2833)' } },
  { id: 'independence-day', label: 'Independence Day', group: 'civic', icon: '★', greeting: 'Celebrate independence and curiosity', when: 'Jul 1–5', priority: 30, motifs: ['★', '✦', '☆'], marks: ['burst', 'star', 'hex'], window: { type: 'annual', start: [7, 1], end: [7, 5] }, tokens: { gold: '#ffd38a', goldBright: '#ffe7b8', cyan: '#b2d7ff', glow: 'rgba(170,59,71,.14)', cool: 'rgba(63,121,192,.16)', fringe: 'repeating-linear-gradient(105deg,#ffd38a 0 12px,#f4efe4 12px 18px,#9c3546 18px 20px,#264b81 20px 32px)' } },
  { id: 'labor-day', label: 'Labor Day', group: 'civic', icon: '⚒', greeting: 'Celebrate the people who build', when: 'Friday–first Monday in September', priority: 30, motifs: ['⚒', '⚙', '✦'], marks: ['gear', 'hex', 'robot'], window: { type: 'nth-weekday', month: 9, weekday: 1, nth: 1, from: -3, to: 0 }, tokens: { gold: '#d8e7ff', goldBright: '#ecf3ff', cyan: '#a9e4f5', glow: 'rgba(63,118,174,.18)', cool: 'rgba(94,165,170,.12)', fringe: 'repeating-linear-gradient(105deg,#467a98 0 16px,#b2dce6 16px 20px,#e8c56e 20px 24px,#1b3347 24px 40px)' } },
  { id: 'halloween', label: 'Halloween', group: 'seasonal', icon: '🎃', greeting: 'A little spooky. A lot of Geek.', when: 'Oct 24–30', priority: 20, motifs: ['🎃', '☾', '✧'], marks: ['terminal', 'hex', 'robot'], window: { type: 'annual', start: [10, 24], end: [10, 30] }, tokens: { gold: '#ffbd70', goldBright: '#ffdaac', cyan: '#dfbbff', glow: 'rgba(166,91,38,.18)', cool: 'rgba(114,65,162,.17)', fringe: 'repeating-linear-gradient(105deg,#cf792d 0 18px,#27172e 18px 36px,#9e79bb 36px 40px)' } },
  { id: 'veterans-day', label: 'Veterans Day', group: 'civic', icon: '★', greeting: 'Honor those who served', when: 'Nov 10–12', priority: 50, motifs: ['★', '❧', '★'], marks: ['ribbon', 'star', 'line'], window: { type: 'annual', start: [11, 10], end: [11, 12] }, tokens: { gold: '#e6d3a3', goldBright: '#f3e8c6', cyan: '#b7cce8', glow: 'rgba(90,50,55,.12)', cool: 'rgba(40,70,110,.16)', fringe: 'linear-gradient(90deg,#6e3a42,#e6d3a3,#2c4d72)' } },
  { id: 'thanksgiving', label: 'Thanksgiving', group: 'seasonal', icon: '🍂', greeting: 'Grateful for every curious mind', when: 'Monday–Sunday of Thanksgiving week', priority: 30, motifs: ['🍂', '❧', '🍁'], marks: ['terminal', 'hex', 'robot'], window: { type: 'nth-weekday', month: 11, weekday: 4, nth: 4, from: -3, to: 3 }, tokens: { gold: '#ffd299', goldBright: '#ffe9cb', cyan: '#e4d2a1', glow: 'rgba(167,100,39,.18)', cool: 'rgba(146,116,68,.14)', fringe: 'repeating-linear-gradient(105deg,#9b5835 0 16px,#c6a259 16px 22px,#70e6dc 22px 24px,#493721 24px 40px)' } },
  { id: 'christmas', label: 'Christmas', group: 'seasonal', icon: '🎄', greeting: 'Merry Christmas, Geeks', when: 'Dec 1–26', priority: 20, motifs: ['❄', '✦', '🎄'], marks: ['tree', 'hex', 'star'], window: { type: 'annual', start: [12, 1], end: [12, 26] }, tokens: { gold: '#ffe2a3', goldBright: '#fff0d0', cyan: '#92e7b6', glow: 'rgba(157,51,60,.16)', cool: 'rgba(44,127,76,.20)', fringe: 'repeating-linear-gradient(105deg,#963544 0 16px,#e8e0c5 16px 22px,#2b6247 22px 38px,#e8e0c5 38px 44px)' } },
  {
    id: 'kaspa-birthday', label: "Kaspa's Birthday", group: 'kaspa', icon: '✦', greeting: 'Happy Birthday, Kaspa.', when: 'Nov 6–8', priority: 90,
    motifs: ['✦', '◇', '⬡'], marks: ['candle', 'hex', 'robot'], window: { type: 'annual', start: [11, 6], end: [11, 8] },
    tokens: { gold: '#c8fff4', goldBright: '#e7fffb', cyan: '#49eacb', glow: 'rgba(73,234,203,.20)', cool: 'rgba(56,147,135,.16)', fringe: 'repeating-linear-gradient(105deg,#49eacb 0 8px,#0b1210 8px 16px,#c8fff4 16px 20px)' },
    source: 'https://wiki.kaspa.org/en/tokenomics'
  },
  {
    id: 'bitcoin-genesis', label: 'Bitcoin Genesis', group: 'bitcoin', icon: '▣', greeting: 'The first block.', when: 'Jan 3', priority: 70,
    motifs: ['▣', '✦', '▣'], marks: ['tablet', 'spark', 'hex'], window: { type: 'one-day', month: 1, day: 3 },
    tokens: { gold: '#ffe19b', goldBright: '#fff0c4', cyan: '#c8d8ff', glow: 'rgba(157,121,48,.16)', cool: 'rgba(30,45,90,.20)', fringe: 'repeating-linear-gradient(90deg,#142033 0 16px,#ffe19b 16px 20px,#1a1a1a 20px 36px)' },
    source: 'https://help.blockstream.com/education/glossary/genesis-block'
  },
  {
    id: 'bitcoin-pizza-day', label: 'Bitcoin Pizza Day', group: 'bitcoin', icon: '◔', greeting: 'A first meal, paid on a new network.', when: 'May 22', priority: 70,
    motifs: ['◔', '▭', '✦'], marks: ['pizza', 'hex', 'tablet'], window: { type: 'one-day', month: 5, day: 22 },
    tokens: { gold: '#ffc48a', goldBright: '#ffe0c0', cyan: '#f0d0a0', glow: 'rgba(170,90,30,.18)', cool: 'rgba(120,80,40,.12)', fringe: 'repeating-linear-gradient(105deg,#ffc48a 0 12px,#6b3e22 12px 24px,#70e6dc 24px 26px)' },
    source: 'https://www.guinnessworldrecords.com/world-records/696240-first-commercial-bitcoin-transaction'
  },
  {
    id: 'ethereum-launch', label: 'Ethereum Launch', group: 'ethereum', icon: '◆', greeting: 'A world computer, still being learned.', when: 'Jul 29–31', priority: 70,
    motifs: ['◆', '✦', '◇'], marks: ['diamond', 'hex', 'dag'], window: { type: 'annual', start: [7, 29], end: [7, 31] },
    tokens: { gold: '#c9b6ff', goldBright: '#e4d9ff', cyan: '#70e6dc', glow: 'rgba(120,90,180,.16)', cool: 'rgba(56,147,135,.12)', fringe: 'repeating-linear-gradient(105deg,#c9b6ff 0 12px,#121816 12px 24px,#70e6dc 24px 28px)' },
    source: 'https://blog.ethereum.org/2015/07/30/ethereum-launches'
  },
  {
    id: 'krc20-launch', label: 'KRC-20 Launch', group: 'kaspa', icon: '⌬', greeting: 'Tokens on Kaspa, made for building.', when: 'Sep 14–16', priority: 80,
    motifs: ['⌬', '▣', '✦'], marks: ['tablet', 'seal', 'hex'], window: { type: 'annual', start: [9, 14], end: [9, 16] },
    tokens: { gold: '#c8fff4', goldBright: '#e7fffb', cyan: '#70e6dc', glow: 'rgba(73,234,203,.16)', cool: 'rgba(80,120,160,.12)', fringe: 'repeating-linear-gradient(105deg,#70e6dc 0 6px,#123038 6px 16px,#e8c56e 16px 18px,#123038 18px 30px)' },
    source: 'https://minerbases.com/krc-20-mainnet-launch-announcement/'
  },
  {
    id: 'bitcoin-whitepaper', label: 'Bitcoin Whitepaper Day', group: 'bitcoin', icon: '§', greeting: 'A peer-to-peer electronic cash system.', when: 'Oct 31', priority: 70,
    motifs: ['§', '✦', '¶'], marks: ['tablet', 'dag', 'hex'], window: { type: 'one-day', month: 10, day: 31 },
    tokens: { gold: '#e7dfc8', goldBright: '#f4efdc', cyan: '#d4c8a0', glow: 'rgba(150,130,70,.16)', cool: 'rgba(50,45,30,.14)', fringe: 'repeating-linear-gradient(90deg,#3a3224 0 12px,#e7dfc8 12px 14px,#2a241c 14px 26px)' },
    source: 'https://www.metzdowd.com/pipermail/cryptography/2008-October/014810.html'
  },
  {
    id: 'crescendo', label: 'Crescendo', group: 'kaspa', icon: '♩', greeting: 'Ten blocks a second.', when: 'May 4–6', priority: 80,
    motifs: ['♩', '♪', '✦'], marks: ['staff', 'hex', 'dag'], window: { type: 'annual', start: [5, 4], end: [5, 6] },
    tokens: { gold: '#c8fff4', goldBright: '#e7fffb', cyan: '#7dfff0', glow: 'rgba(73,234,203,.20)', cool: 'rgba(40,100,120,.14)', fringe: 'repeating-linear-gradient(105deg,#49eacb 0 4px,#0d1c18 4px 12px,#49eacb 12px 20px,#0d1c18 20px 26px,#7dfff0 26px 34px)' },
    source: 'https://github.com/kaspanet/rusty-kaspa/releases/tag/v1.0.0'
  },
  {
    // Named day is June 22 in America/Detroit. deploymentHash is the canonical pin in server/geek-deployment.js, not a second hash.
    id: 'geek-birthday', label: "Geek Protocol's Birthday", group: 'geek', icon: '✦', greeting: 'Deployed on Kaspa. Built for curious minds.', when: 'Jun 21–23', priority: 90,
    motifs: ['✦', '⬡', '◇'], marks: ['robot', 'candle', 'tablet'], window: { type: 'annual', start: [6, 21], end: [6, 23] },
    deploymentHash: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1',
    tokens: { gold: '#e8c56e', goldBright: '#f3df9a', cyan: '#c8fff4', glow: 'rgba(73,234,203,.20)', cool: 'rgba(180,140,50,.14)', fringe: 'repeating-linear-gradient(105deg,#6fc7ba 0 10px,#0b1210 10px 20px,#e8c56e 20px 24px,#b9f1e2 24px 28px)' },
    source: 'https://api.kasplex.org/v1/krc20/token/GEEK'
  },
  {
    id: 'toccata', label: 'Toccata', group: 'kaspa', icon: '♫', greeting: 'Programmability on the first layer.', when: 'Jun 29–30', priority: 80,
    motifs: ['♫', '♩', '✦'], marks: ['keys', 'hex', 'diamond'], window: { type: 'annual', start: [6, 29], end: [6, 30] },
    tokens: { gold: '#e8c56e', goldBright: '#f3df9a', cyan: '#70e6dc', glow: 'rgba(180,140,50,.16)', cool: 'rgba(56,147,135,.16)', fringe: 'repeating-linear-gradient(105deg,#e8c56e 0 8px,#12302c 8px 18px,#70e6dc 18px 22px,#12302c 22px 34px)' },
    source: 'https://kaspa.org/lore'
  },
  {
    id: 'satoshi-birthday', label: "Satoshi's Birthday", group: 'bitcoin', icon: '✧', greeting: 'For the curious minds who start things.', when: 'Apr 5', priority: 0, manualOnly: true,
    motifs: ['✧', '·', '✧'], marks: ['candle', 'tablet', 'hex'], window: { type: 'one-day', month: 4, day: 5 },
    tokens: { gold: '#e8d9a8', goldBright: '#f4ebc8', cyan: '#b9e4dc', glow: 'rgba(120,100,50,.12)', cool: 'rgba(40,80,80,.12)', fringe: 'linear-gradient(90deg,#24302e,#e8d9a8,#1c2424)' },
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
