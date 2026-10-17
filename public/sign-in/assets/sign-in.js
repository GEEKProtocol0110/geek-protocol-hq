(() => {
  'use strict';
  const status = document.querySelector('[data-sign-in-status]');
  const hq = document.querySelector('[data-sign-in-hq]');
  const returningToStart = new URLSearchParams(location.search).get('next') === 'start';
  const continueLink = document.querySelector('[data-sign-in-continue]');
  const nextPages = {
    start: ['/start/#step-geek', 'Continue to your Geek →'],
    study: ['/study/', 'Continue learning →'],
    play: ['/play/#timed-games', 'Continue to your game →'],
    royale: ['/royale/', 'Continue to Royale →'],
    quest: ['/quest/', 'Continue your adventure →']
  };
  const requestedNext = new URLSearchParams(location.search).get('next');
  const nextPage = Object.hasOwn(nextPages, requestedNext) ? nextPages[requestedNext] : ['/profile/', 'Open My HQ →'];
  hq.href = nextPage[0]; hq.textContent = nextPage[1]; continueLink.href = nextPage[0];
  // Fixed destinations only: query input can never become an external redirect.
  if (returningToStart) { hq.href = '/start/#step-geek'; hq.textContent = 'Continue to your Geek →'; continueLink.href = '/start/#step-geek'; continueLink.textContent = 'Continue as a guest →'; }
  const destination = nextPage[1].replace(' →', '') + ' when you’re ready.';
  let signedIn = false;
  let proofIntent = 'identity';
  const showSignedIn = (message) => { status.textContent = message; hq.hidden = false; continueLink.textContent = nextPage[1]; };
  document.addEventListener('geek:passkey-signed-in', () => { signedIn = true; invalidate(); manualStatus.textContent = ''; proofIntent = 'identity'; showSignedIn(`Signed in to your saved player. ${destination}`); hq.focus(); });
  document.addEventListener('geek:device-signed-in', event => { signedIn = true; invalidate(); showSignedIn(`Signed in to ${event.detail.playerName}. ${destination}`); hq.focus(); });
  document.addEventListener('geek:signed-in', (event) => {
    signedIn = true;
    showSignedIn(event.detail.recovered ? `Signed in. Your saved player has been recovered. ${destination}` : `Signed in. Your player is protected by this wallet. ${destination}`);
    hq.focus();
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  fetch('/api/identity', { credentials: 'same-origin', signal: controller.signal })
    .then(async (response) => {
      const payload = await response.json();
      if (signedIn) return;
      if (response.ok && payload.identity?.linked) showSignedIn(`You are already signed in with a verified wallet. ${destination}`);
      else if (response.status === 401 || (response.ok && !payload.identity?.linked)) status.textContent = 'Guest player in this browser. Check the sign-in options below to save access or return to a player you already protected.';
      else throw new Error('Session check unavailable');
    })
    .catch(() => { if (!signedIn) status.textContent = 'Your session could not be checked. Reload to check your saved player before trying again.'; })
    .finally(() => clearTimeout(timer));

  const addressForm = document.querySelector('[data-address-form]');
  const signatureForm = document.querySelector('[data-signature-form]');
  const addressInput = document.querySelector('[data-login-address]');
  const signatureInput = document.querySelector('[data-login-signature]');
  const messageInput = document.querySelector('[data-login-message]');
  const proofStep = document.querySelector('[data-proof-step]');
  const manualStatus = document.querySelector('[data-manual-status]');
  const copyButton = document.querySelector('[data-copy-message]');
  const selectButton = document.querySelector('[data-select-message]');
  let challenge = null, pending = false, copying = false, copyRevision = 0, expiryTimer;
  const invalidate = () => {
    challenge = null; copyRevision += 1; clearTimeout(expiryTimer); proofStep.hidden = true;
    messageInput.value = ''; signatureInput.value = '';
  };
  const busy = value => {
    pending = value;
    addressInput.disabled = value;
    addressForm.querySelector('button').disabled = value;
    signatureForm.querySelector('button').disabled = value;
    copyButton.disabled = value || copying; selectButton.disabled = value;
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
  document.addEventListener('geek:passkey-wallet-proof', () => {
    invalidate(); proofIntent = 'passkey';
    const methods = document.querySelector('[data-wallet-methods]'); if (methods) methods.open = true;
    document.querySelector('[data-manual-method]').open = true;
    manualStatus.textContent = 'Enter your linked address and sign the passkey-authorization message. This grants another way to access this player.'; addressInput.focus();
  });
  addressInput.addEventListener('input', () => { invalidate(); manualStatus.textContent = 'Create a new message for this address.'; });
  addressForm.addEventListener('submit', async event => {
    event.preventDefault(); if (pending) return;
    invalidate(); busy(true); manualStatus.textContent = 'Creating your one-time login message…';
    try {
      await request('/api/session', {});
      const issued = await request('/api/identity', { action: 'challenge', intent: proofIntent, address: addressInput.value.trim() });
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
  const selectMessage = () => {
    if (!challenge || pending) return false;
    if (Date.now() >= challenge.expiresAt) {
      invalidate(); manualStatus.textContent = 'That login message expired. Create a new one.'; return false;
    }
    // Always select the exact server challenge, including every line break.
    messageInput.value = challenge.message;
    messageInput.focus(); messageInput.select();
    messageInput.setSelectionRange?.(0, messageInput.value.length);
    return true;
  };
  const manualCopyHelp = 'Message selected. Touch and hold the selected text, choose Copy, then paste the whole message into your wallet’s Kaspa Sign message screen.';
  selectButton.addEventListener('click', () => {
    if (selectMessage()) manualStatus.textContent = manualCopyHelp;
  });
  copyButton.addEventListener('click', async () => {
    if (copying || !selectMessage()) return;
    const proof = challenge, revision = ++copyRevision;
    // Run the selection-based fallback during the tap. Waiting for a rejected
    // clipboard promise first can lose Android WebView's user activation.
    let copied = false;
    try { copied = document.execCommand?.('copy') === true; } catch { /* Try the Clipboard API next. */ }
    if (copied) { manualStatus.textContent = 'Message copied. Sign it in your wallet, then paste its signature below.'; return; }
    if (typeof navigator.clipboard?.writeText !== 'function') { manualStatus.textContent = manualCopyHelp; return; }
    copying = true; copyButton.disabled = true;
    let deadline;
    const stillCurrent = () => challenge === proof && copyRevision === revision && Date.now() < proof.expiresAt;
    try {
      await Promise.race([
        navigator.clipboard.writeText(proof.message),
        new Promise((_, reject) => { deadline = setTimeout(() => reject(new Error('Clipboard timeout')), 2000); })
      ]);
      if (stillCurrent()) manualStatus.textContent = 'Message copied. Sign it in your wallet, then paste its signature below.';
    } catch {
      if (stillCurrent() && selectMessage()) manualStatus.textContent = manualCopyHelp;
    } finally { clearTimeout(deadline); copying = false; copyButton.disabled = pending; }
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
      if (verified.passkeyAuthorization) {
        invalidate(); proofIntent = 'identity'; manualStatus.textContent = 'Wallet verified. Return to Create a passkey above.';
        document.dispatchEvent(new CustomEvent('geek:passkey-grant', { detail: { token: verified.passkeyAuthorization.token } })); return;
      }
      invalidate(); manualStatus.textContent = `Ownership verified. ${destination}`;
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
