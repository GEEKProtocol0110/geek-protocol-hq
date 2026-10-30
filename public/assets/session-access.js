// Shared by visible account controls; no wallet prompt or guest session creation.
(() => {
  const buttons = [...document.querySelectorAll('[data-sign-out]')];
  if (!buttons.length) return;
  const messages = [...document.querySelectorAll('[data-sign-out-status]')];
  let pending = false, signedOut = false, revision = 0;
  const show = visible => buttons.forEach(button => { button.hidden = !visible; });
  const message = text => messages.forEach(node => { node.textContent = text; });
  // Last known session state survives page loads so a 429/5xx status check never looks like sign-out.
  const KEY = 'geek:last-session-state';
  const recall = () => { try { return window.sessionStorage?.getItem(KEY); } catch { return null; } };
  const remember = signedIn => { try { window.sessionStorage?.setItem(KEY, signedIn ? 'signed-in' : 'signed-out'); } catch {} };
  const RETRY = 'We couldn’t check your sign-in right now. You are still signed in if you were before. Try again in a moment.';
  const unknown = () => { if (recall() === 'signed-in') show(true); message(RETRY); };
  if (recall() === 'signed-in') show(true);
  const request = async options => {
    const controller = new AbortController(), deadline = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch('/api/passkeys/', { credentials: 'same-origin', cache: 'no-store',
        ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
      const payload = await response.json();
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
      unknown();
    } catch { if (version === revision && !pending) unknown(); }
  };
  const signOut = async () => {
    if (pending || signedOut) return;
    pending = true; revision++;
    buttons.forEach(button => { button.disabled = true; button.textContent = 'Signing out…'; });
    message('');
    try {
      const { response, payload } = await request({ method: 'POST', body: JSON.stringify({ action: 'logout' }) });
      if (response.status !== 401 && (!response.ok || !payload.ok || !payload.signedOut)) throw new Error('SIGN_OUT_FAILED');
      signedOut = true; remember(false); show(false);
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
  for (const name of ['geek:signed-in', 'geek:passkey-signed-in', 'geek:device-signed-in']) document.addEventListener(name, refresh);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  refresh();
})();
