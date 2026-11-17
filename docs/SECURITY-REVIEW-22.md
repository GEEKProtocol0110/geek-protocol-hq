# Security review: 22 findings and required evidence

SEC-001 · November 16, 2026 · Internal source review and hardening candidate.

Reviewed baseline: `b7521c6db2087d0c40580afa443104f33f4cd212`. This is not an independent audit. Findings below distinguish an observed implementation issue, existing controls, unfinished acceptance and claims that need correction. No production credentials, privileged records or wallets were inspected or changed. Mainnet settlement, CCE and collection gates remain closed.

## Review outcome and execution order

The first candidate addresses items 1, 2 and the entry points in 5: dedicated owner credentials, mandatory production MFA, and network-based pre-auth limits. Four new regressions failed against the original implementation and pass with the candidate. The broader role/worker inventory remains open.

Next address exact-origin selection (6), public upstream resource limits (7), and the evidence matrix (19). The deeper adversarial review of races (4), information leakage (8), and account recovery (10) remains open for the separate review requested by the reporter. Running existing regression suites does not close that review.

For an existing correct control, a normal regression can already pass. Demonstrate its effectiveness with a negative control that deliberately weakens the control and makes the adversarial test fail. Do not invent a pre-fix failure or rewrite working code just to manufacture a red/green result.

## P0 — privileged access and money boundaries

### 1. Dedicated Operations owner credential

**Confirmed on the baseline; fixed in this source candidate.** The original [operations access configuration](../server/operations-access.js) substituted `CCE_ADMIN_TOKEN` when `OPS_ACCESS_TOKEN` was absent. This could promote a moderator credential to the complete owner role.

The candidate removes the fallback in every environment. Production also rejects an owner key equal to any configured CCE, audit or payout-review key. Missing or invalid configuration fails closed. Constant-time comparison remains in use.

**Acceptance:** missing dedicated key, explicit blank/short key, role-key substitution and production key reuse fail; a correctly configured owner can sign in. Evidence: `tests/operations-mfa.test.js:44` and existing `tests/operations-access.test.js` credential tests. Production provisioning is a separate operator action, not verified here.

### 2. Production MFA

**Confirmed on the baseline; fixed in this source candidate.** MFA was optional, and absence permitted legacy role-key access.

When `VERCEL_ENV=production` or `NODE_ENV=production`, [MFA configuration](../server/operations-mfa.js) now requires a valid secret. The three role APIs also validate production owner configuration before accepting access. Removing MFA cannot revive an old single-factor owner session or restore bearer-key access. Non-production tests may exercise the legacy no-MFA path explicitly.

**Acceptance:** absent/malformed MFA denies production login and role access; valid factors work; removal/rotation invalidates access; no secret or code enters responses, sessions or audit events. Evidence: `tests/operations-mfa.test.js:44`, `:60` and the existing replay/vector tests. TOTP is phishable and is not individual hardware-backed administrator identity. That audit gate stays open.

### 3. Mainnet signing isolation, limits and pause

**Partly implemented; activation acceptance remains open.** An environment-held private key is not, by itself, proof that the signer is insecure. Its execution boundary, exposure, access and spending controls matter.

The current [payout module](../server/mainnet-payout.js) and [worker schedule](../workers/mainnet/schedule.mjs) already implement production/flag gates, exact proof-derived amounts, a 100,000 GEEK global daily cap, and 46,400 GEEK player/address daily caps. The worker has a separate package/configuration and signing flag. These are source controls, not proof of a separately deployed, funded or independently audited service. An admission cap is not an independent signer-side spend limit.

**Required:** verify independent signer deployment/access, signer-side maximum transaction and daily exposure (including KAS fees), independent emergency revocation, exact journal reconciliation, reserve funding, restore behavior and external audit before activation. Test stale queues and in-flight work after a pause. Never enable payouts to test the audit checklist. Existing evidence: `tests/mainnet-payout.test.js` and offline worker checks.

### 4. Atomic balances, claims and destination changes

**Controls exist; deeper completeness review deferred.** [Ranked commits](../server/ranked-state.js), [profile audit writes](../server/profile.js), identity binding and payout admission contain Redis Lua/CAS transitions. Existing `tests/ranked-persistence.test.js` covers concurrent completions, lost replies, stale debits and duplicate finishes. This is not proof that every mutation path is covered.

**Required:** inventory every ledger, XP, claim, profile, destination and payout write; bind idempotency to the economic event, not just an HTTP request; test conflicting concurrent requests, pre-commit rejection, lost post-commit acknowledgment and restore. Show both single application and recovery of an unpaid event. Do not replace atomic Lua with non-atomic pipelines or assume Redis transactions roll back arbitrary runtime errors.

### 5. Admin brute-force protection

**Existing login limit had a real bypass; candidate addresses the three role APIs and login.** Original login used a fingerprint including User-Agent. The candidate uses normalized network identity for ten login/logout requests per ten minutes. CCE, audit and payout-review share sixty pre-auth requests per network per minute, counting rejected keys across endpoints. Existing owner-wide TOTP limits remain.

**Evidence:** `tests/operations-mfa.test.js:73` and `:80` fail on the baseline and pass on the candidate. Network identity normalizes IPv6 to /64; it depends on the documented trusted proxy boundary. These limits do not solve distributed flooding.

**Remaining:** inventory worker/cron and any additional privileged endpoints, verify limits before expensive authentication, prove store failure denies access, and test trusted client-address headers at deployment. Rate-limit rollback must not silently reopen static credentials.

## P1 — origin, request and result integrity

### 6. Exact-origin selection

**Confirmed source weakness; not changed in this candidate.** [Wallet identity](../server/identity.js#L74) selects a forwarded host and permits a broad `*.vercel.app` pattern. [Royale](../server/royale-api.js#L25) compares Origin to a request-derived host instead of an independently trusted exact set. Identity already compares supplied Origin to its selected origin; it is inaccurate to say no origin validation exists.

**Required:** build exact HTTPS origins from trusted deployment configuration, reject arbitrary preview tenants and malformed/multiple forwarded values, and preserve exact issuing-origin binding through verification. Test spoofed Host plus Origin, forwarded-header substitution, valid production/authorized preview, cross-host replay, absent Origin policy and non-HTTPS. Verify passkey RP/origin compatibility separately before changing shared behavior.

### 7. Public upstream budgets and audit pagination

**Partial gap confirmed.** [Mint status](../server/mint.js#L84) has a successful-response cache, but [anonymous `fresh=1`](../api/mint.js#L9) bypasses it. Cache existence therefore does not settle abuse exposure. Concurrent requests are not coalesced by that loader. [Widget metadata](../server/widget-download.js#L18) caches for five minutes, while APK requests retrieve and verify bytes again. Audit is authenticated and the candidate now adds a pre-auth rate budget, but pagination also needs finite-integer validation.

**Required:** define request and upstream-cost budgets for fresh mint checks, metadata and APK bytes; coalesce concurrent equivalent reads; bound failure retries and responses; reject invalid pagination numbers. Preserve a fresh validated mint preflight and fail closed on mismatches. Do not replace it with stale success caching merely to reduce requests. Add parallel cold-cache, provider timeout and repeated-refresh tests.

### 8. Answer leakage, scoring and attempt reuse

**Existing tests; deeper review deferred.** `tests/api.test.js` tests server clocks/scoring, pre-commit Study responses and concurrent transitions; `tests/ranked-persistence.test.js` tests lost/duplicate replies. No full endpoint-by-endpoint information-flow or timing-oracle assessment was performed here.

**Required:** inventory every pre-commit payload, error, source map, public artifact and delayed reveal. Reject client-controlled scores/deadlines/rewards; race the same token; verify per-player secrecy and post-round reveal timing. Treat historical public question content as exposed. Quantify timing concerns under a defined threat model instead of claiming all response timing is secret-independent. Private-bank acceptance remains separate from response filtering.

### 9. Browser HTML sinks

**Inventory required; no blanket XSS finding established.** A textual assignment search finds 64 `innerHTML =` sites in this baseline; a different search can yield a different count. A sink count is not an exploit count.

**Required:** inventory source-to-sink paths for names, rooms, community content, trades and upstream data. Prefer text/DOM APIs for plain text. Review HTML, attribute and URL contexts separately; an HTML escape function is not sufficient for every URL or script context. Add hostile-payload tests and an AST/lint rule or reviewed sink registry. A regex requiring `escapeHtml` on every interpolation would both flag safe literals and miss unsafe contexts.

### 10. Passkey, wallet and recovery evidence

**Substantial existing evidence; deeper review deferred.** `tests/passkeys.test.js` covers UV/origin/signature failure, expiry, replay, revocation, device approval and concurrent receiving changes. `tests/wallet-identity.test.js` covers independent KIP-5 verification and replay. [Legacy payout settings](../api/rewards.js#L13) define a 72-hour delay; [saved receiving-address handling](../server/reward-addresses.js) is a separate path.

**Required:** map each mechanism to each account type and destination path; explicitly test counter regression including legitimate zero-counter authenticators, challenge consumption races, recovery revocation and the exact meaning of the 72-hour eligibility delay. Verify cooldown persistence and signer admission after changes. Do not describe a saved address as wallet ownership proof or assume a receiving flow inherits all legacy payout controls. Complete actual-device recovery tests separately.

### 11. Body, scalar and array limits

**The reported absence of a body limit is incorrect.** [Shared parsing](../server/http.js#L29) limits both raw and platform-parsed JSON to 8,000 bytes and rejects pre-parsed top-level arrays; `tests/http-input.test.js:11` checks this. Several endpoints also bound field/array counts, including four CCE options.

**Remaining:** inventory endpoints and parsing exceptions; require an object consistently after raw parsing (raw JSON arrays/scalars currently parse); bound nesting, arrays, encoded credentials and response/download sizes where appropriate. Test raw and already-parsed paths at boundary sizes and multibyte inputs. A platform body limit is an additional boundary, not the only test.

## P2 — supply chain, maintainability and browser protections

### 12. `ai` dependency

**Unused-dependency claim disproved.** [Tutor code](../server/ace-tutor.js#L66) dynamically imports `generateText`, `Output` and `jsonSchema` from `ai`. It is absent from a simple static-import search because loading is dynamic.

**Required:** retain while that code remains, or remove the paused remote tutor and dependency together as a separately reviewed change. Verify disabled mode cannot make a provider call. Do not activate the paused service or confuse it with local A.C.E. board-game algorithms.

### 13. WASM/SDK provenance and signature checks

**Partly implemented.** [Dependency provenance](DEPENDENCY-PROVENANCE.md) records pins, hashes and scope. `tests/wallet-identity.test.js:51` already verifies a published independent KIP-5 vector and a mutated-message failure, rather than only signing/verifying with one library. Offline real-SDK transaction checks also exist.

**Required:** broaden independent invalid-signature/key/network vectors, review exact distributed WASM/SDK artifacts and run `npm audit signatures` for root and both worker graphs with an available registry. Both worker signature audits passed: 11 registry signatures and one attestation each. The root audit failed with `EMISSINGSIGNATUREKEY` for `@peculiar/x509@2.2.0` because its attestation public key was unavailable. Root provenance remains unresolved; this is not proof of package tampering. Investigate the key/attestation path without disabling verification. Record unavailable or unsigned-package results accurately; signature verification is provenance evidence, not proof of safe package behavior. Do not upgrade identity WASM blindly or use that old verification package for transaction construction.

### 14. Redis-dependent skips

**The specific CI allegation is unsupported by current configuration.** The [security workflow](../.github/workflows/security-verification.yml#L31) installs Redis and sets `DUEL_REQUIRE_REDIS=1` and `QUEST_REQUIRE_REDIS=1`. `tests/operations-access.test.js:15` throws on missing Redis when the required flag is set. The sampled client-IP and classic-online suites throw when `CI` is set. Other suites require the fixture unconditionally.

**Required:** inventory all skip branches and add a CI assertion for zero unexpected skips. Prove missing Redis fails the actual CI command. A future shared `REQUIRE_REDIS` convention may improve clarity, but adding yet another variable alone is not evidence of coverage. The candidate's complete application run passed with zero skips.

### 15. Dense privileged/notification code

**Maintainability concern confirmed.** [Push delivery](../server/classic-push.js) contains compact one-line validation and transitions. Formatting is not itself a security boundary.

**Required:** format and simplify the affected modules in an isolated behavior-preserving change, test push authorization and queue transitions, then enforce a scoped formatter check. Avoid a repository-wide formatting diff in the same PR as authentication changes. Review dependency and developer-workflow impact before adding tooling.

### 16. Player cookie prefix

**Confirmed hardening opportunity.** [HTTP session code](../server/http.js) uses `geek_session` with Secure, HttpOnly, Path=/ and SameSite=Lax; Operations already has a `__Host-` Strict cookie.

**Required:** plan a `__Host-` migration with duplicate-cookie rejection, explicit precedence/expiry, sign-out/recovery behavior and safe retirement of the old name. A permanent fallback would retain the cookie-tossing surface. Preserve guest/account continuity where possible and explain any unavoidable sign-in transition. Evaluate SameSite behavior against link-based invitations and auth flows; Lax alone is not proof of a vulnerability.

### 17. CSP routing coverage

**Source coverage exists; deployed verification remains.** [Vercel configuration](../vercel.json) applies CSP to the broad non-news pattern and two news patterns. `/api/*`, `/ops/*` and ordinary missing paths fall under the non-news source rule; the three groups are not just three isolated pages.

**Required:** test route matching and live headers for canonical/alias, rewritten API, JSON errors, 404/405/500 and news routes, including redirects and provider-generated errors. Preserve required wallet/news behavior and strong directives. Source configuration cannot establish headers on every hosting-provider error response. No CSP weakening is proposed.

### 18. Public commit email

**Future commit identity addressed locally; history unchanged.** This worktree now uses the repository owner's GitHub noreply address for new commits. No private address is copied into this report.

**Required:** configure the same identity in other worktrees, bots and contributor environments; confirm the next authored/committer metadata. A local config change cannot remove historic metadata. The repository connector creates its own remote commit identity and does not inherit this local setting; its published author/committer metadata did not use the noreply domain. Review that publisher/account setting separately before calling this item complete. History rewriting is disruptive and is not authorized or proposed here; public copies may persist regardless.

## P3 — evidence, scope and repository rules

### 19. Claims-to-tests matrix

**Documentation work required.** [SECURITY.md](../SECURITY.md) has broad invariants and [controls.json](../security/controls.json) links evidence, but neither is a complete per-claim adversarial test matrix. Some checks in `scripts/security-check.mjs` assert strings in source; those are guardrails, not behavioral proof.

**Required:** give each claim an ID, scope, enforcing function, behavioral test name/location, negative-control result, exact tested commit, environment and limit. Separate implemented/internal evidence, intended behavior, source candidate and independent acceptance. Scope “no private keys” to the non-custodial app, excluding a separately protected future treasury signer. Correct mint-freshness and historical-bank secrecy claims. Downgrade anything whose enforcement cannot be shown. Do not label the suite an external audit.

### 20. Continuity and change discipline

**Required for each candidate.** SEC-001 updates maintained project/backlog JSON, WORKLOG and generated views. Run `npm run continuity:write`, `npm run continuity:check` and applicable checks on the assembled head; retain original decisions and gates. Record PR/commit, CI, merge and deployment as separate facts. Other open document and private-bank branches must preserve these changes when integrated.

### 21. Hardening phase

**Recommendation, not an adopted project freeze.** A raw commit count is neither a vulnerability nor a useful measure of review completeness; the supplied 478 count was not re-established here.

**Required decision:** choose an assessed release candidate, stop unrelated changes in that candidate, assign independent reviewers and audit scope, close material findings and retest before value movement. Continue essential corrections and free learning availability as appropriate. This security candidate adds no product features and does not silently impose a permanent freeze on the project.

### 22. Main branch protection

**Verified through GitHub's public rules APIs for this snapshot.** Active ruleset `26214524` targets the default branch. The effective rules for main require a PR, squash merges, resolved threads, no deletion/non-fast-forward updates, strict up-to-date checks, `verify`, and both HQ and testnet Vercel statuses.

Required approving review count is **zero**; code-owner and last-push approval are not required. Those settings do not provide independent human approval. The public ruleset response did not expose bypass actors, so it cannot prove who can bypass rules.

**Remaining:** an authorized owner should inspect bypass roles, repository/admin access and source-app binding for every required status. Decide whether to require a second reviewer before the audit release. Do not change protection or grant access as part of this report. Evidence snapshot: `security/review-main-rules.json`.

## Claims to preserve, with honest boundaries

- Keep constant-time credential comparisons; owner comparison already used `timingSafeEqual` on the baseline.
- Preserve CSP, HSTS, framing protection, pinned mint identity, timeouts, lockfiles and SHA-pinned Actions.
- Do not repeat “no secrets in every commit” as a fresh finding without a complete history/artifact scan; none was performed in this session.
- “No Math.random anywhere” is false: visual effects and browser-local receipt IDs use it. Audit security-sensitive nonces/shuffling by context rather than removing cosmetic randomness blindly.
- Passing internal tests does not accept private ranked secrecy, actual-device recovery, provider restoration or a Mainnet signer audit.

## Candidate validation and release boundary

The four new regressions at `tests/operations-mfa.test.js:44`, `:60`, `:73` and `:80` failed on the baseline, then passed with the candidate. The complete application suite subsequently passed **969 tests, zero failures/skips**, using real isolated Redis. Full `npm run verify` passed: 969 application tests plus nine testnet and six mainnet signer checks (984 total), zero failures/skips; 325 security assertions and all supporting checks passed. Final review results belong in WORKLOG and the PR; a source report alone is not production evidence.

Before merging this enforcement change, provision a separate owner token and authenticator through the existing private setup procedure and verify operator recovery. No production secret was generated, read or configured here. Missing configuration intentionally makes privileged access unavailable while public learning remains unchanged. Do not weaken the new checks as a lockout workaround. No merge, deployment or economic enablement is claimed by this document.


## Review handoff

Draft [PR #306](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/306) preserves verified source tree `01da2fd1015f3c4e03bcaf8c8da18fdd2feed2bc` at remote source commit `476f18922a9c06c2b2c569e93102f0c7b81f6c36` (local verification commit `459b4c0ba05a13b0f482de32ceecfed61823f963` has the identical tree). Both Vercel preview statuses succeeded when checked. Required GitHub verification/independent review, production credential provisioning, merge and deployed acceptance remain separate. This handoff adds evidence only.


## Claude handoff follow-up — November 17, 2026

- **External callers:** production rejects standalone role credentials and any Authorization header on the three role APIs, including a request with a valid owner cookie. No repository caller inventory can prove that an external bot does not use those keys. Geek Bot/operator confirmation remains a merge prerequisite; no message was sent on the founder's behalf.
- **Preview MFA:** a new real-Redis regression proves `VERCEL_ENV=preview` plus `NODE_ENV=production` still requires MFA. This is intentional fail-closed behavior of the existing guard. Vercel documents `VERCEL_ENV` as the deployment discriminator; NODE_ENV may be framework/runtime dependent. The actual Preview runtime value was not exposed or inferred from a successful build. Provision isolated preview credentials where required; do not copy production secrets or weaken the guard to make a preview pass.
- **Signed-in rate limit:** a new regression makes 60 successful owner audit reads, then exercises the shipped owner client against the next 429. It reports backoff, preserves the exact session record and retains a successful owner status read. The shared budget intentionally counts authenticated reads; normal dashboard status polling uses a separate route. This is not a full browser load or capacity acceptance.
- **Rate-counter expiry:** `rateLimit` still sends INCR/EXPIRE NX through a non-atomic pipeline. A partial write or lost provider execution can leave an increment without an expiry. Replace it in a separately reviewed atomic transition that preserves fixed-window behavior and repairs a legacy missing TTL; test failures and concurrency across existing callers. This pre-existing issue is not fixed by the new tests.
- **Provisioning evidence:** a metadata-only Vercel read for HQ returned no OPS_ACCESS_TOKEN or OPS_TOTP_SECRET entries and zero hidden Production entries. No secret value was decrypted or printed. Thus production provisioning for this candidate is not established and the merge remains held.
- **Review state:** GitHub verify run 44012581468 passed on prior head fd08a3c, with no submitted reviews or inline review threads returned. New commits require fresh exact-head CI. #305/#306 still need continuity reconciliation if both are integrated; #200 remains a separate held candidate.
