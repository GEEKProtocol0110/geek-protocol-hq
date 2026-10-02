(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const api = '/api/session/?service=vault';
  let vault = null, busy = false, receivedAt = 0, stale = false;
  const element = (tag, text) => { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; return el; };
  const request = async (url, body) => {
    const res = await fetch(url, { credentials: 'same-origin', method: body ? 'POST' : 'GET', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.error || 'The vault could not respond. Refresh to check your saved claim.');
    return data;
  };
  const lock = value => { busy = value; $('[data-today]').setAttribute('aria-busy', String(value)); $('[data-claim]').disabled = value || !vault || vault.claimed; $('[data-retry]').disabled = value; };
  const failure = error => { $('[data-error-text]').textContent = error.message; $('[data-error]').hidden = false; };
  const render = data => {
    vault = data.vault; receivedAt = performance.now(); stale = false;
    const seal = vault.day.seal;
    $('[data-today-title]').textContent = `${seal.name} seal.`;
    $('[data-today-glyph]').textContent = seal.glyph;
    $('[data-today-day]').textContent = `${vault.day.id} / UTC`;
    $('[data-today-description]').textContent = `Today’s exact contents: 1 ${seal.name} seal for your private vault collection.`;
    $('[data-claim-status]').textContent = vault.claimed ? 'OPENED FOR TODAY' : 'TODAY’S VAULT IS READY';
    $('[data-claim]').textContent = vault.claimed ? 'Claimed · return when you like' : 'Open today’s vault →';
    $('[data-next-date]').textContent = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(vault.nextOpensAt);
    $('[data-receipt]').textContent = vault.receipt ? `Saved on the server · ${vault.receipt.day} · receipt ${vault.receipt.id}` : 'One seal. One claim. No mystery contents.';
    $('[data-total]').textContent = vault.totalClaimed;
    $('[data-discovered]').textContent = vault.collection.filter(seal => seal.quantity > 0).length;
    $('[data-album]').replaceChildren(...vault.collection.map(item => {
      const card = element('article'); card.className = `seal-card${item.quantity ? ' collected' : ''}${item.id === seal.id ? ' today' : ''}`;
      if (/^#[a-f0-9]{6}$/i.test(item.color)) card.style.setProperty('--seal', item.color);
      card.append(element('span', item.weekday), element('b', item.glyph), element('h3', item.name), element('p', item.quantity ? `${item.quantity} collected` : 'Not collected yet'));
      return card;
    }));
    $('[data-history]').replaceChildren(...(vault.history.length ? vault.history.map(receipt => {
      const row = element('li'); const name = vault.collection.find(seal => seal.id === receipt.sealId)?.name || 'Vault';
      const time = element('time', receipt.day); time.dateTime = receipt.day;
      row.append(element('span', `1 ${name} seal`), time); return row;
    }) : [element('li', 'Your first seal is waiting.')]));
    $('[data-recovery]').textContent = vault.walletProtected ? 'Your vault follows your verified identity, including when you recover it.' : 'Guest claims follow this browser session. Protect your profile with a verified identity for recovery.';
    tick();
  };
  const refresh = async () => {
    if (busy) return;
    lock(true); $('[data-error]').hidden = true;
    try { await request('/api/session/', {}); render(await request(api)); }
    catch (error) { failure(error); }
    finally { lock(false); }
  };
  const claim = async () => {
    if (busy || !vault || vault.claimed) return;
    if (stale) return refresh();
    lock(true); $('[data-error]').hidden = true;
    try {
      const result = await request(api, { action: 'claim', dayId: vault.day.id }); render(result);
      if (result.claimReceipt.day !== vault.day.id) $('[data-receipt]').textContent = `Your ${result.claimReceipt.day} seal was saved. A new UTC day has now opened.`;
      $('[data-receipt]').focus({ preventScroll: true });
    } catch (error) { failure(error); }
    finally { lock(false); }
  };
  const tick = () => {
    if (!vault) return;
    const left = Math.max(0, Math.ceil((vault.nextOpensAt - vault.serverNow - (performance.now() - receivedAt)) / 1000));
    $('[data-countdown]').textContent = `${Math.floor(left / 3600)}h ${Math.floor(left % 3600 / 60)}m ${left % 60}s`;
    if (!left) {
      stale = true; $('[data-claim-status]').textContent = 'A NEW UTC DAY HAS OPENED';
      $('[data-claim]').textContent = 'Refresh today’s vault →'; $('[data-claim]').disabled = busy;
    }
  };
  $('[data-claim]').addEventListener('click', () => stale ? refresh() : claim());
  $('[data-retry]').addEventListener('click', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  setInterval(tick, 1000); refresh();
})();
