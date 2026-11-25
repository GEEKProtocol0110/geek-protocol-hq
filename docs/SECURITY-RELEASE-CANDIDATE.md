# Combined security release candidate — SEC-004

Prepared November 23, 2026. This is a draft candidate, not a main merge, independent audit or production release.

## Pinned scope

| Component | Source | Purpose |
| --- | --- | --- |
| Base main | 352d811d95b9964d900782244952a6fb5e059563 | Preserve live HQ, deletion, signer and directory work |
| #307 SEC-002 | 607d579665c70dab2b6bcad4a53946c70467ba19 | Exact wallet and Royale request origins |
| #308 SEC-003 | 165f8d1cfc1356787421f0fdad19c84b99a7c6ce | Atomic fixed-window limits and failure handling |
| #309 AUTH-006 | e31230db3459b42b77a93e1794f88a9535b3d349 | Fresh account proof and preserved passkeys on first wallet link |

Each branch is integrated through Git merge history. Combine maintained JSON by stable task ID, retain all project checkpoints and appended worklog history, and regenerate views. The only runtime conflict is identity imports: retain trustedRequestOrigin, consumePasskeyGrant/issuePasskeyGrant/passkeyAccountKey, decodePasskeyAccount and sessionStorageSnapshot. Runtime/API/client/test/script/worker bytes match the previously tested local compatibility commit 8008739 exactly. Unlike that snapshot, this candidate includes all three maintained task records, documents and security-control evidence.

## Review gates

- Run all verify components on this assembled source and record exact source/tree, local results and hosted CI in the PR. The earlier compatibility run is not a substitute.
- No submitted #309 review or delta-review result was available at preparation. The latest #225 report assigns it but does not provide the result. Local verification does not become independent review. The combined import resolution and fresh-proof/expiry/session/deletion/origin/rate boundaries need review at this assembled head.
- HQ has separate Preview and Production Redis configuration records and a Preview-only audit secret. Individual sensitive Redis URL values could not be retrieved for direct endpoint comparison; actual database isolation is not established by variable IDs alone. Obtain owner/provider isolation confirmation before real accounts or device acceptance; do not probe Production storage to infer it.
- Preview build success, HTTP delivery, actual wallet sign-in and a phone returning with its original passkey are separate results. No signing or credential action is performed on the founder's behalf.

## Preview preparation

Preserve the existing preview.geekprotocol.xyz alias and its fixed passkey setting. Select the combined branch's exact server-returned stable alias. Configure IDENTITY_ALLOWED_ORIGINS and PASSKEY_ORIGIN for Preview with gitBranch=codex/security-release-candidate, each using only that HTTPS origin; no wildcard or Production scope. Redeploy the exact checked source after configuration. Confirm configuration readback and deployment/alias routing. Do not interpret a wallet allowlist as permission to broaden WebAuthn RP context. The review-only Preview must not be presented as approved real-account/device testing while database isolation and independent review remain unconfirmed.

## Release and rollback

The original #307/#308/#309 PRs remain intact for comparison; this candidate does not close or merge them. After independent review and explicit founder release approval, merge only the accepted combined head, verify its Production deployment and protected sign-in behavior, then record disposition of the earlier PRs. Prior main 352d811 remains the rollback reference; rollback planning must account for already-updated passkey wallet versions rather than assuming code rollback reverses persisted identity changes. Keep economic flows disabled and stop new link attempts if the transition needs investigation; do not silently rewrite identity records.

#306 owner MFA/caller provisioning is excluded. Private-ranked bank #200, migration #216, payouts, CCE, collection ownership and the remaining adversarial findings retain their own gates. No gate is cleared by this preparation.

## Assembled local verification

The completed application suite passes 1,002 tests with required isolated Redis 7.2.5 and concurrency two, zero failures/skips. Both offline signer suites pass nine tests each: 1,020 application/signer checks total. All other verify components pass, including 340 security assertions, shared continuity, question/content, economy, site and whitepaper checks. Documentation finalization reruns continuity/site/whitespace checks. Exact published head/tree, hosted checks and branch-scoped Preview outcomes are recorded in the PR; no independent or physical-device acceptance is claimed here.

## Published review candidate and Preview evidence

[PR #324](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/324) publishes the combined candidate. The initial published source bf1f61efc57aed402a5d424c82af55bb7ded001c has the same checked tree as local cb19acb; all three pinned component heads are preserved as commit parents.

The server-returned branch alias is `geek-protocol-hq-git-codex-secur-aff3b8-geek-protocols-projects.vercel.app`. IDENTITY_ALLOWED_ORIGINS and PASSKEY_ORIGIN were set to its exact HTTPS origin, with target Preview and gitBranch codex/security-release-candidate only. Both values/scopes were read back. Redeployment dpl_Cnyf2SGtoLEDrRC9JN1ro3WZzqwn is READY on the initial combined source, is a Preview deployment, and serves exact checked sign-in HTML over HTTP 200. The existing preview.geekprotocol.xyz alias still points to its prior deployment; Production origins, secrets and settings were not changed.

This completes Preview routing/origin preparation, not permission to use real accounts. Database isolation and independent review remain unconfirmed. Final documentation-only source changes require their own exact-head hosted checks, recorded in #324. No authentication, wallet, registration or credential action was performed during HTTP delivery verification.
