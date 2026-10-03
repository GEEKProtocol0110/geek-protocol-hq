import { decimalToRaw, formatRaw, splitFee } from './amounts.js';
import { powerups, treasuryAccounts } from './catalog.js';
const $ = selector => document.querySelector(selector);
const element = (tag, text, className) => { const node = document.createElement(tag); if (text !== undefined) node.textContent = text; if (className) node.className = className; return node; };
$('[data-powerups]').replaceChildren(...powerups.map(item => {
  const card = element('article', undefined, 'power-card');
  card.append(element('span', 'PLANNED / NOT AVAILABLE', 'item-status'), element('h3', item.name), element('p', item.description), element('small', item.rules));
  const price = element('p', 'Price not finalized', 'item-price'); const button = element('button', 'Purchases not enabled', 'button button-secondary'); button.type = 'button'; button.disabled = true;
  card.append(price, button); return card;
}));
$('[data-accounts]').replaceChildren(...treasuryAccounts.map(account => {
  const li = element('li'); li.append(element('strong', account.name), element('span', account.purpose), element('small', 'Funding not verified')); return li;
}));
const calculate = () => {
  try {
    const allocation = splitFee(decimalToRaw($('[data-gross]').value), decimalToRaw($('[data-fee]').value));
    $('[data-recycle]').textContent = formatRaw(allocation.recyclePendingRaw) + ' GEEK';
    $('[data-burn]').textContent = formatRaw(allocation.burnPendingRaw) + ' GEEK';
    $('[data-calculation-error]').hidden = true;
  } catch {
    $('[data-recycle]').textContent = '—'; $('[data-burn]').textContent = '—'; $('[data-calculation-error]').hidden = false;
  }
};
$('[data-gross]').addEventListener('input', calculate); $('[data-fee]').addEventListener('input', calculate); calculate();
const request = async (url, body) => {
  const response = await fetch(url, { credentials: 'same-origin', ...(body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  const data = await response.json(); if (!response.ok || !data.ok) throw Error(data.error || 'This information is unavailable right now.'); return data;
};
const status = async () => {
  $('[data-status-retry]').disabled = true;
  try {
    const { economy } = await request('/api/session/?service=economy');
    const messages = { 'not-configured': 'No payout reserve address configured.', 'address-configured': 'Reserve address configured. Its funding is not yet verified.', 'invalid-address': 'The reserve address configuration needs correction.' };
    $('[data-reserve-status]').textContent = messages[economy.reserve.configuration] || 'Reserve status unavailable.';
    $('[data-status-retry]').hidden = true;
  } catch { $('[data-reserve-status]').textContent = 'Reserve status unavailable. No funding or payout capability is being claimed.'; $('[data-status-retry]').hidden = false; }
  finally { $('[data-status-retry]').disabled = false; }
};
$('[data-status-retry]').addEventListener('click', status); status();
const journal = async () => {
  const button = $('[data-journal-load]'); button.disabled = true; $('[data-journal-note]').textContent = 'Loading your private journal…';
  try {
    await request('/api/session/', {});
    const { ledger } = await request('/api/session/?service=economy', { action: 'ledger' });
    $('[data-journal-totals]').hidden = false;
    for (const [name, raw] of Object.entries(ledger.totals)) { const node = document.querySelector(`[data-total="${name}"]`); if (node) node.textContent = formatRaw(raw) + ' GEEK'; }
    $('[data-journal-note]').textContent = ledger.sequence ? `${ledger.sequence} planned transaction${ledger.sequence === 1 ? '' : 's'}. These allocations are not spendable funds or confirmed transfers.` : 'No transactions recorded yet. This planning journal cannot move funds or create a spendable GEEK balance.';
    $('[data-history]').replaceChildren(...ledger.receipts.map(receipt => { const li = element('li'); li.append(element('strong', receipt.kind.replaceAll('-', ' ')), element('span', formatRaw(receipt.grossRaw) + ' GEEK · planned'), element('small', new Date(receipt.createdAt).toLocaleString('en-US'))); return li; }));
    button.textContent = 'Reload my journal';
  } catch (error) { $('[data-journal-note]').textContent = error.message + ' Your saved records have not changed.'; button.textContent = 'Try loading my journal again'; }
  finally { button.disabled = false; }
};
$('[data-journal-load]').addEventListener('click', journal);
