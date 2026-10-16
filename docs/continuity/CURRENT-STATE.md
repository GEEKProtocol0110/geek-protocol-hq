# Current project state

Generated from the maintained JSON by `npm run continuity:write`. Update the source record, then regenerate. [Start Here](../../START-HERE.md).

Record date: 2026-10-16. **Public Alpha**. Canonical: [GEEKProtocol0110/geek-protocol-hq](https://github.com/GEEKProtocol0110/geek-protocol-hq).

## Last verified product release

[PR #124](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/124), commit `c972e27301bc461a526230806d5e781adac05e50`. PR #124 merged at 2026-10-16T05:37:11Z (1:37 AM Detroit), exact head 93d9ac6df3ceacac39b32fcf8e0e0d1790da1900 with passing GitHub verify and Vercel checks; merge-source Vercel success. Live canonical browser renders enabled passkey buttons and ready first-visit status (session/passkey-status API flow). Three targeted HTTP checks passed at 05:40 UTC: HTML 200, client 200, unauthenticated API 401. Full local checks: 471 tests, no failures/skips, real Redis 7.4.2, 311 security assertions; dependency audit zero vulnerabilities. Node monitor transport timed out; do not claim 21 probes passed for this release. Actual phone authenticator enrollment/returning login and independent auth review remain outstanding. A disposable guest API check also passed: session/status/begin-registration each 200, correct production RP ID, required discoverability/user verification. It created expiring options only, not an authenticator credential. Python HTTP following the existing method-preserving 308 redirect succeeded; terminal native-fetch failures are separate transport limits. Recorded tests: 471 passed, 0 failed, 0 skipped; 3 read-only probes passed. Later documentation candidates are separate from this baseline.

## Current checkout counts

8,185 active questions; 678 recorded internal source reviews; 7,322 further reviews needed across eight targets. 537 Study concepts and 4 Quest chapters. These are local code counts, not independent educational certification.

| Category | Active | Recorded reviews | Still needed |
| --- | --- | --- | --- |
| Kaspa | 580 | 580 | 420 |
| Video games | 602 | 0 | 1000 |
| Science fiction | 515 | 37 | 963 |
| Technology | 1497 | 15 | 985 |
| Movies | 1495 | 0 | 1000 |
| History | 1508 | 7 | 993 |
| Comics | 417 | 39 | 961 |
| Pop culture | 1571 | 0 | 1000 |

## Current work and pickup

**AUTH-002: needs-evidence.** Passkey login is merged/deployed in PR #124. Live ready UI and targeted HTTP checks verified; physical-phone enrollment and returning sign-in are next. Old wallet-linked recovery still requires existing proof. Artwork remains paused. Final follow-up on codex/passkey-release prevents revoked-cookie resurrection during concurrent refresh; 472 full tests and 311 security assertions pass. Consult that branch’s release PR for its exact final state.

Next task: **AUTH-002**. On the intended phone browser, open /sign-in/ and enroll a passkey for the current player or sign in with an existing saved passkey. Record exact device/browser/result. New guest enrollment does not recover another wallet-linked player. Reconcile draft #119 before any other features merge; keep artwork paused.

## Holds

CCE: **bank-and-economy-hold**. Contributor rate: unselected; 1 or 5 GEEK are proposals only. Settlement: disabled. Collection ownership: disabled. Counts cannot reopen these gates.

## Unresolved

- Original founding conversation and remaining phone files are still missing; the supplied 500-position roster and incomplete trait PDF are preserved unchanged in merged PR #116.
- Founder recalls 23 hours; an earlier assistant kit used approximately 29 hours. Neither is independently verified.
- No successor or second trusted account administrator is appointed in this record.
- No institutional contract, school partnership, legal-entity registration or accreditation is verified.
- An independent off-provider repository copy and production-provider restore have not been demonstrated.
- KCC20 integration/migration is unapproved: eight-decimal supply representation, exact artifact/wallet compatibility and existing-holder accounting require a concrete design.
- Founder paused further artwork uploads/generation October 15; four supplied sets/twenty original PNGs and the 2,500-slot tracker remain in separate unmerged PR #120.
