(() => {
  'use strict';
  // Vercel's HTML integration: same-origin, production page views only.
  const hosts = new Set(['www.geekprotocol.xyz', 'geekprotocol.xyz']);
  const pages = new Set(['/', '/kaspa/', '/study/', '/profile/', '/practice/', '/play/', '/lobby/', '/challenges/', '/vault/', '/collection/', '/contribute/', '/economy/', '/litepaper/', '/security/', '/mint/', '/rewards/']);
  const canonicalPath = pathname => pathname === '/' ? '/' : pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') + '/';
  if (!hosts.has(location.hostname) || !pages.has(canonicalPath(location.pathname)) || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || document.getElementById('geek-vercel-analytics')) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', event => {
    if (event.type !== 'pageview') return null;
    try {
      const url = new URL(event.url);
      if (!hosts.has(url.hostname) || !pages.has(canonicalPath(url.pathname))) return null;
      url.search = ''; url.hash = ''; url.pathname = canonicalPath(url.pathname);
      return { ...event, url: url.href };
    } catch { return null; }
  });
  const script = document.createElement('script');
  script.id = 'geek-vercel-analytics';
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.append(script);
})();
