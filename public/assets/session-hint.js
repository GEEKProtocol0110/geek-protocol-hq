// Shared reader for the saved "signed in" display hint (never a credential).
// The hint is trusted only when its timestamp is in the past and under 24h old;
// a missing, future or older stamp means "unknown". Used by session-access.js and the sign-in page.
(() => {
  const KEY = 'geek:last-session-state', AT = 'geek:last-session-at', HINT_MS = 24 * 3600 * 1000;
  const get = (w, area, key) => { try { return w[area]?.getItem(key) ?? null; } catch { return null; } };
  const read = (w = window, now = Date.now()) => {
    const value = get(w, 'localStorage', KEY) ?? get(w, 'sessionStorage', KEY);
    if (value !== 'signed-in') return value;
    const stamp = get(w, 'localStorage', AT) ?? get(w, 'sessionStorage', AT);
    const age = now - Number(stamp);
    return stamp !== null && Number.isFinite(age) && age >= 0 && age < HINT_MS ? value : null;
  };
  window.geekSessionHint = Object.freeze({ KEY, AT, HINT_MS, read });
})();
