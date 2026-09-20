(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('[data-payout-form]');
  const addressInput = form.elements.address;
  const message = $('[data-form-message]');
  const serviceState = $('[data-service-state]');
  const useConnected = $('[data-use-connected]');
  const removeButton = $('[data-remove]');
  const payoutAlert = $('[data-payout-alert]');
  let connectedAddress = '';
  let identity = null;

  const api = async (path, options = {}) => {
    const response = await fetch(path, { credentials: 'same-origin', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error || 'The reward service is unavailable.');
    return payload;
  };

  const setMessage = (copy, kind = '') => {
    message.textContent = copy;
    message.className = `form-message ${kind}`.trim();
  };

  const render = (payload) => {
    $('[data-alpha-balance]').textContent = Number(payload.balance || 0).toLocaleString();
    const payout = payload.payout || {};
    identity = payload.identity || identity;
    $('[data-payout-state]').textContent = payout.maskedAddress || 'NOT SET';
    $('[data-identity-state]').textContent = identity?.linked ? 'WALLET VERIFIED' : 'SESSION ONLY';
    const review = payout.review || {};
    $('[data-review-state]').textContent = review.required ? 'REVIEW REQUIRED' : review.status === 'approved' ? 'REVIEWED' : 'NOT REQUIRED';
    const notice = payout.notification || null;
    payoutAlert.hidden = !notice;
    if (notice) {
      payoutAlert.classList.toggle('warning', Boolean(notice.reviewRequired));
      $('[data-payout-alert-title]').textContent = notice.reviewRequired ? 'SECURITY NOTICE · REVIEW REQUIRED' : 'SECURITY NOTICE';
      $('[data-payout-alert-copy]').textContent = notice.message || 'Your payout setting changed.';
      $('[data-payout-alert-reference]').textContent = review.reference ? `Private review reference: ${review.reference}` : `Payout version ${notice.payoutVersion || 0}`;
    }
    addressInput.value = payout.address || '';
    removeButton.hidden = !payout.address;
    serviceState.textContent = 'SERVER READY';
    serviceState.classList.add('live');
  };

  const load = async () => {
    try {
      await api('/api/session', { method: 'POST', body: JSON.stringify({ displayName: 'Reward Geek' }) });
      render(await api('/api/rewards'));
    } catch (error) {
      serviceState.textContent = 'SERVICE PAUSED';
      serviceState.classList.remove('live');
      setMessage(error.message, 'error');
    }
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    const button = $('.save-address');
    button.disabled = true;
    button.textContent = 'Checking address…';
    try {
      let authorizationToken = '';
      if (identity?.linked) {
        button.textContent = 'Sign wallet challenge…';
        const authorization = await window.GeekWallet?.authorizePayout({ operation: 'set', address: addressInput.value });
        authorizationToken = authorization?.token || '';
      }
      const payload = await api('/api/rewards', { method: 'POST', body: JSON.stringify({ address: addressInput.value, acknowledged: form.elements.acknowledged.checked, authorizationToken }) });
      render(payload);
      form.elements.acknowledged.checked = false;
      const receipt = payload.auditReceipt?.eventId ? ` Audit receipt: ${payload.auditReceipt.eventId}.` : '';
      const proof = payload.payout?.ownershipVerified ? ' Wallet ownership is server-verified.' : ' This destination remains unverified.';
      const review = payload.payout?.review?.required ? ' Private risk review is required before any future settlement.' : '';
      setMessage(`Payout wallet saved.${proof}${review} The 72-hour change cooldown restarted; withdrawals remain locked.${receipt}`, 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      button.disabled = false;
      button.innerHTML = 'Save payout wallet <span>→</span>';
    }
  });

  removeButton.addEventListener('click', async () => {
    removeButton.disabled = true;
    try {
      let authorizationToken = '';
      if (identity?.linked) {
        const authorization = await window.GeekWallet?.authorizePayout({ operation: 'remove' });
        authorizationToken = authorization?.token || '';
      }
      const payload = await api('/api/rewards', { method: 'DELETE', body: JSON.stringify({ authorizationToken }) });
      render(payload);
      form.elements.acknowledged.checked = false;
      const receipt = payload.auditReceipt?.eventId ? ` Audit receipt: ${payload.auditReceipt.eventId}.` : '';
      setMessage(`Payout wallet removed from this Alpha profile.${receipt}`, 'success');
    } catch (error) {
      setMessage(error.message, 'error');
    } finally {
      removeButton.disabled = false;
    }
  });

  useConnected.addEventListener('click', () => {
    if (!connectedAddress) return;
    addressInput.value = connectedAddress;
    addressInput.focus();
    setMessage('Connected Kasware address copied. Check every character before saving.');
  });

  document.addEventListener('geek:wallet', (event) => {
    const wallet = event.detail || {};
    connectedAddress = wallet.connected && wallet.network === 'kaspa_mainnet' ? wallet.address || '' : '';
    if (wallet.identity) {
      identity = wallet.identity;
      $('[data-identity-state]').textContent = identity.linked ? 'WALLET VERIFIED' : 'SESSION ONLY';
    }
    useConnected.disabled = !connectedAddress;
  });

  load();
})();
