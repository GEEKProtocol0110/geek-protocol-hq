# Automatic GEEKT test rewards — CHAIN-004

The founder requested automatic rewards on October 18 after completing the first real manual payout. This supersedes the manual-only product direction for the next **testnet** release. The earlier manual transfer remains valid evidence; it does not establish acceptance of this automatic service.

## Flow and boundaries

1. An owner with payout permission enrolls the current HQ player and a checksum-valid TN10 recipient at `/ops/testnet/`. This is a one-time test enrollment, not a public faucet or a new identity proof. Existing payments keep their original destination when enrollment changes.
2. The enrolled player completes a source-checked five-question Kaspa Daily with at least one correct answer and chooses **Finish & save result**. The server validates the result and atomically saves both the finished run and a durable reward job in Redis. No five-minute return to Operations is needed.
3. A dedicated service claims one unresolved job under a sender-wide lease. It checks the pinned deployment and a synced TN10 RPC, derives its own sender, verifies funding, and constructs/signs an ordinary KRC-20 P2SH commit/reveal pair with the official Kasplex SDK.
4. Both signed transactions and IDs are saved immutably in HQ **before** either is broadcast. A missing acknowledgement stops the worker; a restart reads the stored pair. Repeated submission uses exactly those same signed bytes, so it cannot construct a second payment. Transaction signatures are private stored payment evidence, not player credentials.
5. The service checks the existing exact transfer validator until the fixed reveal hash is indexed and accepted. Player status and the automatic section in Operations show queued, prepared/awaiting-indexer or indexed-confirmed. No copy/paste of amounts or hashes is required.

The dedicated sender must differ from the manual sender. The shared persistent per-run lock prevents one result from entering both payment paths. One recipient per UTC day, a default ten-job global daily limit (maximum 100), and a 100-job retained capacity bound this owner-controlled test. Daily eligibility still applies. Capacity or budget exhaustion saves learning without promising a payment; operator review is required before expanding retention. Run, recipient-day and payment locks have no TTL. Do not delete them to retry a payment.

HQ has no signing private key. The separate worker receives no HQ database, owner or player credentials. A narrowly scoped bearer token grants access to the testnet worker protocol; browser cookies/Origin are rejected. The signer key belongs only to the separate service. Neither service accepts Mainnet configuration. Mainnet GEEK payouts, Alpha-credit conversion, CCE and collectible ownership remain disabled.

## Deployment configuration

HQ retains its existing public `TESTNET_REWARDS_*` asset pin and adds:

| HQ variable | Meaning |
| --- | --- |
| `TESTNET_AUTO_ENABLED` | Explicit `true` enables new automatic admission and worker transitions; absent/false pauses both |
| `TESTNET_AUTO_SENDER` | Dedicated checksum-valid TN10 signer address, different from the manual sender |
| `TESTNET_AUTO_DAILY_LIMIT` | Canonical integer 1–100; defaults to 10 jobs per UTC day |
| `TESTNET_AUTO_WORKER_TOKEN` | New 32-byte random hex bearer secret, shared only with the dedicated worker |

Deploy a **separate Vercel project**, linked to this repository with root directory `workers/testnet`, Node 24, no framework. Its checked-in `vercel.json` invokes `/api/tick` once per minute in production. No laptop or phone must remain open. Vercel Cron runs only production deployments; Pro supports one-minute scheduling. [Official quickstart](https://vercel.com/docs/cron-jobs/quickstart), [limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

| Separate signer-service variable | Meaning |
| --- | --- |
| `TESTNET_SIGNER_ENABLED` | Explicit `true` allows scheduled processing; false pauses the signer |
| `TESTNET_SIGNER_PRIVATE_KEY` | Dedicated testnet-only private key, stored as a Production secret in this service only |
| `TESTNET_AUTO_WORKER_TOKEN` | Same scoped worker bearer secret as HQ, Production secret |
| `CRON_SECRET` | Different new 32-byte random hex Production secret; cron request authentication |
| `HQ_REWARD_ORIGIN` | Optional canonical HQ origin; defaults to `https://www.geekprotocol.xyz` |

The service needs GEEKT tokens and test KAS at its own public sender address. It deliberately does not borrow the founder's Kasware keys. Preserve independent recovery under owner control before substantial funding; creating a provider secret is not an independently demonstrated backup. An expendable testnet signer is not a Mainnet custody design. Never paste a seed or existing wallet key into chat, HQ, Git, exports or logs.

Alternative self-hosted command: install with `npm ci --prefix workers/testnet --ignore-scripts`, supply the service environment through the host's secret facility, and run `npm --prefix workers/testnet start` (or `node workers/testnet/worker.mjs --once`). Do not run two independently funded signers for one configured sender. The lease and immutable journals nevertheless protect overlapping scheduled invocations.

Pausing the service or HQ preserves jobs. A rejected/mismatched operation stalls that payment for investigation; the worker never drops it to make a replacement. One unresolved payment blocks later jobs so a shared sender cannot race its token balance or UTXOs. After configuration changes, unresolved jobs under an older fingerprint need explicit reconciliation. `indexed-confirmed` is the last accepted indexer observation, not independent chain finality. The scheduled worker skips accepted jobs; a later reorg requires separate reconciliation of that same hash.

## Verification and acceptance

The app suite uses real Redis for atomic admission, duplicate finish, lost reply, expiry, private enrollment, stale leases, immutable preparation, restart recovery, exact acceptance, owner-only enrollment, per-recipient/day and daily budget cases. Worker orchestration fixtures perform no transaction. The separate signer suite constructs real signed transactions **offline** with synthetic keys/UTXOs, checks exact inscription/output linkage, bounded fees and journal rehydration, verifies the standard commit signature natively, and checks reveal signature framing and its exact redeem script. The generic native signature helper does not validate P2SH reveals; real-node reveal acceptance remains unproved until an actual automatic payout is recorded.

Run `npm ci --ignore-scripts`, `npm ci --prefix workers/testnet --ignore-scripts`, then `npm run verify`. CI also installs/audits the isolated worker lockfile and executes the signer tests. This does not replace device, scheduled-provider, funding, actual automatic transfer or independent review evidence. Exact release and activation facts belong in the continuation worklog.
