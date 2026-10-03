# Economy and Power-up Foundation

Version: 1.0 · Founder authorized this foundation on October 2, 2026 (Detroit time).

## Release boundary

`/economy/` restores the named power-up plan, planned treasury accounts, a fee-allocation example, and a private planning journal. `GET /api/session/?service=economy` is a public catalog/status view; session-bound `POST {"action":"ledger"}` reads only the resolved player's journal. Every other POST action is rejected. No new Vercel function is needed.

**This economy foundation cannot purchase or consume a paid item, fund a wallet, credit a real GEEK balance, transfer tokens, settle a payout, or confirm a burn.** It does not convert Alpha credits. The existing fair-mint interface remains a separate, explicit wallet-approved operation. No existing game or contribution path writes this journal yet.

## Restored lineup

| Item | Proposed effect | Rules still required |
| --- | --- | --- |
| 50/50 | Remove two incorrect choices | Eligible modes, timing, limits and scoring |
| Ask the Fandom | Show aggregate player answers | Real data, sample thresholds and privacy; never fabricate a poll |
| Extra Time | Add question time | Time allowance, modes and limits |
| Skip Question | Move past a question | Scoring and reward treatment |
| Safety Net | A second chance | Protected event, limits and eligibility |
| Double GEEK opportunity | An eligible reward opportunity | Exact effect, budget and eligibility; no guaranteed reward |

The first three names appear in earlier planning; the later power-up plan adds the remaining three. None has a finalized price. The shared catalog exposes `priceRaw: null`, `purchasesEnabled: false`, and `usageEnabled: false`. Free assisted practice at `/practice/` separately provides one 50/50 and one 10-second Extra Time use per 10-question session. These trial uses cannot be purchased, withdrawn, or carried into ranked modes. They do not create inventory balances, fees, journal transactions, XP, or game credits. No score or certification can be bought. Paid assists must have explicit scoring rules and separate assisted eligibility before implementation; existing ranked boards, periodic challenges, and Study are not changed by this foundation.

## Treasury accounts and reserve verification

Restore Reward Reserve, Creator Reward Pool, Tournament Pool, Operations Treasury, Burn Pending, Burn Confirmed, Withdrawal Hot Wallet, and Emergency Reserve. They are categories, not evidence of funds or eight existing wallets.

Optional `GEEK_REWARD_RESERVE_ADDRESS` is a public Kaspa mainnet receiving address. The status reports whether its format is configured, absent, or invalid. The API does not expose the address, claim an indexed balance, or enable signing. A valid address is not proof of ownership or funding. Never put a private key or seed in this setting.

Before reserve activation: identify the founder's public reserve address; verify the canonical GEEK deployment and actual reserve balance through primary chain/indexer evidence; establish authority, budgets, limited signing, monitoring, recovery and independent exact-release review. The separate Geek Wallet planning material describes a watch-only prototype, which is not an implemented payout signer.

## Every transaction and 70/30

The original Master Document and Litepaper specify all **platform fees**, not the 144-billion supply. Every future fee-bearing purchase, paid entry or marketplace transaction must have one authoritative receipt stating gross amount and eligible fee portion. Payouts must also have receipts and an explicit fee policy, including zero when no platform fee applies. The scope and fee amount for each transaction type must be finalized before charging anyone; no implicit percentage of the entire transfer is introduced.

Accounting uses canonical integer strings at the pinned deployment's eight decimals, never floating-point money. Per-transaction amounts cannot exceed the pinned maximum supply. Recycle pending is `floor(feeRaw * 70 / 100)`; burn pending is the remainder. The two always equal the fee exactly. The example calculator makes no API write and is not a price quote.

## Journal and concurrency

`server/economy-ledger.js` accepts trusted server integrations only. Supported planning kinds are power-up purchase, game entry, marketplace fee, player reward payout and creator payout. No HTTP action records them.

A versioned `geek:economy:v1:<resolved-player-id>` record holds a maximum of 250 ordered planning receipts, cumulative allocations, and a SHA-256 receipt chain. Each stable reference can be committed once; an identical retry returns its original receipt and timestamp. Reusing a reference with different terms fails. Cross-player entries are isolated; recovery resolves the same player key. No browser-supplied player ID is authoritative.

A one-key Redis Lua compare-and-set commits the next complete record only when the previously read bytes still match. Token arithmetic and validation happen with BigInt before the write; Lua does no money arithmetic or JSON number conversion. CAS retries are bounded. A lost commit response can be safely retried with the same reference. Invalid versions, inconsistent totals, altered receipts or broken hashes fail closed without resetting state. There is no journal expiry or silent pruning of idempotency references. A journal at capacity needs a reviewed archival design before new records can be added. The API returns only the latest 20 receipts and cumulative planned allocations.

This is an isolated **planning journal**, not a double-entry financial ledger or verified payment evidence. Its hash chain detects accidental modification/inconsistent state; a party controlling Redis can recompute it. Independent append-only evidence, treasury-level reconciliation, canonical settlement-proof validation, refunds/reversals, pending/available/reserved/settled balance transitions, retention/archival, and production-equivalent Redis fault testing remain work before monetary activation. No external Redis integration test or independent audit is claimed by this release.

## Evidence and next work

`tests/economy.test.js` covers denomination pinning, exact arithmetic and rounding, every planning kind, idempotency conflicts, corruption, capacity, concurrent CAS, lost responses, private reads, resolved identity, and disabled HTTP writes using isolated Redis command mocks. Browser QA covers public discovery, catalog, examples, empty private journal and independent error recovery.

Next: verify the reserve; finish fee, price and gameplay rules; build payment verification, inventory and atomic consumption; implement budgeted payout and burn settlement with receipts and reconciliation; complete independent review before activation. Larger Arena, DAO and launchpad expansion remains paused.
