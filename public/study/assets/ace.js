(() => {
  'use strict';
  const root = document.querySelector('[data-ace]');
  if (!root) return;
  const $ = selector => root.querySelector(selector);
  const question = $('[data-ace-question]'), button = $('[data-ace-ask]'), consent = $('[data-ace-consent]');
  let generation = 0, active = null, available = false;
  const clear = () => {
    generation++; active?.abort(); active = null;
    question.value = ''; consent.checked = false;
    $('[data-ace-status]').textContent = 'Find help in this lesson and check its sources.';
    $('[data-ace-answer]').textContent = ''; $('[data-ace-evidence]').replaceChildren(); $('[data-ace-sources]').replaceChildren();
    button.disabled = false; root.setAttribute('aria-busy', 'false');
  };
  window.addEventListener('geek:study-topic', clear);
  window.addEventListener('pagehide', clear);
  const request = async (body, controller) => {
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch('/api/ranked/?service=ace', { method: body ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', signal: controller.signal, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Lesson help is unavailable. Read the lesson and its sources, then try again.');
      return data;
    } finally { clearTimeout(timer); }
  };
  root.addEventListener('toggle', async () => {
    if (!root.open || active) return;
    const controller = new AbortController(), version = generation;
    active = controller; button.disabled = true;
    try {
      const data = await request(null, controller);
      if (version !== generation) return;
      available = data.aiAvailable === true;
      $('[data-ace-opt-in]').hidden = !available;
      $('[data-ace-status]').textContent = available ? 'Find help in this lesson, or opt in to an AI explanation.' : 'Lesson guide is ready. AI explanations are not active yet.';
    } catch {
      if (version === generation) { available = false; $('[data-ace-opt-in]').hidden = true; $('[data-ace-status]').textContent = 'Lesson help could not be checked. You can still read and practice above.'; }
    } finally { if (version === generation) { active = null; button.disabled = false; } }
  });
  button.addEventListener('click', async () => {
    if (active) return;
    if (!question.reportValidity()) return;
    const topic = document.querySelector('[data-lesson]').dataset.topic;
    if (!topic) return;
    const controller = new AbortController(), version = generation;
    active = controller; button.disabled = true; root.setAttribute('aria-busy', 'true');
    $('[data-ace-answer]').textContent = 'Finding lesson help…'; $('[data-ace-evidence]').replaceChildren(); $('[data-ace-sources]').replaceChildren();
    try {
      const data = await request({ topic, question: question.value.trim(), useAI: available && consent.checked }, controller);
      if (version !== generation) return;
      $('[data-ace-answer]').textContent = data.answer;
      $('[data-ace-status]').textContent = data.mode === 'ai' ? data.note : `${data.reason === 'busy' || data.reason === 'daily-limit' || data.reason === 'unavailable' ? 'AI help is unavailable right now. ' : ''}${data.note}`;
      for (const fragment of data.evidence || []) { const li = document.createElement('li'); li.textContent = `${fragment.title}: ${fragment.text}`; $('[data-ace-evidence]').append(li); }
      for (const [i, source] of (data.sources || []).entries()) {
        let url; try { url = new URL(source); if (url.protocol !== 'https:' || url.username || url.password) continue; } catch { continue; }
        const a = document.createElement('a'); a.href = url.href; a.textContent = `Primary source ${i + 1} ↗`; a.target = '_blank'; a.rel = 'noopener noreferrer'; $('[data-ace-sources]').append(a);
      }
    } catch (error) {
      if (version === generation) $('[data-ace-answer]').textContent = controller.signal.aborted ? 'Lesson help took too long. Read the lesson or try again when ready.' : error.message;
    } finally { if (version === generation) { active = null; button.disabled = false; root.setAttribute('aria-busy', 'false'); } }
  });
})();
