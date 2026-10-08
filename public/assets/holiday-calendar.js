// Shared display catalog and celebration dates; no operator configuration lives here.
export const HOLIDAY_TIMEZONE = 'America/Detroit';
export const HOLIDAYS = Object.freeze([
  { id: 'new-year', label: "New Year's", icon: '✦', greeting: 'A new year of discovery', palette: 'gold', when: 'Dec 29–Jan 2' },
  { id: 'mlk-day', label: 'Martin Luther King Jr. Day', icon: '🕊', greeting: 'Keep learning. Keep dreaming.', palette: 'blue', when: 'Third Monday in January' },
  { id: 'valentines', label: "Valentine's Day", icon: '♡', greeting: 'Share a little knowledge and kindness', palette: 'rose', when: 'Feb 12–15' },
  { id: 'presidents-day', label: "Presidents' Day", icon: '★', greeting: 'Discover the stories that shaped us', palette: 'patriotic', when: 'Third Monday in February' },
  { id: 'st-patricks', label: "St. Patrick's Day", icon: '☘', greeting: 'A little luck. A lot of learning.', palette: 'green', when: 'Mar 16–18' },
  { id: 'easter', label: 'Easter', icon: '✝', greeting: 'Hope, renewal, and new beginnings', palette: 'spring', when: 'Palm Sunday–Easter Monday' },
  { id: 'memorial-day', label: 'Memorial Day', icon: '★', greeting: 'Remember and honor', palette: 'patriotic', when: 'Friday–last Monday in May' },
  { id: 'juneteenth', label: 'Juneteenth', icon: '✦', greeting: 'Celebrate freedom. Keep discovering.', palette: 'green', when: 'Jun 18–20' },
  { id: 'independence-day', label: 'Independence Day', icon: '★', greeting: 'Celebrate independence and curiosity', palette: 'patriotic', when: 'Jul 1–5' },
  { id: 'labor-day', label: 'Labor Day', icon: '⚒', greeting: 'Celebrate the people who build', palette: 'blue', when: 'Friday–first Monday in September' },
  { id: 'halloween', label: 'Halloween', icon: '🎃', greeting: 'A little spooky. A lot of Geek.', palette: 'autumn', when: 'Oct 24–31' },
  { id: 'veterans-day', label: 'Veterans Day', icon: '★', greeting: 'Honor those who served', palette: 'patriotic', when: 'Nov 10–12' },
  { id: 'thanksgiving', label: 'Thanksgiving', icon: '🍂', greeting: 'Grateful for every curious mind', palette: 'harvest', when: 'Monday–Sunday of Thanksgiving week' },
  { id: 'christmas', label: 'Christmas', icon: '🎄', greeting: 'Merry Christmas, Geeks', palette: 'christmas', when: 'Dec 1–26' }
].map(Object.freeze));
export const holidayById = id => HOLIDAYS.find(holiday => holiday.id === id) || null;
const DAY = 86_400_000;
const date = (year, month, day) => Date.UTC(year, month - 1, day);
const iso = value => new Date(value).toISOString().slice(0, 10);
const nthMonday = (year, month, nth) => { const first = date(year, month, 1); return first + (((8 - new Date(first).getUTCDay()) % 7) + (nth - 1) * 7) * DAY; };
const lastMonday = (year, month) => { const last = Date.UTC(year, month, 0); return last - ((new Date(last).getUTCDay() + 6) % 7) * DAY; };
// Gregorian computus; this is the Western Easter calendar.
export const easterDay = year => {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return date(year, month, day);
};
export const localHolidayDay = (now = Date.now()) => {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: HOLIDAY_TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(now)).filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
  return date(parts.year, parts.month, parts.day);
};
export const holidayWindows = year => {
  const thanksgiving = date(year, 11, 1) + (((11 - new Date(date(year, 11, 1)).getUTCDay()) % 7) + 21) * DAY;
  const memorial = lastMonday(year, 5), labor = nthMonday(year, 9, 1), easter = easterDay(year);
  const ranges = {
    'new-year': [date(year - 1, 12, 29), date(year, 1, 2)],
    'mlk-day': [nthMonday(year, 1, 3), nthMonday(year, 1, 3)],
    valentines: [date(year, 2, 12), date(year, 2, 15)],
    'presidents-day': [nthMonday(year, 2, 3), nthMonday(year, 2, 3)],
    'st-patricks': [date(year, 3, 16), date(year, 3, 18)], easter: [easter - 7 * DAY, easter + DAY],
    'memorial-day': [memorial - 3 * DAY, memorial], juneteenth: [date(year, 6, 18), date(year, 6, 20)],
    'independence-day': [date(year, 7, 1), date(year, 7, 5)], 'labor-day': [labor - 3 * DAY, labor],
    halloween: [date(year, 10, 24), date(year, 10, 31)], 'veterans-day': [date(year, 11, 10), date(year, 11, 12)],
    thanksgiving: [thanksgiving - 3 * DAY, thanksgiving + 3 * DAY], christmas: [date(year, 12, 1), date(year, 12, 26)]
  };
  return HOLIDAYS.map(holiday => ({ ...holiday, start: iso(ranges[holiday.id][0]), end: iso(ranges[holiday.id][1]) }));
};
export const automaticHoliday = (now = Date.now()) => {
  const day = localHolidayDay(now), year = new Date(day).getUTCFullYear(), today = iso(day);
  // Adjacent years cover New Year's window across the December boundary.
  return [year - 1, year, year + 1].flatMap(holidayWindows).filter(window => window.start <= today && window.end >= today).sort((a, b) => (Date.parse(a.end) - Date.parse(a.start)) - (Date.parse(b.end) - Date.parse(b.start)) || a.id.localeCompare(b.id))[0] || null;
};
export const effectiveHoliday = (config, now = Date.now()) => config.mode === 'manual' ? holidayById(config.holiday) : config.mode === 'auto' ? automaticHoliday(now) : null;
export const upcomingHolidayWindows = (now = Date.now()) => {
  const day = localHolidayDay(now), year = new Date(day).getUTCFullYear(), today = iso(day);
  return [year, year + 1].flatMap(holidayWindows).filter(window => window.end >= today).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 6);
};
