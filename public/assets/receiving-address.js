(() => {
  'use strict';
  const root = document.querySelector('[data-receiving-address]');
  if (!root) return;
  const find = s => root.querySelector(s), form = find('form'), network = find('[data-receiving-network]'), address = find('[data-receiving-input]');
  const save = find('[data-receiving-save]'), remove = find('[data-receiving-remove]'), retry = find('[data-receiving-retry]');
  const note = find('[data-receiving-status]'), access = find('[data-receiving-access]'), checked = find('[data-receiving-confirm]');
  let state = null, busy = false;
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
    save.disabled = remove.disabled = address.disabled = checked.disabled = busy || !enabled;
    network.disabled = retry.disabled = busy;
    remove.hidden = !state?.addresses?.[network.value];
    access.hidden = Boolean(state?.canEdit && supported);
    access.textContent = !supported ? 'Use a browser with passkey support to confirm address changes →' : state?.signedIn ? 'Add a Geek passkey to manage receiving addresses →' : 'Sign in or create your Geek account →';
  };
  const showNetwork = () => { address.value = state?.addresses?.[network.value] || ''; checked.checked = false; controls(); };
  const load = async () => {
    if (busy) return; busy = true; controls();
    try {
      state = await api(); showNetwork();
      note.textContent = state.canEdit ? 'Paste an address from any Kaspa wallet. Your device will confirm changes with your Geek passkey.' : 'Sign in and save a Geek passkey to add a receiving address.';
    } catch (e) { state = null; note.textContent = e.status === 401 ? 'Sign in to save a receiving address to your Geek account.' : e.message; }
    finally { busy = false; controls(); }
  };
  const change = async operation => {
    if (busy || !state?.canEdit || !supported) return;
    const chosenNetwork = network.value, chosenAddress = address.value;
    if (operation === 'set' && (!form.reportValidity() || !checked.checked)) return;
    if (operation === 'remove' && !confirm('Remove this receiving address for future rewards? Previously queued payments keep their original destination.')) return;
    busy = true; controls(); note.textContent = 'Confirm this address change with your Geek passkey…';
    try {
      const issued = await api({ action: 'begin', operation, network: chosenNetwork, address: chosenAddress, version: state.addresses.version, confirmed: true });
      const options = { ...issued.options, challenge: decode(issued.options.challenge),
        allowCredentials: issued.options.allowCredentials.map(c => ({ ...c, id: decode(c.id) })) };
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 120000);
      let credential;
      try { credential = await navigator.credentials.get({ publicKey: options, signal: controller.signal }); }
      finally { clearTimeout(timer); }
      if (!credential) throw new DOMException('No passkey selected.', 'NotAllowedError');
      const r = credential.response;
      state = await api({ action: 'finish', challengeId: issued.challengeId, response: {
        id: credential.id, rawId: encode(credential.rawId), type: credential.type, clientExtensionResults: credential.getClientExtensionResults(),
        response: { clientDataJSON: encode(r.clientDataJSON), authenticatorData: encode(r.authenticatorData), signature: encode(r.signature), userHandle: r.userHandle ? encode(r.userHandle) : null }
      } });
      showNetwork();
      note.textContent = operation === 'remove' ? 'Receiving address removed. Previously queued payments keep their original destination.'
        : chosenNetwork === 'mainnet' ? 'Mainnet receiving address saved to your account. Mainnet payouts remain disabled.'
          : 'Testnet-10 receiving address saved. Eligible approved test rewards are handled automatically.';
    } catch (e) { note.textContent = ['NotAllowedError', 'AbortError'].includes(e.name) ? 'Account confirmation was canceled. Your receiving addresses have not changed.' : e.message; }
    finally { busy = false; controls(); }
  };
  form.addEventListener('submit', event => { event.preventDefault(); return change('set'); });
  remove.addEventListener('click', () => change('remove'));
  network.addEventListener('change', showNetwork);
  address.addEventListener('input', () => { checked.checked = false; });
  retry.addEventListener('click', load);
  controls(); void load();
})();
