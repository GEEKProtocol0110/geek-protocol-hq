# Kaspa directory and Kas.fyi recognition

Task ECO-002. Candidate prepared November 5, 2026 against main `2d5a96c5b310816041054e5ff9829450fb4073d2` (#232). The founder requests a broad public Kaspa directory and explicitly asks for a Kas.fyi shout-out. Additional Hall links have not been supplied. This record describes the candidate; merge, deployment and device acceptance are separate facts.

## Public experience

`/kaspa/directory/` contains 60 entries in 12 categories: learning, wallets, explorers/data, developer tools, research, nodes/mining, apps/tokens, payments/merchants, news/community, broader directories, Geek resources and legacy contributions. The selection is a starting point, not an exhaustive or ranked inventory. Kaspa Hub and KasBay let visitors explore beyond this curated list. No paid placement, affiliate link or inferred supporter credit is introduced.

All descriptions, links, category sections, source links and editorial dates are initial HTML. Without JavaScript, category anchors remain usable. JavaScript progressively reveals search/category/reset controls and hides empty cards/sections. Word search is case/accent insensitive, combines with category selection and reports the visible count through an accessible status. It performs no third-party request. `CollectionPage`, `ItemList` and breadcrumb structured data reflect the same generated entries. This does not guarantee indexing or enhanced results.

Preserve the existing Kaspa 101 technical review date and beginner content. Add directory links to its hero/source desk, Home More/footer, and Hall roots. Home, Kaspa, Thanks and the new route receive substantive sitemap lastmod dates. The directory reuses the existing Kaspa share asset; no logo replacement is part of this change.

## Kas.fyi

The founder-requested static Hall card thanks Kas.fyi for its public explorer contribution. Its own farewell says the explorer has shut down and directs visitors to Kaspa Stream. Source evidence: https://kas.fyi/ and its indexed address/token pages, including https://kas.fyi/address/kaspa%3Appqslqhk9trf9py30cn4tv8dgqq687afu4f9fqep99a3z9qjlnu4kglzxkuxc. The directory marks Kas.fyi as legacy/service closed and separately lists Kaspa Stream. Neither page invents an HQ integration, endorsement, donation or personal relationship. All preexisting credits and application flows remain intact.

## Sources and availability

Maintained catalog: `docs/kaspa-directory.json`. Each entry includes a stable ID, category, original description, HTTPS destination, supporting primary source, editorial date and listed/legacy status. A listing is not a security audit or confirmation that every feature works. Dates describe editorial review, not continuous health monitoring.

Primary discovery sources checked include https://kaspa.org/build, https://kaspa.org/hodl, https://kaspa.org/lore, https://kaspahub.org/, https://kasbay.org/ and individual project sites/repositories. The directory acknowledges the existing broad directories and links them directly rather than copying their catalog descriptions. Kaspium's repository identifies https://kaspium.io/; Kaspa NG's repository identifies https://kaspa-ng.org/; KasWare's documentation supports its wallet description. IACR supplies the two research papers. No third-party “safe”, profitability or investment claims are repeated.

A bounded ordinary GET pass on November 5 returned HTTP 200 for 51 of 60 destinations. Wiki FAQ, Kaspa Explorer, API docs, testnet faucet both IACR landing pages and the three hardware-wallet vendor pages returned 403 through that transport; the latter pages and core-linked destinations have separate primary-site/search evidence. A 403 here is not proof that the public service is down. HTTP 200 also is not functional or security acceptance. The KasBay mining category was corrected from a guessed path to its actual native `/categories/pools` link before this pass. No external requests run in CI or on the visitor's behalf.

## Maintenance and checks

1. Edit the JSON catalog using the project's preferred public identity and HTTPS link. Verify the owner/source, purpose and status; use short original wording. Record an honest editorial date. Retired services belong in the legacy category, not active explorers.
2. Run `npm run directory:write`, then `npm run site:write` if metadata or routes changed. Keep sitemap lastmod aligned with substantive edits.
3. Run `npm run directory:check`, `node --test tests/kaspa-directory.test.js`, site/continuity checks and the relevant regression suite. `npm test` includes catalog/HTML/schema parity automatically. Tests reject unsafe/credentialed links, duplicate IDs/URLs, invalid category/date data and escaping failures. The shipped client is executed for combined search/category, empty state, Unicode/case normalization and keyboard-friendly reset behavior. Synthetic tests do not certify layout.
4. Review rendered desktop/narrow layouts, keyboard focus and JS-disabled usability when preview infrastructure is available. Record the actual browser/deployment tested. Physical-phone acceptance remains separate.
5. Resource suggestions open an ordinary GitHub issue draft; there is no new submission database or automatic publication. Inspect and review suggestions before adding them.

No backend, dependency, API, wallet, payment, account, provider security or bot-access configuration changes. Mainnet/CCE/settlement/ownership and private-ranked-bank gates remain unchanged.

## Validation record

Initial targeted checks: 10/10 tests for directory behavior/parity, homepage flow and Thanks music. Final targeted suite: 15/15 pass, zero failures/skips. Final local catalog, metadata/sitemap (44 HTML records, 30 indexed routes), continuity, whitepaper parity, repository presentation and security checks pass (311 security assertions); whitespace and changed-JavaScript syntax checks pass. Browser automation is unavailable in this session, so rendered desktop/narrow-screen and physical-phone acceptance are not claimed. Exact-head CI and protected-preview HTTP delivery will be recorded in the PR description. Not merged or deployed at candidate preparation.

## Released directory and Hall follow-up — November 5, 2026

Founder-approved #233 merged as `4d83352dcf2e1d42301261997d14161c2d881c89`, matching checked tree `81ff95c140312180242ab752316582b7ab9b6034`. CI 41961204573 passed 728 HQ tests and nine signer checks. Production `dpl_EvPcBFWmVfpM9dDAJHMVRVa5RQZ9` is READY on that source with both domains assigned. Seven canonical HTTP responses match the checked files exactly, including the 60-card directory, Hall and homepage links. Rendering/phone acceptance remains separate. Full evidence is retained in https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/233.

The founder then requested a dedicated Kaspa Stream thank-you card. Its directory entry and secondary link under Kas.fyi were already live; the separate Hall acknowledgment is this follow-up candidate. See `docs/HALL-OF-THANKS.md`. This adds no directory resource, backend flow or relationship claim.

## KRC-20 expansion — November 4, 2026 (Detroit)

ECO-002 shipped through founder-approved #235: c7d780da18fb12e80b190c620476ee6b2409bf90, checked tree 4383c90abf21cf34a5f2c9048ec4199285714c05; CI 41967956997 passed and production dpl_6Tg4xPAMg2cgRBMb8LiqTdrLZRsf is READY. Public Hall HTML matches source exactly with Kas.fyi last under SPECIAL THANK YOU and the dedicated Kaspa Stream card retained. Browser/phone acceptance remains separate.

ECO-003 prepares a dedicated KRC-20 section with 23 projects from 44 researched candidates: 83 total directory resources, 13 categories. The [review record](KRC20-DIRECTORY-REVIEW.md) defines the working-link, identity and 90-day accepted-activity checks, plus the 21-item unresolved queue. Activity is not ongoing-team verification. Project links, explicit KRC-20 records and dated sources are visible in native HTML. The top update and activity dates use America/Detroit; earlier generic editorial dates are preserved as recorded. No public runtime health monitor, investment ranking, migration flow, new reward or automatic external fetch is added.

### Holder-reference correction — November 5, 2026 (Detroit)

The founder points out that quiet tokens still have holders. ECO-003 therefore preserves confirmed token records independently of website and recent-operation checks: 24 project listings plus 19 holder lookups, 103 resources/14 categories overall. ZEAL was mistakenly held despite passing evidence and is corrected. Of the earlier 21 names, 20 have freshly matched KRC-20 records; GHOADFI identity remains unconfirmed after a blocked fetch. This is not a no-holders or dead-token classification. The review document and JSON retain the original queue and the corrected current result.

## Kaspa-first ordering — November 5, 2026 (Detroit)

The founder requests KRC-20 after the Kaspa links. Put the ten general Kaspa resource categories first, followed by KRC-20 projects and holder lookups, then Geek resources and legacy contributions. The beginner field-guide link also precedes the KRC-20 shortcut. Preserve all 104 entry records and their relative order within categories. Generate section, category navigation, filter-option and structured-data order from the same maintained category array. This source follow-up does not refresh link/activity evidence or change the holder-reference policy.

The preceding founder-approved #236 is merged as b38e27dedeec5ac6a014ff6647401d127749ea4e, with checked tree 3c73119f1bfce6d354b071f9468f03c9023a9835. CI 41974695614 succeeded. Production dpl_CRhPA23oi9PEs51aRjUU2P3GGnDw is READY on that merge with both canonical domains assigned; canonical HTML/CSS/JS returned HTTP 200 and matched source exactly. It shipped 104 resources, including 25 project listings and 19 holder lookups, with the supplied KAEN profile. Rendering/phone acceptance remains separate. This ordering follow-up awaits its own review and release.

## KAS purchase directory — November 5, 2026 (Detroit)

Ordering #237 subsequently merged as `478dfc16b6843eef93603b3905d63b7a31f2f1ef`, matching tree `0b0311ddff28150aa1a8a4ae7341d2f76c6054f3`. CI 42063638109 succeeded; production `dpl_6VGBV45EHRDo6EfcLr1xfx932mfo` is READY with exact canonical HTML confirming all 104 resources and Kaspa-first order. Rendering/phone acceptance remains separate.

ECO-004 now prepares 60 native-KAS provider listings: 37 spot exchanges, 14 brokers/on-ramps and nine swaps/aggregators. Place those three alphabetical groups after wallets, with all general Kaspa sections still preceding KRC-20. Preserve all 104 existing records: 164 resources/17 categories overall. The [exchange review](KASPA-EXCHANGE-REVIEW.md) and [dated ledger](kaspa-exchange-review.json) record primary sources, discovery scope, known transfer limitations and 42 held candidates. This expansion is a source candidate, not a merged/deployed or exhaustive worldwide availability claim.


## KaspaDollar — November 8, 2026

Founder requested https://kaspadollar.com/ be included. Added one Apps & token ecosystems resource named KaspaDollar · in development. The project home and /how-it-works describe a proposed KAS-backed dollar stablecoin on L1, with preliminary parameters. The label and description distinguish development/fundraising from a verified live or audited product. No final ticker, security endorsement, donation link, wallet action or investment claim is added. Source review date is editorial; no functionality or solvency test is claimed. Catalog now contains 165 resources in 17 categories. Exact tests and release evidence belong in the PR.


### Founder-approved expansion and games category

The founder approved Kaspalytics, Kasia, Kastle, KEF, Kii, Kaspero Labs and KAT, then requested K app, Stag Hunt, KaChat and games. Added all ten plus KasPlay, KaPlay and TX Missile Command, bringing the candidate to 178 resources / 18 categories including Games & arcade. K uses the web destination linked by its own repository; KaChat uses its Android listing with its publisher app listing as feature evidence. Stag Hunt is coordination/crowdfunding, not an arcade game. Its page currently displays a winner-selection bug notice and claims risk-free refunds; neither safety claims nor refund assurances are repeated. No donation, escrow, chat or wallet action was performed.

Official project/repository/store sources support the descriptions. Several pages are client-rendered: KAT and KEF had indexed primary-site evidence but no readable fetched body; TX Missile Command returned its loading shell and was not gameplay-tested. KasPlay score figures and chain/security claims are not independently verified. KaPlay chess features are publisher-described, not played. Existing directory disclaimers distinguish listings from endorsement/security/functionality acceptance.

Geek already has Practice, Daily, Gauntlet, Quest, Memory, Duel and Royale routes. A separate first-party Games hub is recommended as a follow-up proposal, with external games remaining clearly identified; no new game, paid mode or score-sharing integration is part of this directory change.


### Additional builder and learning resources — November 8, 2026

Founder approved KAS Watch, Kaspa Kinesis, KANet, ChainVsDag and the Kaspa-specific OpenSilver library. Primary home/repository pages support short original descriptions; catalog source URLs retain that evidence. Kinesis is explicitly a hackathon prototype; no fairness, NIST certification, quantum security or infrastructure guarantees are adopted. KANet architecture documentation was readable although its repository root fetch was blocked. ChainVsDag had indexed primary-site content but an empty fetched body; no live comparative performance is independently verified. KAS Watch showed connecting placeholders in the text fetch: its feed freshness and premium features were not tested. No third-party software was installed or run and no wallet or game action was performed. Candidate now has 183 resources / 18 categories.

Split the existing generic GitHub suggestion link into Submit a project and Report a broken link draft links, each with relevant fields and clear GitHub-account/manual-review expectations. Clicking only prepares a draft; nothing is automatically sent or published. Browser and phone acceptance remain separate.
