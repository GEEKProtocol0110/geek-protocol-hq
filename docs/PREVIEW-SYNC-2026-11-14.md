# Preview synchronization

OPS-005, November 14, 2026. The founder requested bringing current HQ releases into the older Preview branch and redeploying Preview with separate test data and payouts disabled. This records a candidate until the PR review record contains the actual release.

## Inputs and boundaries

The Vercel project-domain record binds preview.geekprotocol.xyz to security/private-ranked-bank. Its prior READY deployment dpl_GWMoFsZcRzfQ7eBLR5fkVm6TcYzF uses 55c610153e0bb72d6dc320891e607d2d52a37ec7. Main is 142f104419ea16dab6b1762b77ffd7cae2ed6fdb. The candidate preserves the reviewed held assembly 921c0c863483f29dac76cf4b2e962cc0a82fe441, which descends from the existing Preview branch, and integrates current main. This does not merge the private-bank draft into main.

Read-only provider metadata confirms distinct Production and Preview database/audit variable records. Preview retains its existing database credentials and PASSKEY_ORIGIN=https://preview.geekprotocol.xyz; no secret is copied, decrypted, replaced or published. Preview TESTNET_REWARDS_ENABLED and TESTNET_AUTO_ENABLED are false. No MAINNET payout/signer settings are provisioned. Production variables, canonical domains and data stay unchanged. Existing passkey records and account recovery remain intact; Preview and production authentication/data are separate.

## Integration decisions

Preserve the private-bank loader, immutable pinning, deferred feedback, monthly seasons and pre-start guard. Retain namespaced ranked run keys, the deployed Preview ranked-write refusal, the 22-key atomic grade/payout transaction and both player/network-address start limits. Do not remove those guards to make a test game payable or relabel Preview as production.

Preview mobile wallet copying and Android fallback now retain the allowlisted Preview origin; they previously copied the production URL. Arbitrary, lookalike and non-HTTPS origins cannot become a wallet destination, and secret/query input is not forwarded.

Combine main's My HQ/profile navigation and receiving-wallet shortcut with the draft's 24-hour display-hint expiry, authoritative status events, throttled confirmation and separate sign-out control. A hint is never backend authority. Unknown status is neutral; explicit guest/401 enables sign-in guidance. In-flight stale replies cannot replace a later authentication event.

Retain v2 payout proof and all journal/replay controls. The integrated private loader uses sha256:<64 hex> and git:<40 hex> immutable version identifiers. Accept those exact formats alongside existing bare 64-hex v2 proof fixtures; reject public, malformed and arbitrary identifiers. The MAC binds the exact identifier and season. This compatibility correction does not certify a private artifact, editorial review or payment eligibility.

The published v1.0 PDF matches main byte-for-byte (13 pages); extracted text passes the leak rules. Like the published brand kit, only that exact PDF path and SHA-256 is recognized by a code-reviewed compatibility check. Tests reject changed, appended or substituted bytes and other paths. Other opaque served files remain forbidden.

Current main's published whitepaper/PDF, four-chapter litepaper, wallet switching and other public releases remain. Full private-bank CLI boundary checks and the isolated synthetic rehearsal are added to CI without provider credentials. Existing dependency audits and pinned read-only workflow actions remain.

## Acceptance limits

Verify full repository checks, immutable version proof negatives/positives and the scrubbed local private-bank rehearsal before moving the bound branch. After deployment, verify the exact commit/READY state, Preview alias, public assets, authentication startup and closed payment/write boundaries. Public/bare HTTP delivery does not establish a user's actual passkey, KasWare signing, tablet compatibility or real private-bank readiness. Record the deployment and tests in the PR review record; no mainnet enable or production cutover is authorized.
