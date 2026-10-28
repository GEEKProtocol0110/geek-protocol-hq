# Question encoding review — October 28, 2026

BANK-009 replaces 77 damaged-text draft identities with source-grounded encoding corrections: the 76 original candidates plus one Polish-name case caught by the broader byte-sequence check. Decoding also exposes one exact History duplicate, which is retired under its surviving corrected concept. Candidate totals become **8,355 active / 864 recorded source checks / 7,491 drafts needing factual review**. Kaspa stays 766, introductory Study 537, and the eight category targets still need 7,136 reviews.

## Evidence and disposition

The server-only register `server/question-audit/encoding-2026-10-28.json` records old/new identities, exact grading hashes, changed fields and publisher line references. Seven raw Git objects, including the CC BY-SA 4.0 license, are pinned to OpenTriviaQA `dcc1cdf36c2985ed5c849d1f2265c5041ffcdfb9`. Their SHA-256, sizes and Git blob hashes were independently checked against upstream tree metadata and native Git objects.

These source files mix encodings. HTTP-decoded text cannot establish their original byte hashes, and a connector blob read rejected a non-UTF-8 legacy byte elsewhere in one file. Native Git supplied the exact bytes. Every targeted stem, option and keyed-answer line decodes as strict UTF-8. Windows-1252 or Latin-1 misdecoding reproduces the imported forms; reversing those sequences matches the independently decoded source. This also restores an accented character whose misdecoded nonbreaking byte had been normalized to whitespace. No missing character is guessed from a name alone.

| Category | Encoding replacements |
| --- | ---: |
| Video games | 1 |
| Science fiction | 2 |
| Technology | 18 |
| Movies | 21 |
| History | 17 |
| Pop culture | 18 |
| **Total** | **77** |

The old 77 grading tuples remain lookup-only. New IDs preserve option positions, the keyed index, category, difficulty, source attribution and CC BY-SA license. The additional exact duplicate retains its issued grading too. Both old copies of that fact alias the same surviving concept; no prior retired alias required another update.

This is publisher-byte/provenance review, **not primary-source factual approval**. Correcting text does not verify the publisher's facts, every distractor, grammar, category fit or difficulty. All 77 replacements retain draft status, empty factual review dates and their existing explanation state. Active counts are not padded, and no source-check credit is added.

## Prevention and remaining launch work

The repeatable scan now recognizes the additional reversible sequences, including Polish letters. Bank CI rejects known repairable encoding sequences in active stems/options rather than permitting a regenerated report to hide them. Proper Unicode names and symbols remain intact. The correction helper is a repository proposal aid, not a runtime filter; it requires matching publisher text and never modifies saved gameplay or promotes review status.

The current report has **zero encoding signals**, four time-wording signals and eighteen retained candidate pairs. Ten pairs have distinct-objective dispositions; eight scope/category decisions remain open. The next content step is to resolve those scope/category and time-wording cases, then systematically verify all remaining drafts against primary evidence, including unflagged rows. The full-bank audit and independent editing remain open.

The broader [launch checklist](FREE-BETA-READINESS.md) preserves completed phone/TN10/desktop Study evidence and separates remaining device/account, independent multiplayer and managed-provider recovery acceptance. This content repair does not authorize a Beta label or economic activation. No live database, player, game, wallet, payment, provider setting or billing change is part of the batch. Final local verification, exact CI/tree, merge and production delivery belong in the release record.

## Candidate validation

Full npm run verify passed with required native Redis 7.4.2: 711 HQ tests plus nine offline signer checks (720 total), zero failures/skips, 311 security assertions and all bank/schema/similarity/audit, catalog/readiness, archive/collection, repository, economy, continuity and site checks. Ten focused audit/encoding checks pass, including source mismatch, valid Unicode, no factual promotion, all 77 correction hashes/aliases and the exposed duplicate exclusion. Independent before/after comparison preserved all 12,660 historical grading tuples, all 4,304 prior retired objects and 8,278 untouched active rows. Exactly 77 new draft replacements and one additional duplicate retirement; all seven raw source digests/Git blobs and all 77 strict UTF-8 source stem/options/key matches verified. The source register records provenance, not primary factual certification.

Standard read-only production monitoring on released #176 passed 21/21 probes at October 28, 2026, 12:27 AM Detroit (04:27 UTC), with unchanged five-second bounds. This is point-in-time health, not candidate deployment, sustained capacity, device or provider-recovery acceptance. Final exact-head CI and release observations belong in the scoped PR.
