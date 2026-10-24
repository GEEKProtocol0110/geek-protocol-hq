(() => {
  'use strict';
  const panel = document.querySelector('[data-passkeys]');
  if (!panel) return;
  const note = panel.querySelector('[data-passkey-note]'), list = panel.querySelector('[data-passkey-list]');
  let busy = false, ready = false, grant = '', authenticated = false;
  const supported = Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials?.create && navigator.credentials?.get);
  const controls = () => [...panel.querySelectorAll('button')];
  const setDisabled = () => controls().forEach(button => { button.disabled = busy || !ready
    || (!supported && (button === panel.querySelector('[data-passkey-save]') || button === panel.querySelector('[data-passkey-login]') || button === panel.querySelector('[data-passkey-verify]'))); });
  const device = panel.querySelector('[data-passkey-device]');
  const deviceHelp = panel.querySelector('[data-passkey-device-help]');
  const checkDevice = async () => {
    // A missing platform authenticator does not rule out a phone or security key.
    // This is a local capability check, never an authentication decision.
    if (typeof window.PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return;
    let deadline;
    try {
      const available = await Promise.race([
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        new Promise(resolve => { deadline = setTimeout(() => resolve(null), 2000); })
      ]);
      if (available === false) {
        if (device) device.textContent = 'This browser reports no built-in passkey provider. It may still offer another device or a security key. A screen-lock PIN alone does not guarantee passkey support.';
      } else if (available === true && device) {
        device.textContent = 'A built-in passkey provider is available. Your device still needs to complete the save or sign-in prompt.';
      }
    } catch { /* Unknown support must not block an external authenticator. */ }
    finally { clearTimeout(deadline); }
  };
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const fetchJson = async (path, body) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) { const error = new Error(data.error || 'Passkeys are unavailable.'); error.code = data.code; throw error; }
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request took too long. Reload to check your saved player before trying again.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const request = body => fetchJson('/api/passkeys', body);
  const credentialPrompt = async (method, data) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
      const credential = await navigator.credentials[method]({ publicKey: options(data), signal: controller.signal });
      if (!credential) throw new DOMException('No passkey selected.', 'NotAllowedError');
      return credential;
    } finally { clearTimeout(timer); }
  };
  const options = data => ({ ...data, challenge: decode(data.challenge), ...(data.user ? { user: { ...data.user, id: decode(data.user.id) } } : {}),
    ...(data.excludeCredentials ? { excludeCredentials: data.excludeCredentials.map(c => ({ ...c, id: decode(c.id) })) } : {}),
    ...(data.allowCredentials ? { allowCredentials: data.allowCredentials.map(c => ({ ...c, id: decode(c.id) })) } : {}) });
  const serialize = credential => ({ id: credential.id, rawId: encode(credential.rawId), type: credential.type,
    clientExtensionResults: credential.getClientExtensionResults(), authenticatorAttachment: credential.authenticatorAttachment,
    response: credential.response.attestationObject ? { clientDataJSON: encode(credential.response.clientDataJSON), attestationObject: encode(credential.response.attestationObject), transports: credential.response.getTransports?.() || [] }
      : { clientDataJSON: encode(credential.response.clientDataJSON), authenticatorData: encode(credential.response.authenticatorData), signature: encode(credential.response.signature), userHandle: credential.response.userHandle ? encode(credential.response.userHandle) : null } });
  const refresh = async () => {
    const data = await request(); list.replaceChildren();
    authenticated = Boolean(data.signedIn || data.walletLinked);
    const loginArea = panel.querySelector('[data-passkey-login-area]'), account = panel.querySelector('[data-passkey-account]'), playerRow = panel.querySelector('[data-passkey-player-row]'), newTitle = panel.querySelector('[data-passkey-new-title]');
    if (loginArea) loginArea.hidden = authenticated;
    if (account) account.hidden = !authenticated;
    if (playerRow) playerRow.hidden = !authenticated;
    if (newTitle) newTitle.textContent = authenticated ? 'Add another passkey' : 'New here? Save your player';
    const newPlayer = panel.querySelector('[data-passkey-new]');
    if (newPlayer && authenticated) newPlayer.open = false;
    document.dispatchEvent(new CustomEvent('geek:account-status', {detail:data}));
    const playerName = panel.querySelector('[data-passkey-player]');
    if (playerName) playerName.textContent = data.playerName || 'Name unavailable';
    panel.querySelector('[data-passkey-logout]').hidden = !data.signedIn && !data.walletLinked;
    for (const c of data.credentials) {
      const li = document.createElement('li'), label = document.createElement('span'), button = document.createElement('button');
      label.textContent = `${c.label} · added ${new Date(c.createdAt).toLocaleDateString()}`;
      button.type = 'button'; button.className = 'button button-secondary'; button.textContent = 'Remove passkey';
      button.addEventListener('click', () => act(async () => {
        if (!confirm('Remove this passkey? Other passkey sessions will be signed out. Keep another passkey or linked wallet available for recovery.')) return;
        await request({ action: 'delete', credentialId: c.id, token: grant }); grant = ''; location.reload();
      }));
      li.append(label, button); list.append(li);
    }
    return data;
  };
  const act = async operation => {
    if (busy || !ready) return;
    busy = true; setDisabled();
    try { await operation(); }
    catch (error) {
      note.textContent = ['NotAllowedError', 'AbortError'].includes(error.name)
        ? 'No passkey was completed. Choose a saved Geek passkey, or another device or security key if your browser offers it. See device help below; your saved player has not been replaced.'
        : error.name === 'NotSupportedError'
          ? 'This browser or authenticator cannot complete the requested passkey. See device help below. You can keep learning as a guest without clearing your progress.'
          : error.name === 'InvalidStateError'
            ? 'A passkey may already be saved for this player on that authenticator. Try Sign in instead.'
            : error.message;
      if (['NotAllowedError','AbortError','NotSupportedError'].includes(error.name) && deviceHelp) deviceHelp.open = true;
      if (error.code === 'PASSKEY_REAUTH_REQUIRED') document.querySelector('[data-passkey-wallet-help]').hidden = false;
    } finally { busy = false; setDisabled(); }
  };
  const save = async () => {
    const wasSignedIn = authenticated;
    note.textContent = 'Choose where to save your passkey. Your device may ask for fingerprint, face or screen lock.';
    const token = grant; grant = '';
    const issued = await request({ action: 'begin-register', token });
    const credential = await credentialPrompt('create', issued.options);
    const result = await request({ action: 'finish-register', challengeId: issued.challengeId, response: serialize(credential), label: panel.querySelector('[data-passkey-label]').value });
    grant = result.grant.token; document.dispatchEvent(new CustomEvent('geek:device-grant', {detail:result.grant}));
    note.textContent = 'Passkey saved. Keep another saved/synced passkey or a linked wallet for recovery. Signing in does not approve wallet spending.';
    document.dispatchEvent(new CustomEvent('geek:passkey-signed-in', { detail: { continue: !wasSignedIn } }));
    try { await refresh(); } catch { note.textContent += ' Your player is signed in, but the passkey list could not refresh. Reload to check it.'; }
  };
  panel.querySelector('[data-passkey-save]').addEventListener('click', () => act(save));
  const login = (reauthenticate = false) => act(async () => {
    note.textContent = 'Choose your Geek passkey…';
    const issued = await request({ action: 'begin-login' });
    const credential = await credentialPrompt('get', issued.options);
    const result = await request({ action: 'finish-login', challengeId: issued.challengeId, response: serialize(credential) });
    grant = result.grant.token; document.dispatchEvent(new CustomEvent('geek:device-grant', {detail:result.grant})); note.textContent = 'Signed in to your saved player. You can add or remove a passkey during this fresh sign-in.';
    document.dispatchEvent(new CustomEvent('geek:passkey-signed-in', { detail: { continue: !reauthenticate } }));
    try { await refresh(); } catch { note.textContent += ' Your player is signed in, but the passkey list could not refresh. Reload to check it.'; }
  });
  panel.querySelector('[data-passkey-login]').addEventListener('click', () => login());
  panel.querySelector('[data-passkey-verify]')?.addEventListener('click', () => login(true));
  panel.querySelector('[data-passkey-logout]').addEventListener('click', () => act(async () => { await request({ action: 'logout' }); grant = ''; location.reload(); }));
  document.addEventListener('geek:signed-in', () => { grant = ''; void refresh().catch(() => { note.textContent = 'Signed in. Reload to check your saved player.'; }); });
  document.addEventListener('geek:device-signed-in', () => {
    grant = '';
    refresh().then(() => { note.textContent = 'Your approved player is active. You can sign out on this browser below.'; setDisabled(); })
      .catch(() => { note.textContent = 'Your player was approved, but its status could not refresh. Reload to check your saved player.'; });
  });
  document.addEventListener('geek:device-grant-used', () => { grant = ''; });
  document.addEventListener('geek:passkey-grant', event => { grant = event.detail.token; note.textContent = 'Wallet verified. Open Add another passkey to continue.'; });
  panel.querySelector('[data-passkey-wallet-authorize]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('geek:passkey-wallet-proof')));
  setDisabled();
  if (!supported) {
    note.textContent = 'This browser can’t use passkeys. Continue as a guest, or open Use another device below.';
    if (device) device.textContent = 'This browser cannot request a passkey. Your existing player data has not been cleared.';
  } else {
    void checkDevice();
  }
    (async () => {
      try {
        await fetchJson('/api/session', {});
        const data = await refresh();
        ready = true; setDisabled();
        document.dispatchEvent(new CustomEvent('geek:device-ready', { detail: {signedIn:data.signedIn,playerName:data.playerName} }));
        if (data.signedIn || data.walletLinked) note.textContent = 'You’re signed in. Open My HQ to continue.';
        else if (supported) note.textContent = 'Choose Sign in to open your device’s passkey prompt.';
        document.querySelector('[data-passkey-wallet-help]').hidden = !data.walletLinked;
        if (data.signedIn) document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
      } catch (error) { note.textContent = `${error.message} Reload to check your saved player.`; document.dispatchEvent(new CustomEvent('geek:device-unavailable', {detail:{message:error.message}})); }
    })();
})();
