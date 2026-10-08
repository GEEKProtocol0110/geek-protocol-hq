(() => {
  'use strict';
  const status = document.querySelector('[data-sign-in-status]');
  const hq = document.querySelector('[data-sign-in-hq]');
  let signedIn = false;
  const showSignedIn = (message) => { status.textContent = message; hq.hidden = false; document.querySelector('[data-sign-in-continue]').textContent = 'Continue to My HQ →'; };
  document.addEventListener('geek:signed-in', (event) => {
    signedIn = true;
    showSignedIn(event.detail.recovered ? 'Signed in. Your saved player has been recovered. Open My HQ to continue.' : 'Signed in. Your player is protected by this wallet. Open My HQ to continue.');
    hq.focus();
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  fetch('/api/identity', { credentials: 'same-origin', signal: controller.signal })
    .then(async (response) => {
      const payload = await response.json();
      if (signedIn) return;
      if (response.ok && payload.identity?.linked) showSignedIn('You are already signed in with a verified wallet. Open My HQ to continue.');
      else if (response.status === 401 || (response.ok && !payload.identity?.linked)) status.textContent = 'Guest profile. Choose a wallet or use your Kaspa address below to sign in.';
      else throw new Error('Session check unavailable');
    })
    .catch(() => { if (!signedIn) status.textContent = 'Your session could not be checked. You can retry wallet sign-in below or reload this page.'; })
    .finally(() => clearTimeout(timer));

  const addressForm = document.querySelector('[data-address-form]');
  const signatureForm = document.querySelector('[data-signature-form]');
  const addressInput = document.querySelector('[data-login-address]');
  const signatureInput = document.querySelector('[data-login-signature]');
  const messageInput = document.querySelector('[data-login-message]');
  const proofStep = document.querySelector('[data-proof-step]');
  const manualStatus = document.querySelector('[data-manual-status]');
  let challenge = null, pending = false, expiryTimer;
  const invalidate = () => {
    challenge = null; clearTimeout(expiryTimer); proofStep.hidden = true;
    messageInput.value = ''; signatureInput.value = '';
  };
  const busy = value => {
    pending = value;
    addressInput.disabled = value;
    addressForm.querySelector('button').disabled = value;
    signatureForm.querySelector('button').disabled = value;
  };
  const request = async (path, body) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { method: 'POST', credentials: 'same-origin', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Wallet verification is unavailable.');
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request took too long. Reload to check your saved player before trying again.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  addressInput.addEventListener('input', () => { invalidate(); manualStatus.textContent = 'Create a new message for this address.'; });
  addressForm.addEventListener('submit', async event => {
    event.preventDefault(); if (pending) return;
    invalidate(); busy(true); manualStatus.textContent = 'Creating your one-time login message…';
    try {
      await request('/api/session', {});
      const issued = await request('/api/identity', { action: 'challenge', intent: 'identity', address: addressInput.value.trim() });
      challenge = issued.challenge;
      messageInput.value = challenge.message;
      proofStep.hidden = false;
      document.querySelector('[data-proof-expiry]').textContent = `This message expires at ${new Date(challenge.expiresAt).toLocaleTimeString()}.`;
      expiryTimer = setTimeout(() => { invalidate(); manualStatus.textContent = 'That login message expired. Create a new one.'; }, Math.max(0, challenge.expiresAt - Date.now()));
      manualStatus.textContent = 'Copy this message into your wallet’s Kaspa Sign message feature. Then paste the signature below.';
      messageInput.focus();
    } catch (error) { manualStatus.textContent = error.message; }
    finally { busy(false); }
  });
  document.querySelector('[data-copy-message]').addEventListener('click', async () => {
    if (!challenge) return;
    try { await navigator.clipboard.writeText(messageInput.value); manualStatus.textContent = 'Message copied. Sign it in your wallet.'; }
    catch { messageInput.focus(); messageInput.select(); manualStatus.textContent = 'Select and copy the complete message, then sign it in your wallet.'; }
  });
  signatureForm.addEventListener('submit', async event => {
    event.preventDefault(); if (pending || !challenge) return;
    if (Date.now() >= challenge.expiresAt) { invalidate(); manualStatus.textContent = 'That message expired. Create a new one.'; return; }
    const challengeId = challenge.challengeId, signature = signatureInput.value.trim();
    if (!/^(?:[a-f0-9]{128}|[A-Za-z0-9+/]{86}==|[A-Za-z0-9+/]{86})$/i.test(signature)) { manualStatus.textContent = 'Paste the 64-byte Kaspa message signature as hexadecimal or Base64.'; return; }
    busy(true); manualStatus.textContent = 'Verifying wallet ownership…';
    try {
      const verified = await request('/api/identity', { action: 'verify', challengeId, signature });
      if (!verified.identity?.linked) throw new Error('Wallet ownership could not be verified.');
      invalidate(); manualStatus.textContent = 'Ownership verified. Open My HQ to continue.';
      document.dispatchEvent(new CustomEvent('geek:signed-in', { detail: { recovered: Boolean(verified.recovered) } }));
    } catch (error) { invalidate(); manualStatus.textContent = `${error.message} Create a new login message before retrying.`; }
    finally { busy(false); }
  });
  if (!window.kasware && !window.kaspire) {
    document.querySelector('[data-manual-method]').open = true;
    document.querySelector('[data-browser-method]').open = false;
  }
  document.addEventListener('geek:wallet', event => {
    if (event.detail.installed && !addressInput.value && !challenge) {
      document.querySelector('[data-browser-method]').open = true;
      document.querySelector('[data-manual-method]').open = false;
    }
  });
})();
