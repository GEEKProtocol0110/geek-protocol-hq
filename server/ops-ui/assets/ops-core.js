// Each workspace has one cancellable request. Authentication stays in the HttpOnly owner cookie.
export const ownerClient = ({ endpoint, fetchImpl = globalThis.fetch }) => {
  let generation = 0, active = null;
  const clear = () => { generation += 1; active?.abort(); active = null; };
  return {
    clear,
    async request({ method = 'GET', body, query = '' } = {}) {
      if (active) throw new Error('Wait for the current request to finish.');
      const version = generation, controller = new AbortController();
      active = controller;
      const timer = setTimeout(() => controller.abort(), 15_000);
      try {
        const response = await fetchImpl(endpoint + query, {
          method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          ...(body ? { body: JSON.stringify(body) } : {})
        });
        const payload = await response.json();
        if (version !== generation || controller.signal.aborted) throw new DOMException('View cleared.', 'AbortError');
        if (!response.ok || payload.ok !== true) {
          const copy = response.status === 401 || response.status === 403 ? 'Your owner session has ended. Sign in again.'
            : response.status === 429 ? 'Too many requests. Wait a moment before refreshing.'
            : response.status === 503 ? 'This service is unavailable or its access key is not configured.'
            : String(payload.error || 'The request could not be completed.').slice(0, 240);
          const error = new Error(copy); error.status = response.status; throw error;
        }
        return payload;
      } catch (error) {
        if (controller.signal.aborted && version === generation) throw new Error('Request timed out. Refresh records before retrying a decision.');
        throw error;
      } finally { clearTimeout(timer); if (active === controller) active = null; }
    }
  };
};
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const sourceLink = value => {
  try { const url = new URL(String(value)); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
};
export const auditSummary = events => ({
  warning: events.filter(event => event.severity === 'warning').length,
  critical: events.filter(event => event.severity === 'critical').length,
  failures: events.filter(event => event.outcome === 'failure').length
});
