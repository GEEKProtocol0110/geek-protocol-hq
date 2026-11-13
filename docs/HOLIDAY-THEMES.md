# Holiday themes

Sign in to Operations with the existing owner key, then open **Holiday themes** at `/ops/appearance/`. No additional key is needed. Settings start **Off**; deploying this feature does not enable a holiday.

| Mode | Behavior |
| --- | --- |
| Off | Standard Geek HQ appearance |
| Automatic | Follow the celebration windows below; standard appearance between holidays |
| On | Choose a holiday and keep it on until changed |

The preview is local until **Save holiday settings**. Saving applies fixed accent colors, seasonal header borders, edge ornaments, card glows and one compact greeting to public pages using the shared site script. Each holiday has distinct motifs; Christmas uses snowflakes and trees, Halloween pumpkins and moons, Easter a cross and spring flowers, and Thanksgiving autumn leaves. The private workspace remains in its usual style. Decorations are static, use no external assets, and do not change questions, timers, scoring, profiles or funds. Edge ornaments are not placed on individual game routes or over an active quiz.

## Automatic calendar

Dates use Eastern time (`America/Detroit`). These are authored decoration windows around celebration dates, rather than federal payroll-observance dates. Both endpoints are inclusive. If automatic windows overlap, the highest priority wins, then the shortest window, then the holiday id. Manual-only entries are selectable and never enter this comparison. The Western Gregorian calendar determines Easter. New Year's is evaluated across the December/January boundary.

| Holiday | Group | Priority | Automatic window |
| --- | --- | --- | --- |
| New Year's | Seasonal | 30 | December 29–January 2 |
| Bitcoin Genesis | Bitcoin | 70 | January 3 |
| Valentine's Day | Seasonal | 30 | February 12–15 |
| Presidents' Day | Civic | 50 | Third Monday in February |
| St. Patrick's Day | Seasonal | 50 | March 16–18 |
| Easter | Seasonal | 20 | Palm Sunday through Easter Monday |
| Crescendo | Kaspa | 80 | May 4–6 |
| Bitcoin Pizza Day | Bitcoin | 70 | May 22 |
| Memorial Day | Civic | 30 | Friday through the last Monday in May |
| Geek Protocol's Birthday | Geek Protocol | 90 | June 21–23 |
| Toccata | Kaspa | 80 | June 29–30 |
| Independence Day | Civic | 30 | July 1–5 |
| Ethereum Launch | Ethereum | 70 | July 29–31 |
| Labor Day | Civic | 30 | Friday through the first Monday in September |
| KRC-20 Launch | Kaspa | 80 | September 14–16 |
| Halloween | Seasonal | 20 | October 24–30 |
| Bitcoin Whitepaper Day | Bitcoin | 70 | October 31 |
| Kaspa's Birthday | Kaspa | 90 | November 6–8 |
| Veterans Day | Civic | 50 | November 10–12 |
| Thanksgiving | Seasonal | 30 | Monday through Sunday of the fourth Thursday in November |
| Christmas | Seasonal | 20 | December 1–26 |

Satoshi's Birthday (April 5) is manual only, priority 0. It can be selected in On mode and is absent from Automatic mode. Geek Protocol's Birthday uses June 22 in America/Detroit, the local civil date of the KRC-20 deploy, with an automatic window of June 21–23. The transaction hash is `GEEK_DEPLOYMENT.deploymentHash` in `server/geek-deployment.js`.

Federal holiday rules were checked against [OPM's calendar](https://www.opm.gov/policy-data-oversight/pay-leave/federal-holidays/); the 2026 Easter date against the [USCCB Easter readings](https://bible.usccb.org/bible/readings/040526.cfm). The longer decoration windows are product choices, not official holiday durations.

## 2026 overlap results

These are the dates where a new window meets an existing one, or where the windows were shortened so they would not meet. The picker result is the same for the whole Detroit civil date.

| Detroit date | Windows open | Selected |
| --- | --- | --- |
| January 2 | New Year's | New Year's |
| January 3 | Bitcoin Genesis | Bitcoin Genesis |
| April 5 | Easter; Satoshi is not automatic | Easter |
| May 22 | Bitcoin Pizza Day and Memorial Day | Bitcoin Pizza Day (priority 70 over 30) |
| May 23–25 | Memorial Day | Memorial Day |
| June 20 | none | Standard appearance |
| June 21–23 | Geek Protocol's Birthday | Geek Protocol's Birthday |
| June 24 | none | Standard appearance |
| June 29–30 | Toccata | Toccata |
| July 1 | Independence Day | Independence Day |
| October 30 | Halloween | Halloween |
| October 31 | Bitcoin Whitepaper Day | Bitcoin Whitepaper Day |
| November 8 | Kaspa's Birthday | Kaspa's Birthday |
| November 9 | none | Standard appearance |
| November 10 | Veterans Day | Veterans Day |
| December 27–28 | none | Standard appearance |

December 27–28 stays unthemed. That gap was left as it is.

## Access and saves

The private page and controls require the current Redis-backed owner session. Player sessions and standalone moderation, audit or payout keys cannot authorize appearance changes. Owner-cookie writes require a trusted HTTPS Origin and JSON, reject cross-site metadata, and are rate limited. Key rotation and expiration revoke access through the existing Operations gate.

The Redis key is scoped by `VERCEL_ENV`, so preview and production settings remain separate. A revision check rejects stale tabs with 409. One Lua transaction commits the selected mode, holiday and audit record together. The activity event is `appearance.holiday.changed`; integrity uses the existing audit configuration. Invalid saved records fail closed and are preserved. On a conflict, timeout or lost reply, refresh before another save: the earlier write may already have completed. The UI never retries a write automatically.

## Public delivery

`GET /api/appearance/` returns only `{ "ok": true, "theme": { "id": "christmas" } }`, or a null theme when disabled or outside an automatic window. It cannot save changes or return owner records, greetings, colors or citation URLs. Public requests omit cookies. A 30-second cache and visible-page refresh every 60 seconds generally propagate changes within about 90 seconds; browser suspension and network failures can delay updates. Hidden pages pause polling and recheck on return. Failed reads, an unknown id and Off clear the theme, the greeting and the ornaments. A repeat read of the same id does not add a second greeting. Without JavaScript, pages keep their standard appearance.

Only the fixed catalog's IDs are accepted. Settings cannot supply CSS, HTML, arbitrary colors or asset URLs. Citation links live in the catalog module and are removed before an owner or public response is sent. This feature introduces no analytics event or browser storage. The saved default remains Off.

## Verification

`tests/appearance.test.js` uses real Redis to check holiday dates and Eastern midnight, cross-year windows, overlapping holidays, palette contrast, minimal public output, owner/role isolation, origin and JSON enforcement, strict inputs, audit integrity, concurrent-tab conflicts, lost replies, expiry, key rotation, malformed state, deployment isolation and audit-index failures. Browser QA uses synthetic owner credentials and isolated Redis to exercise all holiday previews, saved modes, public-page refresh, outages, expired access and 320–1280 px layouts. It does not read production keys or make production settings changes. This is internal verification, not an independent audit.

## October 16 character and atmosphere update

MLK Day and Juneteenth are removed from manual choices and automatic windows at the founder’s request. A structurally valid saved selection for either retired ID displays Off without rewriting the underlying record; an owner can save a new listed holiday with its existing revision. New saves of retired IDs are rejected. Other malformed state still fails closed.

The initial release added shared GIGA/A.C.E. panels. The founder subsequently requested less repeated character art; those panels are retired. The later catalog upgrade removed the leftover `.giga-portrait` badge rule. Compact seasonal greetings follow the selected theme and clear on Off, a retired ID or failed reads. Repeated reads of the same active theme do not duplicate ornaments. Holiday decoration remains static and click-through, and does not change questions, timers or scores. The operator preview includes matching seasonal motifs and borders.

The public shell adds a star field, quiet nebula backgrounds, terminal labels and a brief hover code shift. The old space-animation toggle is removed. Canvas motion runs for at most five seconds of visible time per scene, with static stars afterward; reduced-motion, data-saver and hidden-page behavior remain supported. No recurring flashing effect or continuous code animation is added.

## Background emphasis — October 16 correction

The founder requested less GIGA/A.C.E. prominence while more character art is pending, and stronger space/neon/glitch/coder backgrounds. Remove the injected per-page character panels and extra A.C.E. portrait treatment. Replace the large home portrait with a local decorative neon constellation. Keep established story/learning characters in their existing contexts; original artwork remains unchanged.

A fixed, click-through background combines cyan/violet nebula glows, brighter stars, a perspective neon grid, faint scanlines and decorative code fragments. Code-text flicker is a low-opacity, one-time 3.5-second entrance; reduced-motion and narrow layouts disable it. The existing bounded canvas motion remains unchanged and no animation button returns. The code texture is aria-hidden, authored decoration, not live terminal output or a data stream. The holiday greeting is absent when no holiday is active. The former characters.js URL imports the replacement atmosphere module for cached-shell compatibility.

## Catalog upgrade

The catalog in `public/assets/holiday-calendar.js` is the source for id, label, group, icon, greeting, window, priority and motifs. New Kaspa and crypto days also carry color tokens. Those tokens are copied into `holiday-theme.css`; the original twelve color and fringe rules were not regenerated. `holiday-theme.js` reads motifs and the greeting from the catalog. Unknown ids do not render.

The public greeting is one line, the catalog sentence with no icon prefix, hung under `.site-header`. Ornaments stay `aria-hidden`. The old `.hq-holiday-greeting` rules were removed so the greeting has one class, `.holiday-greeting`.

Holiday CSS has no `@keyframes`, no `animation` and no `url(`. Ornament symbols use a fixed tilt. `@media (prefers-reduced-motion: reduce)` sets that tilt to `none`. An active quiz (`[data-screen="quiz"].active`), `body.is-playing`, or a `/games/<name>/` route does not receive the ornament layer. Code-rain tinting was not added.

Citation links for the new days, not sent by the API:

| Holiday | Primary source |
| --- | --- |
| Kaspa's Birthday | Kaspa Wiki tokenomics, mainnet start Nov 07 2021: https://wiki.kaspa.org/en/tokenomics |
| Bitcoin Genesis | Blockstream glossary, genesis timestamp 2009-01-03 18:15:05 UTC: https://help.blockstream.com/education/glossary/genesis-block |
| Bitcoin Pizza Day | Guinness record for the May 22, 2010 payment: https://www.guinnessworldrecords.com/world-records/696240-first-commercial-bitcoin-transaction |
| Ethereum Launch | Ethereum Foundation, July 30, 2015: https://blog.ethereum.org/2015/07/30/ethereum-launches |
| KRC-20 Launch | Secondary report of the Kasplex mainnet announcement, September 15, 2024. The original Kasplex post was not the source used here: https://minerbases.com/krc-20-mainnet-launch-announcement/ |
| Bitcoin Whitepaper Day | Cryptography mailing list, Oct 31, 2008, 14:10 EDT: https://www.metzdowd.com/pipermail/cryptography/2008-October/014810.html |
| Crescendo | rusty-kaspa v1.0.0, activation May 5, 2025: https://github.com/kaspanet/rusty-kaspa/releases/tag/v1.0.0 |
| Toccata | Kaspa lore, activation June 30, 2026. The automatic window stops on June 30: https://kaspa.org/lore |
| Geek Protocol's Birthday | Kasplex token record for the KRC-20 deploy. The hash is the `deploymentHash` pin in `server/geek-deployment.js` (`c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1`). Acceptance time 2025-06-23 02:08:00.851 UTC is 2025-06-22 22:08 EDT: https://api.kasplex.org/v1/krc20/token/GEEK |
| Satoshi's Birthday | P2P Foundation profile date, manual only: https://web.archive.org/web/20120529203623/p2pfoundation.ning.com/profile/SatoshiNakamoto |

Greetings for the new days stay factual. They do not mention price, market value or hype. The twelve existing greeting lines were left as written. Appearance still defaults to Off until an owner saves another mode.

## Stroke marks and palette pass

Public ornaments are drawn from `public/assets/holiday-marks.js`. Each holiday names three mark ids. The page paints twelve static SVG strokes from that list: hex nodes, DAG edges, a terminal frame, and a small circuit-face. The brand circle uses the first mark. Unicode in the catalog remains the ops-preview corner, not the public ornament.

Color tokens for every holiday, including the original twelve, live on the catalog entry and in `holiday-theme.css`. Presidents' Day, Memorial Day, Independence Day, and Veterans Day no longer share one patriotic stripe. Memorial Day is a single quiet fade. Independence Day keeps a short crimson divider. Kaspa teal stays in the crypto, Kaspa, and Geek Protocol fringes. Greetings stay the catalog sentences, in Inter, under the header.

There is still no `@keyframes`, animation, or `url(` in the holiday stylesheet. Reduced motion clears the fixed tilt. An active quiz, `body.is-playing`, and `/games/<name>/` routes do not receive the ornament layer. Code rain is unchanged: this pass does not retint it.
