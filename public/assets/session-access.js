// Shared by visible account controls; no wallet prompt or guest session creation.
(() => {
  const buttons = [...document.querySelectorAll('[data-sign-out]')];
  const accountLinks = [...document.querySelectorAll('[data-nav-account]')];
  if (!buttons.length && !accountLinks.length) return;
  const signedInOnly = [...document.querySelectorAll('[data-signed-in-only]')];
  const signedOutOnly = [...document.querySelectorAll('[data-signed-out-only]')];
  const messages = [...document.querySelectorAll('[data-sign-out-status]')];
  let pending = false, signedOut = false, revision = 0, refreshing = false, refreshAfter = false;
  const show = visible => {
    buttons.forEach(button => { button.hidden = !visible; });
    accountLinks.forEach(link => {
      link.textContent = visible ? 'My HQ' : 'Sign in';
      link.setAttribute('href', visible ? '/profile/' : '/sign-in/');
      link.setAttribute('aria-label', visible ? 'My HQ: signed in' : 'Sign in');
    });
    signedInOnly.forEach(node => { node.hidden = !visible; });
    signedOutOnly.forEach(node => { node.hidden = visible; });
  };
  // Until the server answers, offer a neutral account link rather than claim sign-out.
  accountLinks.forEach(link => { link.textContent = 'Account'; link.setAttribute('href', '/profile/'); });
  signedOutOnly.forEach(node => { node.hidden = true; });
  const message = text => messages.forEach(node => { node.textContent = text; });
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
    if (signedOut || refreshing || pending) return;
    refreshing = true;
    const version = ++revision;
    try {
      const { response, payload } = await request();
      if (version !== revision || pending) return;
      if (response.status === 401) { show(false); return; }
      if (response.ok && payload.ok) show(Boolean(payload.signedIn || payload.walletLinked));
    } catch { /* Existing controls remain usable after a transient status failure. */ }
    finally {
      refreshing = false;
      if (refreshAfter) { refreshAfter = false; void refresh(); }
    }
  };
  const signOut = async () => {
    if (pending || signedOut) return;
    pending = true; revision++;
    buttons.forEach(button => { button.disabled = true; button.textContent = 'Signing out…'; });
    message('');
    try {
      const { response, payload } = await request({ method: 'POST', body: JSON.stringify({ action: 'logout' }) });
      if (response.status !== 401 && (!response.ok || !payload.ok || !payload.signedOut)) throw new Error('SIGN_OUT_FAILED');
      signedOut = true; show(false);
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
    if (!pending && !signedOut) { revision++; show(Boolean(event.detail.signedIn || event.detail.walletLinked)); }
  });
  const accountChanged = () => {
    // Authentication may complete while an earlier guest status read is still pending.
    revision++;
    if (refreshing) { refreshAfter = true; return; }
    void refresh();
  };
  for (const name of ['geek:signed-in', 'geek:passkey-signed-in', 'geek:device-signed-in']) document.addEventListener(name, accountChanged);
  window.addEventListener('pageshow', event => { if (event.persisted) refresh(); });
  refresh();
})();
