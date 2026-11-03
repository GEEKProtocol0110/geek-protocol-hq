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
