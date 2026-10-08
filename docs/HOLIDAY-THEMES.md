# Holiday themes

Sign in to Operations with the existing owner key, then open **Holiday themes** at `/ops/appearance/`. No additional key is needed. Settings start **Off**; deploying this feature does not enable a holiday.

| Mode | Behavior |
| --- | --- |
| Off | Standard Geek HQ appearance |
| Automatic | Follow the celebration windows below; standard appearance between holidays |
| On | Choose a holiday and keep it on until changed |

The preview is local until **Save holiday settings**. Saving adds fixed accent colors, background glows and a small holiday mark to public pages using the shared site script. The private workspace remains in its usual style. Decorations are static, use no external assets, and do not change questions, timers, scoring, profiles or funds.

## Automatic calendar

Dates use Eastern time (`America/Detroit`). These are authored decoration windows around celebration dates, rather than federal payroll-observance dates. Both endpoints are inclusive. If windows overlap, the shortest window wins, then the alphabetical holiday ID breaks a tie. The Western Gregorian calendar determines Easter. New Year's is evaluated across the December/January boundary.

| Holiday | Automatic window |
| --- | --- |
| New Year's | December 29–January 2 |
| Martin Luther King Jr. Day | Third Monday in January |
| Valentine's Day | February 12–15 |
| Presidents' Day | Third Monday in February |
| St. Patrick's Day | March 16–18 |
| Easter | Palm Sunday through Easter Monday |
| Memorial Day | Friday through the last Monday in May |
| Juneteenth | June 18–20 |
| Independence Day | July 1–5 |
| Labor Day | Friday through the first Monday in September |
| Halloween | October 24–31 |
| Veterans Day | November 10–12 |
| Thanksgiving | Monday through Sunday of the fourth Thursday in November |
| Christmas | December 1–26 |

Federal holiday rules were checked against [OPM's calendar](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/); the 2026 Easter date against the [USCCB Easter readings](https://bible.usccb.org/bible/readings/040526.cfm). The longer decoration windows are product choices, not official holiday durations.

## Access and saves

The private page and controls require the current Redis-backed owner session. Player sessions and standalone moderation, audit or payout keys cannot authorize appearance changes. Owner-cookie writes require a trusted HTTPS Origin and JSON, reject cross-site metadata, and are rate limited. Key rotation and expiration revoke access through the existing Operations gate.

The Redis key is scoped by `VERCEL_ENV`, so preview and production settings remain separate. A revision check rejects stale tabs with 409. One Lua transaction commits the selected mode, holiday and audit record together. The activity event is `appearance.holiday.changed`; integrity uses the existing audit configuration. Invalid saved records fail closed and are preserved. On a conflict, timeout or lost reply, refresh before another save: the earlier write may already have completed. The UI never retries a write automatically.

## Public delivery

`GET /api/appearance/` returns only `{ "ok": true, "theme": { "id": "christmas" } }`, or a null theme when disabled or outside an automatic window. It cannot save changes or return owner records. Public requests omit cookies. A 30-second cache and visible-page refresh every 60 seconds generally propagate changes within about 90 seconds; browser suspension and network failures can delay updates. Hidden pages pause polling and recheck on return. Failed reads clear decorations. Without JavaScript, pages keep their standard appearance.

Only the fixed catalog's IDs are accepted. Settings cannot supply CSS, HTML, arbitrary colors or asset URLs. This feature introduces no analytics event or browser storage.

## Verification

`tests/appearance.test.js` uses real Redis to check holiday dates and Eastern midnight, cross-year windows, overlapping holidays, palette contrast, minimal public output, owner/role isolation, origin and JSON enforcement, strict inputs, audit integrity, concurrent-tab conflicts, lost replies, expiry, key rotation, malformed state, deployment isolation and audit-index failures. Browser QA uses synthetic owner credentials and isolated Redis to exercise all holiday previews, saved modes, public-page refresh, outages, expired access and 320–1280 px layouts. It does not read production keys or make production settings changes. This is internal verification, not an independent audit.
