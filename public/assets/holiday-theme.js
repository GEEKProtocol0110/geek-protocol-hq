import { holidayById } from './holiday-calendar.js';

// Fixed seasonal motifs; neither settings nor responses can provide markup/URLs.
const motifs = Object.freeze({
  'new-year': ['✦', '✧', '✦'], valentines: ['♡', '♥', '♡'],
  'presidents-day': ['★', '☆', '★'], 'st-patricks': ['☘', '✧', '☘'],
  easter: ['✝', '🌷', '✧'], 'memorial-day': ['★', '❧', '★'],
  'independence-day': ['★', '✦', '☆'], 'labor-day': ['⚒', '⚙', '✦'],
  halloween: ['🎃', '☾', '✧'], 'veterans-day': ['★', '❧', '★'],
  thanksgiving: ['🍂', '❧', '🍁'], christmas: ['❄', '✦', '🎄']
});

export const initHolidayTheme = ({ fetchImpl = globalThis.fetch } = {}) => {
  const root = document.documentElement;
  let active = null, timer = null, stopped = false, generation = 0, lastRead = 0, stylesheet = null, applied = null;
  const announce = () => document.dispatchEvent(new Event('geek:holiday-change'));
  const clear = () => { applied = null; delete root.dataset.holidayTheme; document.querySelectorAll('.holiday-brand-mark, .holiday-atmosphere').forEach(mark => mark.remove()); announce(); };
  const apply = id => {
    const holiday = holidayById(id);
    if (holiday && applied === holiday.id) return;
    clear();
    if (!holiday) return;
    if (!stylesheet) { stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/assets/holiday-theme.css'; document.head.append(stylesheet); }
    root.dataset.holidayTheme = holiday.id;
    applied = holiday.id;
    const brand = document.querySelector('.site-header .brand, .game-header .brand');
    if (brand) { const mark = document.createElement('span'); mark.className = 'holiday-brand-mark'; mark.textContent = holiday.icon; mark.setAttribute('aria-hidden', 'true'); mark.title = `${holiday.label} at Geek HQ`; brand.append(mark); }
    const scene = document.createElement('div'); scene.className = 'holiday-atmosphere'; scene.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 12; i++) { const symbol = document.createElement('span'); symbol.textContent = motifs[holiday.id][i % 3]; scene.append(symbol); }
    document.body.append(scene); announce();
  };
  const refresh = async () => {
    clearTimeout(timer);
    if (stopped || document.hidden || active) return;
    const version = generation, controller = new AbortController(); active = controller;
    const timeout = setTimeout(() => controller.abort(), 5000); lastRead = Date.now();
    try {
      const response = await fetchImpl('/api/appearance/', { credentials: 'omit', signal: controller.signal, cache: 'default' });
      const payload = await response.json();
      if (version !== generation || stopped || controller.signal.aborted) return;
      if (!response.ok || payload.ok !== true) throw new Error('Appearance unavailable');
      apply(payload.theme?.id);
    } catch { if (version === generation) clear(); }
    finally {
      clearTimeout(timeout); if (active === controller) active = null;
      if (!stopped && !document.hidden && version === generation) timer = setTimeout(refresh, 60_000);
    }
  };
  const pause = () => { generation += 1; clearTimeout(timer); active?.abort(); active = null; };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
    else if (Date.now() - lastRead >= 30_000) refresh();
    else { clearTimeout(timer); timer = setTimeout(refresh, Math.max(1000, 60_000 - (Date.now() - lastRead))); }
  });
  window.addEventListener('pagehide', () => { stopped = true; pause(); });
  window.addEventListener('pageshow', event => { if (event.persisted) { stopped = false; refresh(); } });
  refresh();
};
