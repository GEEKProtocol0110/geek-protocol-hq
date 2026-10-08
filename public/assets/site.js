const header = document.querySelector('[data-header]');
const toggle = document.querySelector('[data-menu-toggle]');
const nav = document.querySelector('[data-nav]');

const syncHeader = () => header?.classList.toggle('scrolled', window.scrollY > 24);
syncHeader();
window.addEventListener('scroll', syncHeader, { passive: true });

toggle?.addEventListener('click', () => {
  const isOpen = toggle.getAttribute('aria-expanded') === 'true';
  toggle.setAttribute('aria-expanded', String(!isOpen));
  nav?.classList.toggle('open', !isOpen);
});

nav?.querySelectorAll('a').forEach((link) => {
  link.addEventListener('click', () => {
    toggle?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    const menu = nav.querySelector('.nav-more');
    if (menu) menu.open = false;
  });
});

const year = document.querySelector('[data-year]');
if (year) year.textContent = String(new Date().getFullYear());

const more = nav?.querySelector('.nav-more');
document.addEventListener('click', (event) => {
  if (more?.open && !more.contains(event.target)) more.open = false;
  if (nav?.classList.contains('open') && !header?.contains(event.target)) {
    toggle?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
  }
});
document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (more?.open) { more.open = false; more.querySelector('summary')?.focus(); }
  if (nav?.classList.contains('open')) {
    toggle?.setAttribute('aria-expanded', 'false');
    nav.classList.remove('open');
    toggle?.focus();
  }
});

// Decorative space scenes. One capped animation loop, only for visible panels.
(() => {
  const hosts = [...document.querySelectorAll('.hero, .grid-hero, .profile-hero, .geek-preview-stage, .kaspa-hero, .study-intro, .memory-intro, .mint-hero, .thanks-hero, .economy-hero, .start-copy')];
  if (!hosts.length) return;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  let reduceMotion = reduced.matches;
  const saveData = Boolean(navigator.connection?.saveData);
  let paused = false, frame = 0, previous = 0, clock = 0;
  const scenes = [];
  const makeStar = () => ({ x: Math.random(), y: Math.random(), depth: .25 + Math.random() * .75, phase: Math.random() * Math.PI * 2, tint: Math.random(), glint: Math.random() > .93 });
  const draw = scene => {
    const { context: ctx, width: w, height: h } = scene;
    if (!w || !h) return;
    ctx.clearRect(0, 0, w, h);
    for (const star of scene.stars) {
      const x = (star.x * w + clock * star.depth * 2) % w, y = (star.y * h - clock * star.depth * 3 % h + h) % h;
      ctx.globalAlpha = .15 + star.depth * .28 + Math.sin(clock * .5 + star.phase) * .06;
      ctx.fillStyle = star.tint < .18 ? '#f6c643' : star.tint < .4 ? '#70e6dc' : '#d4eeeb';
      const radius = .5 + star.depth * .9;
      ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
      if (star.glint) {
        ctx.globalAlpha *= .6; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = .6;
        ctx.beginPath(); ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); ctx.stroke();
      }
    }
    // A quiet, short trail appears once per cycle, never in still mode.
    const flight = (clock + scene.offset) % 19;
    if (!paused && !reduceMotion && !saveData && flight < 1.2 && w > 500) {
      const x = w * .55 + flight * 190, y = h * .17 + flight * 70;
      const trail = ctx.createLinearGradient(x - 60, y - 22, x, y); trail.addColorStop(0, '#70e6dc00'); trail.addColorStop(1, '#c9f8f3');
      ctx.globalAlpha = Math.sin(flight / 1.2 * Math.PI) * .4; ctx.strokeStyle = trail; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - 60, y - 22); ctx.lineTo(x, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };
  const active = () => scenes.some(scene => scene.visible);
  const canMove = () => !paused && !reduceMotion && !saveData && !document.hidden && active();
  const loop = timestamp => {
    frame = 0;
    if (!canMove()) { previous = 0; return; }
    if (!previous) previous = timestamp;
    const delta = timestamp - previous;
    if (delta >= 1000 / 24) {
      clock += Math.min(delta, 100) / 1000; previous = timestamp;
      for (const scene of scenes) if (scene.visible) draw(scene);
    }
    frame = requestAnimationFrame(loop);
  };
  const sync = () => {
    document.body.classList.toggle('space-still', reduceMotion || saveData || document.hidden);
    document.body.classList.toggle('space-paused', paused);
    button.textContent = reduceMotion || saveData ? 'Space effects · still' : paused ? 'Resume space effects' : 'Pause space effects';
    button.disabled = reduceMotion || saveData;
    button.setAttribute('aria-pressed', String(paused));
    if (canMove()) { if (!frame) frame = requestAnimationFrame(loop); }
    else { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; }
  };
  const button = document.createElement('button'); button.type = 'button'; button.className = 'space-toggle'; button.addEventListener('click', () => { paused = !paused; sync(); });
  (document.querySelector('footer') || hosts[0]).append(button);
  for (const host of hosts) {
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d', { alpha: true });
    if (!context) continue;
    canvas.className = 'space-canvas'; canvas.setAttribute('aria-hidden', 'true'); host.classList.add('space-scene'); host.prepend(canvas);
    const scene = { host, canvas, context, width: 0, height: 0, stars: [], offset: 3 + Math.random() * 14, visible: false };
    const resize = () => {
      const bounds = host.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, bounds.width < 600 ? 1 : 1.5);
      scene.width = Math.min(bounds.width, 2400); scene.height = Math.min(bounds.height, 1800);
      canvas.width = Math.round(scene.width * dpr); canvas.height = Math.round(scene.height * dpr); context.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.min(110, Math.max(20, Math.round(scene.width * scene.height / 10000)));
      if (scene.stars.length !== count) scene.stars = Array.from({ length: count }, makeStar);
      draw(scene);
    };
    scenes.push(scene); resize();
    if (typeof ResizeObserver === 'function') new ResizeObserver(resize).observe(host);
    else window.addEventListener('resize', resize, { passive: true });
  }
  if (!scenes.length) { button.remove(); return; }
  if (typeof IntersectionObserver === 'function') {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) { const scene = scenes.find(scene => scene.host === entry.target); scene.visible = entry.isIntersecting; }
      sync();
    });
    scenes.forEach(scene => observer.observe(scene.host));
  } else scenes.forEach(scene => { scene.visible = true; });
  reduced.addEventListener('change', event => { reduceMotion = event.matches; scenes.forEach(draw); sync(); });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { if (frame) cancelAnimationFrame(frame); frame = 0; previous = 0; });
  window.addEventListener('pageshow', sync);
  sync();
})();

// Optional owner-selected decoration. A failed read keeps the standard site usable.
import('/assets/holiday-theme.js').then(module => module.initHolidayTheme()).catch(() => {});
