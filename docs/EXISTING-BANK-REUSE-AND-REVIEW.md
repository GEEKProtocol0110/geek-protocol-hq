# Keep the existing bank; separate Alpha ranking from token competition

BANK-009 and SEC-010, November 13, 2026. Founder-approved direction; source candidate only.

## What is retained

Keep the existing public question corpus for learning, Study, practice and openly known-question Public Alpha rankings. Prior published questions and their saved grading identities remain useful. Review and repair this corpus; a new private bank is not a reason to discard it or generate thousands of replacements before improving existing content.

Future token-bearing competition still requires an approved private source and reward/abuse acceptance. Moving published files into private storage does not undo exposure through Git history or copies. Public/legacy/unranked results remain refused by the held branch's mainnet admission guard, even when fixture flags simulate an enabled worker. This direction does not approve a production cutover, a real private-bank artifact or any economic enable.

The existing 1,000-reviewed-per-category CCE hold remains separate. It is not a requirement to write that many additional questions from scratch, and it is not a declaration that imported drafts are already approved.

## Reconciled inventory

The generated server-side report is `server/question-audit/review-queue.json`:

- 8,432 active-file rows, including 214 practice-only rows; 8,218 are in the selectable Alpha pool.
- 884 rows carry a source-check tag, but only 809 meet the stricter readiness rules. A tag alone is not readiness or independent acceptance.
- 7,548 rows lack that source-check tag; 7,409 of those are selectable drafts.
- The per-category 1,000-review target deficit is 7,191. This is a review/approval target, not a count of mandatory new authoring.

The existing whole-bank audit still verifies structural validity, encoding and the maintained duplicate/context decisions. It does not establish factual, semantic-duplicate, source-rights, category or difficulty acceptance for every row.

## Review existing rows in bounded batches

`npm run questions:triage` checks that the inventory and queue match the current public corpus. To regenerate after a reviewed content change, run:

```sh
npm run questions:triage -- --write
```

Every draft remains subject to primary-source review. The next batch is at most 25 selectable drafts per category, sorted deterministically to prioritize clinical wording, superlatives and unit-system ambiguity, then other drafts. These are review signals, not proof a row is wrong. Missing explanations and primary evidence are explicitly counted. The queue contains only existing public IDs and reasons, not question/answer text or any private bank content.

A reviewer must inspect the prompt, all distractors, the keyed answer, primary evidence, explanation, duplicate concept and category/difficulty fit. Retain unchanged correct content and attach evidence; do not auto-approve from a heuristic. If grading content changes, retire the old identity lookup-only and create a new identity through the existing editorial process. Preserve attribution and historical grading. Founder batch approval remains separate from an internal source check.

## Release verification

The CI verify job now invokes the full `npm run verify` chain, including the private-bank validator, leak checks, corpus/audit/triage checks, archive/collection, repository, economy, continuity, site and whitepaper checks. It also runs the isolated fake-bank rehearsal as a distinct command and retains all three dependency audits. Checkout does not retain repository credentials.

A green job on this candidate establishes that workflow execution, not branch/ruleset enforcement by itself. Demonstrating that required checks block a failing candidate, real-bank editorial/capacity acceptance, hosted rehearsal, real-device testing and independent abuse review remain open. No question data, saved answer key, provider setting, production deployment or payout control is changed by this candidate.
