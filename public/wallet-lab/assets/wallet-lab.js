import { initialize } from './kaspa-sdk.js';
import { NETWORK, derive, seal, open } from './vault.js';
const $ = selector => document.querySelector(selector), storageKey = 'geek-testnet-vault-v1';
let sdk, pending = null, expectedAddress = '', positions = [], timer, busy = false;
const clearSecret = () => { pending = null; positions = []; $('[data-phrase]').textContent = ''; $('[data-word-checks]').replaceChildren(); $('[data-password]').value = ''; $('[data-confirm-password]').value = ''; $('[data-restore-password]').value = ''; $('[data-backup]').hidden = true; clearTimeout(timer); };
const act = async operation => {
  if (busy) return; busy = true; document.querySelectorAll('button').forEach(b => { b.disabled = true; });
  try { sdk ||= await initialize(); await operation(); }
  catch { $('[data-status]').textContent = 'Wallet operation was not completed. Check the backup, password and available browser storage. Your previous saved copy has not been replaced.'; }
  finally { busy = false; document.querySelectorAll('button').forEach(b => { b.disabled = false; }); }
};
const showWallet = address => { $('[data-address]').textContent = address; $('[data-wallet]').hidden = false; };
$('[data-create]').addEventListener('click', () => act(async () => {
  if (localStorage.getItem(storageKey) && !confirm('A testnet wallet already exists here. Keep its backup before creating another. Continue?')) return;
  clearSecret(); expectedAddress = '';
  const mnemonic = sdk.Mnemonic.random(24);
  try { pending = mnemonic.phrase; } finally { mnemonic.free(); }
  positions = [...new Set(Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n % 24))].slice(0,3);
  if (positions.length !== 3) throw new Error('Random check unavailable');
  $('[data-phrase]').textContent = pending.split(' ').map((word,i) => `${i+1}. ${word}`).join('  ');
  for (const index of positions) { const label = document.createElement('label'), input = document.createElement('input'); label.textContent = `Confirm word ${index+1}`; input.dataset.word = String(index); input.required = true; input.autocomplete = 'off'; input.spellcheck = false; label.append(input); $('[data-word-checks]').append(label); }
  $('[data-backup]').hidden = false; $('[data-wallet]').hidden = true;
  $('[data-status]').textContent = 'Write the 24 words down privately, confirm the three requested words and create an encrypted backup.';
  timer = setTimeout(() => { clearSecret(); $('[data-status]').textContent = 'Recovery words cleared. Start again if you did not finish the backup.'; },180000);
}));
$('[data-backup]').addEventListener('submit', event => { event.preventDefault(); act(async () => {
  if (!pending || positions.some(i => document.querySelector(`[data-word="${i}"]`).value.trim() !== pending.split(' ')[i])) throw new Error('Backup check failed');
  const password = $('[data-password]').value;
  if (password !== $('[data-confirm-password]').value) throw new Error('Password mismatch');
  const vault = await seal(sdk,pending,password), checked = await open(sdk,vault,password);
  if (checked.address !== derive(sdk,pending)) throw new Error('Backup mismatch');
  expectedAddress = vault.address;
  const url = URL.createObjectURL(new Blob([JSON.stringify(vault,null,2)],{type:'application/json'})), link = document.createElement('a');
  link.href = url; link.download = 'geek-testnet-encrypted-backup.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  clearSecret(); $('[data-status]').textContent = 'Encrypted backup downloaded. Select that file below to prove you can restore it before saving this wallet.';
}); });
$('[data-restore]').addEventListener('submit', event => { event.preventDefault(); act(async () => {
  const file = $('[data-file]').files[0]; if (!file || file.size > 20000) throw new Error('Invalid backup file');
  const vault = JSON.parse(await file.text()), password = $('[data-restore-password]').value, checked = await open(sdk,vault,password);
  if (expectedAddress && checked.address !== expectedAddress) throw new Error('Choose the just-created backup');
  // Persist ciphertext only after successful password, authentication-tag and SDK-address checks.
  localStorage.setItem(storageKey,JSON.stringify(vault));
  if (localStorage.getItem(storageKey) !== JSON.stringify(vault)) throw new Error('Storage unavailable');
  expectedAddress = ''; clearSecret(); $('[data-file]').value = ''; showWallet(checked.address);
  $('[data-status]').textContent = `Restore succeeded on ${NETWORK}. The encrypted backup and recovery phrase are your recovery methods.`;
}); });
$('[data-copy]').addEventListener('click', () => act(async () => { await navigator.clipboard.writeText($('[data-address]').textContent); $('[data-status]').textContent = 'Testnet address copied.'; }));
$('[data-forget]').addEventListener('click', () => { if (confirm('Forget this encrypted local copy? Keep your backup first. This does not erase a blockchain wallet.')) { localStorage.removeItem(storageKey); clearSecret(); $('[data-wallet]').hidden = true; $('[data-address]').textContent = ''; $('[data-status]').textContent = 'Encrypted browser copy removed.'; } });
document.addEventListener('visibilitychange', () => { if (document.hidden) clearSecret(); });
window.addEventListener('pagehide', clearSecret);
if (!isSecureContext || !crypto.subtle) { document.querySelectorAll('button').forEach(b => { b.disabled = true; }); $('[data-status]').textContent = 'Open this lab in a secure, supported browser.'; }
