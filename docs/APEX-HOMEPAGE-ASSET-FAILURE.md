# Apex homepage asset failure

Task UX-009. Observed November 2, 2026, America/Detroit. Base main: 0302dfe01fc6447a74972978649b2b44c98cf5c6.

## Evidence

The founder's phone screenshots show an unstyled homepage and broken images at geekprotocol.xyz opened from the Vercel dashboard. A clean cloud browser reproduced that result at the apex URL, while the canonical www URL previously rendered with the expected dark styling.

Direct no-redirect HTTP checks:

- `https://geekprotocol.xyz/`: 200 text/html, not the expected canonical redirect.
- `https://geekprotocol.xyz/assets/styles.css`: 308 to the www asset.
- `https://geekprotocol.xyz/assets/geek-protocol-logo.png`: 308 to the www asset.
- `https://www.geekprotocol.xyz/assets/styles.css`: 200 text/css, `Cross-Origin-Resource-Policy: same-origin`.
- The apex document has `style-src 'self'` and `img-src 'self' data:`. Browser DOM shows all six linked stylesheets with no loaded sheet; visible images have zero natural width.

This combination explains why the nonredirected apex HTML loses assets redirected to a different origin. The provider's existing cached root response had a nonzero Age; the precise reason it bypasses the existing wildcard redirect is not established.

The Vercel project is serving READY production deployment dpl_HKmifuKeKvrhvLwqCziPR4ACGBcM from the base main commit. Both custom domains are verified and assigned. Project-domain settings report no domain-level redirect. The source already has a host-scoped wildcard apex redirect, but the live root is demonstrably not following it.

## Scoped candidate

Add an explicit `/` redirect conditioned on the apex host before the existing wildcard rule. Destination is the already established canonical `https://www.geekprotocol.xyz/`, with a permanent redirect. Preserve security headers, authentication, API handlers, assets and other redirect rules. No monetary or deployment-protection authority changes.

## Acceptance after an approved release

Verify the exact preview configuration, deploy the approved scoped change, then confirm the apex root returns 308 and lands on www with loaded CSS and images. Verify page paths and query strings still follow the existing wildcard correctly. Check the actual founder phone path from Vercel. If the old root response persists, investigate provider cache or a project-level domain redirect; do not claim this candidate is a proven production fix.

No live configuration, repository push, merge or deployment was performed during this diagnosis. Current www is a working interim entry point.

## Release verification

Founder authorized push and merge. PR #227 first run exposed the older regression assertion that only one apex rule exists; update it to verify the explicit root followed by the unchanged wildcard, with no www loop. Full local verify then passed: 725 HQ tests and nine signer checks, zero failures/skips, and all supporting checks. Final remote CI and production verification follow against the updated head.

## Homepage release and directory follow-up (UX-010)

PR #227 merged as ea73348ec325ce6b26f30011e023793a9ae77121; production dpl_Fko7NmAfx5t7uz4CWjSXnVFsNrAr is READY on that commit. Apex `/` now returns 308 to www and a fresh cloud browser visibly renders the styled destination with images. Founder replies “Perfect thx.” This confirms the homepage release disposition; directory routes are a separate finding.

Follow-up no-redirect probes show `/play/` and `/study/` return 200 at the apex; `/play` and `/study` redirect to their apex slash versions. `/play/assets/game.css` redirects to www. Learn's actual product target is `/study/`; `/learn/` returns 404 on both origins and is not evidence of a broken Learn navigation link.

Vercel's official `@vercel/routing-utils` 6.6.1 (`sourceToRegex`, `superstatic.js`) compiles sources with `strict: true`. The existing `/:path*` matches slashless paths but excludes a trailing slash and `/`. This explains the reproduced mismatch rather than assuming a stale cache. The root rule from #227 handles `/`. A separate `/:path*/` rule before the unchanged slashless fallback handles directory paths while retaining the trailing slash in its www destination. Official source: https://github.com/vercel/vercel/tree/main/packages/routing-utils ; configuration reference: https://vercel.com/docs/project-configuration/vercel-json#redirects .

No dependency change is needed in HQ: the pinned compiler is used only for isolated validation. Do not weaken security headers or add middleware for this path-pattern correction. Validate compiled route coverage, preservation of queries, no www loop, exact-head CI and preview. Actual apex routing must be checked after a separately approved production release.

Candidate validation: full `npm run verify` with native Redis 7.4.2 and required Redis modes passes (725 HQ tests plus nine signer checks, zero failures/skips), including 311 security assertions and all supporting checks. The official compiler returns no configuration error and produces the exact expected www target for eight paths: root, Play, Study, nested Play sources, Whitepaper, API session, CSS and slashless Play. The www host matches none of these apex rules. Before/after comparisons show headers, functions, rewrites and all preexisting redirects are unchanged. The compiler's compatibility instrumentation emits an existing nonfatal path-template log; conversion returns `error: null`. Query-string propagation is a hosted acceptance requirement, not established by these path checks.
