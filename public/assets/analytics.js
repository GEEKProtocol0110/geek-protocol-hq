(() => {
  'use strict';
  // Vercel's HTML integration: production pages and a small learning-event allowlist.
  const hosts = new Set(['www.geekprotocol.xyz', 'geekprotocol.xyz']);
  const pages = new Set(['/', '/kaspa/', '/study/', '/profile/', '/practice/', '/play/', '/lobby/', '/challenges/', '/vault/', '/collection/', '/contribute/', '/economy/', '/litepaper/', '/security/', '/mint/', '/rewards/']);
  const canonicalPath = pathname => pathname === '/' ? '/' : pathname.replace(/\/index\.html$/, '/').replace(/\/$/, '') + '/';
  const topics = new Set(['origins', 'blockdag', 'mining', 'emission', 'wallets', 'tokens', 'ecosystem', 'fundamentals']);
  const levels = new Set(['foundations', 'connections', 'mixed']);
  // Rebuild each payload from fixed categories. Never forward arbitrary properties.
  const learningData = (name, data, path) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
    if (name === 'Lesson walkthrough completed' && path === '/study/' && topics.has(data.topic)) return { topic: data.topic };
    if (name === 'Practice started' || name === 'Practice completed') {
      if (path === '/practice/' && data.mode === 'assisted') return { mode: 'assisted' };
      if (path === '/study/' && data.mode === 'study' && topics.has(data.topic) && levels.has(data.level)) return { mode: 'study', topic: data.topic, level: data.level };
    }
    if (name === 'Free lifeline used' && path === '/practice/' && ['fifty-fifty', 'extra-time'].includes(data.item)) return { item: data.item };
    const surface = { '/': 'home', '/study/': 'study-welcome', '/profile/': 'progress' }[path];
    if (name === 'Giga choice selected' && surface && data.surface === surface && ['start', 'understand', 'practice', 'review'].includes(data.choice)) return { surface, choice: data.choice };
    return null;
  };
  if (!hosts.has(location.hostname) || !pages.has(canonicalPath(location.pathname)) || navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true || document.getElementById('geek-vercel-analytics')) return;
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  window.va('beforeSend', event => {
    try {
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return null;
      const url = new URL(event.url);
      if (url.protocol !== 'https:' || url.port || url.username || url.password || !hosts.has(url.hostname) || !pages.has(canonicalPath(url.pathname))) return null;
      url.search = ''; url.hash = ''; url.pathname = canonicalPath(url.pathname);
      if (event.type === 'pageview') return { type: 'pageview', url: url.href };
      if (event.type !== 'event') return null;
      const name = event.payload?.name, data = learningData(name, event.payload?.data, url.pathname);
      return data ? { type: 'event', url: url.href, payload: { name, data } } : null;
    } catch { return null; }
  });
  window.GeekAnalytics = Object.freeze({ track(name, data) {
    try {
      if (navigator.doNotTrack === '1' || navigator.globalPrivacyControl === true) return;
      const clean = learningData(name, data, canonicalPath(location.pathname));
      if (clean) window.va('event', { name, data: clean });
    } catch { /* Analytics must never interrupt a lesson or practice request. */ }
  } });
  const script = document.createElement('script');
  script.id = 'geek-vercel-analytics';
  script.defer = true;
  script.src = '/_vercel/insights/script.js';
  document.head.append(script);
})();
