(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const list = $('[data-discovery-list]'), status = $('[data-discovery-status]'), refresh = $('[data-discovery-refresh]');
  const labels = { kaspa: 'Kaspa', 'video-games': 'Video Games', 'science-fiction': 'Science Fiction', technology: 'Technology', movies: 'Movies', history: 'History', comics: 'Comics', 'pop-culture': 'Pop Culture' };
  let generation = 0, controller;
  const clear = () => { generation++; controller?.abort(); list.replaceChildren(); };
  const load = async () => {
    clear(); const version = generation;
    controller = new AbortController(); const current = controller, signal = current.signal;
    const timer = setTimeout(() => current.abort(), 15000);
    refresh.disabled = true; status.textContent = 'Loading public rooms…';
    try {
      const response = await fetch('/api/royale?discover=1', { credentials: 'same-origin', signal });
      const payload = await response.json();
      if (version !== generation) return;
      if (!response.ok || !payload.ok || !Array.isArray(payload.discovery?.rooms)) throw new Error('unavailable');
      const rooms = payload.discovery.rooms;
      if (rooms.length > 20 || rooms.some(r => !/^ROY-[A-Z2-9]{8}$/.test(r.code) || !Object.hasOwn(labels, r.category) || !Number.isInteger(r.seats) || r.seats < 1 || !Number.isInteger(r.capacity) || r.capacity < 2 || r.capacity > 100 || r.seats >= r.capacity || !Number.isInteger(r.online) || r.online < 1 || r.online > r.seats)) throw new Error('invalid');
      list.replaceChildren(...rooms.map(r => {
        const li = document.createElement('li'), info = document.createElement('div'), name = document.createElement('strong'), count = document.createElement('span'), choose = document.createElement('button');
        name.textContent = `${labels[r.category]} · ${r.code}`;
        count.textContent = `${r.seats} / ${r.capacity} seats · ${r.online} online at refresh`;
        choose.type = 'button'; choose.className = 'button button-secondary'; choose.textContent = 'Use this code';
        choose.addEventListener('click', () => {
          const code = $('[data-join-form]').elements.code;
          code.value = r.code; code.focus(); code.scrollIntoView({ block: 'center' });
          status.textContent = 'Code selected. Check your public name and choose Join Royale above.';
        });
        info.append(name, count); li.append(info, choose); return li;
      }));
      status.textContent = rooms.length ? 'Snapshot of available waiting rooms. Refresh for current seats.' : 'No public waiting rooms are available right now. Host one or use a friend’s invitation.';
    } catch {
      if (version === generation) { list.replaceChildren(); status.textContent = 'Public rooms could not be loaded. Refresh to try again.'; }
    } finally { clearTimeout(timer); if (version === generation) refresh.disabled = false; }
  };
  refresh.addEventListener('click', load);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clear(); status.textContent = 'Refresh rooms when you return.'; refresh.disabled = false; } else if (!$('[data-setup]').hidden) load(); });
  window.addEventListener('pagehide', clear);
  load();
})();
