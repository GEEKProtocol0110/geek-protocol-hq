(() => {
  'use strict';
  // Clear the retired review desk's stored credential without reading or reusing it.
  try { sessionStorage.removeItem('geek-cce-admin'); } catch { /* Storage may be unavailable. */ }
  const form = document.querySelector('[data-ops-login]'), message = document.querySelector('[data-login-message]');
  let pending = false;
  form.addEventListener('submit', async event => {
    event.preventDefault(); if (pending) return;
    const key = form.elements.key.value, code = form.elements.code.value.trim();
    form.elements.key.value = ''; form.elements.code.value = ''; pending = true;
    form.querySelector('button').disabled = true; form.elements.key.disabled = true; form.elements.code.disabled = true;
    message.textContent = 'Checking private access…'; message.dataset.error = 'false';
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
    try {
      const response = await fetch('/api/session/?service=operations&action=login', { method: 'POST', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, code }) });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error(response.status === 429 ? 'Too many attempts. Wait before trying again.' : response.status === 503 ? 'Operator access is unavailable. Try again later.' : 'Access was not accepted. Check your owner key and authenticator code. If a code was already used, wait for the next one.');
      window.location.replace('/ops/');
    } catch (error) {
      message.textContent = error.name === 'AbortError' ? 'Access check timed out. Try signing in again.' : error.message || 'Access is unavailable.';
      message.dataset.error = 'true';
    } finally { clearTimeout(timer); pending = false; form.querySelector('button').disabled = false; form.elements.key.disabled = false; form.elements.code.disabled = false; }
  });
})();
