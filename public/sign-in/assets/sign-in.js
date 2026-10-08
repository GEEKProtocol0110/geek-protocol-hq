(() => {
  'use strict';
  const status = document.querySelector('[data-sign-in-status]');
  const hq = document.querySelector('[data-sign-in-hq]');
  let signedIn = false;
  const showSignedIn = (message) => { status.textContent = message; hq.hidden = false; document.querySelector('[data-sign-in-continue]').textContent = 'Continue to My HQ →'; };
  document.addEventListener('geek:signed-in', (event) => {
    signedIn = true;
    showSignedIn(event.detail.recovered ? 'Signed in. Your saved player has been recovered. Open My HQ to continue.' : 'Signed in. Your player is protected by this wallet. Open My HQ to continue.');
    hq.focus();
  });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  fetch('/api/identity', { credentials: 'same-origin', signal: controller.signal })
    .then(async (response) => {
      const payload = await response.json();
      if (signedIn) return;
      if (response.ok && payload.identity?.linked) showSignedIn('You are already signed in with a verified wallet. Open My HQ to continue.');
      else if (response.status === 401 || (response.ok && !payload.identity?.linked)) status.textContent = 'Guest profile. Connect and sign below to sign in.';
      else throw new Error('Session check unavailable');
    })
    .catch(() => { if (!signedIn) status.textContent = 'Your session could not be checked. You can retry wallet sign-in below or reload this page.'; })
    .finally(() => clearTimeout(timer));
})();
