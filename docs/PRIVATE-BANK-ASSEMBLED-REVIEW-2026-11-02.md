# Private ranked-bank assembled review

Task SEC-010. Status: **review candidate, not a production cutover**. No real private questions were read, copied, authored or published. Mainnet, CCE and ownership holds are unchanged.

## Exact inputs

| Input | Head | Disposition |
| --- | --- | --- |
| Current main | 12a02285491e07c93bc2398ff0f0e61975b814d5 | Already released homepage/document discovery and routing |
| #200 private bank | 55c610153e0bb72d6dc320891e607d2d52a37ec7 | Unmerged draft |
| #206 monthly seasons | 22d3f775cb9332617291f77ebc75d11c87dca5b9 | Unmerged draft |
| #207 leak hardening | 10ab3ff4d4181be55e02d980d4c342e513a0e0b9 | Unmerged draft |
| #213 public-bank errors | 07ae008f0afb84a781d28be9b132394c6b5c942a | Unmerged draft |

All four input heads had successful individual GitHub Security verification and both Vercel preview checks at review. This is not assembled-head acceptance. #200 has historical unresolved review threads; later comments and tests address many of their code findings, while repository protection remains an external acceptance gate. Do not resolve another reviewer's threads merely from this integration.

## Reconciliation

Merge main normally into #200, then merge #206, #207 and #213 normally. Keep current main's question corpus, share images, compressed images, public documents, direct document links, timer, headers and redirects. Keep the private-bank selector, deferred feedback, monthly season/state handling, and both bounded saved-player hint and signed-out reward-status hint behavior. Combine verification scripts so private-bank checks and whitepaper parity both remain required locally. Regenerate continuity from the merged JSON; preserve SEC-010 alongside the newer content work.

Original public question files are unchanged from main. Existing in-game and Testnet paths receive only the reviewed unranked/season protections from #206; no payout or environment setting is enabled.

## Additional findings and corrections

1. **Confidentiality: malformed JSON in bank tooling could echo source text.** `scripts/private-bank.mjs` logged the native parser message. Catch bank and manifest parse errors and emit only the known filename plus `invalid JSON`. A subprocess regression injects a synthetic canary into both files and proves it is absent from stdout/stderr. No real content is used.
2. **Required concept identity was not enforced.** The approved process requires a nonempty `conceptId` on every row, but the authoring checker and all fourteen public template rows omitted it. Enforce the requirement in tooling, add explicit synthetic concept IDs to the fake active/retired templates, and regenerate their fake manifest. A regression rejects missing, whitespace and non-string identities, including retired rows. Runtime loading remains a structural validator; authorship, evidence and approval still need the private editorial process.
3. **Timing-dependent test comparison.** One full run exposed the existing mismatched-bank XP test comparing two runs with different real elapsed latency (119 versus 118 XP). Freeze only that test's synthetic clock so equal-answer/equal-timing inputs genuinely justify equal XP. Keep all no-reward, unranked persistence and leaderboard assertions. Game score and XP formulas are unchanged.

## Validation

After the fixes, full `npm run verify` with native Redis 7.4.2 and required Redis modes passes: **893 HQ tests: 892 pass, zero fail, one skip; nine signer checks pass**. All supporting question/corpus, private-template, whole-tree leak scan, archive/collection, 311 security assertions, repository, economy, continuity, site and whitepaper checks pass. The tooling suite is nine tests including the two new regressions.

The skipped case is the real unreadable-file test: root ignores Unix file permission bits. Attempting a non-root run is blocked by this runner's group-switch capability. Missing/malformed/recovery and HTTP-503/code-only-log cases pass; no skipped-case acceptance is claimed. A normal non-root GitHub runner can establish that remaining case.

Existing integration tests exercise deferred answer/resume/retry/early-finish behavior, saved public grading, immutable source versions, expired credentials and outages, bank/season mismatch, season rollover with in-flight runs, namespace boundaries, Testnet refusal for unranked results, and fixed client error messages. They use fake banks and isolated local Redis. They are internal implementation evidence, not independent audit, physical-device or real-bank acceptance.

## Release blockers and observed configuration

| Gate | Current evidence | Required next step |
| --- | --- | --- |
| Immutable bank source | Preview has a private-source mode, sensitive credential and source setting, but neither the immutable commit-ref setting nor expected content-hash setting is present | The private bank custodian must approve the exact reviewed artifact, then set its appropriate immutable pin through the controlled Preview process |
| Preview isolation | Provider metadata identifies distinct linked storage resources for Preview and Production; Preview reward and automatic-signing flags are false | Retain those settings and verify runtime isolation without using real bank contents in public artifacts |
| Playable restricted rehearsal | #206 deliberately rejects Preview/development ranked writes before run creation; its own regression proves 503 and no ranked writes | Design and approve a bounded isolated rehearsal path before claiming an end-to-end hosted Preview run. Never relabel Preview as production or remove the guard |
| Season start boundary | With start month December 2026, the current helper returns Season 1 at November 30, 23:59:59 UTC; the test explicitly expects pre-start clamping | Do not cut over the private bank early while claiming November remains Season 0. Specify either a start-time refusal or an explicit later cutover before release |
| Editorial and capacity acceptance | Only synthetic banks are reviewed here; real bank author/fact-check/approval evidence is outside this workspace | Private editorial acceptance, required category/tier capacity, pinned artifact and founder approval |
| Repository enforcement | CODEOWNERS paths are in the branch; current branch-protection/ruleset enforcement is not verified through the available connector | Verify code-owner/required-check enforcement and a deliberately failing candidate being blocked |
| CI coverage | Current workflow retains its established test/security steps; the separate full-verify workflow change is still an unaccepted rollout item | Reconcile the workflow gate explicitly before cutover rather than inferring it from a green individual PR |

No provider variable, token permission, database setting, signing setting or production branch is changed by this review. Private storage identities and values stay out of this public record. Existing token scope/expiry and actual private-bank content acceptance are not inferred from the presence of a setting.

## Next review step

Publish this as a separate **draft assembly review** against #200's branch. Preserve the original PRs and their exact inputs. Record assembled-head CI/preview evidence in the PR description. Main must continue serving the approved public Alpha. A hosted fail-closed probe can confirm that the Preview guard rejects ranked start without issuing a question; it does not satisfy the playable restricted-rehearsal gate above.
