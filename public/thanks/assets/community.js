import { applicationClient, communityLink } from './community-core.js';
const $ = s => document.querySelector(s);
const form = $('[data-community-form]'), fields = $('[data-community-fields]'), message = $('[data-application-message]');
const client = applicationClient();
const submit = $('[data-community-submit]'), another = $('[data-community-another]');
const consent = $('[data-public-consent]'), recognition = form.elements.recognition;
const updateConsent = () => { consent.hidden = !recognition.checked; form.elements.consent.required = recognition.checked; if (!recognition.checked) form.elements.consent.checked = false; };
recognition.addEventListener('change', updateConsent); updateConsent(); fields.disabled = false;
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!client.pending && !form.reportValidity()) return;
  const data = new FormData(form);
  fields.disabled = true; submit.disabled = true;
  message.textContent = client.pending ? 'Checking the original submission…' : 'Sending your application to private review…';
  try {
    const receipt = await client.submit({ name: data.get('name'), profile: data.get('profile') || '', kind: data.get('kind'), details: data.get('details'), evidence: data.get('evidence') || '', recognition: recognition.checked, consent: form.elements.consent.checked, website: data.get('website') || '' });
    message.textContent = `Received for review. Your reference is ${receipt.id}. Save this reference if you contact the Geek community. Applying does not guarantee a public credit. Giving funds is optional.`;
    submit.hidden = true; another.hidden = false;
  } catch (error) {
    fields.disabled = client.pending;
    submit.textContent = client.pending ? 'Check submission receipt' : 'Send to private review';
    message.textContent = client.pending ? `${error.message || 'The response was unavailable.'} Your request may already be saved. Use “Check submission receipt” to check the same application.` : error.message;
  } finally { submit.disabled = false; }
});
another.addEventListener('click', () => { client.clear(); form.reset(); updateConsent(); fields.disabled = false; submit.hidden = false; another.hidden = true; submit.textContent = 'Send to private review'; message.textContent = 'Only your approved public credit can appear in the hall. Application details stay private.'; form.elements.name.focus(); });
const address = $('[data-fund-address]');
$('[data-fund-copy]').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(address.value); $('[data-fund-message]').textContent = 'Full address copied. Compare it with the address displayed here before sending.'; }
  catch { address.focus(); address.select(); $('[data-fund-message]').textContent = 'Select and copy the full address above.'; }
});
const list = $('[data-community-credits]'), loadButton = $('[data-community-more]');
let offset = 0, loading = false;
const render = credits => {
  for (const credit of credits) {
    const card = document.createElement('article'); card.className = 'thanks-credit';
    const label = document.createElement('span'); label.textContent = 'COMMUNITY CONTRIBUTOR';
    const name = document.createElement('h3'); name.textContent = String(credit.name || '').slice(0, 48);
    const summary = document.createElement('p'); summary.textContent = String(credit.summary || '').slice(0, 500);
    card.append(label, name, summary);
    const profile = communityLink(credit.profile);
    if (profile) { const link = document.createElement('a'); link.href = profile; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.textContent = 'Public profile ↗'; card.append(link); }
    list.append(card);
  }
};
const load = async () => {
  if (loading) return; loading = true; loadButton.disabled = true;
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(`/api/session/?service=community&offset=${offset}`, { credentials: 'omit', cache: 'no-store', signal: controller.signal });
    const result = await response.json();
    if (!response.ok || result.ok !== true || !Array.isArray(result.credits)) throw new Error('Unavailable');
    render(result.credits); offset += 20;
    $('[data-community-credits-message]').textContent = list.children.length ? 'These contributions were reviewed by Geek’s owner and published with permission.' : 'The next chapter is open. New community credits will appear here after review.';
    loadButton.hidden = result.hasMore !== true;
  } catch { $('[data-community-credits-message]').textContent = 'New community credits could not be loaded. The existing dedications above remain available.'; loadButton.hidden = false; loadButton.textContent = 'Try loading community credits'; }
  finally { clearTimeout(timer); loading = false; loadButton.disabled = false; }
};
loadButton.addEventListener('click', load); load();
