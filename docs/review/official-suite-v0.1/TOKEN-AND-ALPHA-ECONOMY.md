# GEEK Token and Alpha Economy

**Document:** GEEK-ECON-001 · **Version:** 0.1 · **Status:** Founder review draft — not adopted

**Source baseline:** HQ commit `b7521c6db2087d0c40580afa443104f33f4cd212` (November 16, 2026 snapshot). This draft distinguishes recorded implementation from proposed requirements. It does not revise the published whitepaper or activate a release gate.

## Two separate systems

GEEK is a KRC-20 token on Kaspa Mainnet. Career XP, scores, cosmetic progress and Alpha credits are application records. Alpha credits are nonwithdrawable and have no automatic conversion into GEEK. A saved receiving address, a completed quiz or a testnet transfer does not create a payable Mainnet claim.

## Fixed deployment specification

| Parameter | Pinned value |
| --- | --- |
| Network / standard | Kaspa Mainnet / KRC-20 |
| Ticker | GEEK |
| Maximum supply | 144,000,000,000 GEEK |
| Decimals | 8 |
| Premint | 0 |
| Limit per mint operation | 100,000 GEEK |
| Deployment hash | `c3cea245b394374b6d80d9fa82269967b56bd5d128a4db3152087a05e014d0b1` |

The matching deployer is `kaspa:qzj0e55rlxpm0knvra9wvgckpkyq9h8hv8wl0lh2ngjad9a4cedmj24cy07ew`. The maximum is 14,400,000,000,000,000,000 smallest units; the mint limit is 10,000,000,000,000 smallest units.

These constants identify the deployment. They do not state current circulating supply, available mints, price, treasury balance or distribution. Those require fresh matching evidence. Zero premint is not a claim about later concentration.

The mint amount is not a guaranteed KAS exchange rate. Wallet charges and network or protocol fees must be presented separately for an actual request. HQ does not take the user's signing keys.

## Current operating boundary

Public treasury settlement and withdrawals remain disabled. The current public quiz loader does not provide eligible private-bank and live-season proof. Merely changing an environment flag cannot turn those public results into payable jobs.

GEEKT on Testnet-10 is a separate pilot asset. A successful pilot payment tests a bounded path; it does not enable Mainnet, establish a funded reserve or promise the same result to a public user.

## Later schedule recorded in source, still disabled

The maintained Mainnet design is newer than the whitepaper's earlier 100-GEEK-per-round planning example. Its currently recorded disabled schedule is:

| Eligible event in the future design | Amount |
| --- | --- |
| Finished five-question Daily with at least one correct | 100 GEEK once per player per UTC day |
| Finished Gauntlet round | Server-graded correct count multiplied by that round's per-answer reward |
| Speed mode | No payment |

Round 1–10 per-answer amounts are 10, 20, 40, 80, 150, 280, 450, 700, 1,100 and 1,800 GEEK. A perfect Gauntlet totals 46,300 GEEK. Temporary design caps are 100,000 globally and 46,400 per player and receiving address per UTC day, applied together.

This table describes disabled source policy, not an offer or an activation. Private-bank acceptance, funding, independent review, protected reconciliation and a separate authorized release remain necessary. Cap exhaustion preserves the learning result without creating a payment. Contributor rates remain unselected.

## Fees, reserves and burns

The proposed 70/30 allocation applies only to an explicitly identified eligible platform fee. It is not a split of maximum supply or automatically of the transaction's gross value. For fee F in smallest units, reward funding planned is floor(7F/10), and burn pending is the remainder. A 10 GEEK eligible fee yields 7 planned for rewards and 3 pending burn.

A pending allocation is not a confirmed transfer or burn. A reserve address is not proof of funding. Before payment activation, admitted liabilities and fees must fit a verified budget with limits, pause controls and recoverable journals.

## Future changes

KCC-20 migration, creator payments, paid assists, collectible ownership and DAO authority remain separate proposals or held work. Token ownership does not currently grant HQ voting or treasury execution rights. No draft, score or marketing statement replaces approved terms and the relevant technical gates.

## Evidence and document control

- [Pinned deployment](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/server/geek-deployment.js)
- [Economy accounting proposal](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/ECONOMY-PROTOCOL.md)
- [Current disabled schedule and proof gate](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/MAINNET-GEEK-PAYOUT.md)
- [Superseding reward decisions](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/continuity/decisions.json)
- [Published whitepaper](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/WHITEPAPER.md)

Revision 0.1: initial review draft. Approval, effective date and publication location remain unassigned. Reconcile this document with the source candidate and founder decisions before adopting version 1.0.
