const panel = document.querySelector('[data-testnet-status]');
let timer, controller, generation = 0;
async function refresh() {
  if (!panel || document.hidden || controller) return;
  clearTimeout(timer); const version = generation; controller = new AbortController();
  const deadline = setTimeout(() => controller?.abort(), 10000);
  try {
    const response = await fetch('/api/rewards?service=testnet', { credentials: 'same-origin', cache: 'no-store', signal: controller.signal });
    if (!response.ok) return;
    const payload = await response.json();
    if (version !== generation || !payload.ok || !payload.enrollment) return;
    panel.hidden = false;
    const latest = payload.records[0];
    panel.textContent = latest
      ? latest.state === 'indexed-confirmed' ? 'Test reward confirmed by the indexer. Your GEEKT payment is recorded.'
        : latest.state === 'queued' ? 'Your test reward is queued. It will be sent automatically by the reward service.'
          : 'Your test reward is being confirmed. No wallet action is needed.'
      : payload.enabled && payload.enrollment.enabled ? 'You’re enrolled for automatic GEEKT test rewards on eligible Kaspa Dailies.'
        : 'Your GEEKT test enrollment is saved. Automatic rewards are currently paused.';
    if (latest && latest.state !== 'indexed-confirmed') timer = setTimeout(refresh, 15000);
  } catch { if (version === generation && !panel.hidden) panel.textContent = 'Test reward status is unavailable. Your saved payment will be checked when service returns.'; }
  finally { clearTimeout(deadline); if (version === generation) controller = null; }
}
window.addEventListener('geek:run-saved', refresh);
window.addEventListener('pagehide', () => { generation += 1; controller?.abort(); controller = null; clearTimeout(timer); if (panel) { panel.hidden = true; panel.textContent = ''; } });
window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearTimeout(timer); else refresh(); });
refresh();
