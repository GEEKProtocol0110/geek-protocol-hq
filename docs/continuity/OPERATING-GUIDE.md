# Keep the project record usable

## Begin a work session

Read [Start Here](../../START-HERE.md), the [current state](CURRENT-STATE.md), [decisions](DECISIONS.md) and the relevant protocol. Check the branch, open PRs and deployment. Select a backlog ID, inspect its evidence and dependencies, and state the intended outcome. Resolve discrepancies between the record, code and live checks without inventing progress.

## Finish or interrupt a session

1. Update [backlog.json](backlog.json): status, actual acceptance, evidence, blocker and next action.
2. Append decisions to [decisions.json](decisions.json). Distinguish founder direction from maintainer proposals; retain superseded decisions and link their replacements.
3. Update [project.json](project.json) when the current focus or verified release changes. Its product baseline remains historical; never replace it with an unmerged candidate. Record test and deployment scope separately.
4. Add a concise [work-log](WORKLOG.md) entry with branch/commit or PR, partial work, blocker and the first useful resume action.
5. Run `npm run continuity:write`, then `npm run continuity:check`, plus checks appropriate to changed behavior. The generator refreshes local counts; it does not mark tasks done or certify production.
6. After a release, record the merge/commit and production acceptance. Append normalized merged metadata to the release ledger. Update component status only after inspecting that repository. The candidate PR is the stable review record while open.

The continuity check runs with `npm run verify` and in CI. It detects missing records, invalid dependencies, stale generated pages/counts and changed preserved-original hashes. A maintainer still reviews the meaning of claims and their evidence.

## Source backup and restore

On a clean, committed checkout, run:

```sh
npm run continuity:snapshot -- --output /absolute/external/path/geek-source-checkpoint
npm run continuity:snapshot -- --verify /absolute/external/path/geek-source-checkpoint
```

The output directory must be new and outside the repository. Shallow and partial clones are rejected; fetch complete history/objects first. The tool creates a bundle of all local Git refs and a manifest containing bundle SHA-256, HEAD/tree, ref objects and scope. Verification hashes the bundle, clones a disposable mirror, verifies the bundle, checks Git object integrity and compares commit/tree/refs. It does not deploy or contact production.

Copy the directory to a **separately controlled durable destination**, then verify there. Record custodian, location, checkpoint, digest and last successful restore in the private operations inventory. A scratch copy or a second folder on the same host is not independent preservation. The digest detects corruption against a trusted manifest; it is not a signature or protection when both manifest and bundle are maliciously replaced.

| Asset | Preservation path |
| --- | --- |
| Committed HQ source/history/local refs | Verified source bundle and independent copy |
| Component repositories | Separate snapshots; the directory is an index, not their backup |
| LFS/submodules, if introduced | Separate preservation support; this tool rejects them |
| Issues, PR comments/reviews, attachments, releases and settings | Separate provider export/inventory; merged metadata is a partial record |
| Phone originals, conversations and external Library files | Controlled originals archive and provenance/hash register |
| Player records and provider backups | [Managed-data recovery](../BACKUP-RECOVERY.md), isolated restore and private evidence |
| Domains, hosting, signing and account recovery | Private custody inventory and [succession](SUCCESSION.md) |

Proposed rhythm: snapshot after meaningful releases; review independent copies/restore evidence monthly; review the roadmap/backlog quarterly. These are documented procedures, not enabled schedules or a claim that independent backups already exist.
