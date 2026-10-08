(() => {
  'use strict';

  const MAINNET = 'kaspa_mainnet';
  const EXPECTED = Object.freeze({
    ticker: 'GEEK',
    deploymentHash: 'c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1',
    limitRaw: '10000000000000',
    perMint: '100000'
  });
  const HEX_64 = /^[a-f0-9]{64}$/i;
  const state = {
    status: null,
    wallet: window.GeekWallet?.snapshot?.() || null,
    pending: false,
    phase: 'idle',
    acknowledged: false,
    refreshing: false,
    statusError: '',
    error: '',
    result: null,
    copyMessage: '',
    copying: false
  };

  const byId = (id) => document.getElementById(id);
  const number = (value) => new Intl.NumberFormat('en-US').format(BigInt(value || '0'));
  const shortHash = (value) => value ? `${value.slice(0, 12)}…${value.slice(-10)}` : '—';
  const checkedTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—';

  const setText = (id, value) => {
    const element = byId(id);
    if (element) element.textContent = value;
  };

  const safeExplorerUrl = (transactionId) => HEX_64.test(transactionId || '')
    ? `https://explorer.kaspa.org/txs/${transactionId}`
    : '';

  const validStatus = (payload) => {
    if (!payload?.ok || payload?.deployment?.verified !== true) return false;
    if (payload.deployment.network !== 'kaspa-mainnet') return false;
    if (payload.deployment.ticker !== EXPECTED.ticker) return false;
    if (payload.deployment.deploymentHash !== EXPECTED.deploymentHash) return false;
    if (payload.deployment.limitRaw !== EXPECTED.limitRaw) return false;
    if (payload.mint?.perMint !== EXPECTED.perMint) return false;
    if (typeof payload.mint.open !== 'boolean') return false;
    const age = Date.now() - Number(payload.checkedAt);
    if (!Number.isFinite(age) || age < -5_000 || age > 60_000) return false;
    if (payload.transaction?.type !== 3 || payload.transaction?.custodial !== false) return false;
    try {
      const inscription = JSON.parse(payload.transaction.inscription);
      return inscription.p === 'KRC-20'
        && inscription.op === 'mint'
        && inscription.tick === EXPECTED.ticker
        && Object.keys(inscription).length === 3;
    } catch {
      return false;
    }
  };

  const canMint = () => Boolean(
    validStatus(state.status)
    && state.status.mint.open === true
    && state.wallet?.installed
    && state.wallet?.connected
    && state.wallet?.network === MAINNET
    && state.acknowledged
    && !state.pending
    && !state.refreshing
    && !state.statusError
    && !state.error
  );

  const render = () => {
    const status = state.status;
    const mint = status?.mint;
    const progress = mint ? Math.min(100, Math.max(0, Number(mint.progressBasisPoints || 0) / 100)) : 0;
    const progressBar = byId('mint-progress-bar');
    if (progressBar) progressBar.style.width = `${progress}%`;
    progressBar?.parentElement?.setAttribute('aria-valuenow', String(progress));
    setText('mint-progress-percent', mint ? `${progress.toFixed(2)}%` : '—');
    setText('mint-completed', mint ? number(mint.completedMints) : '—');
    setText('mint-remaining', mint ? number(mint.remainingMints) : '—');
    setText('mint-supply', mint ? `${number(mint.minted)} / ${number(mint.maximum)}` : '—');
    setText('mint-state', state.statusError ? 'PAUSED' : mint ? (mint.open ? 'OPEN' : 'CLOSED') : 'VERIFYING');
    setText('mint-checked', state.statusError ? 'Unavailable · checks every 30 seconds' : status ? `Verified ${checkedTime(status.checkedAt)}` : 'Checking live indexer…');
    setText('mint-deployment', status ? shortHash(status.deployment.deploymentHash) : shortHash(EXPECTED.deploymentHash));

    const statusPill = byId('mint-live-state');
    if (statusPill) {
      statusPill.dataset.state = state.statusError ? 'error' : mint?.open ? 'open' : status ? 'closed' : 'loading';
      statusPill.textContent = state.statusError ? 'MINT PAUSED' : mint?.open ? 'LIVE FAIR MINT' : status ? 'MINT CLOSED' : 'VERIFYING';
    }

    const connected = state.wallet?.installed && state.wallet?.connected && state.wallet?.network === MAINNET;
    const ready = connected && validStatus(status) && mint?.open === true && !state.statusError;
    const steps = [
      ['connect', connected ? 'done' : 'current', connected ? 'Connected on Mainnet' : state.wallet?.connected ? 'Switch to Mainnet in Kasware' : 'Kasware on Mainnet'],
      ['review', connected ? state.acknowledged && ready ? 'done' : 'current' : 'waiting', state.acknowledged && ready ? 'Request reviewed' : 'Amount, address and fees'],
      ['approve', state.pending || ready && state.acknowledged ? 'current' : state.result ? 'done' : 'waiting', state.phase === 'awaiting-approval' ? 'Waiting for your decision' : state.result && !state.acknowledged ? 'Submitted · check reveal' : 'Only when you choose']
    ];
    for (const [name, stepState, label] of steps) {
      const element = byId(`mint-step-${name}`);
      if (element) {
        element.dataset.state = stepState;
        if (stepState === 'current') element.setAttribute('aria-current', 'step');
        else element.removeAttribute('aria-current');
      }
      setText(`mint-step-${name}-status`, label);
    }
    setText('mint-destination', connected ? state.wallet.address : 'Connect Kasware on Mainnet first');
    const next = state.pending
      ? state.phase === 'awaiting-approval' ? 'Open Kasware to review the final cost. Approve or cancel there.' : 'Checking live supply and your selected wallet…'
      : state.error ? 'Review your wallet activity before resetting this request.'
      : state.statusError ? 'Live supply is unavailable. Minting will resume here after a valid status check.'
      : mint && !mint.open ? 'The mint is closed. A wallet request cannot be started.'
      : !state.wallet?.installed ? 'Open this page in a browser with Kasware installed, then connect your wallet.'
      : !connected ? state.wallet?.connected ? 'Switch Kasware to Kaspa Mainnet, then refresh your wallet.' : 'Connect Kasware to get started. Connection alone does not move funds.'
      : state.result ? 'Your request was submitted. Check the reveal transaction and wallet before another mint.'
      : !status ? 'Checking official GEEK availability…'
      : !state.acknowledged ? 'Check your wallet address and fee notice, then select the review checkbox.'
      : 'Ready. Open Kasware with the mint button and review its final total.';
    setText('mint-next', next);
    const acknowledgment = byId('mint-acknowledge');
    if (acknowledgment) acknowledgment.disabled = state.pending;
    const refresh = byId('mint-refresh');
    if (refresh) { refresh.disabled = state.refreshing || state.pending; refresh.textContent = state.refreshing ? 'Checking…' : 'Refresh status'; }
    const retry = byId('mint-retry');
    if (retry) retry.hidden = !state.error || state.pending;

    const button = byId('mint-submit');
    if (button) {
      button.disabled = !canMint();
      button.textContent = state.pending
        ? state.phase === 'awaiting-approval' ? 'Waiting for Kasware approval…' : 'Checking your mint…'
        : state.statusError
          ? 'Mint paused · refresh status'
          : state.refreshing
            ? 'Checking live status…'
          : state.error
            ? 'Review wallet activity before retrying'
          : !status
          ? 'Verifying deployment…'
          : !mint?.open
            ? 'Mint is closed'
            : !state.wallet?.installed
              ? 'Install Kasware to mint'
              : !state.wallet?.connected
                ? 'Connect Kasware first'
                : state.wallet?.network !== MAINNET
                  ? 'Switch Kasware to mainnet'
                  : !state.acknowledged
                    ? 'Review and acknowledge terms'
                    : 'Open Kasware · Mint 100,000 GEEK';
    }

    const message = byId('mint-message');
    if (message) {
      message.className = `mint-message${state.statusError || state.error ? ' is-error' : state.result ? ' is-success' : ''}`;
      message.textContent = state.error || state.statusError || (state.result
        ? 'Mint transaction submitted. Indexer totals may take a moment to update.'
        : 'The wallet displays the complete request and final KAS cost before you approve it.');
    }

    const result = byId('mint-result');
    if (result) {
      result.hidden = !state.result;
      if (state.result) {
        setText('mint-commit-id', state.result.commitId);
        setText('mint-reveal-id', state.result.revealId);
        setText('mint-result-address', state.result.address);
        setText('mint-result-time', new Date(state.result.submittedAt).toLocaleString());
        setText('mint-copy-message', state.copyMessage);
        const commitLink = byId('mint-commit-link');
        if (commitLink) { commitLink.href = safeExplorerUrl(state.result.commitId); commitLink.hidden = !commitLink.href; }
        const copy = byId('mint-copy-receipt');
        if (copy) copy.disabled = state.copying;
        const link = byId('mint-explorer-link');
        const url = safeExplorerUrl(state.result.revealId);
        if (link) {
          link.href = url || '#';
          link.hidden = !url;
        }
      }
    }
  };

  const fetchStatus = async (fresh = false) => {
    try {
      const response = await fetch(`/api/mint/${fresh ? '?fresh=1' : ''}`, {
        method: 'GET',
        credentials: 'same-origin',
        headers: { Accept: 'application/json' },
        cache: fresh ? 'no-store' : 'default',
        signal: AbortSignal.timeout(25_000)
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || 'Live GEEK mint status is unavailable.');
      if (!validStatus(payload)) throw new Error('Live status is stale or does not match the pinned GEEK deployment. Minting is paused.');
      state.status = payload;
      state.statusError = '';
      return payload;
    } catch (error) {
      state.status = null;
      state.statusError = error?.name === 'TimeoutError'
        ? 'Live GEEK mint status timed out. This page will check again automatically.'
        : String(error?.message || 'Live GEEK mint status is unavailable.');
      throw error;
    }
  };

  const parseWalletResult = (value) => {
    const payload = typeof value === 'string' ? JSON.parse(value) : value;
    const commitId = String(payload?.commitId || '');
    const revealId = String(payload?.revealId || '');
    if (!HEX_64.test(commitId) || !HEX_64.test(revealId)) throw new Error('Kasware did not return valid transaction IDs. Check the wallet activity before retrying.');
    return { commitId, revealId };
  };

  const friendlyError = (error) => {
    const message = String(error?.message || error || 'Mint request failed.');
    if (/reject|denied|cancel/i.test(message)) return 'Mint canceled in Kasware. No approval was submitted by this page.';
    if (/insufficient|balance|fund/i.test(message)) return 'Kasware reported insufficient KAS. Add enough KAS for the 1 KAS protocol fee plus commit/reveal network fees.';
    if (/network|mainnet/i.test(message)) return 'Kasware must be connected to Kaspa Mainnet before minting.';
    return message;
  };

  const mintOne = async () => {
    if (!canMint()) return;
    state.pending = true;
    state.phase = 'checking-status';
    state.error = '';
    state.result = null;
    state.copyMessage = '';
    render();
    try {
      if (!window.kasware?.signKRC20Transaction) throw new Error('This Kasware version does not support KRC-20 mint transactions.');
      const status = await fetchStatus(true);
      if (status.mint.open !== true) throw new Error('The GEEK mint is closed.');

      state.phase = 'checking-wallet';
      render();
      const [network, accounts] = await Promise.all([
        window.kasware.getNetwork(),
        window.kasware.getAccounts()
      ]);
      const address = Array.isArray(accounts) ? String(accounts[0] || '') : '';
      if (network !== MAINNET || !address.startsWith('kaspa:')) throw new Error('Kasware must be connected to a Kaspa Mainnet address.');
      if (address !== state.wallet?.address || state.wallet?.network !== MAINNET || !state.acknowledged) throw new Error('The connected wallet changed. Review the request and acknowledge it again.');

      state.phase = 'awaiting-approval';
      render();

      const response = await window.kasware.signKRC20Transaction(
        status.transaction.inscription,
        3,
        undefined,
        0
      );
      state.result = { ...parseWalletResult(response), address, submittedAt: Date.now() };
      state.phase = 'submitted';
      state.acknowledged = false;
      const checkbox = byId('mint-acknowledge');
      if (checkbox) checkbox.checked = false;
      window.setTimeout(() => refreshStatus(), 5_000);
    } catch (error) {
      if (!state.statusError) state.error = friendlyError(error);
    } finally {
      state.pending = false;
      state.phase = 'idle';
      render();
    }
  };

  document.addEventListener('geek:wallet', (event) => {
    const previous = state.wallet;
    state.wallet = event.detail || null;
    if (previous && (previous.address !== state.wallet?.address || previous.network !== state.wallet?.network)) {
      state.acknowledged = false;
      const checkbox = byId('mint-acknowledge');
      if (checkbox) checkbox.checked = false;
    }
    render();
  });

  byId('mint-acknowledge')?.addEventListener('change', (event) => {
    if (state.pending) return;
    state.acknowledged = Boolean(event.currentTarget.checked);
    render();
  });
  byId('mint-retry')?.addEventListener('click', () => {
    if (state.pending || !state.error) return;
    state.error = '';
    state.acknowledged = false;
    const checkbox = byId('mint-acknowledge');
    if (checkbox) checkbox.checked = false;
    render();
  });
  byId('mint-copy-receipt')?.addEventListener('click', async () => {
    if (!state.result || state.copying) return;
    const receipt = state.result;
    state.copying = true;
    render();
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('COPY_UNAVAILABLE');
      await navigator.clipboard.writeText([
        'Geek Protocol — GEEK mint submission', 'Amount requested: 100,000 GEEK', 'Network: Kaspa Mainnet',
        `Selected wallet: ${receipt.address}`, `Submitted: ${new Date(receipt.submittedAt).toISOString()}`,
        `Commit: ${receipt.commitId}`, `Reveal: ${receipt.revealId}`, safeExplorerUrl(receipt.revealId),
        'Submission is not confirmation. Check wallet activity and the reveal transaction.'
      ].join('\n'));
      if (state.result === receipt) state.copyMessage = 'Receipt copied. It includes your selected wallet address and transaction IDs.';
    } catch {
      if (state.result === receipt) state.copyMessage = 'Copy is unavailable here. Select the transaction IDs above to copy them manually.';
    } finally {
      state.copying = false;
      render();
    }
  });
  byId('mint-submit')?.addEventListener('click', mintOne);
  const refreshStatus = async () => {
    if (state.pending || state.refreshing) return;
    state.refreshing = true;
    render();
    try {
      await fetchStatus(true);
    } catch {
      // fetchStatus clears stale data and keeps minting paused on failure.
    } finally {
      state.refreshing = false;
      render();
    }
  };
  byId('mint-refresh')?.addEventListener('click', refreshStatus);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refreshStatus();
  });
  window.setInterval(() => {
    if (!document.hidden) return refreshStatus();
  }, 30_000);

  render();
  refreshStatus();
})();
