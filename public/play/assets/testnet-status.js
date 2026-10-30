const panel = document.querySelector('[data-testnet-status]');
const dashboard = document.querySelectorAll('[data-testnet-dashboard]')[0];
const find = selector => dashboard?.querySelector(selector);
const badge = find('[data-testnet-badge]'), details = find('[data-testnet-details]');
const checked = find('[data-testnet-checked]'), reload = find('[data-testnet-refresh]');
let timer, controller, generation = 0, followUp = false, accountReady = false;
const clearPanel = () => {
  if (panel) { panel.hidden = true; panel.textContent = ''; }
  if (dashboard) { dashboard.hidden = true; details.replaceChildren(); checked.textContent = ''; badge.textContent = ''; }
};
const paymentLabel = state => ({ queued: 'Queued', prepared: 'Prepared', 'awaiting-indexer': 'Awaiting confirmation', 'indexed-confirmed': 'Confirmed by indexer' })[state];
const renderDetails = latest => {
  if (!dashboard) return;
  details.replaceChildren();
  if (!latest) return;
  const add = (label, value) => {
    const term = document.createElement('dt'), description = document.createElement('dd');
    term.textContent = label; description.textContent = value; details.append(term, description);
  };
  // Format raw units exactly; never round token amounts through Number.
  if (/^[0-9]{1,40}$/.test(latest.amount || '') && /^(?:[0-9]|1[0-8])$/.test(String(latest.decimals)) && /^[A-Z]{4,6}$/.test(latest.ticker || '')) {
    const decimals = Number(latest.decimals), raw = BigInt(latest.amount).toString().padStart(decimals + 1, '0');
    const fraction = decimals ? raw.slice(-decimals).replace(/0+$/, '') : '';
    add('Amount', `${decimals ? raw.slice(0, -decimals) : raw}${fraction ? `.${fraction}` : ''} ${latest.ticker} · Testnet-10`);
  }
  add('Payment stage', latest.serviceRetriesStopped ? 'Service retries stopped · receipt retained' : paymentLabel(latest.state));
  if (latest.freshTest) add('Attempt', 'Fresh test · original receipt retained');
  if (Number.isSafeInteger(latest.createdAt) && latest.createdAt > 0) add('Saved', new Date(latest.createdAt).toLocaleString());
  if (latest.recipient) add('Original receiving address', latest.recipient);
  if (latest.transactionHash) add('Reveal transaction', latest.transactionHash);
};
const suspend = () => {
  generation += 1; controller?.abort(); controller = null; followUp = false;
  clearTimeout(timer); clearPanel();
};
// The rewards read is private to an account session, so it never runs for visitors without one.
// The passkey status GET reports whether this browser already has a signed-in account without
// creating anything; a 401 means there is no session at all. No session is bootstrapped here
// (issue #199), and guests see no panel, no dashboard, and make no rewards request (issue #183).
const ensureAccount = async signal => {
  if (accountReady) return true;
  const response = await fetch('/api/passkeys/', { credentials: 'same-origin', cache: 'no-store', signal });
  if (response.status === 401) return false;
  if (!response.ok) throw new Error('STATUS_UNAVAILABLE');
  const payload = await response.json();
  if (!payload.ok) throw new Error('STATUS_UNAVAILABLE');
  accountReady = Boolean(payload.signedIn || payload.walletLinked);
  return accountReady;
};
async function refresh() {
  if (!panel || document.hidden) return;
  if (controller) { followUp = true; return; }
  clearTimeout(timer); const version = generation, request = new AbortController(); controller = request;
  if (dashboard) { reload.disabled = true; dashboard.setAttribute('aria-busy', 'true'); }
  const deadline = setTimeout(() => request.abort(), 10000);
  let retry = true;
  try {
    if (!await ensureAccount(request.signal)) { retry = false; clearPanel(); return; }
    const response = await fetch('/api/rewards/?service=testnet', { credentials: 'same-origin', cache: 'no-store', signal: request.signal });
    if (version !== generation) return;
    if (response.status === 401 || response.status === 403) { retry = false; accountReady = false; clearPanel(); return; }
    if (!response.ok) throw new Error('STATUS_UNAVAILABLE');
    const payload = await response.json();
    if (version !== generation) return;
    if (!payload.ok || !Array.isArray(payload.records)) throw new Error('STATUS_UNAVAILABLE');
    const latest = payload.records[0];
    if (latest && !paymentLabel(latest.state)) throw new Error('STATUS_UNAVAILABLE');
    if (!payload.enrollment && !latest && !dashboard) { retry = false; clearPanel(); return; }
    panel.hidden = false;
    panel.textContent = latest
      ? latest.serviceRetriesStopped ? 'The earlier test receipt is retained. Our service has stopped retrying that attempt.'
        : latest.state === 'indexed-confirmed' ? 'GEEKT test reward confirmed by the indexer. View its details in Rewards.'
        : !payload.enabled ? 'Your test reward is saved. Automatic rewards are paused; no wallet action is needed.'
          : latest.state === 'queued' ? 'Your test reward is queued for the automatic reward service. No wallet action is needed.'
          : latest.state === 'prepared' ? 'Your test reward is prepared. Our service will handle submission and confirmation. No wallet action is needed.'
            : 'Your test reward is awaiting indexer confirmation. No wallet action is needed.'
      : payload.enabled && payload.enrollment?.enabled ? 'Complete today’s eligible Kaspa Daily. Approved GEEKT test rewards are handled automatically.'
        : payload.enrollment ? 'Your GEEKT test enrollment is saved. New automatic rewards are currently paused.'
          : 'No test reward is queued for this account. Saving an address does not enroll you in the approved test pilot.';
    if (dashboard) {
      renderDetails(latest); dashboard.hidden = false;
      badge.textContent = latest ? latest.serviceRetriesStopped ? 'Retries stopped' : latest.state !== 'indexed-confirmed' && !payload.enabled ? 'Saved · service paused' : paymentLabel(latest.state) : 'No test reward yet';
      checked.textContent = `Status checked at ${new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}.`;
      dashboard.dataset.testnetState = latest?.state || 'empty';
    }
  } catch {
    if (version === generation && (dashboard || !panel.hidden)) {
      panel.hidden = false; panel.textContent = 'Test reward status is unavailable. We’ll check again automatically; you can also refresh.';
      if (dashboard) {
        dashboard.hidden = false; badge.textContent = 'Status unavailable'; dashboard.dataset.testnetState = 'unavailable';
        checked.textContent = checked.textContent ? 'Showing the last loaded payment details. Current confirmation is unavailable.' : 'No current payment status could be loaded.';
      }
    }
  }
  finally {
    clearTimeout(deadline);
    if (version === generation) {
      controller = null;
      if (dashboard) { reload.disabled = false; dashboard.setAttribute('aria-busy', 'false'); }
      if (followUp) { followUp = false; refresh(); }
      else if (retry && !document.hidden) timer = setTimeout(refresh, 15000);
    }
  }
}
window.addEventListener('geek:run-saved', refresh);
for (const name of ['geek:signed-in', 'geek:passkey-signed-in', 'geek:device-signed-in']) document.addEventListener(name, () => { suspend(); refresh(); });
document.addEventListener('geek:signed-out', () => { accountReady = false; suspend(); });
window.addEventListener('geek:receiving-address-saved', refresh);
reload?.addEventListener('click', refresh);
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) suspend(); else refresh(); });
refresh();
