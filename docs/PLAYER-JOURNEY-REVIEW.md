# Player journey review — October 8, 2026

The learning walkthrough uses the shipped browser scripts, actual API handlers and a separate real Redis fixture over HTTPS, with synthetic account data and no production credentials. Chromium touch emulation covers 320, 375, 412, 768 and 1,280 pixel viewports. This is browser QA, not a physical-phone or real Kasware extension test.

## Verified flow

- Home's mobile navigation opens Learn; a new player can choose the first lesson, read four teaching steps and start five untimed questions.
- Reloading restores the same in-progress Study run. Completing a run records explored concepts and a saved mistake.
- My HQ exposes the saved feedback; its review link opens the correct topic, and focused review selects the missed concept.
- Losing an answer response after its Redis commit permits a manual retry without counting the answer twice. A temporary Study outage leaves saved progress intact.
- A hung answer request times out after 15 seconds, shows an actionable error and unlocks the controls. No automatic write retry is introduced. The deadline also covers response-body reading.
- Home, Study, Play, Lobby, My HQ and the reward/recovery page fit the tested widths without horizontal document overflow. Deep links reveal the nested learning records.
- Opening the reward/recovery page preserves an existing chosen player name. Wallet verification's session setup also stops supplying a generic replacement name.

## Fixes

Study previously had no request deadline, so a stalled connection could keep every practice control disabled. The bounded request now returns control with a retry message while retaining the existing server idempotency rules.

Play automatically supplied a browser-stored name or `Guest Geek`, Lobby resubmitted its cached name, the reward/recovery page supplied `Reward Geek`, and wallet proof setup supplied `Verified Geek`. Automatic setup now requests an existing-or-new session without changing a name. The old name editor was hidden with the mobile sidebar; an Edit name button now makes that action available on phones. An explicit lobby name edit still submits the chosen name to the server; other user-entered naming flows remain available.

## Remaining acceptance work

Try these same steps on an actual Android phone and desktop Kasware installation. Verify wallet link/recovery and return to saved progress using synthetic/test accounts; never provide a recovery phrase to HQ. Existing signature, replay, account-recovery and old-session invalidation tests remain covered by the full automated suite, but they do not establish compatibility with the installed extension/device.

Then run a focused 10–20-player trial and record confusing steps, completion and return feedback. A simulated walkthrough cannot establish those user outcomes. Rewards still represent internal Alpha credits; this review enables no treasury settlement or testnet configuration.

## Sign-in and profile-name follow-up

Home now exposes sign-in in its header and beside the starting actions. My HQ exposes guest/verified status, a sign-in link and an **Edit profile name** disclosure on the identity card. `/sign-in/` provides connect → sign a login message → open My HQ, an installation path and guest continuation. It explains the Mainnet requirement and that recovery replaces the browser player rather than merging unrelated guest records.

Names now live in a separate stable-player record so recovery and stale game-profile writes preserve them. Explicit edits require a current session and rate limits run before the write. A name-store outage fails rather than replacing a saved player session. Name and wallet requests have a 15-second network deadline; wallet approval itself waits for the user.

Validation: 172 tests pass, zero skips/failures, and full repository/security/content verification passes. An HTTPS browser fixture with real Redis and real server handlers verifies Home → sign-in → missing-wallet instructions → guest continuation → My HQ rename/reload, plus visible save errors. With a synthetic Kasware provider and real Schnorr signatures it verifies declined-signature retry, wallet linking, recovery from an isolated browser context, old-session revocation, durable name edits, existing-login continuation and wrong-network blocking. Home, sign-in and the open name editor fit widths 320, 375, 412, 768 and 1280. Browser contexts run without Chromium's single-process flag to preserve cookie isolation.

This is browser/device emulation with a synthetic wallet provider, not a real Kasware extension or physical-phone acceptance result. Those checks remain outstanding.
