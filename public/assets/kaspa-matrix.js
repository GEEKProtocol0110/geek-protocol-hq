// Decorative Kaspa code rain behind page content. No requests, player records, game hooks or input capture.
// One capped loop; paused when hidden, still under reduced motion and off inside individual game boards.
export const MATRIX_KEY = 'geek-matrix-background';
export const initKaspaMatrix = () => {
  const root = document.documentElement, body = document.body, path = location.pathname;
  if (!body || root.dataset.kaspaMatrix) return;
  // Individual boards, owner and sign-in surfaces stay clean. Quiz and lobby routes get a dim still frame.
  if (/^\/games\/[^/]+\//.test(path) || /^\/(?:ops|ops-login|sign-in|moderate)\//.test(path)) return;
  const quietRoute = /^\/(?:play|practice|quest|duel|royale|memory|challenges)\//.test(path);
  root.dataset.kaspaMatrix = 'ready';
  const media = query => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : { matches: false, addEventListener() {} });
  const reduced = media('(prefers-reduced-motion: reduce)'), forced = media('(forced-colors: active)');
  const saveData = Boolean(navigator.connection?.saveData);
  const read = () => { try { return localStorage.getItem(MATRIX_KEY); } catch { return null; } };
  const write = value => { try { localStorage.setItem(MATRIX_KEY, value); } catch { /* Storage is optional. */ } };
  // Default on, except under reduced motion where a visitor must opt in (and then sees one still frame).
  const enabled = () => { const saved = read(); return saved === 'on' || (saved !== 'off' && !reduced.matches); };

  if (!document.querySelector('link[data-kaspa-matrix-css]')) {
    const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/assets/kaspa-matrix.css'; link.dataset.kaspaMatrixCss = '';
    document.head?.append(link);
  }
  const layer = document.createElement('div');
  layer.className = 'kaspa-matrix'; layer.dataset.kaspaMatrixLayer = ''; layer.setAttribute('aria-hidden', 'true');
  // Critical placement through CSSOM so the layer never enters document flow if the stylesheet is late.
  // Most sections paint opaque backgrounds, so the veil sits just above them (z-index 1, below the
  // header, menus and dialogs) as a faint, input-transparent layer rather than hidden behind them.
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '1', pointerEvents: 'none', overflow: 'hidden' });
  const canvas = document.createElement('canvas'); canvas.className = 'kaspa-matrix-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const glitch = document.createElement('div'); glitch.className = 'kaspa-matrix-glitch'; glitch.setAttribute('aria-hidden', 'true');
  layer.append(canvas); body.classList.add('kaspa-matrix-host'); body.append(layer);
  const slices = document.createElement('div'); slices.className = 'kaspa-matrix-slices'; slices.setAttribute('aria-hidden', 'true');
  Object.assign(slices.style, { position: 'fixed', inset: '0', pointerEvents: 'none' });
  slices.append(glitch); body.append(slices);
  const ctx = canvas.getContext?.('2d', { alpha: true });

  const glyphs = 'ҜK₭0123456789ABCDEF◇◆⬡◈⋔⟁△⇉⊶⋮∷'.split(''); // Kaspa-style K, digits, hex, BlockDAG marks
  const words = ['KAS', 'GEEK', 'DAG', '₭AS', 'BPS', 'GHOST'];
  const pick = list => list[Math.floor(Math.random() * list.length)];
  let width = 0, height = 0, size = 16, columns = [], frame = 0, previous = 0, nextBurst = 0, burstEnd = 0, resizeTimer = 0, quiet = quietRoute;
  const small = () => (window.innerWidth || 0) < 700;
  const fps = () => (small() || saveData ? 20 : 24);
  const playing = () => body.classList.contains('is-playing') || Boolean(document.querySelector('[data-screen="quiz"].active'));
  const canMove = () => enabled() && !quiet && !reduced.matches && !forced.matches && !saveData && !document.hidden && !playing() && Boolean(ctx);

  const newColumn = (x, scatter) => {
    const word = Math.random() < 0.16 ? pick(words) : '';
    return { x, y: scatter ? Math.random() * -height : -size * Math.random() * 20, speed: (0.35 + Math.random() * 0.65) * size, word, index: 0, bright: Math.random() < 0.08 };
  };
  const resize = () => {
    if (!ctx) return;
    width = Math.min(window.innerWidth || 1280, 3000); height = Math.min(window.innerHeight || 800, 2000);
    const dpr = Math.min(window.devicePixelRatio || 1, small() ? 1 : 1.5);
    size = small() ? 15 : 17;
    canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`; canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const spacing = small() ? size * 1.9 : size * 1.25; // fewer columns on phones
    const count = Math.min(small() ? 26 : 110, Math.ceil(width / spacing));
    columns = Array.from({ length: count }, (_, i) => newColumn(Math.round(i * spacing + spacing / 2), true));
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`; ctx.textAlign = 'center';
    still();
    if (mode === 'moving' && !frame) sync();
  };
  const glyphFor = column => (column.word ? column.word[column.index % column.word.length] : pick(glyphs));
  const step = () => {
    // Fade previous glyphs toward transparent so the page background shows through.
    ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgba(0,0,0,0.11)'; ctx.fillRect(0, 0, width, height);
    ctx.globalCompositeOperation = 'source-over';
    for (const column of columns) {
      column.y += column.speed;
      if (column.y > 0) {
        ctx.fillStyle = column.bright ? '#c9fff4' : column.word ? '#70e6dc' : '#49c7a8';
        ctx.globalAlpha = column.bright ? 0.95 : 0.8;
        ctx.fillText(glyphFor(column), column.x, column.y);
        column.index += 1;
      }
      if (column.y > height + size * 4 || (column.word && column.index > column.word.length && Math.random() < 0.02)) Object.assign(column, newColumn(column.x, false));
    }
    // Sparse static: a few dim specks, never a full-screen flash.
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#8ef5df';
    for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 2, 1);
    ctx.globalAlpha = 1;
  };
  function still() {
    if (!ctx || !width) return;
    ctx.clearRect(0, 0, width, height);
    if (!enabled()) return;
    // One static frame: scattered columns of glyphs with a fading tail.
    for (const column of columns) {
      const head = Math.abs(column.y) % height;
      for (let k = 0; k < 9; k++) { ctx.globalAlpha = 0.75 - k * 0.08; ctx.fillStyle = k ? '#49c7a8' : '#c9fff4'; ctx.fillText(glyphFor(column), column.x, head - k * size); column.index += 1; }
    }
    ctx.globalAlpha = 1;
  }
  const burst = now => {
    // Brief, infrequent RGB-split slices (180-260 ms, at most once every 9-22 s). No strobing.
    if (now >= nextBurst) {
      const span = 180 + Math.random() * 80; burstEnd = now + span; nextBurst = now + 9000 + Math.random() * 13000;
      glitch.style.setProperty('--kaspa-glitch-top', `${Math.round(8 + Math.random() * 76)}%`);
      glitch.style.setProperty('--kaspa-glitch-height', `${Math.round(2 + Math.random() * 5)}%`);
      glitch.style.setProperty('--kaspa-glitch-shift', `${Math.random() < 0.5 ? -1 : 1}`);
      layer.classList.add('kaspa-matrix--burst'); slices.classList.add('kaspa-matrix--burst');
    } else if (burstEnd && now >= burstEnd) { burstEnd = 0; layer.classList.remove('kaspa-matrix--burst'); slices.classList.remove('kaspa-matrix--burst'); }
  };
  const loop = now => {
    frame = 0;
    if (!canMove()) { sync(); return; }
    if (!previous || now - previous >= 1000 / fps()) { previous = now; step(); burst(now); }
    frame = requestAnimationFrame(loop);
  };
  let playPoll = 0, mode = '';
  function sync() {
    const on = enabled() && !forced.matches;
    root.classList.toggle('kaspa-matrix-on', on);
    layer.hidden = !on; slices.hidden = !on;
    const dim = quiet || playing();
    layer.classList.toggle('kaspa-matrix--quiet', dim);
    if (canMove()) { mode = 'moving'; if (!frame) { previous = 0; nextBurst = (performance.now?.() || 0) + 6000 + Math.random() * 6000; frame = requestAnimationFrame(loop); } }
    else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previous = 0; burstEnd = 0; layer.classList.remove('kaspa-matrix--burst'); slices.classList.remove('kaspa-matrix--burst');
      // Draw the still frame once per change, so a paused layer never flickers.
      const next = on ? 'still' : 'off';
      if (next !== mode) { mode = next; still(); }
    }
    // While a board or quiz is active, check back slowly instead of animating.
    if (on && !quiet && playing() && !playPoll) playPoll = setTimeout(() => { playPoll = 0; sync(); }, 1500);
    if (toggle) { toggle.setAttribute('aria-pressed', String(enabled())); toggle.textContent = `Code rain: ${enabled() ? 'on' : 'off'}`; }
  }
  const set = value => { write(value ? 'on' : 'off'); sync(); };

  // Easy footer toggle, persisted on this device only.
  let toggle = null;
  const footer = document.querySelector('footer');
  if (footer) {
    toggle = document.createElement('button'); toggle.type = 'button'; toggle.className = 'kaspa-matrix-toggle'; toggle.dataset.kaspaMatrixToggle = '';
    toggle.setAttribute('aria-label', 'Animated Kaspa code background'); toggle.title = 'Turn the Kaspa code-rain background on or off';
    toggle.addEventListener('click', () => set(!enabled()));
    footer.append(toggle);
  }
  document.addEventListener('geek:matrix-toggle', event => set(typeof event?.detail?.on === 'boolean' ? event.detail.on : !enabled()));
  document.addEventListener('visibilitychange', sync);
  reduced.addEventListener?.('change', sync); forced.addEventListener?.('change', sync);
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 200); }, { passive: true });
  window.addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener('pageshow', sync);
  resize(); sync();
  return { set, sync, enabled };
};

initKaspaMatrix();
