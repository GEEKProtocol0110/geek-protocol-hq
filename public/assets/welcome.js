(() => {
  'use strict';
  // Native details work without JavaScript. Deep links also reveal nested records.
  const reveal = (hash, focus = false) => {
    let id;
    try { id = decodeURIComponent(hash.slice(1)); } catch { return; }
    const target = document.getElementById(id);
    if (!target) return;
    let parent = target;
    while (parent) {
      if (parent instanceof HTMLDetailsElement) parent.open = true;
      parent = parent.parentElement;
    }
    requestAnimationFrame(() => {
      if (focus) {
        const destination = target instanceof HTMLDetailsElement ? target.querySelector('summary') : target;
        if (!destination.hasAttribute('tabindex')) destination.setAttribute('tabindex', '-1');
        destination.focus({ preventScroll: true });
      }
      target.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  };
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank') return;
    const url = new URL(link.href);
    if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search && url.hash) reveal(url.hash, true);
  });
  window.addEventListener('hashchange', () => reveal(location.hash, true));
  if (location.hash) reveal(location.hash, true);
  const params = new URLSearchParams(location.search);
  if (['gauntlet', 'daily', 'speed'].includes(params.get('mode')) || ['kaspa', 'video-games', 'science-fiction', 'technology', 'movies', 'history', 'comics', 'pop-culture'].includes(params.get('category'))) {
    const timed = document.getElementById('timed-games');
    if (timed) timed.open = true;
  }
})();
