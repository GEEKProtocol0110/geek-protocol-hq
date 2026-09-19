(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const form = $('[data-payout-form]');
  const addressInput = form.elements.address;
  const message = $('[data-form-message]');
  const serviceState = $('[data-service-state]');
  const useConnected = $('[data-use-connected]');
  const removeButton = $('[data-remove]');
  let connectedAddress = '';

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
    $('[data-payout-state]').textContent = payout.maskedAddress || 'NOT SET';
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
      const payload = await api('/api/rewards', { method: 'POST', body: JSON.stringify({ address: addressInput.value, acknowledged: form.elements.acknowledged.checked }) });
      render(payload);
      form.elements.acknowledged.checked = false;
      const receipt = payload.auditReceipt?.eventId ? ` Audit receipt: ${payload.auditReceipt.eventId}.` : '';
      setMessage(`Payout wallet saved as an unverified Alpha preference. The 72-hour change cooldown restarted; withdrawals remain locked.${receipt}`, 'success');
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
      const payload = await api('/api/rewards', { method: 'DELETE' });
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
    useConnected.disabled = !connectedAddress;
  });

  load();
})();
