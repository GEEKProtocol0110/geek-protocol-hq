import { ownerClient, escapeHtml as e } from './ops-core.js';
import { formatRaw } from '/economy/assets/amounts.js';
const $ = selector => document.querySelector(selector);
const client = ownerClient({ endpoint: '/api/session/?service=operations&action=stress' });
const whole = value => new Intl.NumberFormat('en-US').format(BigInt(value));
let busy = false, generation = 0;
const controls = () => { document.querySelectorAll('button,input').forEach(el => { el.disabled = busy; }); };
const clear = () => { $('[data-results]').innerHTML = ''; $('[data-examples]').innerHTML = ''; };
const render = result => {
  const g = result.gauntlet, f = result.freeRounds, p = result.reserve;
  $('[data-results]').innerHTML = `<h2>Scenario results · planning only</h2><article class="workspace-card"><h3>Internal credit path</h3><p>${g.completedRounds} rounds completed${g.stoppedAtRound ? `; modeled credits cannot cover round ${g.stoppedAtRound}` : ''}.</p><p>${e(whole(g.issued))} credits granted · ${e(whole(g.spent))} spent · ${e(whole(g.closingCredits))} closing credits.</p><p>${e(whole(f.completions))} free-round completions grant ${e(whole(f.issuedCredits))} internal credits. This does not create token funding.</p></article><article class="workspace-card"><h3>Hypothetical token budget</h3><p>${e(formatRaw(p.feeTotalRaw))} GEEK in modeled fees → ${e(formatRaw(p.recyclePendingRaw))} recycle pending + ${e(formatRaw(p.burnPendingRaw))} burn pending.</p><p>${e(whole(p.coveredClaims))} proposed claims covered; ${e(whole(p.blockedClaims))} blocked by the modeled reserve/cap.</p><p>${e(formatRaw(p.requestedRewardsRaw))} requested · ${e(formatRaw(p.coveredRewardsRaw))} within budget · ${e(formatRaw(p.closingReserveRaw))} closing modeled reserve.</p><p>Funding gap: ${e(formatRaw(p.fundingGapRaw))} GEEK. Cap gap: ${e(formatRaw(p.capGapRaw))} GEEK. These gaps can overlap; do not add them.</p><p>Per-receipt rounding allocates ${e(formatRaw(p.roundingDifferenceRaw))} GEEK less to recycling than a single combined fee. The existing per-receipt policy applies.</p><p>${p.feeReceiptsToCoverDemand === null ? 'These fee receipts recycle zero raw units; more of the same fee cannot cover the reward demand.' : `${e(whole(p.feeReceiptsToCoverDemand))} identical fee receipts would be needed to cover this demand from the assumed opening reserve, before the cap. This is arithmetic, not evidence those fees will arrive.`}</p></article><p><strong>No funds or credits changed. Funding and burns remain unverified; transfers and credit conversion remain disabled.</strong></p>`;
};
const task = async fn => {
  if (busy) return; const version = generation; busy = true; controls(); clear(); $('[data-message]').textContent = 'Calculating the planning scenario…';
  try { const payload = await fn(); if (version !== generation) return;
    if (payload.result) render(payload.result);
    if (payload.examples) { const examples = payload.examples; $('[data-examples]').innerHTML = `<p>A perfect run grants ${e(whole(examples.gauntlet[0].issued))} internal credits and spends ${e(whole(examples.gauntlet[0].spent))}. One million perfect free rounds grant ${e(whole(examples.repeatedFreeRounds.issuedCredits))} internal credits across players/time.</p><p>In the example with no opening reserve, 1,000 one-GEEK fees recycle 700 GEEK, so only 700 of 1,000 proposed one-GEEK claims fit the budget. A million one-raw-unit fees recycle zero units under per-receipt rounding.</p>`; }
    $('[data-message]').textContent = 'Planning calculation complete. No transaction or balance update was made.';
  } catch (error) { if (version === generation) { clear(); $('[data-message]').textContent = error.message; } }
  finally { if (version === generation) { busy = false; controls(); } }
};
$('[data-scenario]').addEventListener('submit', event => {
  event.preventDefault(); const f = event.currentTarget.elements;
  const body = { startingCredits: f.startingCredits.value.trim(), correctByRound: f.pattern.value.split(',').map(v => v.trim() === '' ? null : Number(v)), freeCompletions: Number(f.freeCompletions.value), freeCorrect: Number(f.freeCorrect.value),
    reserve: { openingReserve: f.openingReserve.value.trim(), feeEach: f.feeEach.value.trim(), feeCount: Number(f.feeCount.value), rewardEach: f.rewardEach.value.trim(), claimCount: Number(f.claimCount.value), rewardCap: f.rewardCap.value.trim() } };
  task(() => client.request({ method: 'POST', body }));
});
$('[data-baseline]').addEventListener('click', () => task(() => client.request()));
window.addEventListener('pagehide', () => { generation++; client.clear(); clear(); busy = false; controls(); $('[data-message]').textContent = 'Private planning results cleared. Reload after returning.'; });
$('[data-sign-out]').addEventListener('click', async () => { generation++; client.clear(); clear(); busy = true; controls(); try { await fetch('/api/session/?service=operations&action=logout', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' }); } finally { location.href = '/ops-login/'; } });
task(() => client.request());
