# Native KAS exchange directory review

ECO-004. Editorial date: November 5, 2026, America/Detroit. Prepared against HQ main `3a98a38dee7eb3d7d7fa2733ab38c324fce88cf4`. This is a source candidate; merge, deployment and device acceptance are separate.

## Public result

Add 60 provider listings to `/kaspa/directory/`: 37 spot exchanges, 14 brokers/fiat on-ramps and nine swaps/aggregators. Each group is alphabetical, directly after wallets, before the remaining general Kaspa resources. The two KRC-20 groups stay after all general Kaspa links. Preserve all 104 existing entry records exactly: 164 resources and 17 categories overall.

The introduction gains a native “Where to buy KAS” shortcut that also clears unrelated active filters. Existing search, category anchors, no-JavaScript browsing and structured data cover the new entries through the maintained catalog generator. Directory title/description mention exchanges; the existing indexed route remains in the sitemap. There is no new backend, dependency, logo or visitor-side provider request.

## Evidence and coverage

The machine-readable [review ledger](kaspa-exchange-review.json) records 102 candidate providers, 60 included entries and 42 held candidates with reasons. [The catalog](kaspa-directory.json) remains the source for visible entries and their primary-source links. Review dates describe editorial work, not continuous monitoring or transaction acceptance. The UTC checkpoint is in the ledger; its calendar review date uses Detroit time.

Discovery used [Kaspa's acquisition guide](https://kaspa.org/hodl), [Kaspa Hub's exchange directory](https://kaspahub.org/exchanges/), [CoinGecko's KAS markets](https://www.coingecko.com/en/coins/kaspa#markets) and a Coinranking name cross-check. The fetched Kaspa Hub catalog contained 95 names; CoinGecko's first API page returned 47 market rows, including repeated providers and stale/anomaly flags. Those counts are discovery snapshots, not a count of usable exchanges. No vendor descriptions, affiliate links, ratings or promotional promises were copied.

Inclusion requires provider-owned KAS-specific market, purchase, supported-asset or spot-listing evidence. Public spot APIs additionally confirmed the matching market for HTX, Pionex, BTSE, NonKYC.io, WazirX and CoinDCX. Their responses were read without authentication or order creation. Other included services have their own market page, supported-asset list or indexed provider guidance; the ledger identifies direct-fetch limitations separately. Historical listing notices are cross-checked against current market discovery or current provider material, rather than treated as proof of a present executable quote.

Ordinary GET results include useful HTML, JavaScript shells, 403/204 responses, bot checks and an HTTP-200 “Site Unavailable” response. HTTP 200 alone never establishes a functioning exchange. Indexed primary pages supply separate evidence where recorded. A blocked fetch is not a claim that a service has closed. No protection was bypassed and no signed-in account, purchase, quote acceptance or withdrawal was tested. This work does not certify solvency, liquidity, security, user eligibility or a provider's current execution/transfer state.

## Purchase and transfer distinctions

Spot markets are separate from brokers and swap aggregators. Perpetuals/futures do not establish a native-KAS purchase route. Wrapped KAS, KRC-20 assets and other-network tokens are different assets. Category notes ask visitors to check native Kaspa support, country restrictions, verification, fees, minimums and transfer availability with the provider before funding. There is no universal regional-eligibility, withdrawal, fee or “no KYC” promise.

Known conflicting restrictions are surfaced or held:

| Provider | Review disposition |
| --- | --- |
| Hotcoin | Spot listed; card calls out KAS deposits/withdrawals marked offline in its reviewed status page. |
| Swyftx | Purchase page listed; card calls out suspended KAS transfers in its reviewed fee table. |
| Coinstash | Purchase page listed; card calls out unavailable KAS deposits on the reviewed page. |
| Young Platform | Held: current asset page says KAS is sell-only, despite generic buying instructions below. |
| DigiFinex | Held: provider notice suspends KAS deposit, withdrawal and trading; no resumption established. |
| Guardarian | Held: reviewed KAS quote form explicitly says buying/selling is unavailable. |
| Tapbit | Held: current purchase guide says KAS is unavailable, despite an older listing notice. |
| NovaDAX | Held: Kaspa article remains, but the site links a discontinuation notice; purchase access not established. |
| Poloniex / Giottus | Held: sampled market rows were stale/anomalous and current primary availability was not established. |
| BitMart | Held: current retrieved asset page shows a perpetual; an old spot announcement alone is insufficient. |
| Binance / Coinbase | Held: futures/reference-price pages do not establish native KAS spot purchasing. |
| Quickex | Held: indexed KAS routes conflict with a later 404 retrieval and an ordinary-GET bot check; receiving route unconfirmed. |

The remaining held queue preserves discovery names for later review. It does not assert that those providers never support KAS. Broader-directory and market links remain visible so visitors can check changes beyond this snapshot. This is broad sourced coverage, not an exhaustive worldwide claim or endorsement.

## Maintenance and acceptance

Update the catalog and ledger together when adding/removing a purchase route. Prefer a provider's exact KAS spot/buy page, strip referral parameters, identify the asset/network and inspect contradictory “unavailable” text. Keep earlier resources and KRC-20 evidence intact. Run `npm run directory:write`, `npm run site:write` and continuity generation/checks. The existing directory suite checks native HTML/schema parity, safe unique links, category/date validity, filtering, empty results and reset/shortcut behavior. External provider checks stay editorial; CI and visitors do not fetch them.

Local validation and exact-head CI/preview evidence are recorded in the PR. Source/HTTP delivery is distinct from rendered desktop/mobile and physical-phone acceptance. No rewards, economic settings, private question bank, Mainnet/CCE, settlement, ownership or private-ranked cutover gate changes are included.

Local checks pass: five directory behavior/parity tests, directory generation, metadata/site validation, continuity, repository presentation and 311 security assertions. A one-off comparison against the base commit confirms every prior entry record and prior-category relative order is unchanged; all 60 additions match the review ledger and each group is alphabetical. Whitespace checks pass. No browser/device rendering or live transaction acceptance is claimed. Exact-head CI and preview delivery remain separate until recorded in the PR.

## Released source and HTTP checkpoint

Founder-approved [#239](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/239) merged as `898eaa366cb100bca55dea7b00fffda3ffee6e84`, matching checked tree `896a39074c6d560d8dc8ddcabad909e8e7f4e27c`. Exact-head Security verification 42141825207 succeeded and both preview statuses passed. Production `dpl_Hg4jfYLqSeq7uNqHTNhUdqQ86bJT` is READY on that merge with both canonical domains assigned. Public directory HTML, CSS and JS returned HTTP 200 and matched checked source exactly: 164 cards/17 categories, including the 60 purchase/service additions. This records deployed source/HTTP acceptance. Browser/device rendering, actual provider transactions, eligibility and future worldwide coverage remain separate.
