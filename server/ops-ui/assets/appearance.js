import { ownerClient } from './ops-core.js';
import { HOLIDAYS, holidayById, effectiveHoliday, holidayWindows, HOLIDAY_TIMEZONE } from '/assets/holiday-calendar.js';

export const appearancePanel = ({ isReady, onExpired }) => {
  const root = document.querySelector('[data-appearance-root]');
  if (!root) return null;
  const $ = selector => root.querySelector(selector);
  const form = $('[data-appearance-form]'), fields = $('[data-appearance-fields]'), refresh = $('[data-appearance-refresh]');
  const mode = form.elements.mode, holiday = form.elements.holiday, message = $('[data-appearance-message]');
  const preview = $('[data-appearance-preview]');
  const client = ownerClient({ endpoint: '/api/session/?service=operations&action=appearance' });
  let revision = null, busy = false, epoch = 0;
  HOLIDAYS.forEach(item => { const option = document.createElement('option'); option.value = item.id; option.textContent = item.label; holiday.append(option); });
  const updatePreview = () => {
    $('[data-holiday-choice]').hidden = mode.value !== 'manual';
    const active = effectiveHoliday({ mode: mode.value, holiday: holiday.value });
    if (active) preview.dataset.holidayTheme = active.id; else delete preview.dataset.holidayTheme;
    preview.setAttribute('aria-label', `${active?.label || 'Standard Geek HQ'} appearance preview`);
    $('[data-preview-icon]').textContent = active?.icon || '✦';
    $('[data-preview-title]').textContent = active?.greeting || 'Level up your curiosity.';
    $('[data-preview-copy]').textContent = active ? `${active.label} at Geek HQ` : 'Standard Geek HQ';
    $('[data-mode-description]').textContent = mode.value === 'off' ? 'Keep the regular Geek HQ appearance.' : mode.value === 'manual' ? 'This holiday stays on until you switch to Automatic or Off.' : `Show holiday styles during the calendar windows in ${HOLIDAY_TIMEZONE}. Between holidays, use the standard appearance.`;
  };
  const setBusy = value => { busy = value; fields.disabled = value || revision === null || !isReady(); refresh.disabled = value || !isReady(); };
  const clear = () => {
    epoch += 1; client.clear(); revision = null; busy = false;
    fields.disabled = true; refresh.disabled = true;
    mode.value = 'off'; updatePreview();
    $('[data-saved-theme]').textContent = 'Saved settings are hidden until owner access is checked.';
    document.querySelector('[data-holiday-calendar]').replaceChildren(); message.textContent = '';
  };
  const renderCalendar = () => {
    const year = Number(new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: HOLIDAY_TIMEZONE }).format(new Date()));
    const calendar = document.querySelector('[data-holiday-calendar]'); calendar.replaceChildren();
    const table = document.createElement('table'), caption = document.createElement('caption'); caption.textContent = `${year} celebration windows`; table.append(caption);
    const head = table.createTHead().insertRow(); ['Holiday', 'Automatic window'].forEach(text => { const cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = text; head.append(cell); });
    const body = table.createTBody();
    holidayWindows(year).forEach(item => { const row = body.insertRow(); const name = document.createElement('th'); name.scope = 'row'; name.textContent = item.label; row.append(name); const when = row.insertCell(); when.textContent = item.start === item.end ? item.start : `${item.start} → ${item.end}`; });
    calendar.append(table);
  };
  const render = payload => {
    revision = payload.config.revision; mode.value = payload.config.mode; holiday.value = payload.config.holiday || 'christmas'; updatePreview(); renderCalendar();
    const description = payload.config.mode === 'off' ? 'Off · Standard Geek HQ' : payload.config.mode === 'auto' ? `Automatic · ${payload.active?.label || 'Standard appearance today'}` : `On · ${holidayById(payload.config.holiday)?.label}`;
    $('[data-saved-theme]').textContent = `Saved: ${description}${payload.config.updatedAt ? ` · ${new Date(payload.config.updatedAt).toLocaleString()}` : ''}`;
  };
  const load = async () => {
    if (busy || !isReady()) return;
    const version = epoch; revision = null; setBusy(true); message.textContent = 'Loading saved settings…';
    try { const payload = await client.request(); if (version !== epoch) return; render(payload); message.textContent = 'Settings loaded. Choose a style and save when ready.'; }
    catch (error) { if (version !== epoch) return; if ([401, 403].includes(error.status)) { onExpired(); return; } message.textContent = error.message || 'Settings unavailable. Refresh to try again.'; }
    finally { if (version === epoch) setBusy(false); }
  };
  mode.addEventListener('change', updatePreview); holiday.addEventListener('change', updatePreview);
  refresh.addEventListener('click', load);
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (busy || revision === null || !isReady()) return;
    const version = epoch; setBusy(true); message.textContent = 'Saving holiday settings…';
    try {
      const payload = await client.request({ method: 'POST', body: { mode: mode.value, holiday: mode.value === 'manual' ? holiday.value : null, expectedRevision: revision } });
      if (version !== epoch) return; render(payload); message.textContent = 'Saved. The public site will pick up this appearance within about 90 seconds.';
    } catch (error) {
      if (version !== epoch) return; revision = null;
      if ([401, 403].includes(error.status)) { onExpired(); return; }
      message.textContent = `${error.message || 'Save response unavailable.'} Refresh settings before saving again; the change may already have been saved.`;
    } finally { if (version === epoch) setBusy(false); }
  });
  updatePreview();
  return { lock: clear, load, enableRefresh: () => { if (!busy && isReady()) refresh.disabled = false; } };
};
