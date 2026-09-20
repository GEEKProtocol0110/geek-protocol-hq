(() => {
  'use strict';

  const ROOT_SELECTOR = '[data-wallet-root]';
  const MAINNET = 'kaspa_mainnet';
  const state = {
    installed: false,
    connected: false,
    pending: false,
    verified: false,
    address: '',
    publicKey: '',
    network: '',
    geekBalance: '0',
    identity: null,
    error: ''
  };

  const roots = () => [...document.querySelectorAll(ROOT_SELECTOR)];
  const shortAddress = (address) => address ? `${address.slice(0, 12)}…${address.slice(-6)}` : 'Not connected';
  const networkLabel = (network) => ({
    kaspa_mainnet: 'Kaspa Mainnet',
    kaspa_testnet_10: 'Kaspa Testnet 10',
    kaspa_testnet_11: 'Kaspa Testnet 11',
    kaspa_testnet_12: 'Kaspa Testnet 12',
    kaspa_devnet: 'Kaspa Devnet'
  })[network] || (network ? network.replaceAll('_', ' ') : 'Unknown network');

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Wallet verification is unavailable.');
      error.code = payload.code || '';
      throw error;
    }
    return payload;
  };

  const formatToken = (rawValue, decimalsValue) => {
    try {
      const raw = BigInt(rawValue || '0');
      const decimals = Math.max(0, Math.min(18, Number(decimalsValue || 0)));
      const scale = 10n ** BigInt(decimals);
      const whole = raw / scale;
      const remainder = raw % scale;
      const fraction = decimals ? remainder.toString().padStart(decimals, '0').slice(0, 4).replace(/0+$/, '') : '';
      return `${new Intl.NumberFormat('en-US').format(whole)}${fraction ? `.${fraction}` : ''}`;
    } catch {
      return '0';
    }
  };

  const setText = (root, selector, value) => {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  };

  const publishState = () => document.dispatchEvent(new CustomEvent('geek:wallet', {
    detail: { ...state, identity: state.identity ? { ...state.identity } : null }
  }));

  const render = () => {
    const isMainnet = state.network === MAINNET;
    roots().forEach((root) => {
      root.dataset.walletStatus = state.error ? 'error' : state.verified ? 'verified' : state.connected ? 'connected' : state.installed ? 'ready' : 'missing';
      setText(root, '[data-wallet-state]', state.error ? 'CHECK WALLET' : state.verified ? 'SERVER VERIFIED' : state.connected ? 'WALLET CONNECTED' : state.installed ? 'KASWARE READY' : 'KASWARE NOT FOUND');
      setText(root, '[data-wallet-address]', shortAddress(state.address));
      setText(root, '[data-wallet-network]', state.connected ? networkLabel(state.network) : 'Connect to read network');
      setText(root, '[data-wallet-geek]', state.connected ? `${state.geekBalance} GEEK` : '—');
      setText(root, '[data-wallet-message]', state.error || (state.verified
        ? 'The server verified a one-time Kaspa Schnorr signature. This wallet can recover the player identity and authorize payout-setting changes.'
        : state.connected && !isMainnet
          ? 'Switch Kasware to Kaspa Mainnet before proving ownership.'
          : state.connected
            ? 'Sign a server nonce to link or recover the player identity—no transaction and no network fee.'
            : state.installed
              ? 'Connect only when you choose. Geek Protocol never requests wallet access on page load.'
              : 'Open this page in the Kasware dApp browser or install the official Kasware wallet.'));

      const connect = root.querySelector('[data-wallet-connect]');
      if (connect) {
        connect.disabled = state.pending;
        connect.textContent = state.pending ? 'Waiting for wallet…' : state.connected ? 'Refresh wallet' : 'Connect Kasware';
      }
      const verify = root.querySelector('[data-wallet-verify]');
      if (verify) {
        verify.hidden = !state.connected || state.verified || !isMainnet;
        verify.disabled = state.pending;
        verify.textContent = state.identity?.linked ? 'Recover identity' : 'Verify & protect';
      }
      const install = root.querySelector('[data-wallet-install]');
      if (install) install.hidden = state.installed;
    });
    publishState();
  };

  const ensureSession = () => api('/api/session', { method: 'POST', body: JSON.stringify({ displayName: 'Verified Geek' }) });

  const refreshIdentity = async () => {
    try {
      const payload = await api('/api/identity');
      state.identity = payload.identity || null;
      state.verified = Boolean(state.identity?.linked && state.identity.address === state.address);
      return state.identity;
    } catch (error) {
      if (error.code !== 'SESSION_REQUIRED') throw error;
      return null;
    }
  };

  const readWallet = async (accountsOverride) => {
    if (!window.kasware) {
      state.installed = false;
      state.connected = false;
      render();
      return;
    }
    state.installed = true;
    state.error = '';
    try {
      const accounts = accountsOverride || await window.kasware.getAccounts();
      const address = Array.isArray(accounts) ? accounts[0] : '';
      if (!address) {
        state.connected = false;
        state.verified = false;
        state.address = '';
        state.publicKey = '';
        state.network = '';
        state.geekBalance = '0';
        render();
        return;
      }

      state.connected = true;
      state.address = address;
      const [network, publicKey, balances] = await Promise.all([
        window.kasware.getNetwork(),
        window.kasware.getPublicKey(),
        window.kasware.getKRC20Balance()
      ]);
      state.network = network || '';
      state.publicKey = publicKey || '';
      const geek = Array.isArray(balances) ? balances.find((token) => String(token.tick || '').toUpperCase() === 'GEEK') : null;
      state.geekBalance = geek ? formatToken(geek.balance, geek.dec) : '0';
      await refreshIdentity();
    } catch {
      state.error = 'Kasware could not return the wallet details. Unlock the wallet and try again.';
    }
    render();
  };

  const connectWallet = async () => {
    if (!window.kasware) {
      state.installed = false;
      render();
      return;
    }
    state.pending = true;
    state.error = '';
    render();
    try {
      const accounts = await window.kasware.requestAccounts();
      await readWallet(accounts);
    } catch {
      state.error = 'Connection was not approved. Your wallet remains unchanged.';
    } finally {
      state.pending = false;
      render();
    }
  };

  const signServerChallenge = async (challenge) => {
    if (!window.kasware?.signMessage) throw new Error('This Kasware version does not support message signatures.');
    return window.kasware.signMessage(challenge.message, { type: 'schnorr' });
  };

  const verifyOwnership = async () => {
    if (!window.kasware || !state.connected || state.network !== MAINNET || !state.publicKey) return;
    state.pending = true;
    state.error = '';
    render();
    try {
      await ensureSession();
      const issued = await api('/api/identity', {
        method: 'POST',
        body: JSON.stringify({ action: 'challenge', intent: 'identity', address: state.address, publicKey: state.publicKey })
      });
      const signature = await signServerChallenge(issued.challenge);
      const verified = await api('/api/identity', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', challengeId: issued.challenge.challengeId, signature })
      });
      state.identity = verified.identity;
      state.verified = Boolean(verified.identity?.linked && verified.identity.address === state.address);
    } catch (error) {
      state.error = error.message || 'Ownership verification was canceled or rejected.';
      state.verified = false;
    } finally {
      state.pending = false;
      render();
    }
  };

  const authorizePayout = async ({ operation, address = '' }) => {
    if (!window.kasware || !state.connected || !state.verified || state.network !== MAINNET || !state.publicKey) {
      throw new Error('Connect the verified identity wallet before changing the protected payout setting.');
    }
    const issued = await api('/api/identity', {
      method: 'POST',
      body: JSON.stringify({
        action: 'challenge',
        intent: 'payout',
        operation,
        payoutAddress: address,
        address: state.address,
        publicKey: state.publicKey
      })
    });
    const signature = await signServerChallenge(issued.challenge);
    const verified = await api('/api/identity', {
      method: 'POST',
      body: JSON.stringify({ action: 'verify', challengeId: issued.challenge.challengeId, signature })
    });
    return verified.authorization;
  };

  document.addEventListener('click', (event) => {
    const connect = event.target.closest('[data-wallet-connect]');
    if (connect) connectWallet();
    const verify = event.target.closest('[data-wallet-verify]');
    if (verify) verifyOwnership();
  });

  const bindWalletEvents = () => {
    if (!window.kasware?.on) return;
    window.kasware.on('accountsChanged', (accounts) => readWallet(accounts));
    window.kasware.on('networkChanged', () => readWallet());
    window.kasware.on('balanceChanged', () => readWallet());
  };

  const snapshot = () => ({ ...state, identity: state.identity ? { ...state.identity } : null });

  window.GeekWallet = Object.freeze({ authorizePayout, refreshIdentity, snapshot });
  state.installed = Boolean(window.kasware);
  render();
  if (state.installed) {
    bindWalletEvents();
    readWallet();
  }
})();
