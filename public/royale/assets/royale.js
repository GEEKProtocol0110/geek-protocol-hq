(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const labels = { kaspa: 'Kaspa', 'video-games': 'Video Games', 'science-fiction': 'Science Fiction', technology: 'Technology', movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop Culture' };
  let room = null, acting = false, refreshing = false, ready = false, offline = false, pollTimer = null, boundary = '', confirmedAt = 0;
  let serverAt = 0, receivedAt = 0;
  let requestVersion = 0, rosterSignature = '';
  const now = () => serverAt + performance.now() - receivedAt;
  const say = text => { $('[data-status]').textContent = text; };
  const showError = error => { $('[data-error-text]').textContent = error.message; $('[data-error]').hidden = false; };
  const api = async (path, body) => {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(path, { method: body ? 'POST' : 'GET', credentials: 'same-origin', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
      const payload = await response.json();
      if (!response.ok) { const error = new Error(payload.error || 'Royale is unavailable.'); error.status = response.status; error.code = payload.code; throw error; }
      return payload;
    } catch (error) {
      if (controller.signal.aborted) throw new Error('The request took too long. Refresh saved state before trying again.');
      throw error;
    } finally { clearTimeout(timer); }
  };
  const stopPoll = () => { clearTimeout(pollTimer); pollTimer = null; };
  const schedulePoll = () => {
    stopPoll();
    if (!room || document.hidden || ['finished', 'cancelled'].includes(room.state) || offline) return;
    const base = room.state === 'waiting' ? 5000 : 4000;
    pollTimer = setTimeout(refresh, base + Math.floor(Math.random() * 400));
  };
  const controls = () => {
    const busy = acting || !ready;
    $('[data-setup]').querySelectorAll('button').forEach(button => { button.disabled = busy; });
    if (!room) return;
    const you = room.players.find(p => p.slot === room.yourSlot), waiting = room.state === 'waiting';
    $('[data-ready]').hidden = !waiting;
    $('[data-ready]').textContent = you?.ready ? 'Not ready' : 'Ready up';
    $('[data-ready]').disabled = busy || offline;
    $('[data-start]').hidden = !waiting || !room.isHost;
    $('[data-start]').disabled = busy || offline || !room.canStart;
    $('[data-cancel]').hidden = !room.isHost || ['finished', 'cancelled'].includes(room.state);
    $('[data-cancel]').disabled = busy || offline;
    $('[data-leave]').hidden = room.isHost && !['finished', 'cancelled'].includes(room.state);
    $('[data-leave]').disabled = busy;
    $('[data-new]').hidden = !['finished', 'cancelled'].includes(room.state);
    $('[data-reconnect]').hidden = !offline;
    const remaining = room.state === 'question' ? room.questionEndsAt - now() : 0;
    $('[data-answers]').querySelectorAll('button').forEach(button => { button.disabled = busy || offline || !room.canAnswer || remaining <= 0; });
    $('[data-roster]').querySelectorAll('button').forEach(button => { button.disabled = busy || offline; });
  };
  const renderRoster = r => {
    const signature = JSON.stringify([r.state, r.isHost, r.players]);
    if (signature === rosterSignature) return;
    rosterSignature = signature;
    const focusedSeat = document.activeElement?.dataset.kick;
    $('[data-roster-summary]').textContent = `· ${r.players.length} seats · ${r.remaining} remain`;
    $('[data-roster]').replaceChildren(...r.players.map(p => {
      const li = document.createElement('li'); li.dataset.out = String(!p.alive);
      const div = document.createElement('div'), name = document.createElement('strong'), note = document.createElement('small');
      name.textContent = `${p.name}${p.slot === r.yourSlot ? ' · you' : ''}`;
      const state = r.state === 'waiting' ? `${p.ready ? 'Ready' : 'Not ready'} · ${p.online ? 'online' : 'offline'}` : p.alive ? 'Still standing' : `Out: ${p.eliminationReason} · question ${p.eliminatedAt}`;
      note.textContent = `Seat ${p.slot}${p.host ? ' · host' : ''} · ${state}`; div.append(name, note); li.append(div);
      if (r.isHost && r.state === 'waiting' && !p.host) { const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.kick = p.slot; remove.textContent = 'Remove'; remove.setAttribute('aria-label', `Remove ${p.name}, seat ${p.slot}`); li.append(remove); }
      return li;
    }));
    if (focusedSeat) $(`[data-kick="${Number(focusedSeat)}"]`)?.focus({ preventScroll: true });
  };
  const render = r => {
    const old = room, previous = old ? `${old.id}:${old.state}:${old.questionNumber}` : '';
    room = r; serverAt = r.serverNow; receivedAt = performance.now(); confirmedAt = receivedAt; offline = false;
    $('[data-error]').hidden = true; $('[data-room]').hidden = false; $('[data-setup]').hidden = true;
    $('[data-room-category]').textContent = `${labels[r.category]} · TRIVIA ROYALE`;
    $('[data-seat-count]').textContent = r.state === 'waiting' ? `${r.players.length} / ${r.capacity}` : `${r.remaining} standing`;
    $('[data-room-title]').textContent = { waiting: 'Gather your crew.', starting: 'The battle is about to begin.', question: 'Keep your mind in the game.', review: 'See who remains.', finished: 'The battle is complete.', cancelled: 'The host ended this event.' }[r.state];
    const invite = new URL(location.href); invite.search = new URLSearchParams({ code: r.code }).toString(); invite.hash = '';
    $('[data-invite]').value = invite.href; $('[data-room-code]').textContent = r.code; $('[data-invitation]').hidden = r.state !== 'waiting';
    history.replaceState(null, '', `${location.pathname}?${new URLSearchParams({ code: r.code })}`);
    const you = r.players.find(p => p.slot === r.yourSlot);
    $('[data-player-state]').textContent = r.state === 'waiting' ? you?.ready ? 'You are ready. The host starts when everyone is ready.' : 'Read the rules, then choose Ready up.' : you?.alive ? 'You are still standing.' : 'You are out. You can stay and watch the battle.';
    const cues = { waiting: 'Share the invitation. Everyone must be online and ready; the host locks the roster when starting.', starting: 'The roster is locked. The first question arrives after the five-second countdown.', question: 'Choose your first answer before the clock closes. Correctness is revealed together.', review: r.review?.speedTie ? 'The correct response times are exactly tied. That group stays together.' : 'Wrong and missing answers are out. The slowest correct time group is out too.', finished: 'The server has saved this event’s result. GIGA salutes the minds that stayed standing.', cancelled: 'This event was ended by its host. There is no winner.' };
    $('[data-ace-cue]').textContent = cues[r.state];
    $('[data-question-panel]').hidden = !['starting', 'question', 'review'].includes(r.state);
    $('[data-question-step]').textContent = r.state === 'starting' ? 'Starting together' : `Question ${r.questionNumber} · up to ${r.questionCount}`;
    $('[data-question]').textContent = r.question?.prompt || 'Get ready, Geeks.';
    const roundChanged = !old || old.id !== r.id || old.questionNumber !== r.questionNumber || Boolean(old.question) !== Boolean(r.question);
    if (roundChanged) $('[data-answers]').replaceChildren(...(r.question?.options || []).map((option, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.answer = index; button.textContent = option;
      button.addEventListener('click', () => act('answer', { questionNumber: room.questionNumber, selectedIndex: index })); return button;
    }));
    $('[data-answers]').querySelectorAll('button').forEach(button => {
      button.dataset.selected = String(Number(button.dataset.answer) === r.yourAnswer?.selectedIndex);
      button.setAttribute('aria-pressed', button.dataset.selected);
      button.dataset.correct = String(Number(button.dataset.answer) === r.review?.correctIndex);
    });
    $('[data-answer-status]').textContent = r.state === 'question' ? r.yourAnswer ? 'Answer locked. Wait for the shared reveal.' : you?.alive ? 'Your first answer locks. You cannot change it.' : 'Spectating. Your answers are closed.' : '';
    $('[data-review]').hidden = r.state !== 'review';
    if (r.review) {
      $('[data-correct-answer]').textContent = `Correct answer: ${r.question.options[r.review.correctIndex]}`;
      $('[data-explanation]').textContent = r.review.explanation;
      $('[data-source]').replaceChildren();
      try { const url = new URL(r.review.source); if (url.protocol === 'https:') { const a = document.createElement('a'); a.href = url.href; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'Read the question source ↗'; $('[data-source]').append(a); } } catch { /* No supported source URL. */ }
      $('[data-round-result]').textContent = `${r.review.remaining} Geeks remain.${r.yourAnswer?.elapsedMs !== undefined ? ` Your server response time: ${(r.yourAnswer.elapsedMs / 1000).toFixed(3)}s.` : ''}`;
    }
    const finished = ['finished', 'cancelled'].includes(r.state);
    $('[data-result]').hidden = !finished;
    if (finished) {
      const winner = r.result.winners.includes(r.yourSlot), names = r.players.filter(p => r.result.winners.includes(p.slot)).map(p => `${p.name} (seat ${p.slot})`);
      $('[data-medal]').hidden = !winner;
      $('[data-result-title]').textContent = r.state === 'cancelled' ? 'Event ended.' : !names.length ? 'No mind remained this time.' : names.length === 1 ? winner ? 'You are the Last Mind Standing.' : `${names[0]} is the Last Mind Standing.` : 'The last minds share victory.';
      $('[data-result-copy]').textContent = names.length ? `${names.join(', ')}${winner ? ' · Your Royale room-result medal is earned.' : ''} This result awards no XP or monetary rewards.` : 'Start another event when your crew is ready.';
      if (!old || !['finished', 'cancelled'].includes(old.state)) { $('[data-result-title]').tabIndex = -1; $('[data-result-title]').focus({ preventScroll: true }); $('[data-result]').scrollIntoView({ block: 'start', behavior: 'instant' }); }
    }
    renderRoster(r); controls(); clock(); schedulePoll();
    say('Your Royale is connected. The server controls the clock and elimination.');
    if (`${r.id}:${r.state}:${r.questionNumber}` !== previous && r.state === 'question') { $('[data-question]').focus({ preventScroll: true }); $('[data-question-panel]').scrollIntoView({ block: 'start', behavior: 'instant' }); }
  };
  const connectionLost = error => {
    offline = true; stopPoll(); showError(error); controls();
    say('Connection lost. The question clock continues. Reconnect to recover your saved seat and answer.');
  };
  async function refresh() {
    if (!room || refreshing || acting) return;
    refreshing = true; const code = room.code, id = room.id, version = requestVersion;
    try { const payload = await api(`/api/royale?${new URLSearchParams({ code })}`); if (room?.id === id && requestVersion === version && !acting) render(payload.royale); }
    catch (error) { if (room?.id === id && requestVersion === version && !acting) connectionLost(error); }
    finally { refreshing = false; }
  }
  async function act(action, extra = {}) {
    if (!room || acting || offline) return;
    requestVersion++; stopPoll(); acting = true; controls(); const code = room.code, id = room.id;
    try { const payload = await api('/api/royale', { action, code, eventId: id, ...extra }); if (room?.id === id) render(payload.royale); }
    catch (error) { if (error.status === 409 || error.status === 403) { showError(error); } else connectionLost(error); }
    finally { acting = false; controls(); schedulePoll(); }
  }
  const enter = async (action, data) => {
    if (acting || !ready) return;
    acting = true; controls();
    try {
      const displayName = $('[data-create-form]').elements.displayName.value.trim();
      if (!displayName) throw new Error('Enter your public display name before joining.');
      await api('/api/session', { action: 'rename', displayName });
      render((await api('/api/royale', { action, ...data })).royale);
      $('[data-room]').scrollIntoView({ block: 'start', behavior: 'instant' });
    } catch (error) { showError(error); }
    finally { acting = false; controls(); }
  };
  const reset = () => { requestVersion++; rosterSignature = ''; room = null; offline = false; stopPoll(); $('[data-room]').hidden = true; $('[data-setup]').hidden = false; $('[data-reconnect]').hidden = true; $('[data-error]').hidden = true; history.replaceState(null, '', location.pathname); say('Create a new room or join another invitation.'); controls(); };
  const clock = () => {
    if (!room) return;
    const active = ['starting', 'question', 'review'].includes(room.state);
    if (!active) return;
    const end = room.state === 'starting' ? room.startsAt : room.state === 'question' ? room.questionEndsAt : room.reviewEndsAt;
    const remaining = Math.max(0, end - now()), total = room.state === 'starting' || room.state === 'review' ? 5000 : 15000;
    $('[data-clock]').textContent = `${Math.ceil(remaining / 1000)}s`;
    $('[data-timer]').style.width = `${Math.min(100, remaining / total * 100)}%`;
    if (!offline && confirmedAt && performance.now() - confirmedAt > 15000) connectionLost(new Error('Your room state is stale. Reconnect before answering.'));
    controls();
    const key = `${room.id}:${room.state}:${room.questionNumber}`;
    if (!remaining && boundary !== key && !acting && !refreshing && !offline) { boundary = key; refresh(); }
  };
  $('[data-create-form]').addEventListener('submit', event => { event.preventDefault(); enter('create', { category: event.currentTarget.elements.category.value, capacity: Number(event.currentTarget.elements.capacity.value) }); });
  $('[data-join-form]').addEventListener('submit', event => { event.preventDefault(); enter('join', { code: event.currentTarget.elements.code.value.trim().toUpperCase() }); });
  $('[data-ready]').addEventListener('click', () => act('ready', { ready: !room.players.find(p => p.slot === room.yourSlot)?.ready }));
  $('[data-start]').addEventListener('click', () => act('start'));
  $('[data-roster]').addEventListener('click', event => { const button = event.target.closest('[data-kick]'); if (button) act('kick', { slot: Number(button.dataset.kick) }); });
  $('[data-cancel]').addEventListener('click', () => { if (confirm('End this Royale for everyone? This event will have no winner.')) act('cancel'); });
  $('[data-leave]').addEventListener('click', async () => {
    if (!room || acting || refreshing) return;
    if (['finished', 'cancelled'].includes(room.state)) { reset(); return; }
    if (!confirm(room.state === 'waiting' ? 'Leave this waiting room?' : 'Leave this Royale? You will be eliminated.')) return;
    acting = true; controls();
    try { await api('/api/royale', { action: 'leave', code: room.code, eventId: room.id }); reset(); }
    catch (error) { connectionLost(error); }
    finally { acting = false; controls(); }
  });
  $('[data-new]').addEventListener('click', reset);
  $('[data-copy]').addEventListener('click', async () => { try { await navigator.clipboard.writeText($('[data-invite]').value); say('Invitation copied. Share it with your crew.'); } catch { $('[data-invite]').select(); say('Select and copy the invitation link.'); } });
  const connect = async () => {
    if (room) { await refresh(); return; }
    try {
      const payload = await api('/api/session', {}); ready = true; $('[data-create-form]').elements.displayName.value = payload.player.name; controls();
      $('[data-error]').hidden = true;
      const code = new URLSearchParams(location.search).get('code');
      if (code) {
        $('[data-join-form]').elements.code.value = code;
        try { render((await api(`/api/royale?${new URLSearchParams({ code })}`)).royale); }
        catch (error) { if (error.status === 403) say('Invitation ready. Choose your public name and Join Royale to take a seat.'); else throw error; }
      } else say('Your player is ready. Host a Royale or enter an invitation code.');
      $('[data-reconnect]').hidden = true;
    } catch (error) { ready = false; controls(); showError(error); $('[data-reconnect]').hidden = false; say('Your player could not connect. Retry when the service is available.'); }
  };
  $('[data-reconnect]').addEventListener('click', connect);
  $('[data-error-retry]').addEventListener('click', connect);
  document.addEventListener('visibilitychange', () => { if (document.hidden) stopPoll(); else if (room) refresh(); });
  window.addEventListener('pagehide', stopPoll);
  setInterval(clock, 200);
  connect();
})();
