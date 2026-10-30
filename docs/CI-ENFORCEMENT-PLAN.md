# CI enforcement plan (CI-001)

The goal is a security check that actually **blocks** a failing candidate. An environment failure, such as missing Redis or a missing dependency, is a failure. It is never a pass.

## 1. Workflow patch for #200

- **Checked October 30, 2026:** `gh auth status` reports token scopes `gist`, `read:org` and `repo`, with **no `workflow` scope**. GitHub rejects pushes that change `.github/workflows/*` without it, so the patch has **not** been pushed.
- **Patch:** [patches/pr200-security-verification-workflow.patch](patches/pr200-security-verification-workflow.patch). It changes `security-verification.yml` to:
  - check that `redis-server --version` works;
  - run the full `npm run verify` with `DUEL_REQUIRE_REDIS=1` and `QUEST_REQUIRE_REDIS=1`;
  - raise the timeout to 20 minutes.
  `verify` already chains `private-bank:check` and `private-bank:leak-check` on #200. The patch still applies cleanly to `8f1993c`.
- **Next action:**
  1. A session or person with `workflow` scope runs `git am docs/patches/pr200-security-verification-workflow.patch` on `security/private-ranked-bank`.
  2. Push normally (no force).
  3. Confirm the new step names appear in the PR's check run.

## 2. Full local verification with Redis (#200 head `8f1993c898ce73435500e3a683afbcceee7f3fb1`)

- **Environment:** box Linux, Node 24.22.1, and a user-space Redis 7.2.4 binary (from the `redis-stack-server-7.2.0-v10` tarball). The Debian apt mirrors were unreachable from the box, so apt could not be used.
- **Command:** `npm run verify`. **Exit code 0.**
- **Results:**
  - `npm test`: **777 tests, 777 pass, 0 fail, 0 skipped, 0 cancelled.** This matches CI run [41059613671](https://github.com/GEEKProtocol0110/geek-protocol-hq/actions/runs/41059613671/job/124075778285) (777/777).
  - `test:signer`: **9/9**.
  - `questions:check`: catalog 8,338 distinct; 876 recorded / 7,124 still needed. Audit: 0 unresolved items or pairs.
  - `private-bank:check`: OK, with the template's 14 fake rows.
  - `private-bank:leak-check`: passed, 587 tracked files, pattern mode.
  - `security:check`: 311 assertions.
  - `collection`, `archive`, `repository`, `economy:stress`, `continuity` and `site`: all passed.
- **Earlier failures:** the 19 local failures from previous sessions were all `redis-server` ENOENT, plus `@kasplex/kiwi` missing. Neither applies to this run; both are now resolved locally.
- **What this proves, and what it doesn't:** a local machine with real Redis passes everything. It does not prove the check is required on GitHub; that is section 3.

## 3. Prove the required check blocks a failing candidate

**Do not open the throwaway PR until branch protection exists.** Today main is unprotected: the API returns `Branch not protected`.

**Founder action first.** In GitHub, go to Settings → Branches (or Rules → Rulesets) for `main` and require:
- pull-request review with **Require review from Code Owners** (CODEOWNERS ships with #200; until it is on main, the rule applies only after #200 merges);
- status check **`verify`** from the Security verification workflow, with "Require branches to be up to date";
- no bypass for administrators, unless the founder deliberately keeps one. Record which choice was made.

**Then run the proof:**
1. Branch `ci/blocking-proof-<date>` from main **after** #200 merges, or from #200's branch if the founder wants proof earlier, with the PR based on that branch.
2. Add one deliberate **fake** leak, for example a file under `docs/` containing a `PRK-` style ID with fake digits that is not `PRK-FAKE-000000-0000`. Never use a real question.
3. Open it as a **draft** PR titled "DO NOT MERGE — CI blocking proof".
4. Expected: `verify` fails at `private-bank:leak-check` (and in `npm test` via the leak-check suite), and the merge box shows "Required statuses must pass" plus "Review required from code owners".
5. Record the run URL, the failing step, and a screenshot or `gh pr view --json mergeStateStatus` showing `BLOCKED`.
6. Close the PR without merging and delete the branch.

**Acceptance:** CI-001 is done only once steps 4–6 have evidence. A green run on a clean branch does not show that the check blocks anything.
