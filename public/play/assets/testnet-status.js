const panel = document.querySelector('[data-testnet-status]');
let timer, controller, generation = 0, followUp = false;
const clearPanel = () => { if (panel) { panel.hidden = true; panel.textContent = ''; } };
const suspend = () => {
  generation += 1; controller?.abort(); controller = null; followUp = false;
  clearTimeout(timer); clearPanel();
};
async function refresh() {
  if (!panel || document.hidden) return;
  if (controller) { followUp = true; return; }
  clearTimeout(timer); const version = generation, request = new AbortController(); controller = request;
  const deadline = setTimeout(() => request.abort(), 10000);
  let retry = true;
  try {
    const response = await fetch('/api/rewards/?service=testnet', { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
    if (version !== generation) return;
    if (response.status === 401 || response.status === 403) { retry = false; clearPanel(); return; }
    if (!response.ok) throw new Error('STATUS_UNAVAILABLE');
    const payload = await response.json();
    if (version !== generation) return;
    if (!payload.ok || !Array.isArray(payload.records)) throw new Error('STATUS_UNAVAILABLE');
    if (!payload.enrollment && !payload.records.length) { retry = false; clearPanel(); return; }
    panel.hidden = false;
    const latest = payload.records[0];
    panel.textContent = latest
      ? latest.state === 'indexed-confirmed' ? 'GEEKT test reward received. Your payment is recorded in My HQ.'
        : !payload.enabled ? 'Your test reward is saved. Automatic rewards are paused; no wallet action is needed.'
          : latest.state === 'queued' ? 'Your test reward is queued for the automatic reward service. No wallet action is needed.'
          : 'Your test reward is being confirmed. No wallet action is needed.'
      : payload.enabled && payload.enrollment?.enabled ? 'Complete today’s eligible Kaspa Daily. Your GEEKT test reward is sent automatically.'
        : 'Your GEEKT test enrollment is saved. New automatic rewards are currently paused.';
  } catch { if (version === generation && !panel.hidden) panel.textContent = 'Test reward status is unavailable. Your saved payment will be checked when service returns.'; }
  finally {
    clearTimeout(deadline);
    if (version === generation) {
      controller = null;
      if (followUp) { followUp = false; refresh(); }
      else if (retry && !document.hidden) timer = setTimeout(refresh, 15000);
    }
  }
}
window.addEventListener('geek:run-saved', refresh);
document.addEventListener('geek:signed-in', () => { suspend(); refresh(); });
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else refresh(); });
refresh();
