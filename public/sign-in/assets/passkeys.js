(() => {
  'use strict';
  const panel = document.querySelector('[data-passkeys]');
  if (!panel) return;
  const note = panel.querySelector('[data-passkey-note]'), list = panel.querySelector('[data-passkey-list]');
  const controls = [...panel.querySelectorAll('button')];
  let busy = false, grant = '';
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const request = async body => {
    const response = await fetch('/api/passkeys', { method: body ? 'POST' : 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    const data = await response.json();
    if (!response.ok) { const error = new Error(data.error || 'Passkeys are unavailable.'); error.code = data.code; throw error; }
    return data;
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
    if (busy) return;
    busy = true; controls.forEach(b => { b.disabled = true; });
    try { await operation(); }
    catch (error) {
      note.textContent = error.name === 'NotAllowedError' ? 'Passkey prompt cancelled or unavailable. You can retry or use wallet sign-in.' : error.message;
      if (error.code === 'PASSKEY_REAUTH_REQUIRED') document.querySelector('[data-passkey-wallet-help]').hidden = false;
    } finally { busy = false; controls.forEach(b => { b.disabled = false; }); }
  };
  const save = async () => {
    note.textContent = 'Choose where to save your passkey. Your device may ask for fingerprint, face or screen lock.';
    const token = grant; grant = '';
    const issued = await request({ action: 'begin-register', token });
    const credential = await navigator.credentials.create({ publicKey: options(issued.options) });
    const result = await request({ action: 'finish-register', challengeId: issued.challengeId, response: serialize(credential), label: panel.querySelector('[data-passkey-label]').value });
    grant = result.grant.token;
    note.textContent = 'Passkey saved. Keep another saved/synced passkey or a linked wallet for recovery. Signing in does not approve wallet spending.';
    await refresh(); document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
  };
  panel.querySelector('[data-passkey-save]').addEventListener('click', () => act(save));
  panel.querySelector('[data-passkey-login]').addEventListener('click', () => act(async () => {
    note.textContent = 'Choose your Geek passkey…';
    const issued = await request({ action: 'begin-login' });
    const credential = await navigator.credentials.get({ publicKey: options(issued.options) });
    const result = await request({ action: 'finish-login', challengeId: issued.challengeId, response: serialize(credential) });
    grant = result.grant.token; note.textContent = 'Signed in to your saved player. You can add or remove a passkey during this fresh sign-in.';
    await refresh(); document.dispatchEvent(new CustomEvent('geek:passkey-signed-in'));
  }));
  panel.querySelector('[data-passkey-logout]').addEventListener('click', () => act(async () => { await request({ action: 'logout' }); grant = ''; location.reload(); }));
  document.addEventListener('geek:passkey-grant', event => { grant = event.detail.token; note.textContent = 'Wallet control verified. Select Save passkey to continue.'; });
  panel.querySelector('[data-passkey-wallet-authorize]').addEventListener('click', () => document.dispatchEvent(new CustomEvent('geek:passkey-wallet-proof')));
  if (!window.isSecureContext || !window.PublicKeyCredential || !navigator.credentials) {
    controls.forEach(b => { b.disabled = true; }); note.textContent = 'Passkeys are unavailable in this browser. Open Geek in an up-to-date browser or use wallet sign-in.';
  } else {
    fetch('/api/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      .then(r => { if (!r.ok) throw new Error('Player session unavailable.'); return refresh(); })
      .then(data => { note.textContent = data.signedIn ? 'Your passkey session is active.' : 'Sign in with a saved passkey, or protect this browser’s player with a new one.'; if (data.signedIn) document.dispatchEvent(new CustomEvent('geek:passkey-signed-in')); })
      .catch(error => { note.textContent = error.message; });
  }
})();
