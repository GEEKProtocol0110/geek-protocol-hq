# Project facts and search discovery

Task SEO-002. Prepared November 3, 2026 against main `12a02285491e07c93bc2398ff0f0e61975b814d5` (#230). Founder approved preparing the recommended project-facts/FAQ and discovery-cleanup batch. Merge remains a separate decision under #225.

## Public change

Add `/about/` as an indexable, canonical, script-independent project facts and FAQ page. Ten visible questions cover the product, Proof of Learning, free access, GEEK, credits/rewards, independence, audits, contributors, companions and current sources. Reuse the homepage Organization identity and official profiles in AboutPage structured data. No FAQ rich-result eligibility or search placement is claimed. Every financial/security assertion is bounded by the published whitepaper and security statement; no new audit, endorsement, payment or learning-outcome claim is introduced.

Link it beside Whitepaper, Litepaper and Contributors below the homepage hero, in the visible footer and from the HQ README. Mobile document buttons use a two-column grid and retain the existing one-column narrow-screen fallback. All answers and links are in initial HTML. Register the page in maintained metadata and regenerate the sitemap; update homepage lastmod only for this substantive change. No new analytics, API, dependency, bot exception, deployment configuration or security-header change.

## Read-only audit

| Check | Observed result | Limit |
| --- | --- | --- |
| Canonical homepage, robots, sitemap, whitepaper | All return HTTP 200 without a redirect on November 3; HTML has no noindex in its head and no X-Robots-Tag response | Ordinary HTTP requests, not verified crawler-origin requests or proof of index inclusion |
| Live robots | Wildcard permits public paths; `/api/` and `/ops/` remain disallowed; canonical sitemap advertised | Does not prove CDN crawler access |
| Hosting protection | HQ project reports SSO protection `all_except_custom_domains`, password protection disabled | Keep protected Preview/Vercel deployment hosts protected; canonical custom domain is the public discovery destination |
| Firewall configuration inspection | Correctly scoped active configuration endpoint returns 404 `Seawall Config not found` | Cannot conclude no bot filtering or verify crawler IP access; no settings changed |
| Alpha repository | Live README blob `e6d059d710b35e918f9cf5ef1b9b5d964ad083e8` already labels itself legacy, links current HQ, and describes old schedules/financial claims as historical | Search result still quotes older “Coming Q1 2026” wording; do not rewrite an already corrected source or treat a stale snippet as current code |
| Earlier litepaper | `https://geek-litepaper-nu.vercel.app/` returns 200, no X-Robots-Tag, no noindex in fetched head | Matching Vercel project-name search returned no project in the connected team. Source ownership/routing needs identification before a redirect or canonical change |
| Search Console / Bing ownership | Not verified in this session | Missing HTML verification tags would not establish lack of ownership; DNS verification is possible. Do not claim submission, indexed status or account access |

## Operator follow-through

1. In Google Search Console, select the verified canonical domain property or complete owner-controlled DNS verification. Inspect `/`, `/about/`, `/whitepaper/`, `/litepaper/` and `/thanks/`. Record selected canonicals, crawl/index status and any exclusion reason; request indexing for eligible updated pages. Submit `https://www.geekprotocol.xyz/sitemap.xml` if it is not already registered. Record actual submission/inspection evidence privately as appropriate, not merely a successful sitemap HTTP response.
2. In Bing Webmaster Tools, verify/import the property, submit the same sitemap and inspect these URLs. Check search and AI Performance reports when available. Do not create paid services, credentials or fabricated verification records.
3. Have the owner of the earlier standalone litepaper identify its source. Preferred reviewed change: a permanent redirect to `https://www.geekprotocol.xyz/litepaper/` after preserving the historical source. If it must remain an accessible historical edition, label it prominently and review the canonical/indexing policy against its distinct purpose. Do not repoint unrelated Vercel projects or delete original documents.
4. Inspect provider request logs or verified-bot reporting to distinguish successful crawls from blocks. For a confirmed false positive, use the provider's verified crawler controls and published IP verification guidance; do not broadly bypass the firewall by user-agent string.
5. Keep official directory/profile descriptions aligned with current HQ. External submissions and announcements require their own authorized destinations; none were sent here. Do not purchase fabricated mentions or reviews.
6. Establish a dated baseline for “Geek Protocol”, “What is Geek Protocol?”, “Geek Protocol Kaspa learning”, and “Does Geek Protocol pay GEEK rewards?”. Record actual engine, date, web-search mode, cited URL and factual accuracy. Distinguish model memory from live retrieval. Visibility and citations are outcomes to measure, not guarantees.

## Primary guidance consulted

- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features) — normal indexing/snippet eligibility and search fundamentals apply; no separate AI placement requirement.
- [Google: generative AI optimization guide](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide) — no special AI markup or llms.txt needed for Google Search. This batch does not add a speculative AI file.
- [OpenAI: crawlers](https://developers.openai.com/api/docs/bots) — OAI-SearchBot search access and GPTBot training controls are independent. Existing wildcard public access is preserved; training permission is not a prerequisite for search eligibility.
- [Bing: Webmaster Guidelines](https://www.bing.com/webmasters/help/bing-webmaster-guidelines-30fba23a) and [AI Performance](https://www.bing.com/webmasters/help/ai-performance-9f8e7d6c) — clear, indexable content and measurable citations; no guaranteed inclusion.

## Validation and release disposition

Local site generation/parity passes for 43 pages, 948 local links and 184 external links; whitepaper source parity, repository presentation, continuity validation, all 311 security assertions, five existing homepage onboarding tests and whitespace checks pass. A separate initial-HTML parser confirms ten visible FAQ answers, two homepage links outside disclosures, unique IDs, sitemap/index/canonical parity, matching Organization identity and no external script dependency. No backend, signer, question, workflow or hosting input changes; full backend/signer suites are left to existing candidate CI rather than repeated locally for this static content change. Browser layout, remote checks, merge, deployment, index inclusion, verified AI crawler requests and external profile corrections are separate evidence states. Mainnet settlement, payouts, private-bank cutover, CCE and ownership are outside this change.
