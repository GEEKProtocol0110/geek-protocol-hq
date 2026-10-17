# Performance baseline — October 17, 2026

PERF-001 has a reproducible local baseline in [the recorded JSON](performance/2026-10-17-readiness.json). Run `npm run performance:baseline`; add `-- --redis` with Redis available for the mixed workload. The command accepts no remote target and creates isolated temporary fixtures. No production traffic, player data, database settings, hosting plan or provider region changed.

Study previously rebuilt its reviewed array repeatedly for catalog/progress calls. The deployed-revision lesson catalog and reviewed bank are now memoized per process; player progress and API responses remain uncached/no-store. New deployments rebuild the memoized content. The measured warm catalog p95 went from about 1.92 ms to below 0.001 ms; empty progress p95 from 1.62 ms to 0.35 ms (200 local samples each). These CPU timings are not page-load or network-speed measurements.

| Synthetic question pool | Cold JSON load | Selection p50 / p95 | Process RSS |
| --- | --- | --- | --- |
| 10,000 | 58.0 ms | 3.46 / 8.00 ms | 183 MiB |
| 100,000 | 639.5 ms | 50.58 / 59.55 ms | 518 MiB |

Growth fixtures contain repeated source-shaped records with distinct synthetic IDs/prompts, not new reviewed content. Each measured reader is a fresh process, excluding fixture construction. RSS includes the Node process, imported modules, parsed records, maps and selection allocations, and is not a steady-state production heap guarantee. Twenty selection samples per size cover the real selector across difficulty tiers; real editorial variation, published community pools, long exclusion lists and other bank shapes can behave differently.

The real-Redis loopback workload used 24 synthetic players concurrently: eight Study practices, eight complete Daily rounds, and two four-player Royale lobbies joined/readied/started/viewed. **162 requests, zero returned errors, 1,442 Redis commands and about 1.54 MiB Redis memory.** Examples: Daily-answer p50/p95 15.42/38.27 ms; Study-progress 24.48/30.81 ms; Royale-view 13.74/16.88 ms. This small run does not measure saturation, a full timed Royale, mobile rendering, internet latency, serverless scaling or production capacity.

The measured 100,000-row load/memory growth supports evaluating a compact category/difficulty/concept index and lazy retired-key lookup before that scale. It does not establish that the current 8,229 active records need a database/hosting migration now. Versioned public assets, durable idempotent workers and provider-near placement remain staged proposals requiring measurements and a rollout/rollback design. Private sessions, progress and receipts must keep no-store and exactly-once effect boundaries.

Existing native Redis recovery tests are rerun with the candidate: snapshot/restore into another loopback instance, invalidate restored bearer proofs, then fresh-passkey recovery of the same durable player. That is internal recovery evidence. Owner MFA, provider retention, an isolated provider restore, measured production RTO/RPO and an independently controlled source restore remain unverified. Model latency/cost metrics await the separately configured A.C.E. pilot.
