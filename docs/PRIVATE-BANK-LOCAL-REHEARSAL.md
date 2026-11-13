# Private bank: current HQ integration and local rehearsal

SEC-010, November 13, 2026. Source candidate only; no production cutover.

## Reviewed inputs

- Held assembly plus approved start guard: `73f80ce5372b87d1b82027463678c1d9b70adddf` (#284 merged into #231's branch).
- Current HQ: `dbdb7f04b840d6ef14fc792448692d5bb656a4b7` (#283).

The integration preserves both histories. Current site pages, mint history, game/notification features, dependencies and mainnet signer controls remain. Private bank selection, immutable versions, deferred feedback, monthly seasons, the pre-start guard, namespaced ranked state, Preview refusal and legacy grading also remain. A draft against the held assembly is the review destination; merging to main is not authorized by this rehearsal.

## Payout reconciliation

Keep season-aware score recording instead of replacing it with a Season 0 board write. Combine the 22-key ranked/payout transaction with the ranked environment guard and namespaced run keys. Apply both per-player harvesting and network-address start limits; changing User-Agent does not reset the latter.

Mainnet admission now additionally refuses an unranked, public-bank, missing-version or Season 0 result. Synthetic payout tests supply a fake private bank. A qualifying private-run control proves that the negative eligibility checks are effective, rather than passing because an address or reward is missing. Preview still rejects ranked starts before issuing a question; its positive production tests run only against disposable mocked infrastructure. No external payout flag or secret changed.

## Run the local rehearsal

Install the root dependencies from the lockfile, provide a local redis-server executable on PATH (or through REDIS_SERVER_BIN), then run:

```sh
npm run private-bank:rehearse
```

The runner creates a child process with only PATH, REDIS_SERVER_BIN and optional TMPDIR inherited. It does not inherit Vercel environment labels, database endpoints/tokens, private bank paths or credentials, signer keys, payout flags, or NODE_OPTIONS. Every API test uses fresh loopback-only Redis with persistence disabled and temporary fake banks; fetch mocks refuse unexpected endpoints. The tests close their Redis processes and clean up temporary fixtures. This is an API rehearsal, not a deployed or browser/device trial. Never relabel a hosted Preview as production or remove its write guard to make it playable.

The rehearsal covers pre-start refusal, round completion and resume/retry, deferred feedback, bank rotation and mismatches, preserved historical seasons, loader failures, error redaction and leak scanning. It does not certify bot resistance, production performance or real-bank editorial quality.

## Public asset and logging reconciliation

The leak checker still rejects served/static opaque-file allowlist entries and unknown public archives. One code-reviewed compatibility exception recognizes the exact already-published brand-kit ZIP by path and SHA-256. Its reviewed members are only the published logo PNG, share PNG and public README. Tests reject changed bytes, a different path and substituted contents. A changed archive requires another explicit code/test review. No private questions or credential values were inspected.

Unknown API errors retain the current structured classification while restricting name/code characters and length. Raw messages, paths, stacks, bank content and error objects remain excluded. Both prior confidentiality regressions and current API-error tests are retained.

## Remaining gates

The immutable real-bank artifact and author/fact-check/founder approval, category/tier capacity, repository/workflow enforcement, independent abuse review, and a bounded hosted rehearsal remain unaccepted. The local run does not close those gates. CCE, collection ownership, withdrawals and production reward controls remain held. Keep this integration draft until reviewed; do not merge #231 into main or activate ranked rewards from these results.

## Verification result

The isolated local rehearsal passed 105 tests. Full combined npm run verify passed 1077 application tests plus 9 testnet and 5 mainnet offline signer checks, with zero failures/skips and all supporting checks. Dependencies were installed from the integrated lockfile with lifecycle scripts disabled. Physical-device, browser, hosted-isolation and real-bank acceptance are not established by these runs.
