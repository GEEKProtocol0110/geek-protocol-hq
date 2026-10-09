export const communityLink = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
// A lost response can be checked with the identical payload and request ID.
// Editing an uncertain submission never silently creates another application.
export const applicationClient = (fetchImpl = globalThis.fetch) => {
  let pending = null, busy = false;
  return {
    get pending() { return pending !== null; },
    clear() { if (busy) throw new Error('Wait for the current request.'); pending = null; },
    async submit(fields) {
      if (busy) throw new Error('Wait for the current request.');
      if (!pending) pending = { requestId: globalThis.crypto.randomUUID(), ...fields };
      busy = true;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetchImpl('/api/session/?service=community', { method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(pending) });
        const payload = await response.json();
        if (!response.ok || payload.ok !== true) {
          if ([400, 403, 409].includes(response.status)) pending = null;
          throw new Error(String(payload.error || 'Submission could not be confirmed.').slice(0, 240));
        }
        if (!/^app_[a-f0-9]{32}$/.test(payload.receipt?.id)) throw new Error('Submission receipt was not recognized.');
        pending = null;
        return payload.receipt;
      } finally { clearTimeout(timer); busy = false; }
    }
  };
};
