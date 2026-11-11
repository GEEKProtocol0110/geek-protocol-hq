// Decorative Kaspa space, planet and code rain behind page content. No requests, player records, game hooks or input capture.
// One capped loop for rain and stars; paused when hidden, still under reduced motion and off inside individual game boards.
// The faint planet is a pre-rendered image and can load on every page, including game and operator surfaces.
export const MATRIX_KEY = 'geek-matrix-background';
// Swap-friendly public filenames. Optimize a new render into these four paths (see docs/KASPA-MATRIX.md).
export const PLANET_SRC = {
  desktopAvif: '/assets/kaspa-planet.avif',
  desktopWebp: '/assets/kaspa-planet.webp',
  mobileAvif: '/assets/kaspa-planet-sm.avif',
  mobileWebp: '/assets/kaspa-planet-sm.webp'
};

// Deterministic per-route placement: same path always matches, different pages differ.
// Values are viewport-anchored (vw / px). Negative insets park the planet partly off-canvas.
export const planetPath = path => {
  const raw = String(path || '/').split('?')[0].split('#')[0] || '/';
  return raw === '/' || raw.endsWith('/') ? raw : `${raw}/`;
};
const planetHash = path => {
  let hash = 2166136261;
  for (let i = 0; i < path.length; i++) { hash ^= path.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
};
// Explicit corners for the main routes so home, inner, game, quiz and ops pages clearly differ.
export const PLANET_PLACEMENTS = {
  '/': { corner: 'br', insetX: -8, insetY: -10, size: 520, rotate: 4 },
  '/news/': { corner: 'bl', insetX: -16, insetY: -18, size: 500, rotate: -8 },
  '/about/': { corner: 'tr', insetX: -18, insetY: -16, size: 480, rotate: 8 },
  '/media/': { corner: 'tl', insetX: -20, insetY: -18, size: 470, rotate: -6 },
  '/games/': { corner: 'br', insetX: -8, insetY: -28, size: 440, rotate: 10 },
  '/games/hanoi/': { corner: 'tr', insetX: -14, insetY: -20, size: 420, rotate: -10 },
  '/games/chess/': { corner: 'bl', insetX: -18, insetY: -24, size: 400, rotate: 7 },
  '/play/': { corner: 'tl', insetX: -16, insetY: -22, size: 380, rotate: 6 },
  '/practice/': { corner: 'tr', insetX: -20, insetY: -14, size: 390, rotate: -4 },
  '/quest/': { corner: 'bl', insetX: -10, insetY: -26, size: 430, rotate: 9 },
  '/duel/': { corner: 'tl', insetX: -22, insetY: -16, size: 400, rotate: -9 },
  '/royale/': { corner: 'br', insetX: -20, insetY: -16, size: 410, rotate: 5 },
  '/memory/': { corner: 'tr', insetX: -10, insetY: -24, size: 400, rotate: -7 },
  '/challenges/': { corner: 'bl', insetX: -22, insetY: -14, size: 390, rotate: 8 },
  '/sign-in/': { corner: 'tl', insetX: -18, insetY: -20, size: 360, rotate: -5 },
  '/ops-login/': { corner: 'br', insetX: -22, insetY: -20, size: 360, rotate: 11 },
  '/ops/': { corner: 'tr', insetX: -16, insetY: -18, size: 360, rotate: -8 },
  '/leaderboard/': { corner: 'bl', insetX: -12, insetY: -22, size: 450, rotate: 3 }
};
export const planetPlacement = (path, { mobile = false } = {}) => {
  const key = planetPath(path);
  const preset = PLANET_PLACEMENTS[key];
  let place;
  if (preset) place = { ...preset };
  else {
    const hash = planetHash(key);
    place = {
      corner: ['br', 'bl', 'tr', 'tl'][hash % 4],
      insetX: -8 - ((hash >>> 8) % 14),
      insetY: -14 - ((hash >>> 16) % 12),
      size: 400 + ((hash >>> 4) % 120),
      rotate: -12 + ((hash >>> 12) % 25)
    };
  }
  if (mobile) {
    place = { ...place, insetX: place.insetX - 6, insetY: place.insetY - 4, size: Math.round(place.size * 0.58) };
  }
  return place;
};
export const applyPlanetPlacement = (node, path, { mobile = false } = {}) => {
  const place = planetPlacement(path, { mobile });
  const x = `${place.insetX}vw`, y = `${place.insetY}vw`;
  const left = place.corner.includes('l');
  const top = place.corner.includes('t');
  node.dataset.kaspaPlanetCorner = place.corner;
  Object.assign(node.style, {
    position: 'fixed',
    zIndex: '-3',
    pointerEvents: 'none',
    left: left ? x : 'auto',
    right: left ? 'auto' : x,
    top: top ? y : 'auto',
    bottom: top ? 'auto' : y,
    width: `min(${mobile ? 56 : 42}vw, ${place.size}px)`,
    transform: `rotate(${place.rotate}deg)`
  });
  return place;
};

const mediaQuery = query => (typeof window.matchMedia === 'function' ? window.matchMedia(query) : { matches: false, addEventListener() {} });
const ensureMatrixCss = () => {
  if (document.querySelector('link[data-kaspa-matrix-css]')) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = '/assets/kaspa-matrix.css'; link.dataset.kaspaMatrixCss = '';
  document.head?.append(link);
};
const quietRoute = path => /^\/(?:play|practice|quest|duel|royale|memory|challenges)\//.test(path);
const gameOrOpsRoute = path => /^\/games\/[^/]+\//.test(path) || /^\/(?:ops|ops-login|sign-in|moderate)(?:\/|$)/.test(path);
const planetShouldBeStill = (path, reduced, saveData) => gameOrOpsRoute(path) || quietRoute(path) || reduced.matches || saveData;

export const initKaspaPlanet = () => {
  const root = document.documentElement, body = document.body, path = location.pathname;
  if (!body || root.dataset.kaspaPlanet) return;
  root.dataset.kaspaPlanet = 'ready';
  body.classList.add('kaspa-planet-host');
  ensureMatrixCss();
  const reduced = mediaQuery('(prefers-reduced-motion: reduce)');
  const forced = mediaQuery('(forced-colors: active)');
  const saveData = Boolean(navigator.connection?.saveData);
  const picture = document.createElement('picture');
  picture.className = 'kaspa-planet'; picture.dataset.kaspaPlanetLayer = ''; picture.setAttribute('aria-hidden', 'true');
  const placePlanet = () => applyPlanetPlacement(picture, path, { mobile: (window.innerWidth || 1280) < 700 });
  placePlanet();
  const source = (srcset, type, query) => {
    const node = document.createElement('source'); node.srcset = srcset; node.type = type; if (query) node.media = query; return node;
  };
  picture.append(
    source(PLANET_SRC.mobileAvif, 'image/avif', '(max-width: 700px)'),
    source(PLANET_SRC.mobileWebp, 'image/webp', '(max-width: 700px)'),
    source(PLANET_SRC.desktopAvif, 'image/avif'),
    source(PLANET_SRC.desktopWebp, 'image/webp')
  );
  const img = document.createElement('img');
  img.src = PLANET_SRC.desktopWebp; img.alt = ''; img.width = 720; img.height = 720;
  img.decoding = 'async'; img.setAttribute('aria-hidden', 'true'); img.draggable = false;
  picture.append(img); body.append(picture);
  const syncPlanet = () => {
    const still = planetShouldBeStill(path, reduced, saveData) || forced.matches;
    picture.classList.toggle('kaspa-planet--still', still);
    picture.hidden = forced.matches;
  };
  reduced.addEventListener?.('change', syncPlanet); forced.addEventListener?.('change', syncPlanet);
  window.addEventListener('resize', placePlanet, { passive: true });
  syncPlanet();
  return { sync: syncPlanet, picture, placement: placePlanet };
};

export const initKaspaMatrix = () => {
  initKaspaPlanet();
  const root = document.documentElement, body = document.body, path = location.pathname;
  if (!body || root.dataset.kaspaMatrix) return;
  // Individual boards, owner and sign-in surfaces stay clean (planet still may remain). Quiz and lobby routes get a dim still frame.
  if (gameOrOpsRoute(path)) return;
  const quiet = quietRoute(path);
  root.dataset.kaspaMatrix = 'ready';
  const reduced = mediaQuery('(prefers-reduced-motion: reduce)'), forced = mediaQuery('(forced-colors: active)');
  const saveData = Boolean(navigator.connection?.saveData);
  // Clear any leftover device-level off-state so a previous footer toggle cannot hide the effect.
  try { localStorage.removeItem(MATRIX_KEY); } catch { /* Stale-key cleanup is optional. */ }
  // Session-only override from the hidden terminal easter egg. Never read or write localStorage.
  let preference = null;
  try { preference = sessionStorage.getItem(MATRIX_KEY); } catch { /* Storage is optional. */ }
  const write = value => {
    preference = value;
    try { sessionStorage.setItem(MATRIX_KEY, value); } catch { /* Storage is optional. */ }
  };
  // Default on, except under reduced motion where a visitor must opt in (and then sees one still frame).
  const enabled = () => preference === 'on' || (preference !== 'off' && !reduced.matches);

  ensureMatrixCss();
  const space = document.createElement('div');
  space.className = 'kaspa-space'; space.dataset.kaspaSpace = ''; space.setAttribute('aria-hidden', 'true');
  Object.assign(space.style, { position: 'fixed', inset: '0', zIndex: '-4', pointerEvents: 'none', overflow: 'hidden' });
  const nebula = document.createElement('div'); nebula.className = 'kaspa-space-nebula'; nebula.setAttribute('aria-hidden', 'true');
  const stars = document.createElement('canvas'); stars.className = 'kaspa-space-stars'; stars.setAttribute('aria-hidden', 'true');
  space.append(nebula, stars); body.append(space);
  const layer = document.createElement('div');
  layer.className = 'kaspa-matrix'; layer.dataset.kaspaMatrixLayer = ''; layer.setAttribute('aria-hidden', 'true');
  // Behind translucent section panels, below the sticky header (z 90), menus and dialogs.
  Object.assign(layer.style, { position: 'fixed', inset: '0', zIndex: '-1', pointerEvents: 'none', overflow: 'hidden' });
  const canvas = document.createElement('canvas'); canvas.className = 'kaspa-matrix-canvas'; canvas.setAttribute('aria-hidden', 'true');
  const glitch = document.createElement('div'); glitch.className = 'kaspa-matrix-glitch'; glitch.setAttribute('aria-hidden', 'true');
  layer.append(canvas); body.classList.add('kaspa-matrix-host'); body.append(layer);
  const slices = document.createElement('div'); slices.className = 'kaspa-matrix-slices'; slices.setAttribute('aria-hidden', 'true');
  Object.assign(slices.style, { position: 'fixed', inset: '0', zIndex: '-1', pointerEvents: 'none' });
  slices.append(glitch); body.append(slices);
  const ctx = canvas.getContext?.('2d', { alpha: true });
  const starCtx = stars.getContext?.('2d', { alpha: true });

  const glyphs = 'ҜK₭0123456789ABCDEF◇◆⬡◈⋔⟁△⇉⊶⋮∷'.split(''); // Kaspa-style K, digits, hex, BlockDAG marks
  const words = ['KAS', 'GEEK', 'DAG', '₭AS', 'BPS', 'GHOST'];
  const pick = list => list[Math.floor(Math.random() * list.length)];
  let width = 0, height = 0, size = 16, columns = [], field = [], links = [], frame = 0, previous = 0, nextBurst = 0, burstEnd = 0, resizeTimer = 0;
  const small = () => (window.innerWidth || 0) < 700;
  const fps = () => (small() || saveData ? 20 : 24);
  const playing = () => body.classList.contains('is-playing') || Boolean(document.querySelector('[data-screen="quiz"].active'));
  const canMove = () => enabled() && !quiet && !reduced.matches && !forced.matches && !saveData && !document.hidden && !playing() && Boolean(ctx);

  const newColumn = (x, scatter) => {
    const word = Math.random() < 0.16 ? pick(words) : '';
    return { x, y: scatter ? Math.random() * -height : -size * Math.random() * 20, speed: (0.35 + Math.random() * 0.65) * size, word, index: 0, bright: Math.random() < 0.08 };
  };
  const seedStars = () => {
    const count = Math.min(small() || saveData ? 48 : 110, Math.max(24, Math.round(width * height / 14000)));
    field = Array.from({ length: count }, () => ({ x: Math.random() * width, y: Math.random() * height, depth: 0.25 + Math.random() * 0.75, phase: Math.random() * Math.PI * 2, tint: Math.random(), glint: Math.random() > 0.92 }));
    const bright = field.map((star, i) => i).filter(i => field[i].glint || field[i].depth > 0.8).slice(0, small() ? 5 : 9);
    links = [];
    for (let i = 0; i < bright.length; i++) {
      const a = field[bright[i]];
      const nearest = bright.filter(j => j !== bright[i]).sort((j, k) => {
        const dj = (field[j].x - a.x) ** 2 + (field[j].y - a.y) ** 2;
        const dk = (field[k].x - a.x) ** 2 + (field[k].y - a.y) ** 2;
        return dj - dk;
      }).slice(0, 2);
      for (const j of nearest) if (j > bright[i]) links.push([bright[i], j]);
    }
  };
  const drawStars = (twinkle, clock = 0) => {
    if (!starCtx || !width) return;
    starCtx.clearRect(0, 0, width, height);
    if (!enabled()) return;
    starCtx.lineWidth = 0.6;
    for (const [a, b] of links) {
      const sa = field[a], sb = field[b];
      starCtx.globalAlpha = 0.12 + sa.depth * 0.08;
      starCtx.strokeStyle = '#70e6dc';
      starCtx.beginPath(); starCtx.moveTo(sa.x, sa.y); starCtx.lineTo(sb.x, sb.y); starCtx.stroke();
    }
    for (const star of field) {
      const pulse = twinkle ? Math.sin(clock * 0.9 + star.phase) * 0.08 : 0;
      starCtx.globalAlpha = 0.18 + star.depth * 0.35 + pulse;
      starCtx.fillStyle = star.tint < 0.16 ? '#f6c643' : star.tint < 0.4 ? '#70e6dc' : '#d4eeeb';
      const radius = 0.5 + star.depth * 0.9;
      starCtx.beginPath(); starCtx.arc(star.x, star.y, radius, 0, Math.PI * 2); starCtx.fill();
      if (star.glint) {
        starCtx.globalAlpha *= 0.55; starCtx.strokeStyle = starCtx.fillStyle; starCtx.lineWidth = 0.6;
        starCtx.beginPath(); starCtx.moveTo(star.x - 3.5, star.y); starCtx.lineTo(star.x + 3.5, star.y);
        starCtx.moveTo(star.x, star.y - 3.5); starCtx.lineTo(star.x, star.y + 3.5); starCtx.stroke();
      }
    }
    starCtx.globalAlpha = 1;
  };
  const resize = () => {
    if (!ctx) return;
    width = Math.min(window.innerWidth || 1280, 3000); height = Math.min(window.innerHeight || 800, 2000);
    const dpr = Math.min(window.devicePixelRatio || 1, small() ? 1 : 1.5);
    size = small() ? 15 : 17;
    const apply = (node, context) => {
      if (!context) return;
      node.width = Math.round(width * dpr); node.height = Math.round(height * dpr);
      node.style.width = `${width}px`; node.style.height = `${height}px`;
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    apply(canvas, ctx); apply(stars, starCtx);
    const spacing = small() ? size * 1.9 : size * 1.25;
    const count = Math.min(small() ? 26 : 110, Math.ceil(width / spacing));
    columns = Array.from({ length: count }, (_, i) => newColumn(Math.round(i * spacing + spacing / 2), true));
    ctx.font = `600 ${size}px ui-monospace, SFMono-Regular, Consolas, monospace`; ctx.textAlign = 'center';
    seedStars();
    still();
    if (mode === 'moving' && !frame) sync();
  };
  const glyphFor = column => (column.word ? column.word[column.index % column.word.length] : pick(glyphs));
  const step = clock => {
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
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#8ef5df';
    for (let i = 0; i < 10; i++) ctx.fillRect(Math.random() * width, Math.random() * height, 1 + Math.random() * 2, 1);
    ctx.globalAlpha = 1;
    drawStars(true, clock / 1000);
  };
  function still() {
    if (!ctx || !width) return;
    ctx.clearRect(0, 0, width, height);
    if (!enabled()) { drawStars(false); return; }
    for (const column of columns) {
      const head = Math.abs(column.y) % height;
      for (let k = 0; k < 9; k++) { ctx.globalAlpha = 0.75 - k * 0.08; ctx.fillStyle = k ? '#49c7a8' : '#c9fff4'; ctx.fillText(glyphFor(column), column.x, head - k * size); column.index += 1; }
    }
    ctx.globalAlpha = 1;
    drawStars(false);
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
    if (!previous || now - previous >= 1000 / fps()) { previous = now; step(now); burst(now); }
    frame = requestAnimationFrame(loop);
  };
  let playPoll = 0, mode = '';
  function sync() {
    const on = enabled() && !forced.matches;
    root.classList.toggle('kaspa-matrix-on', on);
    space.hidden = !on; layer.hidden = !on; slices.hidden = !on;
    const dim = quiet || playing();
    layer.classList.toggle('kaspa-matrix--quiet', dim);
    space.classList.toggle('kaspa-space--still', dim || !canMove());
    if (canMove()) { mode = 'moving'; if (!frame) { previous = 0; nextBurst = (performance.now?.() || 0) + 6000 + Math.random() * 6000; frame = requestAnimationFrame(loop); } }
    else {
      if (frame) cancelAnimationFrame(frame);
      frame = 0; previous = 0; burstEnd = 0; layer.classList.remove('kaspa-matrix--burst'); slices.classList.remove('kaspa-matrix--burst');
      const next = on ? 'still' : 'off';
      if (next !== mode) { mode = next; still(); }
    }
    if (on && !quiet && playing() && !playPoll) playPoll = setTimeout(() => { playPoll = 0; sync(); }, 1500);
  }
  const set = value => { write(value ? 'on' : 'off'); sync(); };

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
