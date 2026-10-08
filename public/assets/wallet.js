(() => {
  'use strict';

  const ROOT_SELECTOR = '[data-wallet-root]';
  const MAINNET = 'kaspa_mainnet';
  const state = {
    providerName: '',
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

  const providers = new Map();
  const kaswareOnly = Boolean(document.querySelector('[data-wallet-kasware-only]'));
  let selected = null;
  let readRevision = 0;
  const addProvider = (id, name, adapter) => {
    if (providers.has(id) || providers.size >= 20) return;
    providers.set(id, { id, name: String(name || 'Kaspa wallet').slice(0, 60), ...adapter });
    if (!selected) { selected = providers.get(id); state.providerName = selected.name; }
    state.installed = true;
    document.querySelectorAll('[data-wallet-provider]').forEach(select => {
      const option = document.createElement('option'); option.value = id; option.textContent = providers.get(id).name; select.append(option);
      select.value = selected.id;
    });
    render();
  };
  const normalizeNetwork = value => ({ mainnet: MAINNET, 'testnet-10': 'kaspa_testnet_10', 'testnet-11': 'kaspa_testnet_11', devnet: 'kaspa_devnet' })[value] || value;

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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { credentials: 'same-origin', ...options, signal: controller.signal, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
      const payload = await response.json().catch(error => { if (controller.signal.aborted) throw error; return {}; });
      if (!response.ok) {
        const error = new Error(payload.error || 'Wallet verification is unavailable.');
        error.code = payload.code || (response.status === 401 ? 'SESSION_REQUIRED' : '');
        throw error;
      }
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request took too long. Reload to check your saved player before retrying.');
      throw error;
    } finally { clearTimeout(timer); }
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
      setText(root, '[data-wallet-state]', state.error ? 'CHECK WALLET' : state.verified ? 'SERVER VERIFIED' : state.connected ? 'WALLET CONNECTED' : state.installed ? `${state.providerName} ready` : 'No browser wallet detected');
      setText(root, '[data-wallet-address]', shortAddress(state.address));
      setText(root, '[data-wallet-network]', state.connected ? networkLabel(state.network) : 'Connect to read network');
      setText(root, '[data-wallet-geek]', state.connected ? `${state.geekBalance} GEEK` : '—');
      setText(root, '[data-wallet-message]', state.error || (root.hasAttribute('data-wallet-kasware-only')
        ? state.connected
          ? isMainnet ? 'Connected for minting. Review your selected address, amount and fees below. No player sign-in is needed.' : 'Switch Kasware to Kaspa Mainnet, then refresh your wallet before minting.'
          : state.installed ? 'Connect only when you choose. Connection alone does not move funds.' : 'This mint flow requires Kasware. Open this page in a browser where Kasware is installed and available.'
        : state.verified
        ? root.hasAttribute('data-wallet-sign-in') ? 'Your wallet proof is verified. Open My HQ to continue with your saved player.' : 'The server verified a one-time Kaspa Schnorr signature. This wallet can recover the player identity and authorize payout-setting changes.'
        : state.connected && !isMainnet
          ? 'Switch your wallet to Kaspa Mainnet before proving ownership.'
          : state.connected
            ? 'Sign a server nonce to link or recover the player identity—no transaction and no network fee.'
            : state.installed
              ? 'Connect only when you choose. Geek Protocol never requests wallet access on page load.'
              : 'Use the signed-message option on the sign-in page, or open this page with a compatible Kaspa browser wallet.'));

      const connect = root.querySelector('[data-wallet-connect]');
      if (connect) {
        connect.disabled = state.pending || !selected;
        connect.textContent = state.pending ? 'Waiting for wallet…' : state.connected ? 'Refresh wallet' : selected ? `Connect ${selected.name}` : 'Connect browser wallet';
      }
      const verify = root.querySelector('[data-wallet-verify]');
      if (verify) {
        verify.hidden = !state.connected || state.verified || !isMainnet;
        verify.disabled = state.pending;
        verify.textContent = root.hasAttribute('data-wallet-sign-in') ? 'Sign in with wallet' : state.identity?.linked ? 'Recover identity' : 'Verify & protect';
      }
      const install = root.querySelector('[data-wallet-install]');
      if (install) install.hidden = state.installed;
      const selector = root.querySelector('[data-wallet-provider]');
      if (selector) { selector.disabled = state.pending || !providers.size; selector.hidden = providers.size < 2; }
    });
    publishState();
  };

  const ensureSession = () => api('/api/session', { method: 'POST', body: '{}' });

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
    const revision = ++readRevision;
    const provider = selected;
    if (!provider) {
      state.installed = false;
      state.connected = false;
      render();
      return;
    }
    state.installed = true;
    state.error = '';
    try {
      const accounts = accountsOverride || await provider.getAccounts();
      if (provider !== selected || revision !== readRevision) return;
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
        provider.getNetwork(),
        provider.getPublicKey(),
        Promise.resolve().then(() => provider.getBalances()).catch(() => null)
      ]);
      if (provider !== selected || revision !== readRevision) return;
      state.network = normalizeNetwork(network || '');
      state.publicKey = publicKey || '';
      const geek = Array.isArray(balances) ? balances.find((token) => String(token.tick || '').toUpperCase() === 'GEEK') : null;
      state.geekBalance = geek ? formatToken(geek.balance, geek.dec) : Array.isArray(balances) ? '0' : '—';
      await refreshIdentity();
    } catch {
      state.error = 'Your wallet could not return the signing details. Unlock it and try again, or use the signed-message option.';
    }
    render();
  };

  const connectWallet = async () => {
    if (state.pending) return;
    if (!selected) {
      state.installed = false;
      render();
      return;
    }
    state.pending = true;
    state.error = '';
    render();
    try {
      const accounts = await selected.requestAccounts();
      await readWallet(accounts);
    } catch {
      state.error = 'Connection was not approved. Your wallet remains unchanged.';
    } finally {
      state.pending = false;
      render();
    }
  };

  const signServerChallenge = async (challenge) => {
    if (!selected?.signMessage) throw new Error('This wallet does not support Kaspa message signatures. Use the signed-message option if your wallet can sign outside the browser.');
    return selected.signMessage(challenge.message, state.address);
  };

  const verifyOwnership = async () => {
    if (state.pending || !selected || !state.connected || state.network !== MAINNET) return;
    const provider = selected, address = state.address;
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
      if (provider !== selected || address !== state.address || state.network !== MAINNET) throw new Error('The wallet changed. Request a new login message.');
      const verified = await api('/api/identity', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify', challengeId: issued.challenge.challengeId, signature })
      });
      state.identity = verified.identity;
      state.verified = Boolean(verified.identity?.linked && verified.identity.address === state.address);
      if (state.verified) document.dispatchEvent(new CustomEvent('geek:signed-in', { detail: { recovered: Boolean(verified.recovered) } }));
    } catch (error) {
      state.error = error.message || 'Ownership verification was canceled or rejected.';
      state.verified = false;
    } finally {
      state.pending = false;
      render();
    }
  };

  const authorizePayout = async ({ operation, address = '' }) => {
    if (!selected || !state.connected || !state.verified || state.network !== MAINNET) {
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

  const bindWalletEvents = (provider) => {
    if (!provider.on) return;
    const listen = (name, callback) => { try { provider.on(name, callback); } catch { /* Events are optional provider capabilities. */ } };
    listen('accountsChanged', accounts => { if (selected?.id === provider.id) readWallet(accounts); });
    ['networkChanged', 'chainChanged', 'balanceChanged'].forEach(name => listen(name, () => { if (selected?.id === provider.id) readWallet(); }));
    listen('disconnect', () => { if (selected?.id === provider.id) readWallet([]); });
  };
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-wallet-provider]')) return;
    if (state.pending) { event.target.value = selected.id; return; }
    selected = providers.get(event.target.value);
    state.providerName = selected?.name || '';
    Object.assign(state, { connected: false, verified: false, address: '', publicKey: '', network: '', geekBalance: '0', error: '' });
    document.querySelectorAll('[data-wallet-provider]').forEach(select => { select.value = selected.id; });
    render();
  });

  const snapshot = () => ({ ...state, identity: state.identity ? { ...state.identity } : null });

  window.GeekWallet = Object.freeze({ authorizePayout, refreshIdentity, snapshot });
  render();
  if (window.kasware) {
    const wallet = window.kasware;
    addProvider('kasware', 'Kasware', {
      requestAccounts: () => wallet.requestAccounts(), getAccounts: () => wallet.getAccounts(),
      getNetwork: () => wallet.getNetwork(), getPublicKey: () => wallet.getPublicKey(),
      getBalances: () => wallet.getKRC20Balance?.() || Promise.resolve([]),
      signMessage: (message) => wallet.signMessage(message, { type: 'schnorr' }), on: wallet.on?.bind(wallet)
    });
    bindWalletEvents(providers.get('kasware'));
  }
  const detectKaspire = () => {
    const wallet = window.kaspire;
    if (kaswareOnly || !wallet?.isKaspire || providers.has('kaspire')) return;
    const call = (method, params) => wallet.request({ method, ...(params ? { params } : {}) });
    addProvider('kaspire', 'Kaspire Extension', {
      requestAccounts: () => call('requestAccounts'), getAccounts: () => call('getAccounts'),
      getNetwork: () => call('getNetwork'), getPublicKey: () => call('getPublicKey'), getBalances: async () => null,
      signMessage: async (message, address) => { const result = await call('signMessage', { message, address }); if (result.address !== address) throw new Error('The signing wallet changed.'); return result.signature; },
      on: wallet.on?.bind(wallet)
    });
    bindWalletEvents(providers.get('kaspire'));
  };
  detectKaspire();
  window.addEventListener('kaspire#initialized', detectKaspire);
  window.addEventListener('kaspa:provider', event => {
    if (kaswareOnly) return;
    const { info, provider } = event.detail || {};
    if (!info || typeof info.uuid !== 'string' || !provider || typeof provider.requestAccounts !== 'function') return;
    const id = `standard:${info.uuid}`;
    if (providers.has(id)) return;
    addProvider(id, info.name, {
      requestAccounts: () => provider.requestAccounts(), getAccounts: () => provider.getAccounts?.() || Promise.resolve([]),
      getNetwork: () => provider.getNetwork?.() || Promise.resolve(''), getPublicKey: () => provider.getPublicKey?.() || Promise.resolve(''), getBalances: async () => null,
      signMessage: typeof provider.signMessage === 'function' ? message => provider.signMessage(message) : null,
      on: provider.on?.bind(provider)
    });
    if (providers.has(id)) bindWalletEvents(providers.get(id));
  });
  window.dispatchEvent(new Event('kaspa:requestProvider'));
})();
