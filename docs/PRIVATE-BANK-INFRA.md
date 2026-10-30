# Private answer-bank infrastructure (INFRA-001)

This document covers instructions and patches only. **No repository, credential or Vercel setting was created or changed.** The founder-only steps are marked **FOUNDER**. Never paste a token into chat, an issue, a PR, a commit or a log.

The code it refers to (`server/question-source.js`, `scripts/private-bank.mjs`, `private-bank-template/`) is on draft PR #200 (`security/private-ranked-bank`, last checked `8f1993c`), not on main.

## 1. Private repository with immutable versions

**FOUNDER: create the repository**
1. Create a **new private** repository, for example `<owner>/geek-private-bank`. Its name and owner are private metadata: do not record them in this public repo.
2. Copy the layout from #200's `private-bank-template/` (the template's rows are FAKE; replace them only inside the private repository):
   ```
   manifest.json                 generated version manifest
   bank/<category>.json          active rows      { "questions": [...] }
   bank/<category>-retired.json  lookup-only rows (grade saved runs, never selected)
   dist/ranked-bank.json         built document   { "banks": {...}, "retired": {...} }
   ```
3. In the private repo's settings, protect `main`:
   - no force-push and no deletion;
   - require a pull request with one approval: the fact-checker, who must not be the author;
   - optionally require signed commits.

**Version rules (immutable)**
- **New version:** after any row change, run these from a checkout of the public repo:
  - `node scripts/private-bank.mjs check <private>`
  - `manifest <private> --write`
  - `build <private> --out <private>/dist/ranked-bank.json`

  Commit the result. The **40-hex commit SHA** is the version. HQ pins it with `GEEK_PRIVATE_QUESTION_REF`, and a run binds `git:<sha>` at issue.
- **Published versions:** never rewrite one. Do not amend, rebase or force-push, and never delete a version tag.
- **Tags:** tag each released version `bank-YYYY-MM-<n>`. A tag is for people; HQ trusts only the SHA.
- **Retiring a row:** move it to `<category>-retired.json` with `retiredReason` and `retiredAt`. Never delete retired rows, so saved runs keep grading.
- **IDs:** `PRK-<CAT>-<YYYYMM>-<NNNN>`, never reused. A prompt that has ever appeared in the public repo is rejected as exposed: moving a public question does not make it secret.
- **Leak cross-check:** the private repo's own CI runs `node scripts/private-bank-leak-check.mjs --private <private>/bank --root <public checkout>`. Its results stay in the private repo.

## 2. Fine-grained read-only token, entered directly in Vercel Preview

**FOUNDER: create and enter the token**
1. In GitHub, go to Settings → Developer settings → Personal access tokens → **Fine-grained tokens** → Generate new token.
   - **Resource owner:** the account that owns the private bank.
   - **Repository access:** "Only select repositories", with **only** the private bank selected.
   - **Permissions:** Repository permissions → **Contents: Read-only**. Leave everything else at No access (Metadata read-only is added automatically).
   - **Expiration:** 30–90 days. Add a calendar reminder to rotate it before it expires.
2. Copy the token once, straight into Vercel. Do not save it anywhere else.
3. In the Vercel project `geek-protocol-hq`, open Settings → Environment Variables and add these with **Environment: Preview only** (untick Production and Development):
   - `GEEK_PRIVATE_QUESTION_URL` = `https://api.github.com/repos/<owner>/<private-repo>/contents/dist/ranked-bank.json`
   - `GEEK_PRIVATE_QUESTION_TOKEN` = the token, marked **Sensitive**
   - `GEEK_PRIVATE_QUESTION_REF` = the 40-hex commit SHA of the version under test

   Optionally scope all three to the `security/private-ranked-bank` preview branch.
4. Do **not** add or change any Production variable, and do not set any exposed-bank override.
5. Redeploy the #200 preview and run the restricted Preview test (§4).

**How the code uses it** (#200):
- HTTPS only, with `redirect: 'error'`, so the token is never sent to a redirect target.
- An 8-second timeout and an 8 MB cap.
- The `ref` is pinned for GitHub contents URLs.
- Preview counts as production for ranked play: without a working private source it fails closed with `RANKED_BANK_UNAVAILABLE`, with no fallback to fixture or exposed banks.
- A URL source in Preview or Production **requires** `GEEK_PRIVATE_QUESTION_REF`.

## 3. Preview isolation from production scores, accounts and payment workers (code check at `8f1993c`)

| Area | What the code does | Isolation depends on | FOUNDER check |
| --- | --- | --- | --- |
| Scores, runs, sessions, profiles, leaderboard (`geek:run:`, `geek:session:`, `geek:profile:`, `geek:ranked:active:` …) | Keys are **not** prefixed by environment. `server/redis.js` uses `UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/`_TOKEN` | The Preview environment having its **own** Redis database | In Vercel env vars, confirm the Preview values for those names point to a different database than Production. If Preview shares the production database, **do not** run the Preview test |
| A.C.E., appearance, community | Namespaced by `VERCEL_ENV` (`geek:ace:preview:` etc.) | Already separated | — |
| Testnet payout signer (`workers/testnet/cron.mjs`) | Returns `paused` unless `VERCEL_ENV === 'production'` **and** `TESTNET_SIGNER_ENABLED === 'true'` | Code gate | Confirm the signer project has no Preview signer key |
| Reward and automatic-reward paths (`server/testnet-rewards.js`, `server/testnet-automatic.js`) | Gated by `TESTNET_REWARDS_ENABLED` / `TESTNET_AUTO_ENABLED` and an allowlist | Those being unset in Preview | Confirm both are unset for Preview |
| Ranked bank source | Preview is treated as production (fails closed, pin required) | Code gate | — |

**Finding:** Preview isolation for scores and accounts is a **configuration** property (separate Redis credentials), not a code guarantee. Making it a code guarantee would mean adding an environment prefix to those keys. That is a migration that touches Grok Bot's season and leaderboard files, so it is noted here as an option and **not** done.

## 4. Failure modes: tests and restricted Preview plan

**Automated tests** for #200: a new `tests/private-bank-resilience.test.js` with FAKE values only. I ran it locally against `8f1993c`: **4/4 pass.** It is held as a maintainer patch outside this public docs PR. Committed as a `.patch` under `docs/`, its fake bank URL and env assignments would trip #200's leak check, which allows fake values only under `tests/`. It goes onto #200's branch as `tests/private-bank-resilience.test.js`.

| Scenario | Expected | Covered by |
| --- | --- | --- |
| Storage unavailable (network error, 503, timeout) | New ranked rounds reject with `PRIVATE_BANK_UNREACHABLE`/`TIMEOUT`/`RANKED_BANK_UNAVAILABLE`. No fallback, no token or repo name in the error, and recovery once storage returns | Test 1 |
| Expired or revoked credential (401/403) | Same safe block; the bearer header was sent; the token never appears in the error | Test 2 |
| Invalid document (bad JSON, wrong shapes, duplicate options, out-of-range key) | `PRIVATE_BANK_INVALID`, nothing partially loaded | Test 3 (plus existing #200 tests) |
| Version rollback | Repinning an older SHA serves exactly that version from the immutable cache with no refetch. Runs bound to the old version still grade while a newer one is current. A malformed pin (`main`) or missing pin blocks | Test 4 |
| Saved games while blocked | Already-issued runs still grade | Existing #200 test "production without a private source refuses new ranked rounds but keeps grading saved games" |

Adding the test file to #200 is a normal commit on the #200 branch. It was not pushed from this docs PR.

**Restricted Preview test** (after §2, on the #200 preview URL only):
1. Start a ranked round: questions come from the private bank, and the page source and network responses contain no `correctIndex`.
2. Set `GEEK_PRIVATE_QUESTION_REF` to a nonexistent SHA and redeploy: ranked shows the unavailable state, and practice still works.
3. Revoke the token in GitHub and redeploy: same safe block. Then issue a new token and enter it in Vercel.
4. Roll back to the previous SHA: an in-flight run started on the newer version still grades.
5. Run `--private` leak check results privately.
6. Record pass/fail by role in the PR. Never record the token, repository name or question text.
