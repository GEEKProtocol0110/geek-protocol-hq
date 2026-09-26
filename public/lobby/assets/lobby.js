(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const IDENTITY_KEY = 'geek-lobby-identity-v1';
  const categories = new Set(['kaspa', 'video-games', 'science-fiction', 'technology', 'movies', 'history', 'comics', 'pop-culture']);
  const categoryNames = {
    kaspa: 'Kaspa', 'video-games': 'Video Games', 'science-fiction': 'Science Fiction', technology: 'Technology',
    movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop Culture'
  };
  const channels = {
    briefing: ['briefing', 'Create a live learning room and share the invite.', 'Choose a room template, invite another player, and let the host start ten shared questions with server-scored standings.'],
    matchmaking: ['matchmaking', 'See who is gathering now.', 'Open rooms appear while at least one player is present. Join a room and wait for the host to start the shared round.'],
    academy: ['kaspa-academy', 'Start with Kaspa fundamentals.', 'The Kaspa Core template spans origins, blockDAG basics, mining, wallets, scaling, programmability, and ecosystem culture.'],
    ghostdag: ['ghostdag-lab', 'Study the consensus layer.', 'GHOSTDAG Lab raises the selection priority of consensus and ordering questions inside the Kaspa bank.'],
    builders: ['builders-desk', 'Explore the current developer surface.', 'Builder Briefing emphasizes Toccata, covenants, Based Apps, Inline ZK, Rust, WASM, and the evolving authoring toolchain.']
  };
  const templates = {
    core: { name: 'Kaspa Core', category: 'kaspa', seats: '4', focus: '', mode: 'gauntlet' },
    ghostdag: { name: 'GHOSTDAG Lab', category: 'kaspa', seats: '4', focus: 'ghostdag', mode: 'gauntlet' },
    speed: { name: 'Quick Duel', category: 'kaspa', seats: '2', focus: '', mode: 'gauntlet' },
    builders: { name: 'Builder Briefing', category: 'kaspa', seats: '8', focus: 'builders', mode: 'gauntlet' }
  };

  const form = $('[data-lobby-form]');
  const roomPanel = $('[data-room]');
  const nameDialog = $('[data-name-dialog]');
  const nameForm = $('form', nameDialog);
  let identity = localStorage.getItem(IDENTITY_KEY) || 'Guest Geek';
  let serviceAvailable = false;
  let currentRoom = null;
  let heartbeatTimer = null;
  let roomListTimer = null;
  let matchTimer = null;
  let currentMatch = null;
  let matchClockOffset = 0;
  let matchLoading = false;

  const api = async (path, options = {}) => {
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error || 'Community service unavailable.');
      error.code = payload.code || response.status;
      throw error;
    }
    return payload;
  };

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);

  const setServiceState = (state, message) => {
    serviceAvailable = state === 'live';
    const badge = $('[data-service-badge]');
    const status = $('[data-service-status]');
    const statusCopy = $('[data-service-copy]');
    badge.textContent = state === 'live' ? 'LIVE' : state === 'checking' ? 'CHECKING' : 'OFFLINE';
    badge.className = `status-pill ${state === 'live' ? 'ready' : ''}`;
    status.classList.toggle('live', state === 'live');
    status.classList.toggle('offline', state === 'offline');
    statusCopy.textContent = message;
  };

  const setIdentity = (name) => {
    identity = String(name || 'Guest Geek').replace(/[<>\u0000-\u001f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24) || 'Guest Geek';
    localStorage.setItem(IDENTITY_KEY, identity);
    $('[data-identity-name]').textContent = identity;
    $('[data-avatar]').textContent = identity.charAt(0).toUpperCase();
  };

  const syncSession = async () => {
    const payload = await api('/api/session', { method: 'POST', body: JSON.stringify({ displayName: identity }) });
    setIdentity(payload.player.name);
    setServiceState('live', 'Live presence connected');
    return payload.player;
  };

  const applyTemplate = (key) => {
    const template = templates[key];
    if (!template) return;
    form.elements.name.value = template.name;
    form.elements.category.value = template.category;
    form.elements.seats.value = template.seats;
    form.elements.focus.value = template.focus;
    form.elements.mode.value = template.mode;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const renderRoom = (room, replaceUrl = true, live = serviceAvailable) => {
    const safeCategory = categories.has(room.category) ? room.category : 'kaspa';
    const safeSeats = [2, 4, 8].includes(Number(room.seats)) ? Number(room.seats) : 4;
    const safeFocus = ['ghostdag', 'builders'].includes(room.focus) ? room.focus : '';
    const safeMode = ['gauntlet', 'daily', 'speed'].includes(room.mode) ? room.mode : 'gauntlet';
    const members = Array.isArray(room.members) ? room.members.slice(0, safeSeats) : [{ name: identity, host: true }];
    currentRoom = { ...room, category: safeCategory, seats: safeSeats, focus: safeFocus, mode: safeMode, members, live };
    $('[data-room-name]').textContent = room.name || 'Kaspa Study Hall';
    $('[data-room-code]').textContent = room.code;
    $('[data-room-state]').textContent = live ? 'LIVE' : 'OFFLINE';
    $('[data-room-state]').className = `status-pill ${live ? 'ready' : ''}`;
    $('[data-seats]').innerHTML = Array.from({ length: safeSeats }, (_, index) => {
      const member = members[index];
      if (!member) return `<div class="seat"><b>Open seat ${index + 1}</b><small>INVITE A GEEK</small></div>`;
      const isYou = member.name === identity;
      return `<div class="seat ${isYou ? 'you' : ''}"><b>${escapeHtml(member.name)}</b><small>${member.host ? 'HOST' : 'PLAYER'}${isYou ? ' · THIS DEVICE' : ' · ONLINE'}</small></div>`;
    }).join('');
    const playParams = new URLSearchParams({ category: safeCategory, lobby: room.code });
    if (safeFocus) playParams.set('focus', safeFocus);
    if (safeMode !== 'gauntlet') playParams.set('mode', safeMode);
    $('[data-launch]').href = `../play/?${playParams}`;
    const inviteParams = new URLSearchParams({ lobby: room.code });
    if (!live) {
      inviteParams.set('name', room.name || 'Kaspa Study Hall');
      inviteParams.set('category', safeCategory);
      inviteParams.set('seats', String(safeSeats));
      if (safeFocus) inviteParams.set('focus', safeFocus);
      if (safeMode !== 'gauntlet') inviteParams.set('mode', safeMode);
    }
    if (replaceUrl) history.replaceState(null, '', `${location.pathname}?${inviteParams}`);
    $('[data-room-note]').textContent = currentMatch
      ? 'Shared round in progress. Players who were in the room when the host started can answer.'
      : live ? 'Invite another player. The host can start a shared practice round once two players are online.' : 'The live room service is unavailable.';
    $('[data-start-match]').hidden = !currentRoom.isHost || Boolean(currentMatch);
    $('[data-start-match]').disabled = !live || members.length < 2;
    roomPanel.hidden = false;
  };

  const updateMatchClock = () => {
    if (!currentMatch) return;
    const now = Date.now() + matchClockOffset;
    const remaining = currentMatch.state === 'starting'
      ? currentMatch.startsAt - now : currentMatch.questionEndsAt - now;
    $('[data-match-clock]').textContent = currentMatch.state === 'finished' ? 'DONE' : `${Math.max(0, Math.ceil(remaining / 1000))}s`;
  };

  const renderMatch = (match) => {
    const previous = currentMatch;
    currentMatch = match;
    $('[data-shared-match]').hidden = !match;
    if (!match) {
      if (currentRoom) renderRoom(currentRoom, false, true);
      return;
    }
    matchClockOffset = match.serverNow - Date.now();
    const isNewQuestion = !previous || previous.id !== match.id || previous.questionNumber !== match.questionNumber || previous.state !== match.state;
    $('[data-match-status]').textContent = match.state === 'starting' ? 'Starting together' : match.state === 'finished' ? 'Shared round complete' : `Question ${match.questionNumber} / ${match.questionCount}`;
    $('[data-match-question]').textContent = match.state === 'starting'
      ? 'Get ready. Everyone will see the same questions.'
      : match.state === 'finished' ? 'Final room standings' : match.question?.prompt || 'This round was already in progress when you joined.';
    const options = $('[data-match-options]');
    if (isNewQuestion || Boolean(previous?.yourAnswer) !== Boolean(match.yourAnswer)) {
      options.replaceChildren();
      if (match.question && match.canPlay) match.question.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `${index + 1}. ${option}`;
        button.dataset.answerIndex = String(index);
        button.disabled = Boolean(match.yourAnswer);
        options.append(button);
      });
      $('[data-match-feedback]').textContent = match.yourAnswer
        ? `Answer recorded. ${match.yourAnswer.correct ? `+${match.yourAnswer.scoreAdded} points` : 'No points this question.'}`
        : match.state === 'finished' ? 'Create another room to play again. Scores here do not award Alpha GEEK or tokens.'
          : match.canPlay ? 'Choose one answer before the clock closes. Your first answer counts.' : 'You joined after the round began. Watch the standings or create a new room.';
    }
    const scores = $('[data-match-scores]');
    scores.replaceChildren(...match.scores.map((player) => {
      const item = document.createElement('li');
      item.textContent = `${player.name} · ${player.score.toLocaleString()} points`;
      return item;
    }));
    if (currentRoom) renderRoom(currentRoom, false, true);
    updateMatchClock();
  };

  const refreshMatch = async () => {
    if (!serviceAvailable || !currentRoom?.live || currentMatch?.state === 'finished' || matchLoading || document.hidden) return;
    const code = currentRoom.code;
    matchLoading = true;
    try {
      const payload = await api(`/api/lobbies?game=1&code=${encodeURIComponent(code)}`);
      if (currentRoom?.code === code) renderMatch(payload.match);
    } catch (error) {
      $('[data-match-feedback]').textContent = error.message;
    } finally {
      matchLoading = false;
    }
  };

  const renderRoomList = (rooms = []) => {
    const list = $('[data-live-rooms]');
    if (!rooms.length) {
      list.innerHTML = `<div class="empty-room-list"><b>${serviceAvailable ? 'No public rooms are active yet.' : 'Live room board is offline.'}</b><span>${serviceAvailable ? 'Create the first room and share its code.' : 'Creating rooms resumes when the community service returns.'}</span></div>`;
      return;
    }
    list.innerHTML = rooms.map((room) => `
      <button type="button" class="live-room-card" data-join-code="${escapeHtml(room.code)}">
        <span><i></i>${room.online}/${room.seats} ONLINE</span>
        <strong>${escapeHtml(room.name)}</strong>
        <small>${escapeHtml(categoryNames[room.category] || 'Kaspa')} · ${escapeHtml(room.code)}</small>
      </button>
    `).join('');
  };

  const loadRoomList = async () => {
    if (!serviceAvailable) return renderRoomList([]);
    try {
      const payload = await api('/api/lobbies');
      renderRoomList(payload.rooms);
    } catch {
      setServiceState('offline', 'Live rooms unavailable');
      renderRoomList([]);
    }
  };

  const joinRoom = async (code, replaceUrl = true) => {
    if (!serviceAvailable) throw new Error('Community service unavailable.');
    const payload = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({ action: 'join', code }) });
    currentMatch = null;
    renderRoom(payload.room, replaceUrl, true);
    await refreshMatch();
    roomPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const heartbeat = async () => {
    if (!serviceAvailable || !currentRoom?.live) return;
    try {
      const payload = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({ action: 'heartbeat', code: currentRoom.code }) });
      renderRoom(payload.room, false, true);
    } catch (error) {
      $('[data-room-note]').innerHTML = `<b>Connection paused:</b> ${escapeHtml(error.message)} Your invite URL is still safe to copy.`;
    }
  };

  const startPolling = () => {
    window.clearInterval(heartbeatTimer);
    window.clearInterval(roomListTimer);
    heartbeatTimer = window.setInterval(heartbeat, 15_000);
    roomListTimer = window.setInterval(loadRoomList, 20_000);
    window.clearInterval(matchTimer);
    matchTimer = window.setInterval(() => { refreshMatch(); updateMatchClock(); }, 4_000);
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('button[type="submit"]', form);
    const data = new FormData(form);
    button.disabled = true;
    button.textContent = 'Creating live room…';
    try {
      if (!serviceAvailable) throw new Error('Live room service is unavailable. Try again shortly.');
      await syncSession();
      const payload = await api('/api/lobbies', {
        method: 'POST',
        body: JSON.stringify({ action: 'create', name: data.get('name'), category: data.get('category'), seats: data.get('seats'), focus: data.get('focus'), mode: data.get('mode') })
      });
      currentMatch = null;
      renderRoom(payload.room, true, true);
      renderMatch(null);
      await loadRoomList();
      roomPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) {
      $('[data-room-list-message]').textContent = error.message;
    } finally {
      button.disabled = false;
      button.innerHTML = 'Create room <span>→</span>';
    }
  });

  $$('[data-template]').forEach((button) => button.addEventListener('click', () => applyTemplate(button.dataset.template)));
  $$('[data-channel]').forEach((button) => button.addEventListener('click', () => {
    const content = channels[button.dataset.channel];
    if (!content) return;
    $$('[data-channel]').forEach((item) => item.classList.toggle('active', item === button));
    $('[data-channel-title]').textContent = content[0];
    $('[data-channel-description]').textContent = content[1];
    $('[data-channel-copy]').textContent = content[2];
    if (button.dataset.channel === 'matchmaking') $('[data-room-browser]').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  $('[data-live-rooms]').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-join-code]');
    if (!button) return;
    button.disabled = true;
    try {
      await joinRoom(button.dataset.joinCode);
    } catch (error) {
      button.querySelector('small').textContent = error.message;
      button.disabled = false;
    }
  });
  $('[data-refresh-rooms]').addEventListener('click', loadRoomList);

  $('[data-start-match]').addEventListener('click', async (event) => {
    if (!currentRoom?.live || !currentRoom.isHost) return;
    event.currentTarget.disabled = true;
    try {
      const payload = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({ action: 'game-start', code: currentRoom.code }) });
      renderMatch(payload.match);
    } catch (error) {
      $('[data-room-note]').textContent = error.message;
      event.currentTarget.disabled = false;
    }
  });

  $('[data-match-options]').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-answer-index]');
    if (!button || !currentMatch?.canPlay || !currentRoom?.live || currentMatch.yourAnswer) return;
    const number = currentMatch.questionNumber;
    $$('[data-answer-index]', $('[data-match-options]')).forEach((item) => { item.disabled = true; });
    $('[data-match-feedback]').textContent = 'Recording your answer…';
    try {
      const payload = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({
        action: 'game-answer', code: currentRoom.code, questionNumber: number, selectedIndex: Number(button.dataset.answerIndex)
      }) });
      renderMatch(payload.match);
    } catch (error) {
      $('[data-match-feedback]').textContent = error.message;
      await refreshMatch();
    }
  });

  $('[data-copy]').addEventListener('click', async (event) => {
    try {
      await navigator.clipboard.writeText(location.href);
      event.currentTarget.textContent = 'Invite copied';
    } catch {
      event.currentTarget.textContent = 'Copy address bar URL';
    }
  });
  $('[data-new-room]').addEventListener('click', () => {
    if (currentRoom?.live) api('/api/lobbies', { method: 'POST', body: JSON.stringify({ action: 'leave', code: currentRoom.code }) }).catch(() => {});
    currentRoom = null;
    currentMatch = null;
    roomPanel.hidden = true;
    history.replaceState(null, '', location.pathname);
    form.scrollIntoView({ behavior: 'smooth' });
  });
  $('[data-edit-name]').addEventListener('click', () => {
    nameForm.elements.displayName.value = identity;
    nameDialog.showModal();
  });
  nameDialog.addEventListener('close', async () => {
    if (nameDialog.returnValue !== 'save') return;
    setIdentity(nameForm.elements.displayName.value);
    if (!serviceAvailable) return;
    try {
      await syncSession();
      if (currentRoom?.live) {
        const payload = await api('/api/lobbies', { method: 'POST', body: JSON.stringify({ action: 'join', code: currentRoom.code }) });
        renderRoom(payload.room, false, true);
      }
    } catch {
      setServiceState('offline', 'Live rooms unavailable');
    }
  });

  document.addEventListener('geek:wallet', (event) => {
    const wallet = event.detail || {};
    const identityState = $('[data-identity-state]');
    if (identityState) identityState.textContent = wallet.verified ? 'WALLET VERIFIED' : wallet.connected ? 'WALLET LINKED' : serviceAvailable ? 'LIVE PLAYER' : 'LOCAL IDENTITY';
    document.body.classList.toggle('wallet-verified', Boolean(wallet.verified));
  });

  window.addEventListener('pagehide', () => {
    if (!currentRoom?.live || !navigator.sendBeacon) return;
    navigator.sendBeacon('/api/lobbies', new Blob([JSON.stringify({ action: 'leave', code: currentRoom.code })], { type: 'application/json' }));
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { refreshMatch(); heartbeat(); }
  });

  const initialize = async () => {
    setIdentity(identity);
    setServiceState('checking', 'Checking live presence…');
    try {
      await syncSession();
      await loadRoomList();
      startPolling();
    } catch {
      setServiceState('offline', 'Live rooms unavailable');
      renderRoomList([]);
    }

    const params = new URLSearchParams(location.search);
    if (!params.has('lobby')) return;
    if (!serviceAvailable) return;
    try {
      await joinRoom(params.get('lobby'), false);
    } catch (error) {
      $('[data-room-list-message]').textContent = error.message;
    }
  };

  initialize();
})();
