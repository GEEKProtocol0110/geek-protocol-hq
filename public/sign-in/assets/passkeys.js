(() => {
  'use strict';
  const panel = document.querySelector('[data-passkeys]');
  if (!panel) return;
  const note = panel.querySelector('[data-passkey-note]'), list = panel.querySelector('[data-passkey-list]');
  let busy = false, ready = false, grant = '';
  const controls = () => [...panel.querySelectorAll('button')];
  const setDisabled = () => controls().forEach(button => { button.disabled = busy || !ready; });
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
      note.textContent = ['NotAllowedError', 'AbortError'].includes(error.name) ? 'No passkey was completed. Try again in your browser when you’re ready. If this app cannot show passkeys, open Geek in an up-to-date browser such as Chrome.' : error.message;
      if (error.code === 'PASSKEY_REAUTH_REQUIRED') document.querySelector('[data-passkey-wallet-help]').hidden = false;
    } finally { busy = false; setDisabled(); }
  };
  const save = async () => {
    note.textContent = 'Choose where to save your passkey. Your device may ask for fingerprint, face or screen lock.';
    const token = grant; grant = '';
    const issued = await request({ action: 'begin-register', token });
    const credential = await credentialPrompt('create', issued.options);
    const result = await request({ action: 'finish-register', challengeId: issued.challengeId, response: serialize(credential), label: panel.querySelector('[data-passkey-label]').value });
    grant = result.grant.token;
    note.textContent = 'Passkey saved. Keep another saved/synced passkey or a linked wallet for recovery. Signing in does not approve wallet spending.';
    document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
    try { await refresh(); } catch { note.textContent += ' Your player is signed in, but the passkey list could not refresh. Reload to check it.'; }
  };
  panel.querySelector('[data-passkey-save]').addEventListener('click', () => act(save));
  panel.querySelector('[data-passkey-login]').addEventListener('click', () => act(async () => {
    note.textContent = 'Choose your Geek passkey…';
    const issued = await request({ action: 'begin-login' });
    const credential = await credentialPrompt('get', issued.options);
    const result = await request({ action: 'finish-login', challengeId: issued.challengeId, response: serialize(credential) });
    grant = result.grant.token; note.textContent = 'Signed in to your saved player. You can add or remove a passkey during this fresh sign-in.';
    document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
    try { await refresh(); } catch { note.textContent += ' Your player is signed in, but the passkey list could not refresh. Reload to check it.'; }
  }));
  panel.querySelector('[data-passkey-logout]').addEventListener('click', () => act(async () => { await request({ action: 'logout' }); grant = ''; location.reload(); }));
  document.addEventListener('geek:passkey-grant', event => { grant = event.detail.token; note.textContent = 'Wallet control verified. Select Create a passkey to continue.'; });
  panel.querySelector('[data-passkey-wallet-authorize]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('geek:passkey-wallet-proof')));
  setDisabled();
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials?.create || !navigator.credentials?.get) {
    note.textContent = 'Passkeys are unavailable in this browser. Open Geek in an up-to-date browser such as Chrome. You can keep learning as a guest here.';
  } else {
    (async () => {
      try {
        await fetchJson('/api/session', {});
        const data = await refresh();
        ready = true; setDisabled();
        note.textContent = data.signedIn ? 'Your passkey session is active.' : data.walletLinked
          ? 'This player is linked to a wallet. Adding a passkey requires fresh wallet proof. A new guest passkey cannot recover an older wallet-linked player.'
          : 'First visit? Create a passkey for this player. Returning? Sign in with the passkey you already saved.';
        document.querySelector('[data-passkey-wallet-help]').hidden = !data.walletLinked;
        if (data.signedIn) document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
      } catch (error) { note.textContent = `${error.message} Reload to check your saved player.`; }
    })();
  }
})();
