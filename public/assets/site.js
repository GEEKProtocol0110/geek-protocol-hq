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
