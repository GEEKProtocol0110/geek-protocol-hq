# Technology question review — November 6, 2026

BANK-009. Internal, risk-selected review of six existing hardware/OS/interface drafts from main `0a8a53fa9acc62262b5493c4eb9aa95811b88f67`. This is not independent review, a contiguous-prefix review or whole-category certification. Difficulty remains provisional.

| Identity | Disposition | Reason / boundary |
| --- | --- | --- |
| `TECH-N-7ce1893db2ea` | Confirmed, exact grading retained | Retain exact prompt/options/key and existing provisional difficulty; add an original explanation and specific primary evidence. No independent review is claimed. |
| `TECH-N-b61820698c2e` | Confirmed, exact grading retained | Retain exact prompt/options/key and existing provisional difficulty; add an original explanation and specific primary evidence. No independent review is claimed. |
| `TECH-N-0802a9e35a49` | Confirmed, exact grading retained | Retain exact prompt/options/key and existing provisional difficulty; add an original explanation and specific primary evidence. No independent review is claimed. |
| `TECH-0810-Rfcd02b1e2f` | Corrected; practice-only draft | The old generic physical-RAM limit ignores PAE and confuses physical memory, total virtual space and the process user-space share. |
| `TECH-N-0461c5e98b88-Rbc490ae047` | Corrected; practice-only draft | Replace the imprecise human-memory analogy with an explicit saved-file/nonvolatile-storage objective. |
| `TECH-N-d0bbfb636d98-R488e1b3347` | Corrected; practice-only draft | Replace an undated intended-to-succeed claim and code-name lore with the explicit historical release date. |

The full item register is server-only at `server/question-audit/technology-2026-11-06.json`. Each decision binds the exact prompt/options/key hash, specific primary evidence, all four distractors, context and status. Original OpenTriviaQA CC BY-SA 4.0 provenance and license are retained. Explanations and adaptations are original; no source-site prose is imported.

Three older identities move to lookup-only retirement with their original prompts, choices and correct indices. Their canonical concept IDs point to the corrected replacements. New replacements remain `practiceOnly: true` / `draft-needs-human-review` pending a separate reviewer; having primary factual references does not silently make them ranked. Three unchanged existing questions receive internal source checks and original explanations without changing their grading. No new question is added to pad quantity.

## Evidence scope

- [Microsoft virtual address spaces](https://learn.microsoft.com/en-us/windows-hardware/drivers/gettingstarted/virtual-address-spaces) distinguishes the total 32-bit address range from its user/system split. [PAE](https://learn.microsoft.com/en-us/windows/win32/memory/physical-address-extension) expressly permits more than 4 GB of physical RAM on capable 32-bit systems, so the original blanket upgrade claim is not retained.
- [Corsair's volatile/nonvolatile explanation](https://www.corsair.com/us/en/explorer/diy-builder/memory/volatile-vs-non-volatile-memory-whats-the-difference/) distinguishes working memory from persistent drive storage. The replacement names saved files and power retention rather than a vague human-memory analogy.
- [Microsoft's October 22, 2009 announcement](https://news.microsoft.com/source/2009/10/22/microsoft-simplifies-the-pc-with-windows-7/) and [lifecycle record](https://learn.microsoft.com/en-us/lifecycle/products/windows-7) support a dated Windows 7 release-history question. The unverified code-name relation is dropped rather than certified.
- [USB-IF](https://www.usb.org/about) identifies Universal Serial Bus; [IBM optical-media guidance](https://www.ibm.com/support/pages/dvd-ram-media-types-and-media-formats) explicitly expands CD-ROM and distinguishes read-only media; [Microsoft ipconfig](https://learn.microsoft.com/en-us/windows-server/administration/windows-commands/ipconfig) separates full `/all` configuration from the basic summary. The IBM Docs overview returned 403 and is not relied on; the successful IBM support page is the evidence.

## Counts and validation

Candidate: 8,438 active static rows; 8,225 ranked-eligible; 213 practice-only. Eligible internal source reviews rise from 800 to 803; 7,197 further eligible reviews remain across the eight category targets. Raw audit `source-checked` counts include 75 held authorship rows and must not be substituted for readiness counts. Kaspa stays 766 and Study 537. New drafts are not approved by this count.

Validation includes exact historical grading/retirement compatibility, retained-item hash checks, new-draft isolation and deterministic later-eligibility concept exclusion for all three aliases. Bank/schema/similarity/catalog/readiness/audit, continuity, public-answer protection and required CI checks must pass before release. Exact results belong in the PR record; this source candidate is not merged/deployed. Independent editing remains unassigned.

## Local verification result

Full local npm run verify passed on Node 24.22.1 with native Redis 7.0.15: 755 HQ tests plus nine offline signer checks (764 total), zero failures/skips; 311 security assertions and bank/schema/similarity/catalog/readiness/audit, collection/archive, repository, economy, continuity, site and whitepaper checks. Focused audit tests passed 13/13. Separate baseline comparison preserves all 12,888 historical grading tuples and all 4,450 previously retired objects unchanged; exactly three new identities and three retirement records are added. Fresh published-head CI remains required.
