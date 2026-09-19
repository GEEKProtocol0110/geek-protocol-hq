(() => {
  'use strict';

  const ROOT_SELECTOR = '[data-wallet-root]';
  const PROOF_KEY = 'geek-wallet-proof-v1';
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

  const readProof = () => {
    try {
      return JSON.parse(localStorage.getItem(PROOF_KEY)) || null;
    } catch {
      return null;
    }
  };

  const clearProof = () => {
    localStorage.removeItem(PROOF_KEY);
    state.verified = false;
  };

  const makeNonce = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  };

  const buildProofMessage = () => [
    'Geek Protocol wallet verification',
    `Domain: ${location.hostname}`,
    `Address: ${state.address}`,
    `Nonce: ${makeNonce()}`,
    `Issued at: ${new Date().toISOString()}`,
    'Purpose: Link this wallet to the Geek Protocol community Alpha.',
    'This message does not create or approve a transaction.'
  ].join('\n');

  const setText = (root, selector, value) => {
    const element = root.querySelector(selector);
    if (element) element.textContent = value;
  };

  const render = () => {
    const isMainnet = state.network === MAINNET;
    roots().forEach((root) => {
      root.dataset.walletStatus = state.error ? 'error' : state.verified ? 'verified' : state.connected ? 'connected' : state.installed ? 'ready' : 'missing';
      setText(root, '[data-wallet-state]', state.error ? 'CHECK WALLET' : state.verified ? 'OWNERSHIP VERIFIED' : state.connected ? 'WALLET LINKED' : state.installed ? 'KASWARE READY' : 'KASWARE NOT FOUND');
      setText(root, '[data-wallet-address]', shortAddress(state.address));
      setText(root, '[data-wallet-network]', state.connected ? networkLabel(state.network) : 'Connect to read network');
      setText(root, '[data-wallet-geek]', state.connected ? `${state.geekBalance} GEEK` : '—');
      setText(root, '[data-wallet-message]', state.error || (state.verified
        ? 'Signed ownership proof verified on this device. Server authentication and payouts remain disabled.'
        : state.connected && !isMainnet
          ? 'Switch Kasware to Kaspa Mainnet before verifying ownership.'
          : state.connected
            ? 'Wallet connected. Verify ownership with a message signature—no transaction and no network fee.'
            : state.installed
              ? 'Connect only when you choose. Geek Protocol will not request wallet access on page load.'
              : 'Open this page in the Kasware dApp browser or install the official Kasware wallet.'));

      const connect = root.querySelector('[data-wallet-connect]');
      if (connect) {
        connect.disabled = state.pending;
        connect.textContent = state.pending ? 'Connecting…' : state.connected ? 'Refresh wallet' : 'Connect Kasware';
      }
      const verify = root.querySelector('[data-wallet-verify]');
      if (verify) {
        verify.hidden = !state.connected || state.verified || !isMainnet;
        verify.disabled = state.pending;
      }
      const install = root.querySelector('[data-wallet-install]');
      if (install) install.hidden = state.installed;
    });
    document.dispatchEvent(new CustomEvent('geek:wallet', { detail: { ...state, publicKey: undefined } }));
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
        state.address = '';
        state.publicKey = '';
        state.network = '';
        state.geekBalance = '0';
        clearProof();
        render();
        return;
      }

      if (state.address && state.address !== address) clearProof();
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
      const proof = readProof();
      state.verified = Boolean(proof && proof.address === address && proof.hostname === location.hostname && proof.verifiedAt);
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

  const verifyOwnership = async () => {
    if (!window.kasware || !state.connected || state.network !== MAINNET || !state.publicKey) return;
    state.pending = true;
    state.error = '';
    render();
    try {
      const message = buildProofMessage();
      const signature = await window.kasware.signMessage(message, { type: 'auto' });
      const valid = await window.kasware.verifyMessage(state.publicKey, message, signature);
      if (!valid) throw new Error('Invalid signature');
      localStorage.setItem(PROOF_KEY, JSON.stringify({ address: state.address, hostname: location.hostname, verifiedAt: new Date().toISOString() }));
      state.verified = true;
    } catch {
      state.error = 'Ownership verification was canceled or the signature could not be verified.';
      state.verified = false;
    } finally {
      state.pending = false;
      render();
    }
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
    window.kasware.on('networkChanged', () => {
      clearProof();
      readWallet();
    });
    window.kasware.on('balanceChanged', () => readWallet());
  };

  state.installed = Boolean(window.kasware);
  render();
  if (state.installed) {
    bindWalletEvents();
    readWallet();
  }
})();
