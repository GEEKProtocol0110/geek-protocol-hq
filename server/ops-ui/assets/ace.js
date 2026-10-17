import { ownerClient } from './ops-core.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session?service=operations&action=ace' });
let busy = false, epoch = 0;
const clear = () => { epoch++; client.clear(); busy = false; $('[data-refresh]').disabled = false; $('[data-ace-readiness]').textContent = 'Private readiness cleared.'; };
const load = async () => {
  if (busy) return; busy = true; const version = epoch; $('[data-refresh]').disabled = true;
  $('[data-ace-readiness]').textContent = 'Checking A.C.E. readiness…';
  try {
    const { readiness: r } = await client.request();
    if (version !== epoch) return;
    if (typeof r?.aiAvailable !== 'boolean' || !Number.isSafeInteger(r.attemptsToday) || r.attemptsToday < 0 || !Number.isSafeInteger(r.dailyLimit) || r.dailyLimit < 0 || r.dailyLimit > 1000 || r.operations !== 'read-only' || r.autonomousActions !== false) throw new Error('Readiness was not valid.');
    $('[data-ace-readiness]').textContent = `${r.aiAvailable ? 'AI tutor configured' : 'AI tutor inactive'} · Lesson guide available. ${r.attemptsToday} reserved AI attempts today / ${r.dailyLimit || 'unconfigured'} daily limit. Up to ${r.concurrentLimit} concurrent requests, ${r.maxOutputTokens} output tokens each, ${r.timeoutMs / 1000} seconds for generation. ${r.note}`;
  } catch (error) { if (version === epoch) $('[data-ace-readiness]').textContent = error.message; }
  finally { if (version === epoch) { busy = false; $('[data-refresh]').disabled = false; } }
};
$('[data-refresh]').addEventListener('click', load);
window.addEventListener('pagehide', clear);
load();
