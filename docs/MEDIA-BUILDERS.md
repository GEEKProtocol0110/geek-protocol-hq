# Media and builder resources

ECO-005. Founder approved preparation of a public Media & Builders page after the ecosystem listing kit. Prepared November 5, 2026 (America/Detroit) against main `898eaa366cb100bca55dea7b00fffda3ffee6e84` (#239). This record describes the source candidate. Merge, deployment and rendered/device acceptance remain separate.

## Public result

`/media/` gives directory maintainers and other builders a permanent public source for Geek Protocol descriptions, original logo/share PNG downloads, a small artwork ZIP, current project/document links and Geek Mini sharing resources. Home More/footer, About's official links and the Free Tools page expose the route. Canonical metadata, `CollectionPage`/download structured data and the sitemap include it.

The short description matches the prepared listing kit. The longer public description introduces the current learning product and companion tools. A separate status note preserves Public Alpha, application-level Proof of Learning, nonwithdrawable XP/credits and gated public Mainnet treasury rewards. No accreditation, intelligence ranking, independent audit, approved directory placement or formal partnership is implied. Founder identity, contact placeholders, submission drafts, directory tracking and private materials are not published on the page or in the ZIP.

## Original assets

The page references the existing `public/assets/geek-protocol-logo.png` (200 × 200) and `share-default-v1.png` (1200 × 630). Both were visually inspected during listing-kit preparation. They remain unchanged. `public/media/downloads/geek-protocol-brand-kit.zip` contains those exact image bytes, using the filenames `geek-protocol-logo.png` and `geek-protocol-share.png`, plus a short README with canonical sources and usage guidance. It includes promotional artwork; no product screenshot or higher-resolution remake is claimed. Archive entries use fixed timestamps for reproducible bytes and contain no HTML or executable files.

To update the kit, replace assets only within separately authorized brand scope, rebuild the ZIP from the published originals, verify the image bytes/dimensions and README contents, and update the page's visible dimensions and structured data together. Do not put the private outreach kit or submission tracker into this public download.

## Copy and sharing behavior

Descriptions and two embed examples are native readonly textareas with explicit labels, available without JavaScript. Copy buttons start hidden, reveal only for existing nonempty fields, and use the Clipboard API only after the visitor clicks. A successful clipboard write reports success locally beside its control. Missing or denied clipboard access focuses/selects the source field and asks the visitor to use the device's Copy command. Overlapping clicks stay locked until the write resolves. No clipboard reads, third-party fetch, new analytics event or account request is added.

The existing Mini homepage was fetched as a public source check: `https://geek-mini.vercel.app/` includes `id="share"`, Daily/Speed sharing controls and a `/embed?mode=daily` preview at 420 × 320. Its embed route returned HTTP 200 without an X-Frame-Options or frame-ancestors restriction in the inspected headers. The Media page links `https://geek-mini.vercel.app/#share`, offers Daily/Speed iframe examples using the existing mode parameter and opens previews only when a visitor chooses the link. The examples include responsive inline sizing, which the builder's host must permit. This checks route/source delivery, not a live cross-site browser integration or every host's iframe policy.

HQ loads no Mini iframe on this page and does not expand its existing `frame-src` or other CSP policy. The literal embed markup is escaped inside textareas. Mini's existing game, proxy, public board, privacy and practice-only scoring behavior remain unchanged.

## Validation and release boundary

Two shipped-client tests cover an asynchronous successful copy/overlap lock and missing/denied clipboard fallback, including exact text, truthful feedback, selected/focused fallback and restored controls. Catalog/site metadata checks, internal links, sitemap, relevant Home/Tools/directory regression checks, continuity, security and whitespace checks are run before review. One-off source checks compare archived images byte-for-byte, confirm all copy fields are readonly/labelled and all four source values remain available without JavaScript, and preserve the 164-resource catalog plus existing security/backend files.

Exact candidate head/tree, CI and hosted-preview HTTP evidence will be recorded in the PR description. Browser/physical-device rendering and third-party builder acceptance are not claimed. No directory request, email, Discord post, external PR, payment, reward, account or environment change is part of ECO-005. Mainnet, CCE, settlement, ownership and private-ranked-bank holds remain unchanged. BANK-009 remains the separate content priority after this bounded page work.

Local validation passes: 12 targeted tests (two clipboard, five directory and five Home checks), zero failures/skips; metadata/site validation (46 HTML records, 32 indexed routes), continuity, directory parity, whitepaper parity, repository presentation, 311 security assertions and whitespace/syntax checks. One-off source inspection confirms four labelled readonly copy sources, no live iframe, exact published PNG bytes in the three-file ZIP and unchanged directory/CSP files. Exact-head CI/preview and actual rendered/device results remain separate.
