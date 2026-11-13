# Your first contribution

Use Node.js 22 or newer; full CI currently uses Node 24. Pick a small documentation or interface issue and read AGENTS.md and START-HERE.md before editing.

1. Clone the repository and create a branch from current main.
2. Run `npm ci --ignore-scripts` and `npm ci --prefix workers/testnet --ignore-scripts`. Install Redis locally for integration tests; never use a production database or secrets.
3. Run one relevant test, for example `node --test tests/start-client.test.js`. Make the smallest useful change, then rerun it.
4. `npm run site:write` regenerates metadata, sitemap and robots from the maintained page configuration. `npm run site:check` checks those generated outputs and internal links without changing them. Commit generated changes only when intended.
5. Update the relevant continuity task and work log. Run `npm run continuity:write`, then `npm run verify` with isolated local Redis available. Record any unavailable checks honestly.
6. Open a PR explaining the problem, resulting behavior and actual checks. A green test does not establish phone acceptance or independent review.

Do not change payout, mint, settlement, ownership or account authority as part of an unrelated contribution. Never copy private questions, answer keys, tokens or seed phrases into public files. Issued grading keys are immutable; question corrections need their documented review process and new identities. Report vulnerabilities privately under SECURITY.md.
