# Checked KRC-20 project directory

Task ECO-003. Prepared November 4, 2026 (America/Detroit) against deployed main `c7d780da18fb12e80b190c620476ee6b2409bf90` (#235). The founder asks to add KRC-20 projects that are still active with live links. This candidate adds 23 checked projects to the directory, taking it from 60 to 83 resources and 12 to 13 categories. It is not merged or deployed at preparation.

## Scope and meaning of activity

Review all 32 project listings in KasBay's public KRC-20 token category/API, then 12 additional sourced projects found through primary project pages, KasLens and focused searches: 44 distinct candidates. Include every researched candidate that passes both checks below. The 21 unresolved candidates remain in `docs/krc20-directory-review.json`; they are not declared permanently inactive. This is a bounded source review, not a complete registry of every KRC-20 project. The category includes native links to KasBay's larger token directory and KasLens for further discovery.

A project destination must return HTTP 200 and expose matching project-specific content. A parked sale page, unrelated repurposed site, generic hosting placeholder or unavailable page does not qualify merely because its HTTP status is 200. Project-owned public profiles and community hubs can be used when the old website is unavailable, with the destination type shown on the card. Such profiles can require sign-in, and their outgoing links have not all been certified. Describe current functionality only to the extent the project supports it; no endorsement, audit or investment ranking is implied.

The public Kasplex Mainnet KRC-20 operation endpoint must expose a matching ticker and an accepted transaction/operation within the preceding 90 days at the recorded check time. Store the accepted operation, timestamp, public transaction hash and source URL; link each ticker's separate KRC-20 record. This is evidence of token activity, which may include automated transfers or listings. It does not prove active maintainers, development, genuine trading demand, liquidity or service quality. No holder lists, wallet addresses or private learning/account data enter the catalog or review report.

KRC-20 is distinct from covenant/KCC-20 and EVM/L2 versions. NACHO's current site publishes migration guidance; PEPE, KASMO and other multi-version projects are described without conflating token identities. The source-linked namespace/ticker identifies the KRC-20 record, not any L2 contract with the same symbol. No migration instruction or transaction is implemented here.

## Included project destinations

The link and activity dates below use America/Detroit. Complete timestamps, source URLs and public event hashes are maintained per entry in `docs/kaspa-directory.json`.

| Ticker | Project destination | Accepted operation date | Destination type |
| --- | --- | --- | --- |
| BAKA | [Baka the Kappa (BAKA)](https://bakakappa.com/) | 2026-11-01 | website |
| BURTLE | [Burtle (BURTLE)](https://x.com/burtle_on_kaspa) | 2026-11-04 | social |
| FAST | [FAST (FAST)](https://gofast.money/) | 2026-11-03 | website |
| GEEK | [Geek Protocol (GEEK)](https://www.geekprotocol.xyz/) | 2026-11-04 | website |
| GHOAD | [Ghoad (GHOAD)](https://x.com/GhoadCoin) | 2026-11-03 | social |
| KANGO | [Kango (KANGO)](https://linktr.ee/kango_on_kas) | 2026-11-04 | hub |
| KAPA | [KasPaw (KAPA)](https://kaspaw.com/) | 2026-10-05 | website |
| KAPSA | [Kapsa (KAPSA)](https://x.com/kapsacoin) | 2026-11-03 | social |
| KASBOT | [Kasbot (KASBOT)](https://x.com/kasbotcoin) | 2026-11-03 | social |
| KASMO | [Kasmo (KASMO)](https://linktr.ee/kasmonauts) | 2026-10-26 | hub |
| KASPER | [Kasper (KASPER)](https://linktr.ee/kaspercoin) | 2026-11-04 | hub |
| KASPY | [Kaspy (KASPY)](https://kaspy.io) | 2026-11-04 | website |
| KEKE | [Keke (KEKE)](https://www.kekecoin.org/) | 2026-11-04 | website |
| KONAN | [Konan of Kaspa (KONAN)](https://konanofkaspa.io/) | 2026-11-04 | website |
| KREX | [Kasparex (KREX)](https://www.kasparex.com/) | 2026-11-04 | website |
| LULZ | [LULZ (LULZ)](https://lulztoken.fyi/) | 2026-09-11 | website |
| NACHO | [Nacho the Kat (NACHO)](https://nachothekat.xyz/) | 2026-11-04 | website |
| PEPE | [Pepe on Kaspa (PEPE)](https://pepekrc20.com) | 2026-11-03 | website |
| PLUTO | [Pluto (PLUTO)](https://x.com/Plutokaspa) | 2026-11-04 | social |
| PPKAS | [PPKAS (PPKAS)](https://x.com/PPKAS_space) | 2026-11-04 | social |
| SHIT | [Paska (SHIT)](https://paskacoin.org) | 2026-10-26 | website |
| SZAR | [SZAR (SZAR)](https://szar.ourosociety.com/) | 2026-11-03 | website |
| WOLFY | [Wolfy’s (WOLFY)](https://linktr.ee/wolfysbar) | 2026-11-04 | hub |

## Source review and exclusions

- Discovery: https://kasbay.org/api/services and https://kasbay.org/categories/krc_20_tokens, plus https://kaspa-lens.com/kaspa/tokens and individual project pages/profiles. Directory presence and trading-table rows are discovery leads, not active-team evidence. Descriptions are original, short and bounded to primary project material.
- Activity and identity: `https://api.kasplex.org/v1/krc20/oplist?tick=TICKER` and `https://api.kasplex.org/v1/krc20/token/TICKER`. No secret or authenticated API is used.
- The old GHOAD domain redirects toward a domain-sale page; its matching public X profile is used instead. PPKAS's old root serves FASTPANEL rather than the project, so its public profile replaces that destination. KASMO's earlier domain serves a sale page; the current project Linktree is used. KPAW's earlier domain is unrelated casino-review content, and some other old destinations are parked, unavailable or unconfirmed. Those candidates stay in the review queue. These are dated observations, not permanent judgments about the communities.
- KANGO and Kasper use project link hubs; Kasbot and Burtle use matching public profiles. Burtle's standalone site says coming soon. The catalog does not claim that an unavailable website proves a token is inactive.
- PEPE's public domain redirects to an Arweave-hosted page with matching Pepe/Kaspa/KRC-20 project content. Its final URL and manually inspected redirect are explicitly recorded; future cross-host redirects require the same explicit review.
- KaspaScreener's discovered dataset is L2-address data and was not imported as a KRC-20 project registry. KCC-20 and same-symbol assets seen elsewhere were not substituted for KRC-20 records.

## Implementation and maintenance

Every project, ticker, destination, link-check date, accepted-activity date, KRC-20 record and activity source is in initial HTML. Existing search/category filters include the new category. The KRC-20 jump link clears incompatible filters before navigating. No client-side third-party fetch, wallet connection, new tracking, API or dependency is introduced. The generator validates the evidence offline, and schema entries match visible cards. Existing Hall and the 60 prior resources remain intact.

The top update and new activity/check dates render in America/Detroit. Historical generic editorial date strings are preserved as originally recorded. The sitemap's directory lastmod is already November 5 in the earlier UTC-based machine record; this edit occurs during that same UTC date. No new user-facing host-time assumption is introduced.

Rechecking is manual: inspect the project destination and redirects, fetch a fresh accepted KRC-20 operation and token record, update the evidence and review report, then run `npm run directory:write`. Re-run site generation if metadata changed. Do not silently refresh timestamps, use HTTP 200 as identity proof, or turn this into a continuous-monitoring claim. A previously checked entry can become stale; its displayed dates remain visible until reviewed again. Source snapshots are not live health guarantees.

## Validation and release record

Initial targeted suite passes 16/16 with zero failures/skips. It covers generated HTML/schema parity, source/network/ticker checks, accepted/stale/future activity, unreviewed redirects, destination identity evidence, search/category reset and shortcut behavior, homepage discovery, existing Hall music and continuity helpers. No public game, token, wallet or payment operation is performed. All 23 public token-record lookups returned matching tickers. Metadata/site, catalog parity, continuity, repository presentation, whitepaper parity and security checks pass (311 security assertions); changed JavaScript syntax and whitespace checks pass. Exact-head CI and protected-preview delivery are recorded in the PR description when available. Browser automation is unavailable in this session; desktop/mobile rendering and physical-device acceptance are not claimed. The directory and all policy/economic/private-bank holds remain otherwise unchanged.
