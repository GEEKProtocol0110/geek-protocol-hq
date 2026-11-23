# Exact-origin selection — SEC-002

November 17, 2026. Source candidate based on main `b7521c6db2087d0c40580afa443104f33f4cd212`. Implements item 6 of the SEC-001 review independently of held owner-access PR #306. No economic or production configuration change.

## Problem and implementation

Wallet proof context previously selected `X-Forwarded-Host` ahead of Host and accepted any host ending in `.vercel.app`. Royale compared Origin to the same request-selected forwarded host. A matching attacker Origin and substituted forwarded header could therefore pass the source checks; the broad preview exception also admitted unrelated tenants. This source review does not claim a live-account compromise.

`server/request-origin.js` now accepts only the canonical `https://www.geekprotocol.xyz` and `https://geekprotocol.xyz`, plus exact operator entries from `IDENTITY_ALLOWED_ORIGINS` and the legacy `IDENTITY_ORIGIN`. Every configured entry must be a canonical HTTPS origin without credentials, a non-root path, query, fragment or wildcard. One trailing slash in operator configuration is normalized; request Origin headers must be exact origins.

The request Host must select an allowed origin. A forwarded host is optional, must be a single string and must match Host; it cannot choose another authority. A supplied forwarded protocol must be exactly `https`. Multi-value/array headers, cross-site request metadata, invalid Origin forms and non-HTTPS context are rejected. No trust is inferred from `VERCEL_URL`, `VERCEL_BRANCH_URL` or a preview suffix.

Wallet challenges retain compatibility with clients that omit Origin: their Host still has to be explicitly allowed. A supplied Origin must exactly match that Host. Royale mutations require Origin; its public GET discovery path does not. Existing session, rate, room and proof authorization remain in place. A Host allowlist is not a substitute for correct TLS/proxy configuration or protection against a raw client forging its own headers.

Proof issuance and verification use the same validator. Existing challenge consumption and exact stored-origin comparison remain, so a proof issued on one allowed origin cannot be verified on another. The signature scheme, message, TTL, one-time consumption, account binding and wallet ownership checks are unchanged.

## Regression evidence

Eight new real-Redis tests exercise shipped session, identity and Royale handlers, actual KIP-5 signatures and passkey context:

- Substituted forwarded host with matching attacker Origin is rejected before creating a wallet challenge.
- Arbitrary Vercel tenants are rejected even when their names occur in deployment environment variables.
- Non-HTTPS, multi-value, array and malformed origin headers are rejected.
- Exact custom and Vercel preview entries work; a forwarded substitution still cannot replace the original Host.
- Legacy exact origin configuration remains usable; unsafe configured URLs fail closed.
- Cross-origin proof verification fails and consumes the challenge; a fresh same-origin signed proof succeeds.
- Royale mutation checks cannot be bypassed, approved previews work, and public discovery remains readable.
- Wallet allowlisting does not broaden the separate passkey relying-party configuration.

On the original implementation, five of the eight tests failed and three passed. A temporary negative control restoring `.vercel.app` wildcard acceptance made the arbitrary-tenant rejection test fail (201 instead of 400); the weakened code was restored immediately and is not committed. The initial focused wallet/Royale/passkey run passed 63 tests. The first complete verification passed 973 application tests plus nine testnet and six mainnet signer checks (988 total), zero failures/skips; final assembled-head verification also passed all 988 checks, zero failures/skips, with 328 security assertions and all supporting checks. These are internal checks, not actual-device or independent acceptance.

## Preview and production rollout

The existing `preview.geekprotocol.xyz` alias was verified through Vercel metadata as pointing to an HQ deployment. This is an existing destination, not authorization to enable every generated preview hostname. For a preview where wallet proofs or Royale writes are needed, configure `IDENTITY_ALLOWED_ORIGINS` with the exact approved HTTPS origin in that project's Preview environment, then redeploy. Add ephemeral review hosts only when deliberately selected; remove obsolete entries after review. No environment variable was created, decrypted or changed by this candidate.

Passkeys still use their existing production RP ID and separate `PASSKEY_ORIGIN` configuration on previews. The real WebAuthn registration/login regression suite must pass on the assembled head. Do not widen RP IDs or weaken account proof to make a new preview work. An allowlisted wallet origin alone does not authorize a passkey origin.

Before release: inspect exact-head CI and preview, reconcile continuity changes from other PRs, verify intended preview origins, obtain founder release authorization, and have the founder complete one real wallet sign-in on production after deployment. No live wallet was signed into by this session. No merge or production deployment is claimed here.

## Claude handoff reconciliation and remaining work

- #305 and #306 are open drafts on the reported heads; neither has merged. Their overlapping continuity JSON, generated backlog and work log need reconciliation when integrated. This candidate has its own SEC-002 record; regenerate continuity views from merged JSON rather than choosing one side's generated file. #200 is a separate held candidate, not rebased here.
- GitHub verify run `44012581468` passed on #306 head `fd08a3c`; no submitted reviews or inline review threads were returned at inspection. Every follow-up requires fresh exact-head checks.
- Production owner/MFA provisioning remains a blocker for #306: HQ metadata lists neither dedicated owner-token nor authenticator entry and reports zero hidden Production entries. No secret values were read. External Geek Bot bearer callers cannot be ruled out by repository search; operator confirmation is still required. No message was sent to another agent or service.
- #306's `NODE_ENV=production` fallback also applies when `VERCEL_ENV=preview`; a regression verifies that combination. Actual preview runtime NODE_ENV was not exposed by these metadata reads. Vercel documents VERCEL_ENV as its production/preview/development discriminator; do not infer the runtime's NODE_ENV merely from build success.
- Signed-in role reads count toward #306's shared 60-per-minute limit. A follow-up regression there verifies a 429/backoff without session revocation. Global `rateLimit` still uses a non-atomic INCR/EXPIRE pipeline; an atomic fixed-window/recovery follow-up remains open.
- Adversarial balance/payout races, comprehensive answer leakage/attempt reuse and full account/recovery assessment remain unfinished. Running existing tests does not close those independent reviews.
- Remote branch counts and deletion safety were not established here. Inventory ownership, open PR linkage, merged history and preservation needs before proposing labels or pruning; no branch was deleted.

Reference: [Vercel system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables). This source candidate changes no owner credentials, Mainnet payouts, CCE admission, collection ownership or paused remote tutor settings.


## November 23 current-main integration

Integrated live main `352d811d95b9964d900782244952a6fb5e059563` into #307 head `a0049790906a6d62966838035f7cdedefd9a8fc4`, preserving both histories. Conflicts were confined to continuity records and generated views; all prior worklog history and tasks remain. The exact-origin helper, wallet integration, Royale integration and eight origin regressions are unchanged from the prior candidate. Current main's account deletion, signer guard, Credits Song and directory work are retained. #309's first-wallet-link change is still a separate unmerged candidate; this is not an assembled #307/#309 release.

Fresh required-isolated-Redis (7.2.5), concurrency-two application suite: **981 pass**, zero failures/skips. Offline signer suites: **9 each**, for **999 total tests**. Every other verify component passes, including **336 security assertions**, question/content, economy, continuity, site and whitepaper checks. A separate focused exact-origin/passkey/account-deletion/Royale suite passes **63 tests**, zero failures/skips. Historical baseline and wildcard negative controls above were not repeated because their code/tests are unchanged; this run establishes compatibility with current main.

Read-only HQ environment inspection lists PASSKEY_ORIGIN for Preview, set to the previously approved `https://preview.geekprotocol.xyz`, and lists neither IDENTITY_ALLOWED_ORIGINS nor IDENTITY_ORIGIN. Only this plain origin variable was retrieved individually; no secret was decrypted. Configure exact approved wallet/Royale origins in Preview before interactive use of this candidate, and confirm the chosen alias points at that review deployment. PASSKEY_ORIGIN remains a separate boundary and does not itself authorize wallet proofs or Royale mutations. Production canonical origins are built in. No variable, alias, secret, live account or production setting was changed here.

Geek Bot's earlier report calls #307 READY; #307 currently has no submitted GitHub review or non-Vercel conversation comment. This refresh records internal integration verification, not a new independent audit. Hosted checks, founder release review and actual wallet/device acceptance remain separate and are recorded in the PR. Owner MFA (#306), atomic rates (#308), wallet-link recovery (#309) and private-bank #200 remain independent work; no economic gate is lifted.
