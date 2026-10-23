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

## Released HQ checkpoint — PR #153

PR #153 merged October 18 at 08:03:24 UTC as eff74c91972aff5bf962237b4aa1104938d75a5e. Exact head 3605e65edbe85607a7e3f189e4b627493fca3cce/tree 66283763efa1619e304bd874fc45ae7ab751f701 matches local 1f3dce63382d1d83ebbb0f7cfa567386bbf80c3d. CI 39109899250 passed; no submitted reviews/threads. Full verify passed 594 HQ tests plus four separate offline SDK tests, zero failures/skips, real Redis 7.0.15, 311 security assertions and supporting checks. Worker dependency audit: zero vulnerabilities. Preview dpl_kVpn59DxerfjGUtuLKeL1ZZkt8Ck READY; HTTP Play and worker GET/405 verified, player-status fetch was blocked by the preview authentication helper. Production dpl_JD8HQ2oF3bDZimGa8YT2aY4mEAnw READY on the exact merge with both canonical domains assigned. Six canonical checks passed under 15-second limits: Play HTML, exact status-client bytes, private player 401, unauthorized worker POST 401, private owner-auto 401 and Testnet desk 303. Initial unsuffixed API probes returned expected platform 308 redirects; corrected canonical paths passed. Follow-up fixes the isolated worker to use /api/session/ directly because its HTTP client rejects redirects. Error-level deployment samples were Node DEP0169 url.parse deprecation warnings. No rendered-device/automatic-transfer acceptance is claimed. Vercel denied creation of geek-geekt-testnet-worker in the existing team with 403 forbidden/no project-create permission; no CLI or CLI credentials are available. No signer wallet, production signing secret, new environment value, funded worker or actual automatic payment was created. Automatic admission remains off; manual proof stays complete, Mainnet/CCE/ownership holds unchanged.

The worker source follow-up uses the canonical trailing-slash HQ API URL directly and adds a transport regression test. Automatic service provisioning remains blocked independently of that code correction. Owner setup: [import the existing repository on Vercel](https://vercel.com/new), choose project `geek-geekt-testnet-worker`, set Root Directory to `workers/testnet`, Framework to Other/none and Node to 24. Initial deployment has no signer secret and cannot send. After project creation, provision the separate Production secrets described above; existing wallet credentials are unnecessary.

### Canonical transport released — PR #154

PR #154 merged October 18 at 08:07:48 UTC as 1f15c3e7a7ebfe84c8060e0351391681fbdca5cf. Exact head 828b493d2ca68369def5ba6841557329ca81f890/tree a258d121278ea89858503fc0eb7c11e8bc4a3800 matches local 270c8e1aa1845687de48c5f943e48b2992033ec8. CI 39110190459 passed; no submitted reviews/threads. Full verification passed 595 HQ tests plus four offline SDK tests, zero failures/skips, real Redis and all supporting checks. Production dpl_2bnMXoN68cGkX2BkaxnXTC1AsXRh READY on the exact merge. Four canonical no-redirect checks passed under 15-second bounds: exact player-status script, private player 401, unauthorized worker POST 401 and private owner-auto 401. The correction targets /api/session/ directly. HQ contains the released source/UI, but the separate signing service remains unprovisioned after Vercel project creation returned 403; no signer key/wallet, production environment mutation, funded sender or automatic payout was created. CHAIN-004 is blocked on owner/provider project creation, then secret provisioning, test funding and actual automated acceptance. Prior manual payout stays complete; no Mainnet/CCE/ownership activation.

## Player status recovery — CHAIN-005

The player status client uses the canonical `/api/rewards/` URL and one private, no-store read at a time, with a ten-second request deadline and a fifteen-second polling interval. Temporary network, HTTP and timeout failures retain polling. Enrolled and confirmed views keep checking for later jobs; a saved-run event during an older read schedules a fresh read after it completes. These reads do not enroll a player, create a receipt or send a transaction.

Queued/prepared payments say they are saved and paused when HQ automatic processing is disabled. An observed indexed confirmation remains visible even during a pause. This reports HQ configuration and saved observations; it does not establish that the separate signer is provisioned, healthy or funded. Lost authorization or missing enrollment clears earlier status. Backgrounding, page exit and a player sign-in invalidate pending replies, and each timeout aborts only its own request. Foreground/page-cache return reads status again.

Eight synthetic shipped-client tests cover those behaviors, including failed-request recovery, in-flight save events and late replies/deadlines across a player change. Actual-phone rendering, production delivery and automatic transfer acceptance require separate evidence. The CHAIN-004 provider setup blocker remains open.

### October 23 release and activation checkpoint

PR #155 merged October 23, 2026 at 12:21:55 Detroit (16:21:55 UTC) as 1476aa2d1a4469ed1eed30d9c72f94ca50e8bd4f. Final checked head ee1ce12bb3e961e2013d56a4dda29855a14d1810/tree d8d0e4fd94564ba79cd7559ce7e4add355587a0b matches local 4da8aeb3dee54ed73e1172c16afa5f5206a38fa2; the merge has that same tree. Exact-head GitHub Security verification 39964886728 succeeded; no submitted reviews or inline threads were present before merge. Full local verification passed 603 HQ tests plus four offline signer tests, zero failures/skips, real Redis 7.0.15, 311 security assertions and all supporting checks. Production dpl_7FYxuRoLQ6VVpB5PLdnHGqFwaxzk is READY on the exact merge with both canonical domains assigned. Five no-redirect canonical checks passed under 15-second request bounds: exact status-client bytes, Play HTML referencing the client, private player 401, unauthorized worker POST 401 and private owner-auto 401; all protected responses were private/no-store. The earlier protected-preview private-fetch failure remains provider authentication evidence, not application acceptance. Actual-phone status recovery and actual automatic transfer remain unproved. Fresh project search found no geek-geekt-testnet-worker; creation in the existing Vercel team again returned 403 forbidden/no project-create permission. Neither vercel nor vc CLI is installed. No signer project, key, environment value, test funding or automatic payment was created. Mainnet/CCE/ownership holds remain unchanged.

The owner/provider step remains: import the existing repository through https://vercel.com/new in the existing team; use project name `geek-geekt-testnet-worker`, Root Directory `workers/testnet`, Framework Other and Node 24. The unconfigured service cannot process payments; Production secrets, dedicated test funding and a verified automatic transfer follow separately.
