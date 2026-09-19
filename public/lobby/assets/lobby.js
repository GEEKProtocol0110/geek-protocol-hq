(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const IDENTITY_KEY = 'geek-lobby-identity-v1';
  const categories = new Set(['kaspa', 'video-games', 'science-fiction', 'technology', 'movies', 'history', 'comics', 'pop-culture']);
  const channels = {
    briefing: ['briefing', 'Create a focused learning room and share the invite.', 'Choose a room template or configure your own. Every invite opens the same room setup, but live presence, chat, and synchronized rounds require the next multiplayer backend phase.'],
    matchmaking: ['matchmaking', 'Configure a room for your people.', 'Use a shareable lobby code to align category, room size, and game focus before everyone launches the Gauntlet.'],
    academy: ['kaspa-academy', 'Start with Kaspa fundamentals.', 'The Kaspa Core template spans origins, blockDAG basics, mining, wallets, scaling, programmability, and ecosystem culture.'],
    ghostdag: ['ghostdag-lab', 'Study the consensus layer.', 'GHOSTDAG Lab raises the selection priority of consensus and ordering questions inside the Kaspa bank.'],
    builders: ['builders-desk', 'Explore the current developer surface.', 'Builder Briefing emphasizes Toccata, covenants, Based Apps, Inline ZK, Rust, WASM, and the evolving authoring toolchain.']
  };
  const templates = {
    core: { name: 'Kaspa Core', category: 'kaspa', seats: '4', focus: '' },
    ghostdag: { name: 'GHOSTDAG Lab', category: 'kaspa', seats: '4', focus: 'ghostdag' },
    speed: { name: 'Speed Signal', category: 'kaspa', seats: '2', focus: '' },
    builders: { name: 'Builder Briefing', category: 'kaspa', seats: '8', focus: 'builders' }
  };

  const form = $('[data-lobby-form]');
  const room = $('[data-room]');
  const nameDialog = $('[data-name-dialog]');
  const nameForm = $('form', nameDialog);
  let identity = localStorage.getItem(IDENTITY_KEY) || 'Guest Geek';

  const setIdentity = (name) => {
    identity = (name || 'Guest Geek').trim().slice(0, 24) || 'Guest Geek';
    localStorage.setItem(IDENTITY_KEY, identity);
    $('[data-identity-name]').textContent = identity;
    $('[data-avatar]').textContent = identity.charAt(0).toUpperCase();
  };

  const makeCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const values = new Uint32Array(4);
    crypto.getRandomValues(values);
    return `GEEK-${[...values].map((value) => chars[value % chars.length]).join('')}`;
  };

  const applyTemplate = (key) => {
    const template = templates[key];
    if (!template) return;
    form.elements.name.value = template.name;
    form.elements.category.value = template.category;
    form.elements.seats.value = template.seats;
    form.elements.focus.value = template.focus;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderRoom = ({ name, category, seats, focus, code }, replaceUrl = true) => {
    const safeCategory = categories.has(category) ? category : 'kaspa';
    const safeSeats = ['2', '4', '8'].includes(String(seats)) ? Number(seats) : 4;
    const safeFocus = ['ghostdag', 'builders'].includes(focus) ? focus : '';
    const safeName = (name || 'Kaspa Study Hall').trim().slice(0, 36) || 'Kaspa Study Hall';
    const safeCode = /^GEEK-[A-Z2-9]{4}$/.test(code || '') ? code : makeCode();
    $('[data-room-name]').textContent = safeName;
    $('[data-room-code]').textContent = safeCode;
    $('[data-seats]').innerHTML = Array.from({ length: safeSeats }, (_, index) => index === 0
      ? `<div class="seat you"><b></b><small>HOST · THIS DEVICE</small></div>`
      : `<div class="seat"><b>Open seat ${index + 1}</b><small>INVITE A GEEK</small></div>`).join('');
    $('.seat.you b').textContent = identity;
    const playParams = new URLSearchParams({ category: safeCategory });
    if (safeFocus) playParams.set('focus', safeFocus);
    $('[data-launch]').href = `../play/?${playParams}`;
    const inviteParams = new URLSearchParams({ lobby: safeCode, name: safeName, category: safeCategory, seats: String(safeSeats) });
    if (safeFocus) inviteParams.set('focus', safeFocus);
    if (replaceUrl) history.replaceState(null, '', `${location.pathname}?${inviteParams}`);
    room.hidden = false;
    room.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    renderRoom({ name: data.get('name'), category: data.get('category'), seats: data.get('seats'), focus: data.get('focus'), code: makeCode() });
  });

  $$('[data-template]').forEach((button) => button.addEventListener('click', () => applyTemplate(button.dataset.template)));
  $$('[data-channel]').forEach((button) => button.addEventListener('click', () => {
    const content = channels[button.dataset.channel];
    if (!content) return;
    $$('[data-channel]').forEach((item) => item.classList.toggle('active', item === button));
    $('[data-channel-title]').textContent = content[0];
    $('[data-channel-description]').textContent = content[1];
    $('[data-channel-copy]').textContent = content[2];
  }));

  $('[data-copy]').addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = 'Invite copied';
    } catch {
      event.currentTarget.textContent = 'Copy address bar URL';
    }
  });
  $('[data-new-room]').addEventListener('click', () => {
    room.hidden = true;
    history.replaceState(null, '', location.pathname);
    form.scrollIntoView({ behavior: 'smooth' });
  });
  $('[data-edit-name]').addEventListener('click', () => {
    nameForm.elements.displayName.value = identity;
    nameDialog.showModal();
  });
  nameDialog.addEventListener('close', () => {
    if (nameDialog.returnValue === 'save') setIdentity(nameForm.elements.displayName.value);
  });

  document.addEventListener('geek:wallet', (event) => {
    const wallet = event.detail || {};
    const identityState = $('[data-identity-state]');
    if (identityState) identityState.textContent = wallet.verified ? 'WALLET VERIFIED' : wallet.connected ? 'WALLET LINKED' : 'LOCAL IDENTITY';
    document.body.classList.toggle('wallet-verified', Boolean(wallet.verified));
  });

  setIdentity(identity);
  const params = new URLSearchParams(location.search);
  if (params.has('lobby')) renderRoom({ name: params.get('name'), category: params.get('category'), seats: params.get('seats'), focus: params.get('focus'), code: params.get('lobby') }, false);
})();
