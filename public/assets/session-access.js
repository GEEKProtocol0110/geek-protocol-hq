// Shared by visible account controls; no wallet prompt or guest session creation.
(() => {
  const buttons = [...document.querySelectorAll('[data-sign-out]')];
  if (!buttons.length) return;
  const messages = [...document.querySelectorAll('[data-sign-out-status]')];
  let pending = false, signedOut = false, revision = 0;
  const show = visible => buttons.forEach(button => { button.hidden = !visible; });
  const message = text => messages.forEach(node => { node.textContent = text; });
  // Last known session state survives page loads so a 429/5xx status check never looks like sign-out.
  const KEY = 'geek:last-session-state', CHECKED = 'geek:last-session-checked', FRESH_MS = 15000;
  const store = () => { try { return window.sessionStorage || null; } catch { return null; } };
  const recall = () => { try { return store()?.getItem(KEY) ?? null; } catch { return null; } };
  const remember = signedIn => { try { store()?.setItem(KEY, signedIn ? 'signed-in' : 'signed-out'); store()?.setItem(CHECKED, String(Date.now())); } catch {} };
  const fresh = () => { try { return Date.now() - Number(store()?.getItem(CHECKED) || 0) < FRESH_MS; } catch { return false; } };
  // Seconds from Retry-After, or from the body's retryAfter / reset (epoch ms). Always a bounded number.
  const retrySeconds = (response, payload) => {
    const header = Number.parseInt(response?.headers?.get?.('Retry-After') ?? '', 10);
    const fromReset = Number(payload?.reset) > 0 ? Math.ceil((Number(payload.reset) - Date.now()) / 1000) : NaN;
    const value = [header, Number(payload?.retryAfter), fromReset].find(n => Number.isFinite(n) && n > 0);
    return Math.min(3600, Math.max(1, Math.round(value || 60)));
  };
  let retryTimer = null;
  const unknown = (seconds = null) => {
    if (recall() === 'signed-in') show(true);
    message(seconds === null ? 'We couldn’t check your sign-in right now. Your session has not changed. Try again in a moment.'
      : `Temporarily rate limited. Your session has not changed. Try again in ${seconds} seconds.`);
    if (seconds !== null) { clearTimeout(retryTimer); retryTimer = setTimeout(() => { retryTimer = null; refresh(); }, seconds * 1000); }
  };
  if (recall() === 'signed-in') show(true);
  const request = async options => {
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/passkeys/', { credentials: 'same-origin', cache: 'no-store',
        ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
      const payload = await response.json().catch(() => ({}));
      return { response, payload };
    } finally { clearTimeout(deadline); }
  };
  const refresh = async () => {
    if (signedOut) return;
    const version = ++revision;
    try {
      const { response, payload } = await request();
      if (version !== revision || pending) return;
      // Only an explicit 401 or a successful "no session" answer means signed out.
      if (response.status === 401) { remember(false); show(false); message(''); return; }
      if (response.ok && payload.ok) { const known = Boolean(payload.signedIn || payload.walletLinked); remember(known); show(known); message(''); return; }
      unknown(response.status === 429 ? retrySeconds(response, payload) : null);
    } catch { if (version === revision && !pending) unknown(); }
  };
  // Per-account browser state must not carry over to the new guest created after sign-out.
  const ACCOUNT_KEYS = ['geek_hq_ranked_run_v1', 'geek-lobby-identity-v1', 'geek-cce-name-v1', 'geek-challenge-active-v1', 'geek-assisted-run'];
  const forgetAccountState = () => {
    for (const area of ['localStorage', 'sessionStorage']) {
      try { const s = window[area]; for (const key of ACCOUNT_KEYS) s?.removeItem?.(key); } catch { /* storage is optional */ }
    }
    try { window.sessionStorage?.removeItem?.(CHECKED); } catch {}
  };
  const signOut = async () => {
    if (pending || signedOut) return;
    pending = true; revision++;
    buttons.forEach(button => { button.disabled = true; button.textContent = 'Signing out…'; });
    message('');
    try {
      const { response, payload } = await request({ method: 'POST', body: JSON.stringify({ action: 'logout' }) });
      if (response.status !== 401 && (!response.ok || !payload.ok || !payload.signedOut)) throw new Error('SIGN_OUT_FAILED');
      signedOut = true; remember(false); show(false); forgetAccountState();
      document.dispatchEvent(new CustomEvent('geek:signed-out'));
      location.replace('/sign-in/?signedOut=1');
    } catch {
      message('Could not confirm sign-out. Please try again.');
    } finally {
      pending = false;
      buttons.forEach(button => { button.disabled = false; button.textContent = 'Sign out'; });
    }
  };
  buttons.forEach(button => button.addEventListener('click', signOut));
  document.addEventListener('geek:account-status', event => {
    if (!pending && !signedOut) { revision++; const known = Boolean(event.detail.signedIn || event.detail.walletLinked); remember(known); show(known); }
  });
  // The initial page-load announcement already carried its status via geek:account-status; refetching it was a duplicate request.
  for (const name of ['geek:signed-in', 'geek:passkey-signed-in', 'geek:device-signed-in']) document.addEventListener(name, event => { if (!event?.detail?.initial) refresh(); });
  document.addEventListener('geek:account-status-unknown', event => { if (!pending && !signedOut) unknown(event.detail?.retryAfter ?? null); });
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  // Dedupe: the sign-in page's passkey panel already fetches status and reports it by event,
  // and a status checked moments ago on the previous page is reused instead of refetched.
  if (!document.querySelectorAll('[data-passkeys]').length && !(fresh() && recall())) refresh();
})();
