(() => {
  'use strict';
  const root = document.querySelector('[data-receiving-address]');
  if (!root) return;
  const find = s => root.querySelector(s), form = find('form'), network = find('[data-receiving-network]'), address = find('[data-receiving-input]');
  const save = find('[data-receiving-save]'), remove = find('[data-receiving-remove]'), retry = find('[data-receiving-retry]');
  const note = find('[data-receiving-status]'), access = find('[data-receiving-access]'), checked = find('[data-receiving-confirm]');
  const badge = find('[data-receiving-badge]'), hint = find('[data-receiving-hint]');
  let state = null, busy = false, phase = 'loading', needsRetry = false, signInRequired = false, currentNetwork = network.value;
  const drafts = Object.create(null);
  const clearDrafts = () => { for (const key of Object.keys(drafts)) delete drafts[key]; address.value = ''; };
  const savedAddress = () => state?.addresses?.[network.value] || '';
  const normalized = value => String(value || '').trim().toLowerCase();
  const dirty = () => normalized(address.value) !== normalized(savedAddress());
  const rememberDraft = () => {
    if (!state) return;
    const saved = state.addresses?.[currentNetwork] || '';
    if (normalized(address.value) !== normalized(saved)) drafts[currentNetwork] = address.value;
    else delete drafts[currentNetwork];
  };
  const supported = Boolean(window.isSecureContext && window.PublicKeyCredential && navigator.credentials?.get);
  const encode = value => btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const api = async body => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch('/api/rewards?service=addresses', { method: body ? 'POST' : 'GET', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' }, signal: controller.signal, ...(body ? { body: JSON.stringify(body) } : {}) });
      const data = await response.json();
      if (!response.ok) { const e = new Error(data.error || 'Receiving addresses are unavailable.'); e.status = response.status; throw e; }
      return data;
    } catch (e) { if (controller.signal.aborted) throw new Error('The request took too long. Reload addresses to check whether your change was saved.'); throw e; }
    finally { clearTimeout(timer); }
  };
  const controls = () => {
    const enabled = Boolean(state?.canEdit && supported);
    remove.disabled = address.disabled = checked.disabled = busy || !enabled;
    save.disabled = busy || !enabled || !dirty() || !checked.checked || !address.value.trim();
    save.textContent = phase === 'confirming' ? 'Confirm on your device…' : phase === 'saving' ? 'Saving address…' : 'Save address';
    network.disabled = retry.disabled = busy;
    remove.hidden = !savedAddress(); retry.hidden = !needsRetry;
    form.hidden = !state || (!state.signedIn && !state.canEdit);
    root.setAttribute('aria-busy', busy ? 'true' : 'false');
    const status = phase === 'loading' ? 'loading' : signInRequired ? 'guest' : !state ? 'unavailable' : !state.signedIn && !state.canEdit ? 'guest' : dirty() ? 'unsaved' : savedAddress() ? 'saved' : 'empty';
    root.dataset.receivingState = status;
    badge.textContent = { loading: 'Loading…', unavailable: 'Unavailable', guest: 'Sign in to add', unsaved: 'Unsaved changes', saved: 'Saved', empty: 'Not added' }[status];
    address.placeholder = network.value === 'mainnet' ? 'kaspa:…' : 'kaspatest:…';
    hint.textContent = network.value === 'mainnet' ? 'Use a Mainnet address beginning with kaspa:. Mainnet payouts are currently disabled.' : 'Use a kaspatest: address for GEEKT test rewards on Testnet-10.';
    access.hidden = busy || Boolean(state?.canEdit && supported);
    access.textContent = !supported ? 'Use a browser with passkey support to confirm address changes →' : state?.signedIn ? 'Add a Geek passkey to manage receiving addresses →' : 'Sign in or create your Geek account →';
  };
  const showNetwork = () => { address.value = drafts[network.value] ?? savedAddress(); checked.checked = false; controls(); };
  const load = async () => {
    if (busy) return; rememberDraft(); busy = true; phase = 'loading'; controls();
    try {
      state = await api(); needsRetry = false; signInRequired = false; showNetwork();
      note.textContent = state.canEdit ? 'Your device will confirm address changes with your Geek passkey.' : 'Your receiving address will be saved to your Geek account.';
    } catch (e) { state = null; signInRequired = e.status === 401; if (signInRequired) clearDrafts(); needsRetry = !signInRequired; note.textContent = signInRequired ? 'Sign in to save a receiving address to your Geek account.' : e.message; }
    finally { busy = false; phase = ''; controls(); }
  };
  const change = async operation => {
    if (busy || !state?.canEdit || !supported) return;
    const chosenNetwork = network.value, chosenAddress = address.value;
    if (operation === 'set' && (!form.reportValidity() || !checked.checked || !dirty())) return;
    if (operation === 'remove' && !confirm('Remove this receiving address for future rewards? Previously queued payments keep their original destination.')) return;
    busy = true; phase = 'confirming'; needsRetry = false; controls(); note.textContent = 'Confirm this address change with your Geek passkey…';
    try {
      const issued = await api({ action: 'begin', operation, network: chosenNetwork, address: chosenAddress, version: state.addresses.version, confirmed: true });
      const options = { ...issued.options, challenge: decode(issued.options.challenge),
        allowCredentials: issued.options.allowCredentials.map(c => ({ ...c, id: decode(c.id) })) };
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
      let credential;
      try { credential = await navigator.credentials.get({ publicKey: options, signal: controller.signal }); }
      finally { clearTimeout(timer); }
      if (!credential) throw new DOMException('No passkey selected.', 'NotAllowedError');
      phase = 'saving'; controls();
      const r = credential.response;
      state = await api({ action: 'finish', challengeId: issued.challengeId, response: {
        id: credential.id, rawId: encode(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(),
        response: { clientDataJSON: encode(r.clientDataJSON), authenticatorData: encode(r.authenticatorData), signature: encode(r.signature), userHandle: r.userHandle ? encode(r.userHandle) : null }
      } });
      delete drafts[chosenNetwork]; showNetwork();
      note.textContent = operation === 'remove' ? 'Receiving address removed. Previously queued payments keep their original destination.'
        : chosenNetwork === 'mainnet' ? 'Mainnet receiving address saved to your account. Mainnet payouts remain disabled.'
          : 'Testnet-10 receiving address saved. Eligible approved test rewards are handled automatically.';
    } catch (e) {
      const canceled = ['NotAllowedError', 'AbortError'].includes(e.name);
      needsRetry = !canceled;
      if (e.status === 401) { clearDrafts(); state = null; signInRequired = true; }
      if (e.status === 403) { clearDrafts(); state = { ...state, canEdit: false }; showNetwork(); }
      note.textContent = canceled ? 'Account confirmation was canceled. Your receiving addresses have not changed.' : e.message;
    }
    finally { busy = false; phase = ''; controls(); }
  };
  form.addEventListener('submit', event => { event.preventDefault(); return change('set'); });
  remove.addEventListener('click', () => change('remove'));
  network.addEventListener('change', () => { rememberDraft(); currentNetwork = network.value; showNetwork(); });
  address.addEventListener('input', () => { checked.checked = false; controls(); });
  checked.addEventListener('change', controls);
  retry.addEventListener('click', load);
  controls(); void load();
})();
