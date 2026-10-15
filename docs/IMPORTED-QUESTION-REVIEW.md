# Imported question review

Open **Operations → Questions → Imported question review** at `/ops/imported/`. It requires the current owner session and configured CCE permission. The page and scripts remain outside the public output. No public endpoint returns answer keys.

Choose a category, source-review status and optional search. Ten active questions appear at a time with their answer key, explanation, source, difficulty, content revision and current proposal. Check the source yourself; a source link or draft status is not evidence of correctness. Select up to ten questions, enter a private note and explicitly acknowledge source checking. Mark reviewed only when an existing explanation is present; otherwise select one question, use Edit and propose a correction. A retirement proposal preserves the original question for compatibility.

The save compares every selected source revision and review version before writing any proposal. Conflicting edits fail as a whole. Decisions expire after 90 days and do not publish themselves. Lost responses clear actionable rows; refresh before retrying. Audit activity records a request for an editorial proposal, never a claim that source evidence was independently checked or a release published.

Export the current page's non-stale proposals. This private JSON contains answer keys and private notes. Keep it out of public assets and public issue attachments. A maintainer can stage it with:

```sh
node scripts/stage-question-reviews.mjs PRIVATE_EXPORT.json NEW_PRIVATE_STAGING_DIRECTORY
```

The command writes a new private staging directory, not the running source bank. Review the proposed bank and maintenance-report differences, copy approved changes into a branch, regenerate `node scripts/question-catalog.mjs --write`, and run `npm run verify` before publishing through a PR. Private decision notes do not enter published bank files. Corrections retire the issued identity with its original answer key and create a new canonical identity; existing saved runs retain their previous grading record. CI still checks duplicates, allowed content, tier capacity, retirement hashes and count accounting.

Validation: pure proposal/correction/staging regressions and real-Redis owner access, origin/JSON restrictions, bounded reads, atomic stale-version conflicts, corruption preservation, and TTL tests. Browser layout/keyboard checks and human question-source review remain separate work. This feature does not activate token rewards or change existing question answers automatically.
