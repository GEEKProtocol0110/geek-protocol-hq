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
  const MAX_MINTS = 100;
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
    copying: false,
    count: 1,
    batch: null,
    walletVersion: 'Unavailable',
    diagnosticMessage: ''
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

  const queueRemaining = () => state.batch && !state.batch.stopped ? Math.max(0, state.batch.total - state.batch.attempted) : 0;
  const validCount = (value) => /^\d{1,3}$/.test(String(value)) && Number(value) >= 1 && Number(value) <= MAX_MINTS;
  const needsActivityReview = () => Boolean(state.error || state.result && !state.result.readable && !state.result.reviewed);

  const canMint = () => Boolean(
    validStatus(state.status)
    && state.status.mint.open === true
    && state.wallet?.installed
    && state.wallet?.connected
    && state.wallet?.network === MAINNET
    && state.acknowledged
    && validCount(state.count)
    && !state.pending
    && !state.refreshing
    && !state.statusError
    && !needsActivityReview()
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
    const incompleteReceipt = state.result && !state.result.readable;
    const remaining = queueRemaining();
    const count = state.pending && state.batch ? state.batch.reviewCount : remaining || state.count;
    const amount = validCount(count) ? number(BigInt(count) * BigInt(EXPECTED.perMint)) : '—';
    setText('mint-selected-amount', amount);
    setText('mint-amount-label', !state.pending && remaining ? 'REMAINING IN YOUR QUEUE' : 'YOUR MINT QUEUE');
    setText('mint-protocol-fee', validCount(count) ? `${count} KAS` : '—');
    setText('mint-ack-amount', amount);
    setText('mint-ack-count', validCount(count) ? `${count} mint${count === 1 ? '' : 's'}` : 'your selected mints');
    setText('mint-ack-fee', validCount(count) ? `${count} KAS` : 'the selected protocol fee');
    const countInput = byId('mint-count');
    if (countInput) countInput.disabled = state.pending || remaining > 0;
    const queue = byId('mint-batch-status');
    if (queue) {
      queue.hidden = !state.batch;
      queue.textContent = state.batch ? `${state.batch.attempted} of ${state.batch.total} wallet requests opened${state.pending ? ' · In progress' : state.batch.stopped ? ' · Queue stopped' : remaining ? ' · Queue paused' : ' · Queue finished'}. This is not a confirmed mint count.` : '';
    }
    const stop = byId('mint-stop');
    if (stop) { stop.hidden = !(state.pending || remaining); stop.disabled = Boolean(state.batch?.stopped); }
    const ready = connected && validStatus(status) && mint?.open === true && !state.statusError;
    const steps = [
      ['connect', connected ? 'done' : 'current', connected ? 'Connected on Mainnet' : state.wallet?.connected ? 'Switch to Mainnet in Kasware' : 'Kasware on Mainnet'],
      ['review', connected ? state.acknowledged && ready ? 'done' : 'current' : 'waiting', state.acknowledged && ready ? 'Request reviewed' : 'Amount, address and fees'],
      ['approve', state.pending || ready && state.acknowledged ? 'current' : incompleteReceipt ? 'current' : state.result ? 'done' : 'waiting', state.phase === 'awaiting-approval' ? 'Waiting for your decision' : incompleteReceipt ? 'Check wallet activity' : state.result && !state.acknowledged ? 'Submitted · check reveal' : 'Only when you choose']
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
      ? state.phase === 'awaiting-approval' ? `Request ${state.batch?.attempted || 1} of ${state.batch?.total || 1}: approve or cancel in Kasware. Stop queue prevents further requests.` : 'Checking live supply and your selected wallet…'
      : state.error ? 'Review your wallet activity before resetting this request.'
      : incompleteReceipt && needsActivityReview() ? 'Kasware finished the request without a readable transaction ID. Check wallet activity before continuing.'
      : state.statusError ? 'Live supply is unavailable. Minting will resume here after a valid status check.'
      : mint && !mint.open ? 'The mint is closed. A wallet request cannot be started.'
      : !state.wallet?.installed ? 'Open this page in a browser with Kasware installed, then connect your wallet.'
      : !connected ? state.wallet?.connected ? 'Switch Kasware to Kaspa Mainnet, then refresh your wallet.' : 'Connect Kasware to get started. Connection alone does not move funds.'
      : remaining ? `There are ${remaining} mints left in this queue. Review the remaining amount and fees, then continue when you choose.`
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
    if (retry) retry.hidden = !needsActivityReview() || state.pending;

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
          : needsActivityReview()
            ? 'Check wallet activity before another mint'
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
                    : remaining ? `Continue queue · ${remaining} mint${remaining === 1 ? '' : 's'}` : `Open Kasware · ${count === 1 ? 'Mint' : `${count} mints ·`} ${amount} GEEK`;
    }

    const message = byId('mint-message');
    if (message) {
      message.className = `mint-message${state.statusError || state.error ? ' is-error' : incompleteReceipt ? ' is-notice' : state.result ? ' is-success' : ''}`;
      message.textContent = state.error || state.statusError || (state.result
        ? incompleteReceipt ? 'Kasware finished the request, but HQ could not read a transaction ID. This does not mean the mint failed. Check Kasware activity and your GEEK balance.' : state.result.complete ? 'Mint transaction submitted. Indexer totals may take a moment to update.' : 'Kasware returned a transaction reference. Check the transaction and wallet activity for the mint outcome.'
        : 'The wallet displays the complete request and final KAS cost before you approve it.');
    }

    const result = byId('mint-result');
    if (result) {
      result.hidden = !state.result;
      if (state.result) {
        result.dataset.state = incompleteReceipt ? 'incomplete' : state.result.complete ? 'submitted' : 'reference';
        setText('mint-result-label', incompleteReceipt ? 'RECEIPT INCOMPLETE' : state.result.complete ? 'REQUEST SUBMITTED' : 'TRANSACTION ID RETURNED');
        setText('mint-result-title', incompleteReceipt ? 'Check Kasware activity' : 'Follow your mint');
        setText('mint-result-description', incompleteReceipt
          ? 'HQ cannot confirm the mint outcome from this receipt. Any valid transaction IDs returned are shown below. If Kasware shows the mint completed, do not repeat it to fix this notice.'
          : state.result.complete ? 'Kasware returned both transaction IDs. Submission does not confirm that GEEK has arrived. Check the reveal transaction and your wallet before minting again.'
          : 'Kasware returned a transaction reference. A wallet response does not confirm that GEEK has arrived. Check the linked transaction and your wallet.');
        setText('mint-commit-id', state.result.commitId || 'Not returned in a readable format');
        setText('mint-reveal-id', state.result.revealId || 'Not returned in a readable format');
        const reference = byId('mint-reference-row');
        if (reference) reference.hidden = !state.result.transactionId;
        setText('mint-reference-id', state.result.transactionId || '—');
        const referenceLink = byId('mint-reference-link');
        if (referenceLink) { const url = safeExplorerUrl(state.result.transactionId); referenceLink.href = url || '#'; referenceLink.hidden = !url; }
        setText('mint-receipt-diagnostic', `Kasware ${state.walletVersion} · ${state.result.diagnostic}`);
        setText('mint-diagnostic-message', state.diagnosticMessage);
        setText('mint-batch-log', state.batch?.receipts.map((receipt) => [
          `Request ${receipt.requestNumber}: ${receipt.readable ? 'Transaction ID returned; confirmation not checked' : 'No readable transaction ID; check wallet activity'}`,
          receipt.commitId ? `Commit: ${receipt.commitId}` : '',
          receipt.revealId ? `Reveal: ${receipt.revealId}` : '',
          receipt.transactionId ? `Transaction: ${receipt.transactionId}` : ''
        ].filter(Boolean).join('\n')).join('\n\n') || '');
        setText('mint-result-address', state.result.address);
        setText('mint-result-time', new Date(state.result.submittedAt).toLocaleString());
        setText('mint-copy-message', state.copyMessage);
        const commitLink = byId('mint-commit-link');
        if (commitLink) { const url = safeExplorerUrl(state.result.commitId); commitLink.href = url || '#'; commitLink.hidden = !url; }
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
    let payload = value;
    const type = (item) => item === null ? 'null' : Array.isArray(item) ? 'array' : typeof item;
    const responseType = type(value);
    let layers = 0;
    while (typeof payload === 'string' && !HEX_64.test(payload) && layers < 2) {
      try { payload = JSON.parse(payload); layers++; } catch { break; }
    }
    const validId = (id) => typeof id === 'string' && HEX_64.test(id) ? id : '';
    const commitId = validId(payload?.commitId);
    const revealId = validId(payload?.revealId);
    // A bare ID has no reliable commit/reveal label. Keep it as a generic reference.
    const transactionId = validId(payload);
    const fields = ['commitId', 'revealId', 'txId', 'txid', 'transactionId', 'data', 'result'];
    const diagnostic = `Response ${responseType}; decoded ${type(payload)}; JSON layers ${layers}; ${fields.map(field => `${field}: ${type(payload?.[field])}`).join(', ')}`;
    // A fulfilled wallet call and a readable receipt are separate outcomes.
    // Keep valid IDs individually; never infer broadcast or mint completion.
    return { commitId, revealId, transactionId, complete: Boolean(commitId && revealId), readable: Boolean(commitId || revealId || transactionId), diagnostic, reviewed: false };
  };

  const friendlyError = (error) => {
    const message = String(error?.message || error || 'Mint request failed.');
    if (/reject|denied|cancel/i.test(message)) return 'Kasware canceled the request. Check wallet activity for any transactions already sent.';
    if (/insufficient|balance|fund/i.test(message)) return 'Kasware reported insufficient KAS. Add enough KAS for the 1 KAS protocol fee plus commit/reveal network fees.';
    if (/network|mainnet/i.test(message)) return 'Kasware must be connected to Kaspa Mainnet before minting.';
    return message;
  };

  const mintOne = async () => {
    if (!canMint()) return;
    state.pending = true;
    state.phase = 'checking-status';
    state.error = '';
    const continuing = queueRemaining() > 0;
    if (!continuing) state.batch = { total: Number(state.count), attempted: 0, address: state.wallet.address, stopped: false, receipts: [] };
    const batch = state.batch;
    batch.reviewCount = batch.total - batch.attempted;
    const provider = window.kasware;
    if (batch.address !== state.wallet.address) {
      state.pending = false;
      state.error = 'The queue belongs to a different wallet. Stop it and review a new request.';
      render();
      return;
    }
    state.result = continuing ? state.result : null;
    state.copyMessage = '';
    state.diagnosticMessage = '';
    render();
    try {
      if (!provider?.signKRC20Transaction) throw new Error('This Kasware version does not support KRC-20 mint transactions.');
      while (batch.attempted < batch.total && !batch.stopped) {
        state.phase = 'checking-status';
        render();
        const status = await fetchStatus(true);
        if (status.mint.open !== true) throw new Error('The GEEK mint is closed.');
        if (!/^\d{1,12}$/.test(String(status.mint.remainingMints)) || BigInt(status.mint.remainingMints) < BigInt(batch.total - batch.attempted)) throw new Error('Not enough GEEK mints remain for this queue. Stop the queue and choose a smaller count.');

        state.phase = 'checking-wallet';
        render();
        const [network, accounts] = await Promise.all([
          provider.getNetwork(),
          provider.getAccounts()
        ]);
        if (batch.stopped || document.hidden) break;
        const address = Array.isArray(accounts) ? String(accounts[0] || '') : '';
        if (network !== MAINNET || !address.startsWith('kaspa:')) throw new Error('Kasware must be connected to a Kaspa Mainnet address.');
        if (address !== batch.address || address !== state.wallet?.address || state.wallet?.network !== MAINNET || !state.acknowledged) throw new Error('The connected wallet changed. Review the request and acknowledge it again.');
        if (provider !== window.kasware) throw new Error('The wallet provider changed. Review the request again.');

        state.phase = 'awaiting-approval';
        batch.attempted++;
        render();

        const response = await provider.signKRC20Transaction(
          status.transaction.inscription,
          3,
          undefined,
          0
        );
        state.result = { ...parseWalletResult(response), address, submittedAt: Date.now(), requestNumber: batch.attempted };
        batch.receipts.push(state.result);
        state.phase = 'submitted';
        render();
        if (!state.result.readable || document.hidden) break;
      }
      window.setTimeout(() => refreshStatus(), 5_000);
    } catch (error) {
      if (!state.statusError) state.error = friendlyError(error);
    } finally {
      state.pending = false;
      state.phase = 'idle';
      state.acknowledged = false;
      const checkbox = byId('mint-acknowledge');
      if (checkbox) checkbox.checked = false;
      render();
    }
  };

  document.addEventListener('geek:wallet', (event) => {
    const previous = state.wallet;
    state.wallet = event.detail || null;
    if (previous && (previous.address !== state.wallet?.address || previous.network !== state.wallet?.network)) {
      if (state.batch) state.batch.stopped = true;
      state.acknowledged = false;
      const checkbox = byId('mint-acknowledge');
      if (checkbox) checkbox.checked = false;
    }
    readWalletVersion();
    render();
  });

  byId('mint-acknowledge')?.addEventListener('change', (event) => {
    if (state.pending) return;
    state.acknowledged = Boolean(event.currentTarget.checked);
    render();
  });
  byId('mint-count')?.addEventListener('change', (event) => {
    if (state.pending || queueRemaining()) return;
    state.count = validCount(event.currentTarget.value) ? Number(event.currentTarget.value) : 0;
    state.acknowledged = false;
    const checkbox = byId('mint-acknowledge');
    if (checkbox) checkbox.checked = false;
    render();
  });
  byId('mint-stop')?.addEventListener('click', () => {
    if (!state.batch) return;
    state.batch.stopped = true;
    state.acknowledged = false;
    const checkbox = byId('mint-acknowledge');
    if (checkbox) checkbox.checked = false;
    render();
  });
  byId('mint-retry')?.addEventListener('click', () => {
    if (state.pending || !needsActivityReview()) return;
    state.error = '';
    if (state.result) state.result.reviewed = true;
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
        'Geek Protocol — GEEK mint request', 'Amount requested: 100,000 GEEK', 'Network: Kaspa Mainnet',
        `Selected wallet: ${receipt.address}`, `Wallet request finished: ${new Date(receipt.submittedAt).toISOString()}`,
        `Receipt: ${receipt.complete ? 'Both transaction IDs returned' : 'Partial or missing; outcome unconfirmed by HQ'}`,
        `Commit: ${receipt.commitId || 'Unavailable'}`, `Reveal: ${receipt.revealId || 'Unavailable'}`, `Transaction reference: ${receipt.transactionId || 'Unavailable'}`, safeExplorerUrl(receipt.revealId || receipt.transactionId || receipt.commitId),
        ...(state.batch ? [`Queue: ${state.batch.attempted} of ${state.batch.total} wallet requests opened (not confirmed mints)`, byId('mint-batch-log')?.textContent || ''] : []),
        'Submission is not confirmation. Check wallet activity and the reveal transaction.'
      ].join('\n'));
      if (state.result === receipt) state.copyMessage = 'Receipt copied. It includes your selected wallet address and any available transaction IDs.';
    } catch {
      if (state.result === receipt) state.copyMessage = 'Copy is unavailable here. Select the transaction IDs above to copy them manually.';
    } finally {
      state.copying = false;
      render();
    }
  });
  byId('mint-copy-diagnostic')?.addEventListener('click', async () => {
    if (!state.result) return;
    try {
      if (!globalThis.navigator?.clipboard?.writeText) throw new Error('COPY_UNAVAILABLE');
      await navigator.clipboard.writeText(`GEEK receipt diagnostic\nKasware version: ${state.walletVersion}\n${state.result.diagnostic}`);
      state.diagnosticMessage = 'Diagnostic copied. It contains response types only; no wallet address or transaction data.';
    } catch {
      state.diagnosticMessage = 'Copy is unavailable. Select the diagnostic text above to copy it manually.';
    }
    render();
  });
  let versionRequested = false;
  const readWalletVersion = () => {
    if (versionRequested || !window.kasware?.getVersion) return;
    versionRequested = true;
    Promise.resolve().then(() => window.kasware.getVersion()).then(version => {
      if (typeof version === 'string' && version.length <= 64 && /^\d+(?:\.\d+){1,3}(?:[-+][a-z0-9.-]{1,30})?$/i.test(version)) state.walletVersion = version;
      render();
    }).catch(() => {});
  };
  readWalletVersion();
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
