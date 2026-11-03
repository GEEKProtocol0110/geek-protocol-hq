# Homepage document discovery

Task DOC-002. Base main 755a6ce682de3f37d5efccc81395b73d4f046332.

The founder requests prominent Whitepaper, Litepaper and Contributors links from the homepage, including the footer shown in the supplied phone screenshot, for visitors and independent crawlers.

Add a compact native-link row below the hero, outside all closed disclosures, and repeat the three links in the visible footer navigation. Contributors opens `/thanks/`, the existing public Hall of Thanks. Its static dedications and builder credits remain readable without scripts. The separately loaded approved community-credit list is unchanged; no private applications, contributor claims or names are added.

The whitepaper currently declares `noindex,follow` and is absent from the sitemap. Set its maintained page record to indexable and regenerate metadata/sitemap. Retain the edition's existing publication-candidate label rather than implying an independent audit, certification or external grade. Fix the litepaper's obsolete v0.1 link label to v1.0. Whitepaper body, economics, game behavior and all security/settlement boundaries remain unchanged.

Checks must cover native links in both visible locations, public targets, robots metadata, canonical URL, sitemap membership, script-free content and responsive layout. A correctly crawlable page does not guarantee indexing or a result from Tony's independent grading service. No grader URL or crawl result has been supplied.

Reference guidance: https://developers.google.com/search/docs/crawling-indexing/links-crawlable and https://developers.google.com/search/docs/crawling-indexing/block-indexing .

Publication disposition: prepare the draft PR and exact-head preview, then obtain founder merge approval under the existing #225 workflow.

## Validation

Site metadata/link/sitemap generation and parity, whitepaper source parity, continuity, repository presentation, 311 security assertions and whitespace checks pass. A script-free HTML parser confirms all six native links (three near the hero and three in the footer) are outside closed disclosures; all three destinations are public, indexable, canonical and present in the sitemap. Whitepaper body and static builder credits are in the initial HTML. API/operator exclusions remain. No game JavaScript, API, server, security header or deployment configuration changed. The existing full 725-HQ-plus-nine-signer verification is the parent release evidence; full backend/signer suites are not rerun for this link/metadata/CSS-only change. Preview, exact-head CI and visual acceptance follow in the PR record.
