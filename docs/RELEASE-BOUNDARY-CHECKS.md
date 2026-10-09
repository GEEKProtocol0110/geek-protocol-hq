# Public answers and settlement release checks

These checks strengthen the existing Alpha boundaries. They are internal regression evidence, not an independent audit or production acceptance result.

## Public deployment artifact

`npm run security:check` runs `scripts/public-answer-check.mjs` before the existing security evidence checks. `npm run verify` and the pull-request workflow both invoke that command. The scanner reads the static `outputDirectory` from `vercel.json`; currently this is `public`, with no client build step. If a future build generates another directory, run the check after the build against that configured output.

The scanner indexes all checked-in active and retired `server/questions/*.json` banks and recursively examines every public file. It rejects:

- known private question identifiers, including Unicode/hex escapes;
- known bank filenames and references to the private bank directory;
- literal graded records containing a known private prompt, `options` and a numeric `correctIndex`, even with their IDs removed;
- those records inside escaped source-map content or JSON string wrappers;
- the same content in gzip or Brotli assets (gzip magic bytes are checked even after renaming);
- symlinks, unsupported file types, unreadable or invalid compressed assets, oversized assets, and missing or empty output.

Each file and decompressed output is limited to 32 MiB. Diagnostics report paths and reason codes rather than answer text. Synthetic regression fixtures cover renaming, minification, retired rows, removed IDs, escaping, source maps, compression, and invalid output.

Public teaching material is intentional. Quest checks use public `choices` and teaching answers; lessons can contain answer words. A playable question must also display every answer option. The check therefore does not ban answer strings generally.

This is a known-content guard, not a JavaScript parser or a proof of confidentiality. It cannot detect arbitrary computed/obfuscated records, encrypted or differently encoded content, renamed grading schemas with removed IDs, arbitrary archive formats, dynamically published community banks, or external/CDN artifacts. It also does not make banks in a public source repository secret. Protecting deployed assets and restricting API disclosure are useful controls, but repository visibility and competitive anti-cheat remain separate review questions.

## API disclosure transitions

`tests/release-boundaries.test.js` invokes shipped API handlers against isolated real Redis with synthetic players and records. It checks:

- Gauntlet, Daily and Speed in all eight categories return the current prompt/options without its grade, private bank IDs or future prompts.
- Forged question tokens and another player's run do not reveal answers. A committed answer returns its own teaching receipt; retries preserve that receipt even when supplied answer fields change. The next question remains ungraded.
- Royale does not reveal correctness when one or all players have answered, including refresh. It reveals the expired question after the shared deadline while withholding the future pack and player session IDs.

Existing mode-specific tests continue to cover Study, practice, Quest, Duel and other game transitions. These tests do not claim that all possible API states or concurrency schedules have been exhausted.

## Settlement stays disabled

The same suite verifies actual responses and stored state rather than relying on export names or comments. A synthetically configured reserve and `GEEK_SETTLEMENT_ENABLED=true` cannot activate economy purchases, payouts, burns, transfers or signing. Saving a valid payout destination and approving its risk review leave withdrawals and settlement eligibility disabled. Client-supplied enable flags cannot change those decisions.

Rejected economy transfer, withdrawal, redemption, settlement, purchase, payout, burn and ledger-write requests preserve the saved profile, planning journal, review and session bytes. Rate-limit metadata may change. The journal remains planning-only; it is not a spendable token balance.

Minting is a separate, user-approved operation. The mint API exposes the exact KRC-20 `mint` inscription and non-custodial wallet guidance, and rejects transaction mutations before contacting an indexer. It does not execute transfers or sign transactions. Indexer reads are mocked and all other external requests are denied in the suite.

Run locally with Redis available:

```sh
node --test tests/public-answer-check.test.js tests/release-boundaries.test.js
npm run verify
npm audit --omit=dev --audit-level=high
```

Treasury execution, signing, withdrawals and spendable rewards still require their separately documented architecture and independent review gates. None are enabled by this change.
