(() => {
  'use strict';
  const panel = document.querySelector('[data-device-access]');
  if (!panel) return;
  const el = name => panel.querySelector(`[data-device-${name}]`);
  const note = el('note');
  let ready = false, busy = false, grant = '', request = null, review = null, received = null, expiry;
  const controls = () => [...panel.querySelectorAll('button')];
  const disabled = () => controls().forEach(b => { b.disabled = !ready || busy; });
  const api = async body => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(),15000);
    try {
      const r = await fetch('/api/passkeys', {method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:controller.signal});
      const data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Device access is unavailable.');
      return data;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request timed out. Check the current player or approval state before trying again.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const act = async work => {
    if (!ready || busy) return;
    busy = true; disabled();
    try { await work(); } catch (error) { note.textContent = error.message; }
    finally { busy = false; disabled(); }
  };
  const token = () => { const t = grant; grant = ''; document.dispatchEvent(new CustomEvent('geek:device-grant-used')); return t; };
  const resetTarget = () => { request = null; received = null; clearTimeout(expiry); el('request').hidden = true; el('received').hidden = true; el('code-display').value = ''; };
  document.addEventListener('geek:device-ready', () => { ready = true; disabled(); note.textContent = 'Choose the steps for the device you are using.'; });
  document.addEventListener('geek:device-unavailable', event => { ready = false; disabled(); note.textContent = `Device access is unavailable here. ${event.detail.message} Reload to check your saved player.`; });
  document.addEventListener('geek:device-grant', event => { grant = event.detail.token; });
  el('start').addEventListener('click', () => act(async () => {
    const next = await api({action:'device-start',label:el('label').value,acknowledge:el('guest-ack').checked});
    resetTarget(); request = next; el('request').hidden = false; el('code-display').value = next.code;
    el('request-check').textContent = `Matching check: ${next.check}`;
    el('expiry').textContent = `Expires at ${new Date(next.expiresAt).toLocaleTimeString()}. Keep this page open.`;
    note.textContent = 'Enter this code on your trusted phone. After approval, return here and choose Check approval.';
    expiry = setTimeout(() => { resetTarget(); note.textContent = 'The request expired. Show a new approval code to try again.'; }, Math.max(0,next.expiresAt-Date.now()));
  }));
  el('cancel').addEventListener('click', () => act(async () => { if (!request) return; await api({action:'device-cancel',code:request.code}); resetTarget(); note.textContent = 'Request cancelled.'; }));
  el('check').addEventListener('click', () => act(async () => {
    if (!request) return;
    const data = await api({action:'device-status',code:request.code});
    received = data.approved ? data : null; el('received').hidden = !received;
    if (received) { el('player').textContent = `Approved player: ${data.playerName}. Switching leaves this browser’s guest progress separate.`; note.textContent = 'Check the player name, then choose Switch to this player.'; }
    else note.textContent = 'Waiting for approval on your trusted phone. No player has been switched.';
  }));
  el('finish').addEventListener('click', () => act(async () => {
    if (!request || !received) return;
    const data = await api({action:'device-finish',code:request.code,approvalId:received.approvalId,confirm:true});
    if (!data.signedIn) throw new Error('The approval is not ready. Check approval again.');
    resetTarget(); note.textContent = `Signed in to ${data.playerName}. This browser can use that saved player.`;
    document.dispatchEvent(new CustomEvent('geek:device-signed-in',{detail:data}));
  }));
  el('code-input').addEventListener('input', () => { review = null; el('review-panel').hidden = true; el('confirm').checked = false; });
  el('review').addEventListener('click', () => act(async () => {
    const code = el('code-input').value;
    const data = await api({action:'device-review',code});
    review = {...data,code}; el('review-panel').hidden = false; el('confirm').checked = false;
    el('review-text').textContent = `Approve “${data.label}” for player ${data.playerName}. Matching check: ${data.check}. Expires at ${new Date(data.expiresAt).toLocaleTimeString()}.`;
    note.textContent = 'Compare both screens. If you have not just signed in, use Verify with a passkey in Manage saved access above, then approve.';
  }));
  el('approve').addEventListener('click', () => act(async () => {
    if (!review || !el('confirm').checked) throw new Error('Review the device and confirm that the checks match first.');
    if (!grant) throw new Error('Use Verify with a passkey in Manage saved access above, then approve this device.');
    await api({action:'device-approve',code:review.code,check:review.check,playerId:review.playerId,confirm:true,token:token()});
    review = null; el('review-panel').hidden = true; el('code-input').value = '';
    note.textContent = 'Approved. On your tablet, choose Check approval and confirm the player name.';
  }));
  const list = async () => {
    const data = await api({action:'device-list'}); el('list-items').replaceChildren();
    for (const d of data.devices) {
      const li = document.createElement('li'), label = document.createElement('span'), remove = document.createElement('button');
      label.textContent = `${d.label} · approved ${new Date(d.createdAt).toLocaleDateString()} `;
      remove.type = 'button'; remove.className = 'button button-secondary'; remove.textContent = 'Remove access';
      remove.addEventListener('click', () => act(async () => {
        if (!grant) throw new Error('Use Verify with a passkey in Manage saved access above before removing access.');
        if (!confirm(`Remove access for ${d.label}?`)) return;
        await api({action:'device-revoke',deviceId:d.id,token:token()});
        note.textContent = 'Device access removed. Its approved session can no longer sign in.'; await list();
      }));
      li.append(label,remove); el('list-items').append(li);
    }
    if (!data.devices.length) note.textContent = 'No approved devices are recorded for this player.';
    disabled();
  };
  el('list').addEventListener('click', () => act(list));
  disabled();
})();
