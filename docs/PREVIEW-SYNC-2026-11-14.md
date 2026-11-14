# Preview synchronization

OPS-005, November 14, 2026. The founder requested bringing current HQ releases into the older Preview branch and redeploying Preview with separate test data and payouts disabled. Released to Preview through PR #293; production main is unchanged.

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


## Released Preview evidence

The bound branch was fast-forwarded with an expected-head lease to d3da56dfff687dac587e35902c50096d1dcf6afc, preserving the merge ancestry. PR #293 is merged. Exact tree f9b7f92005dc094c0193d775d4a46b1d8688eb2a passed 1090 application plus 9 testnet and 6 mainnet signer checks (1105 total), zero failures/skips, with real Redis, all required content/security/generated checks, and 106 scrubbed synthetic rehearsal checks. Exact-head Security verification 43638498071, both Vercel checks and Android debug APK workflow 43638498146 passed.

Live Preview deployment dpl_4PUgGmrzYuGFPck1jFRLQEcaZZhe is READY on that exact commit and the existing bound branch, with preview.geekprotocol.xyz assigned. The browser shows enabled Sign in and Create Geek account, its ready message and the fixed Preview wallet URL. Existing environment records are unchanged; exact Preview passkey origin and false Preview reward/automatic flags remain. No account data or credential was reset, migrated or copied. Production remains 142f104 on dpl_3BdzDLjKrRXSeTZrtLs4YFeJiSQp. These checks establish updated Preview delivery and authentication startup, not actual user passkey completion or private-ranked-bank acceptance. Final HTTP and release results are retained in the [PR review record](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/293).


Bare unauthenticated HTTP reaches Vercel's login page, not the application. Deployment Protection remains enabled. Owner-authorized protected fetches returned exact source for sign-in HTML, session-access JS, sign-in JS and receiving-address JS (all HTTP 200); a credential-free application status request returned 401 and the worker GET returned 405/Allow POST/no-store. Browser startup and these HTTP checks do not establish that an unrelated device has passed the outer Vercel access gate or completed Geek authentication. The exact-head follow-up Security verification 43638679870 also passed.
