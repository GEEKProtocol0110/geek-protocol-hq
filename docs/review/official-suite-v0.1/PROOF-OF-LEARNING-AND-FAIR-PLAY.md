# Proof of Learning and Fair Play Standard

**Document:** GEEK-POL-001 · **Version:** 0.1 · **Status:** Founder review draft — not adopted

**Source baseline:** HQ commit `b7521c6db2087d0c40580afa443104f33f4cd212` (November 16, 2026 snapshot). This draft distinguishes recorded implementation from proposed requirements. It does not revise the published whitepaper or activate a release gate.

## What a result means

Proof of Learning is Geek Protocol's application method for connecting an activity to its content, rules and accepted result. It can show participation and performance under stated conditions. It cannot by itself establish lasting mastery, independent work, identity as one unique human, an educational credential or improved intelligence. It is separate from Kaspa's Proof of Work.

This proposed standard makes three questions explicit: did the application accept the result, can the scoring context be recovered, and did the assessment measure a defensible learning objective?

## Separate activity classes

| Activity | Appropriate interpretation |
| --- | --- |
| Authored lesson or Study feedback | A concept interaction and explanation |
| Quest badge | Completion of the stated chapter rules |
| Timed quiz | Server-accepted performance under a defined deadline |
| Shared practice room | Performance within that room's rules |
| Browser-local A.C.E. result | Personal practice history on that browser |
| Future qualified assessment | A separate supervised or otherwise validated process, if approved |

Practice and competitive results should be labeled where a player chooses a mode and where results are shown. Assistance rules must be visible before a result is treated as comparable. Local storage and screenshots are supporting evidence, not trusted substitutes for a server record.

## Proposed assessment acceptance criteria

Each reviewed question should have one clear objective, one defensible correct answer, plausible alternatives, an original explanation, specific primary evidence, provenance and a dated review disposition. A separate fact-checker should check the actual answer and explanation. Automated similarity or source checks do not replace that judgment.

Review should screen semantic duplicates, answer clues, ambiguity, changing facts and category fit. Two paraphrases of one fact count as one concept for capacity. Corrected material receives a new question identity; retired items leave new selection while historical keys remain available for already-issued grading.

## Server integrity and retries

Recorded timed transitions use server-selected content, bounded tokens, trusted deadlines and atomic state changes. The browser must not choose its score, credit balance or accepted finish time. Repeated submissions must preserve the original accepted outcome rather than earn it again.

Content version and scoring context must survive an investigation. A run with missing or incompatible evidence should not be promoted into a higher trust category. Connection problems require a saved-state check before a retry is interpreted as a new attempt.

## Competitive secrecy and abuse

An answer key omitted from a game response is only one protection. Previously public content remains exposed. The private ranked proposal needs restricted artifacts, version binding, live season rules, delayed reveal, rotation, leak handling and end-to-end acceptance before a secrecy claim is appropriate.

Open quizzes remain vulnerable to web search, answer sharing, automation and coordinated harvesting. Passkeys do not prove one person per account. A private hash alone does not prove the bank was confidential, reviewed or eligible.

The existing Mainnet admission control rejects public/legacy and Season 0 results and requires saved private-bank context. It is one fail-closed boundary, not evidence that private ranked cutover or settlement is complete.

## Proposed reporting and correction process

A public report should identify mode, question reference if displayed, approximate time and the disputed wording, without posting a full protected bank. Account recovery material and private player identifiers should stay out of public issues.

Maintainers should reproduce the issue against the relevant version, distinguish content error from scoring failure, record the disposition and retire defective material from new selection. Any compensation or score correction needs a separately authorized policy; this draft creates none.

Adoption requires an assigned review owner, a defined appeal route, rules for assistance and invalidation, and proof that the implemented mode matches the published standard.

## Evidence and document control

- [Proof of Learning model](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/WHITEPAPER.md)
- [Content review requirements](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/QUESTION-BANK-AUDIT-2026-10-27.md)
- [Private bank review design](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/PRIVATE-BANK-REVIEW.md)
- [Mainnet admission boundary](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/MAINNET-GEEK-PAYOUT.md)
- [Maintained holds and decisions](https://github.com/GEEKProtocol0110/geek-protocol-hq/blob/b7521c6db2087d0c40580afa443104f33f4cd212/docs/continuity/decisions.json)

Revision 0.1: initial review draft. Approval, effective date and publication location remain unassigned. Reconcile this document with the source candidate and founder decisions before adopting version 1.0.
