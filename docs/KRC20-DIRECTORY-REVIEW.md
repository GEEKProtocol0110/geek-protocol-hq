# KRC-20 projects and holder lookups

Task ECO-003. Revised November 5, 2026 (America/Detroit), based on deployed main `c7d780da18fb12e80b190c620476ee6b2409bf90` (#235). The founder asks for KRC-20 coverage and points out that people still hold tokens when a project website is uncertain or transfers are quiet. Confirmed token records must remain discoverable independently of project-link and activity status.

The candidate now contains 24 project listings and 20 additional holder references: 44 confirmed assets from 45 researched names, 104 total directory resources and 14 categories. All 60 earlier resource records and Hall credits are preserved. GHOADFI remains an unconfirmed asset identity after its record request returned 403; this is not evidence that it has no holders. The candidate is not merged or deployed at this revision.

## What each listing establishes

A project listing uses an inspected matching project destination with HTTP 200 and an accepted Mainnet KRC-20 operation in a dated 90-day snapshot window. This measures link content and token activity, not active maintainers, demand, liquidity or investment quality. A project-owned profile/hub can replace an unavailable website and is labeled by destination type; some profiles require sign-in. The page does not certify every outbound link in a community hub.

A holder reference needs a freshly matched public KRC-20 token record and deployment hash. It does not require recent transfers, a current project website or an active team. Its primary link is the token record, with activity lookup and status notes separate. An old operation is displayed as an earlier sample, without hiding or declaring the asset dead. The tests explicitly accept a holder reference with old activity.

KRC-20 is distinct from KCC-20 and EVM/L2 versions. Every confirmed listing links its Mainnet KRC-20 ticker namespace. NACHO migration and multi-version project descriptions are bounded to project guidance. No migration instruction, wallet connection, transaction or reward flow is implemented.

## Review scope and correction

Sources cover all 32 KasBay KRC-20 project listings plus 12 additional sourced names and the founder-requested KAEN lookup, 45 candidates total. The earlier 23-project selection incorrectly omitted ZEAL despite passing evidence; it is corrected as the 24th project listing. A fresh record pass matched 20 of the earlier 21 held names. The other 19 now have holder-reference cards. The earlier queue is retained in JSON as `previouslyHeld`, not as a blacklist or dead-token label. The single current unresolved record is GHOADFI.

This remains a source-bounded review rather than a complete registry of every KRC-20 project. Native links to KasBay's broader token directory and KasLens support further discovery. No claimed active-team label follows simply from trading-table rows, directory presence or accepted operations.

## Checked project destinations

Dates below use America/Detroit. Exact check/event timestamps, public hashes and source URLs are retained per entry in `docs/kaspa-directory.json`.

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
| ZEAL | [Zealous Swap (ZEAL)](https://zealousswap.com/) | 2026-11-04 | website |

## Additional holder references

KAEN, BTAI, DOGK, FOMOON, GRASS, HERPES, KASFAM, KEIRO, KPAW, KPTKAS, KYSOO, MODENG, NEIRO, PARROT, POPKAT, SHADOW, SNOWDN, SOMPS, WORI, YORAN. Each has a matching public record and deployment hash. Project and recent-activity uncertainty is shown separately rather than suppressing the token.

KAEN is additionally included as a holder reference after its matching public Kasplex token record was retrieved (deployment hash `429d772ebbb05eeacd27624cadea73e2a439c9df02746e82ddf5e7a921296a87`). The founder identifies it as Tony’s project; no personal attribution or guessed project website is added to the public card. A verified official project destination remains outstanding.

The original 21-name review queue was: BTAI, DOGK, FOMOON, GHOADFI, GRASS, HERPES, KASFAM, KEIRO, KPAW, KPTKAS, KYSOO, MODENG, NEIRO, PARROT, POPKAT, SHADOW, SNOWDN, SOMPS, WORI, YORAN, ZEAL. These names were not determined to have no holders. Original observations remain in `docs/krc20-directory-review.json`.

## Sources and destination review

Discovery: https://kasbay.org/api/services, https://kasbay.org/categories/krc_20_tokens, https://kaspa-lens.com/kaspa/tokens and individual primary project pages/profiles. Record/activity namespaces: `https://api.kasplex.org/v1/krc20/token/TICKER` and `https://api.kasplex.org/v1/krc20/oplist?tick=TICKER`. No authenticated API, holder lists, wallet addresses or private learning/account data are included.

HTTP 200 alone does not establish a matching project site. Old GHOAD and KASMO destinations led to sale pages; PPKAS served a generic hosting page; KPAW's earlier destination showed unrelated casino-review content. Matching public profiles/hubs replace unsafe or uncertain project destinations where inspected. Other uncertain websites are not promoted as official; their confirmed tokens still have holder lookups. These are dated observations, not permanent judgments about communities.

KANGO and Kasper use matching project hubs; Kasbot and Burtle use matching profiles. Burtle's separate site is under construction. PEPE's domain redirects to an inspected matching Arweave project page; its final URL and redirect review are recorded explicitly. The mixed KaspaScreener dataset was not imported as a KRC-20 registry because its discovered records were L2 addresses.

## Implementation and maintenance

All project links, holder lookups, status notes, dates and sources are native HTML. Search and categories cover both groups; the KRC-20 shortcut clears conflicting filters. The generator validates accepted activity for project listings and matching record evidence for holder references separately. Unreviewed cross-host redirects are rejected for project-link evidence. Structured data matches visible cards. There is no visitor-side third-party fetch, new dependency, backend or tracking.

The top update and new check/activity dates use America/Detroit. Earlier generic editorial date strings are preserved as recorded; the machine sitemap date remains the already recorded UTC date. Rechecks are manual. Do not silently refresh evidence dates, claim continuous availability, or infer token disappearance from a website failure. Holder record access does not depend on passing the project activity window.

## Validation and release

Seventeen targeted tests pass, zero failures/skips, covering record/HTML/schema parity, source/network/ticker identity, rejected/stale/future project activity, holder access with old activity, reviewed destinations and redirects, filtering/shortcuts, homepage/Hall regressions and continuity helpers. All 23 initially listed token records matched, and 20 of the earlier 21 names matched in the follow-up (including ZEAL). GHOADFI retrieval remained blocked. Supporting checks and exact-head CI/preview evidence are recorded in the PR description. Browser automation is unavailable; rendering and physical-device acceptance remain unverified. All economic, private-bank, ownership and Mainnet/CCE holds remain unchanged.
