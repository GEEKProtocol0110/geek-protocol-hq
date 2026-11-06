# Geek News

ECO-006 / DR-032. Source prepared November 6, 2026 (America/Detroit) from main `bbb58bf95d4babf4f2e0e244e58fe08011da9d39` (#240). Founder requests a news page with markets, crypto world news and futures. Merge, production and device acceptance are separate from this source candidate.

## Experience

`/news/` originally provided four selected views (expanded below): Kraken KAS/BTC/ETH/SOL spot quotes in USD, crypto headlines, global financial-market headlines, and Binance KAS/BTC/ETH/SOL perpetual futures quoted in USDT. The futures view is explicitly derivatives, not price predictions. All prices and headline content come from the provider; no example prices, invented headlines, AI summaries, order actions, affiliates or paid API accounts are added.

Home's main navigation and footer link to Geek News. Native Kaspa official updates, rusty-kaspa releases, Kas.fyi, directory and TradingView source links remain useful without the embed or JavaScript. Introductory explanations distinguish pairs, derivatives and headline interpretation. Data coverage/timing, content attribution and provider privacy links are visible. Metadata and sitemap include the public route.

## Integration and boundaries

The shipped local client builds fixed cross-origin iframe URLs in the format emitted by TradingView's official current `embed-widget-market-quotes.js` and `embed-widget-timeline.js`. It does not execute those remote bootstrap scripts in the Geek origin. `locale`/`market` parameters and URL-encoded settings match the inspected bootstraps. Timeline's current bootstrap filters out older `feedMode` configuration: crypto uses the actual `market=crypto` query; the unfiltered view supplies global market stories. Changing provider URL/config formats will require checking this adapter again.

Frames allow scripts, their separate origin and new source tabs, but no forms, top navigation, wallet/identity permissions or account API access. Since the frame is cross-origin, `allow-same-origin` preserves the provider's origin, not Geek's. Fixed canonical public page URI and attribution parameters are supplied; browser location/query/hash/account data never enter settings. The page's scripts and connection CSP remain self-only. The existing strict CSP is applied outside `/news`; an exclusive `/news/:path*` rule changes only `frame-src` to `https://www.tradingview-widget.com`. Common HSTS, framing denial and other response headers remain global. Preview must confirm a single effective CSP on News and the original policy elsewhere; static local preview does not emulate Vercel headers.

Only the selected feed runs. Repeated selection does not reload it. Switching destroys the previous frame. Pause removes the frame; Resume or selecting another view reconnects. No background polling, local storage, service worker, news proxy, API key or new server function is added. Provider frames may make their own requests and apply provider privacy practices. No claim is made that external provider usage is zero or available forever.

The status describes the selected feed and warns of delays; an iframe `load` event never becomes a verified-live/data-fresh assertion. Browsers cannot reliably inspect cross-origin feed health. Permanent fallback links and honest notices cover blocks, stale data, missing symbols and provider outages. News selection is provider-controlled and can include older stories. Headline presence is not independent fact verification. Do not scrape or redistribute full articles; preserve the widget's own links and attribution.

## Primary references checked November 6

- [TradingView free widgets](https://www.tradingview.com/widget/) and [iframe integration tutorial](https://www.tradingview.com/widget-docs/tutorials/iframe/build-page/widget-integration/).
- [Market Data widget](https://www.tradingview.com/widget-docs/widgets/watchlists/market-data/) and [legacy Top Stories](https://www.tradingview.com/widget-docs/widgets/news/legacy-top-stories/).
- Official bootstrap bytes inspected: [market quotes](https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js), [timeline](https://s3.tradingview.com/external-embedding/embed-widget-timeline.js). These generate the `www.tradingview-widget.com/embed-widget/` URLs used here.
- [KAS spot on Kraken](https://www.tradingview.com/symbols/KASUSD/?exchange=KRAKEN), [BTC](https://www.tradingview.com/symbols/BTCUSD/?exchange=KRAKEN), [ETH](https://www.tradingview.com/symbols/ETHUSD/?exchange=KRAKEN), [SOL](https://www.tradingview.com/symbols/SOLUSD/?exchange=KRAKEN), [KAS perpetual on Binance](https://www.tradingview.com/symbols/KASUSDT.P/?exchange=BINANCE), [BTC perpetual](https://www.tradingview.com/symbols/BTCUSDT.P/?exchange=BINANCE).
- [Provider data coverage](https://www.tradingview.com/data-coverage/) and [Vercel header configuration](https://vercel.com/docs/project-configuration/vercel-json#headers).

## Verification

Three synthetic client/config regressions cover one-frame isolation, fixed-origin/config handling despite hostile URL parameters, repeated selections, four futures symbols, pause/resume, filtered/unfiltered news, no false live state, route CSP separation and native discovery links. Existing Home/Media checks also pass (10 combined tests). Security evidence check passes all 311 assertions; public-answer checks pass. Local desktop browser observed actual spot quotes and attributed crypto/global headlines. Desktop browser also observed numeric KAS/BTC/ETH/SOL perpetual quotes, and Pause removed the frame while Resume reconnected. Final Vercel headers/CI remain to be checked at this checkpoint. No physical phone or independent market-data validation is claimed. Final exact-head CI/preview evidence belongs in the PR review record.

The Kaspa directory's 164 resources, account/game authority, private ranked work and all CCE/reward/ownership holds remain intact.

## Preview routing correction

Preview check at source 45bee79: /news/ returned HTTP 200 without Content-Security-Policy, while Home/Profile retained their baseline and the News script received the intended policy. Added an explicit /news/ document rule alongside /news/:path* and a configuration regression. Fresh deployment/header and CI verification are required; source changes alone do not prove the fix.

## Expanded global market desk

Expanded the candidate after founder feedback that markets/global markets were lacking. The default world overview covers US, Europe and Japan benchmarks plus currency/commodity context. Ten views now include eight crypto spot pairs, ten US stocks, eight forex pairs, metals/energy, six government yields, seven traditional futures, four crypto perpetuals and two news feeds. Market groups and headline controls are distinct; each selected view has an instrument explanation and a matching external market link. Native links expose broader indexes/stocks/currencies/futures/bonds without JavaScript. Broker index CFDs, spot metals, continuous futures and yields are labeled separately; no invented prices or market-open claims. One-frame/pause/CSP isolation is preserved. Four focused tests pass locally; fresh exact-head CI and deployed source/header checks pending. Actual per-symbol quote availability, physical phone rendering and independent data review are not established by source tests.

Primary configuration references: [Market quotes index demo](https://www.tradingview.com/widget-docs/widgets/watchlists/market-quotes/demos/indices/), [Market overview presets](https://www.tradingview.com/widget-docs/widgets/watchlists/market-overview/), [government yields](https://www.tradingview.com/symbols/TVC-US10Y/) and [listed futures instruments](https://www.tradingview.com/the-leap/amp-futures-september-2026/rules/). Provider embedding rights and coverage vary by instrument; direct market links remain available.

## Native Top 100 crypto

Founder requested top-100 crypto coverage. Added a native searchable USD table for exactly 100 unique CoinGecko market-cap entries, with rank, name/symbol, price, signed 24-hour change, capitalization and volume. Kaspa watchlist stays distinct and does not force Kaspa into the ranking. Stablecoins/wrapped assets remain included. A fixed public GET service in the existing widget function fetches only CoinGecko coins/markets with market_cap_desc/per_page=100/page=1; no new function, key or paid account. Five-minute caches, concurrent-request coalescing, bounded timeout/response, failure cooldown and explicit unavailable output avoid invented or silently incomplete rankings. Browser requests use same-origin credentials for protected previews; the public service never reads or forwards account cookies to CoinGecko. switching or pausing aborts the request and prevents late insertion. No automatic polling. Native text/encoded links prevent provider HTML injection. Snapshot fetch time is not asserted as quote freshness. The legacy TradingView crypto screener rendered no matches in a direct browser check, so it was not shipped. Focused tests cover ranking validity, cache/backoff, unchanged APK behavior, table/search/zero/null values, late responses and pause/switch isolation; fresh deployment/API and full CI remain to be checked.

This supersedes the no-news-API integration boundary in DR-032 only for public crypto rankings; see DR-033. [CoinGecko markets documentation](https://www.coingecko.com/learn/python-query-coingecko-api) describes market-cap ordering and page size; [attribution](https://www.coingecko.com/en/api) is visible by the feed. Missing/blocked/rate-limited API access shows an unavailable notice and direct ranking link. Provider availability remains a deployment acceptance condition.

## HQ visual polish

Founder requested polish and more GEEK identity. News adopts the existing HQ gold (#f6c643), Kaspa cyan (#70e6dc), dark green panels, technical grid/orbit typography, clear gold entry control, native section links and Geek field notes. Market controls have 48px minimum height; Top 100 retains a distinct cyan outline, sticky table headers, numeric alignment and signed change colors. Decorative signal artwork is hidden from assistive technology and removed on narrow screens. No new images, portrait rollout, network dependency or data/security behavior. Focused News/Top100/APK regressions passed 15/15. Earlier native Top100 CI 42261263638 passed; browser rendered 100 rows, bitcoin search narrowed to Bitcoin/Bitcoin Cash and clearing restored 100. Final polish preview/rendered acceptance and CI remain pending at this checkpoint.
