# Geek Protocol Technical Overview

**Document:** GEEK-TECH-001 · **Version:** 0.1 · **Status:** Founder review draft — not adopted

**Source baseline:** HQ commit `b7521c6db2087d0c40580afa443104f33f4cd212` (November 16, 2026 snapshot). This draft distinguishes recorded implementation from proposed requirements. It does not revise the published whitepaper or activate a release gate.

## Purpose and scope

Geek Protocol HQ connects learning content, attempts and accepted results. Public Alpha combines guided Study, Quiz Quest, timed quizzes, social play, progress and browser-local strategy games. Kaspa provides the network for GEEK token operations; the application remains responsible for scoring and account state.

HQ is the canonical application described here. Earlier Next.js/Fastify Alpha plans and independently deployed Geek Jr or Geek Mini components must not be substituted for HQ's deployed architecture.

## Components and authority

| Component | Responsibility | Boundary |
| --- | --- | --- |
| Static web pages and browser clients | Present lessons, questions, controls and saved local games | Browser claims cannot authorize ranked scores or payments |
| Vercel Functions | Authenticate, validate and apply trusted application transitions | Function access does not grant authority over a user's wallet |
| Upstash Redis | Hold sessions, attempts, progress, replay controls and Alpha records | A database balance is not an on-chain balance |
| User's compatible wallet | Present and sign explicitly approved wallet operations | Connecting or unlocking a wallet is not automatic Geek authentication |
| Kaspa and matching token indexer | Carry transactions and report interpreted token operations | Indexer observations cannot authenticate a player or grade an answer |
| Isolated payout worker design | Journal and reconcile a potential future treasury transfer | Public Mainnet settlement remains disabled |

## Assessed activity flow

A timed run begins with the server resolving a player and eligible content. The server selects and shuffles a question and issues a bounded attempt token with its deadline. The client submits a selected option. An atomic transition checks the saved attempt, authority, deadline and prior answer, then records the accepted result and permitted progress.

Retries recover the prior accepted transition. A client timeout is ambiguous: the transition may have committed before the response was lost. Reconciliation must precede another value-bearing action. A missing trusted data service must not silently turn server-authoritative competition into browser scoring.

A useful result model binds player, activity, content version, attempt, accepted choice, server time, rules version and outcome. This is an explanatory model, not a declaration that every current API exports one universal receipt schema.

## Identity and wallet boundary

Passkey account access, wallet-based proof and a saved receiving address serve different purposes. A typed Kaspa address identifies a proposed destination; it is not proof of ownership. Sensitive receiving-address changes use the account confirmation flow. HQ does not request seed phrases or private keys.

Mainnet and Testnet destinations must remain distinct. Indexer data can support a mint status check, but cannot replace a wallet signature, account proof or accepted game result.

## Distinct game and content models

Study and Quest use their own progress rules and do not inherit ranked rewards. Friend rooms and local games have separate authority models. The A.C.E. Arena uses local algorithms and browser storage, with legal action journals replayed through game engines. Its wins and milestones are mutable personal practice records, without account sync, ranked verification or token entitlement.

Public teaching content is intentionally inspectable. Historically public quiz content must be treated as exposed even when normal API responses omit answer keys. Private ranked storage and season integration require their own acceptance; the current public loader cannot satisfy the private payout proof gate.

## Release and recovery requirements

Before broader trust claims, a release needs exact commit evidence, deployment verification, account and failure-path tests, isolated restoration and independent review appropriate to its risk. A Git clone recovers committed source; provider data, secrets, domains and external releases need separate recovery procedures.

Future settlement additionally requires funding, signer isolation, bounded exposure, journal recovery, reconciliation and explicit activation. This document records those boundaries and does not authorize enabling them.

## Evidence and document control

- [Published whitepaper](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/WHITEPAPER.md)
- [Architecture and trust boundaries](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/ARCHITECTURE.md)
- [Account controls](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/HOME-ACCOUNT-WALLET.md)
- [A.C.E. practice continuity](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/ARCADE-300.md)
- [Private payout proof gate](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/MAINNET-GEEK-PAYOUT.md)

Revision 0.1: initial review draft. Approval, effective date and publication location remain unassigned. Reconcile this document with the source candidate and founder decisions before adopting version 1.0.
