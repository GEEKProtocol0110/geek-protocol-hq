import { geekSvg, geekDescription } from '../../assets/geek-avatar.js';

const $ = selector => document.querySelector(selector);
const categories = { kaspa: 'Kaspa', 'video-games': 'Video Games', 'science-fiction': 'Science Fiction', technology: 'Technology', movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop Culture' };
let duel = null, connected = false, loading = false, acting = false, answerPending = false, initializing = false, offset = 0, boundary = '';
const say = text => { $('[data-message]').textContent = text; };
const api = async (path, body) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(path, { credentials: 'same-origin', signal: controller.signal,
      ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.error || 'Duel service unavailable.'), { code: data.code, status: response.status });
    return data;
  } finally { clearTimeout(timeout); }
};
const escape = value => String(value || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const now = () => Date.now() + offset;
const available = () => connected && !acting;
const you = () => duel?.players.find(p => p.slot === duel.yourSlot);
const refresh = async () => {
  if (!duel || loading || acting || document.hidden || you()?.left) return;
  loading = true;
  try { render((await api(`/api/duel?code=${encodeURIComponent(duel.code)}`)).duel); }
  catch (error) { connectionLost(error); }
  finally { loading = false; }
};
const connectionLost = error => {
  connected = false;
  say(`${error.message} Your seat stays reserved. Questions continue; reconnect within 45 seconds.`);
  updateControls();
};
const updateControls = () => {
  if (!duel) return;
  const me = you(), finished = duel.state === 'finished', waiting = duel.state === 'waiting';
  $('[data-ready]').hidden = !waiting;
  $('[data-ready]').textContent = me.ready ? 'Ready · waiting for opponent' : 'Ready up';
  $('[data-ready]').disabled = !available() || me.ready || me.left || duel.players.length < 2;
  $('[data-rematch]').hidden = !finished || duel.players.length !== 2 || duel.players.some(p => p.left);
  $('[data-rematch]').textContent = me.rematch ? 'Rematch requested · waiting' : 'Request rematch';
  $('[data-rematch]').disabled = !available() || me.rematch;
  $('[data-reconnect]').hidden = connected || me.left;
  $('[data-leave]').hidden = me.left;
  $('[data-leave]').disabled = !available();
  $('[data-new]').hidden = !finished && !me.left;
  $('[data-new]').disabled = acting || (!connected && !me.left);
  $('[data-invitation]').hidden = !waiting || duel.players.length === 2;
  document.querySelectorAll('[data-answer]').forEach(button => {
    button.disabled = !available() || answerPending || Boolean(duel.yourAnswer) || duel.state !== 'playing' || now() >= duel.questionEndsAt;
    button.classList.toggle('chosen', duel.yourAnswer?.selectedIndex === Number(button.dataset.answer));
  });
};
const render = d => {
  if (!d || (duel?.code === d.code && (d.generation < duel.generation || d.serverNow < duel.serverNow))) return;
  const old = duel;
  duel = d; connected = true; offset = d.serverNow - Date.now();
  $('[data-setup]').hidden = true; $('[data-room]').hidden = false;
  $('[data-room-category]').textContent = `${categories[d.category] || 'Trivia'} · FREE DUEL`;
  $('[data-round-label]').textContent = `MATCH ${d.generation}`;
  const title = d.state === 'waiting' ? d.players.length < 2 ? 'Invite your opponent.' : 'Both Geeks, ready up.' : d.state === 'starting' ? 'The challenge begins.' : d.state === 'finished' ? 'Duel complete.' : 'Make every answer count.';
  $('[data-room-title]').textContent = title;
  const params = new URLSearchParams({ code: d.code });
  const url = `${location.origin}${location.pathname}?${params}`;
  if (location.search !== `?${params}`) history.replaceState(null, '', `?${params}`);
  $('[data-invite-url]').value = url; $('[data-code]').textContent = d.code;
  $('[data-fighters]').innerHTML = [1, 2].map(slot => {
    const p = d.players.find(item => item.slot === slot);
    if (!p) return '<article class="fighter"><div class="fighter-art" aria-hidden="true">?</div><h3>Opponent wanted</h3><small>SHARE YOUR INVITATION</small><strong>—</strong></article>';
    const art = p.avatar.id === 'giga-builder' ? `<div class="fighter-art" role="img" aria-label="${escape(geekDescription(p.avatar.customization))}">${geekSvg(p.avatar.customization)}</div>` : `<div class="fighter-art"><img src="${escape(p.avatar.asset)}" alt="${escape(p.avatar.name)}" /></div>`;
    const status = p.left ? 'LEFT THE DUEL' : now() - p.lastSeen > 12_000 && !['waiting', 'finished'].includes(d.state) ? 'RECONNECTING · CLOCK CONTINUES' : d.state === 'waiting' ? p.ready ? 'READY' : 'WAITING TO READY UP' : d.state === 'finished' && p.rematch ? 'REMATCH REQUESTED' : 'IN THE DUEL';
    return `<article class="fighter ${slot === d.yourSlot ? 'you' : ''}">${art}<small>${slot === d.yourSlot ? 'YOUR GEEK' : 'OPPONENT'}</small><h3>${escape(p.name)}</h3><strong>${p.score.toLocaleString()}</strong><small>${p.correct} CORRECT · ${status}</small></article>`;
  }).join('');
  $('[data-question-panel]').hidden = !['starting', 'playing'].includes(d.state);
  $('[data-question-number]').textContent = d.state === 'starting' ? 'Ready together' : `Question ${d.questionNumber} / ${d.questionCount}`;
  const changed = !old || old.id !== d.id || old.questionNumber !== d.questionNumber || old.state !== d.state;
  if (changed) {
    $('[data-question]').textContent = d.state === 'starting' ? 'Get ready. Your first question is on its way.' : d.question?.prompt || '';
    $('[data-answers]').replaceChildren();
    d.question?.options.forEach((option, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.dataset.answer = index; button.textContent = `${index + 1}. ${option}`; $('[data-answers]').append(button);
    });
    if (d.state === 'playing') $('[data-question]').setAttribute('tabindex', '-1');
    if (d.state === 'playing' && old?.state !== 'waiting') $('[data-question]').focus({ preventScroll: true });
  }
  $('[data-feedback]').textContent = d.yourAnswer ? d.yourAnswer.correct ? `Correct. +${d.yourAnswer.scoreAdded} room points.` : 'Answer recorded. No points this question.' : d.state === 'starting' ? 'Both players see the same question and answer order.' : 'Choose one answer before the clock closes. Your first answer counts.';
  $('[data-result]').hidden = d.state !== 'finished';
  if (d.result) {
    const names = Object.fromEntries(d.players.map(p => [p.slot, p.name]));
    const verdict = d.result.reason === 'cancelled' ? 'Duel cancelled.' : d.result.reason === 'abandoned' ? 'Both connections expired.' : d.result.winner === 0 ? 'It’s a draw.' : d.result.winner === d.yourSlot ? 'Your Geek wins!' : `${names[d.result.winner]} wins.`;
    const reasons = { completed: 'All ten questions are complete. The final scores decide the result.', forfeit: 'One player left the Duel. The other player wins by forfeit.', disconnect: 'One player’s connection exceeded the 45-second grace period.', abandoned: 'Neither player returned within the connection grace period. No winner is recorded.', cancelled: 'A player left before the match started. No winner is recorded.' };
    $('[data-result-title]').textContent = verdict; $('[data-result-copy]').textContent = reasons[d.result.reason] || '';
    if (old?.state !== 'finished') { $('[data-result-title]').setAttribute('tabindex', '-1'); $('[data-result-title]').focus({ preventScroll: true }); }
    say('Final scores are saved for this room. Duel points do not change your ranked progression.');
  } else say(d.state === 'waiting' ? d.players.length < 2 ? 'Copy the invitation link and send it to a friend.' : 'Both players must choose Ready up. The clock starts together.' : 'Live Duel connected. The server controls the clock and points.');
  updateControls(); clock();
};
const clock = () => {
  if (!duel || !['starting', 'playing'].includes(duel.state)) return;
  const end = duel.state === 'starting' ? duel.startsAt : duel.questionEndsAt;
  const remaining = Math.max(0, end - now());
  $('[data-clock]').textContent = `${Math.ceil(remaining / 1000)}s`;
  $('[data-timer-bar]').style.width = `${Math.min(100, remaining / (duel.state === 'starting' ? 3000 : 15_000) * 100)}%`;
  updateControls();
  const key = `${duel.id}:${duel.state}:${duel.questionNumber}`;
  if (!remaining && boundary !== key) { boundary = key; refresh(); }
};
const act = async (action, extra = {}) => {
  if (!duel || acting) return;
  acting = true; updateControls();
  try { render((await api('/api/duel', { action, code: duel.code, matchId: duel.id, ...extra })).duel); }
  catch (error) { if (error.status === 409) { say(error.message); } else connectionLost(error); }
  finally { acting = false; answerPending = false; updateControls(); await refresh(); }
};
const enter = async (action, fields) => {
  if (acting) return;
  acting = true;
  document.querySelectorAll('[data-setup] button').forEach(button => { button.disabled = true; });
  try {
    const displayName = $('[data-create-form]').elements.displayName.value.trim();
    if (displayName) await api('/api/session', { displayName });
    render((await api('/api/duel', { action, ...fields })).duel);
    $('[data-room]').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  } catch (error) { say(error.message); }
  finally { acting = false; document.querySelectorAll('[data-setup] button').forEach(button => { button.disabled = !connected; }); updateControls(); }
};
$('[data-create-form]').addEventListener('submit', event => { event.preventDefault(); enter('create', { category: event.currentTarget.elements.category.value }); });
$('[data-join-form]').addEventListener('submit', event => { event.preventDefault(); enter('join', { code: event.currentTarget.elements.code.value.trim().toUpperCase() }); });
$('[data-ready]').addEventListener('click', () => act('ready'));
$('[data-rematch]').addEventListener('click', () => act('rematch'));
$('[data-answers]').addEventListener('click', event => {
  const button = event.target.closest('[data-answer]');
  if (!button || button.disabled || answerPending || duel.yourAnswer) return;
  answerPending = true; act('answer', { questionNumber: duel.questionNumber, selectedIndex: Number(button.dataset.answer) });
});
$('[data-copy]').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('[data-invite-url]').value); $('[data-copy]').textContent = 'Invite copied'; }
  catch { $('[data-invite-url]').select(); say('Copy the selected invitation link.'); }
});
$('[data-leave]').addEventListener('click', () => $('[data-leave-dialog]').showModal());
$('[data-leave-dialog]').addEventListener('close', () => { if ($('[data-leave-dialog]').returnValue === 'leave') act('leave'); });
$('[data-new]').addEventListener('click', async () => {
  if (duel.state !== 'finished' || acting) return;
  if (!you().left) { await act('leave'); if (!you().left) return; }
  duel = null; $('[data-room]').hidden = true; $('[data-setup]').hidden = false; history.replaceState(null, '', location.pathname); say('Choose a category and create your next Duel.'); $('[data-create-form]').elements.category.focus();
});
$('[data-reconnect]').addEventListener('click', async () => { await refresh(); });
const initialize = async () => {
  if (initializing) return; initializing = true;
  $('[data-retry-service]').hidden = true;
  try {
    const data = await api('/api/session', {}); connected = true; $('[data-create-form]').elements.displayName.value = data.player.name;
    document.querySelectorAll('[data-setup] button').forEach(button => { button.disabled = false; });
    say('Your player is connected. Create a Duel or open an invitation.');
    const code = new URLSearchParams(location.search).get('code');
    if (code) {
      try { render((await api(`/api/duel?code=${encodeURIComponent(code)}`)).duel); }
      catch (error) { if (error.code === 'DUEL_NOT_PLAYER') await enter('join', { code }); else throw error; }
    }
  } catch (error) { say(error.message); $('[data-retry-service]').hidden = false; }
  finally { initializing = false; }
};
$('[data-retry-service]').addEventListener('click', initialize);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
setInterval(() => { if (!document.hidden) refresh(); }, 3000);
setInterval(() => { if (!document.hidden) clock(); }, 250);
initialize();
