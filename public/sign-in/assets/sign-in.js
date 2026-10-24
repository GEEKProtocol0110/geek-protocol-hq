(() => {
  'use strict';
  const status = document.querySelector('[data-sign-in-status]');
  const signedOut = new URLSearchParams(location.search).get('signedOut') === '1';
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
  const walletLink = document.querySelector('[data-wallet-hq-link]');
  if (walletLink) {
    walletLink.value = `https://www.geekprotocol.xyz/sign-in/${Object.hasOwn(nextPages, requestedNext) ? `?next=${requestedNext}` : ''}`;
    const launch = document.querySelector('[data-wallet-open-app]');
    const launchStatus = document.querySelector('[data-wallet-launch-status]');
    if (launch && /Android/i.test(navigator.userAgent || '')) {
      // Package and scheme verified in KasWare's official Android v0.5.3 APK.
      // This launches the wallet only; it is not a URL/signature handoff API.
      const fallback = new URL(walletLink.value);
      fallback.searchParams.set('walletLaunch', 'unavailable');
      launch.href = `intent://#Intent;scheme=com.kasware.app;package=com.kasware.app;S.browser_fallback_url=${encodeURIComponent(fallback.href)};end`;
      launch.hidden = false;
      launch.addEventListener('click', () => {
        launchStatus.textContent = 'Opening KasWare. In its Mainnet browser, paste the copied HQ link to sign in.';
      });
    }
    if (new URLSearchParams(location.search).get('walletLaunch') === 'unavailable') {
      launchStatus.textContent = 'KasWare could not be opened from this browser. Open the app yourself, then paste the HQ link in its Mainnet browser.';
    }
    document.querySelector('[data-wallet-copy-link]')?.addEventListener('click', async () => {
      walletLink.focus(); walletLink.select(); walletLink.setSelectionRange?.(0, walletLink.value.length);
      const note = document.querySelector('[data-wallet-copy-status]');
      note.textContent = 'Link selected. Copy it, then open it in KasWare’s in-app browser.';
      try {
        if (document.execCommand?.('copy') === true) { note.textContent = 'HQ link copied. Open it in KasWare’s in-app browser.'; return; }
        if (typeof navigator.clipboard?.writeText === 'function') {
          await navigator.clipboard.writeText(walletLink.value);
          note.textContent = 'HQ link copied. Open it in KasWare’s in-app browser.';
        }
      } catch { /* Selected text remains available when clipboard access is denied. */ }
    });
  }
  let proofIntent = 'identity';
  const showSignedIn = (message) => { status.textContent = message; hq.hidden = false; continueLink.textContent = nextPage[1]; const title = document.querySelector('[data-sign-in-title]'); if (title) title.textContent = 'Welcome back.'; const guest = document.querySelector('[data-sign-in-guest]'); if (guest) guest.hidden = true; };
  document.addEventListener('geek:passkey-signed-in', () => { signedIn = true; invalidate(); manualStatus.textContent = ''; proofIntent = 'identity'; showSignedIn(`Signed in to your saved player. ${destination}`); hq.focus(); });
  document.addEventListener('geek:device-signed-in', event => { signedIn = true; invalidate(); showSignedIn(`Signed in to ${event.detail.playerName}. ${destination}`); hq.focus(); });
  document.addEventListener('geek:signed-in', (event) => {
    signedIn = true;
    showSignedIn(event.detail.recovered ? `Signed in. Your saved player has been recovered. ${destination}` : `Signed in. Your player is protected by this wallet. ${destination}`);
    hq.focus();
    if (event.detail.source === 'wallet-connect') location.assign(nextPage[0]);
  });
  document.addEventListener('geek:account-status', event => {
    if (event.detail.signedIn || event.detail.walletLinked) {
      signedIn = true;
      showSignedIn('You’re signed in.');
    } else if (!signedIn) {
      status.textContent = signedOut ? 'You’re signed out. Your saved progress is ready when you sign in again.' : 'Not signed in.';
    }
  });
  document.addEventListener('geek:device-unavailable', () => {
    if (!signedIn) status.textContent = 'Sign-in is temporarily unavailable. You can continue as a guest.';
  });

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
    const recovery = document.querySelector('[data-wallet-manual]'); if (recovery) recovery.open = true;
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
        invalidate(); proofIntent = 'identity'; manualStatus.textContent = 'Wallet verified. Return to Add another passkey above.';
        document.dispatchEvent(new CustomEvent('geek:passkey-grant', { detail: { token: verified.passkeyAuthorization.token } })); return;
      }
      invalidate(); manualStatus.textContent = `Ownership verified. ${destination}`;
      document.dispatchEvent(new CustomEvent('geek:signed-in', { detail: { recovered: Boolean(verified.recovered) } }));
    } catch (error) { invalidate(); manualStatus.textContent = `${error.message} Create a new login message before retrying.`; }
    finally { busy(false); }
  });
  document.addEventListener('geek:wallet', event => {
    if (event.detail.installed && !addressInput.value && !challenge) {
      document.querySelector('[data-browser-method]').open = true;
      document.querySelector('[data-manual-method]').open = false;
    }
  });
})();
