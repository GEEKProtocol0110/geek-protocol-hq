import { holidayById } from './holiday-calendar.js';

export const initHolidayTheme = ({ fetchImpl = globalThis.fetch } = {}) => {
  const root = document.documentElement;
  let active = null, timer = null, stopped = false, generation = 0, lastRead = 0, stylesheet = null;
  const clear = () => { delete root.dataset.holidayTheme; document.querySelectorAll('.holiday-brand-mark').forEach(mark => mark.remove()); };
  const apply = id => {
    const holiday = holidayById(id);
    clear();
    if (!holiday) return;
    if (!stylesheet) { stylesheet = document.createElement('link'); stylesheet.rel = 'stylesheet'; stylesheet.href = '/assets/holiday-theme.css'; document.head.append(stylesheet); }
    root.dataset.holidayTheme = holiday.id;
    const brand = document.querySelector('.site-header .brand, .game-header .brand');
    if (brand) { const mark = document.createElement('span'); mark.className = 'holiday-brand-mark'; mark.textContent = holiday.icon; mark.setAttribute('aria-hidden', 'true'); mark.title = `${holiday.label} at Geek HQ`; brand.append(mark); }
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
