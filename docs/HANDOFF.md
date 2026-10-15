# Geek Protocol working handoff

Updated: October 15, 2026. Canonical product repository: `GEEKProtocol0110/geek-protocol-hq`. Founder: Michael Gee. Read this file, [Project Status](PROJECT-STATUS.md), and [Bank-first release](BANK-FIRST-STORE.md) before continuing. Check the current branch, open PRs and deployment status before claiming anything is live.

## Current checkpoint

- The preceding merged baseline is [PR #112](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/112): 250 Kaspa questions and 247 Study concepts.
- This change adds 250 authored questions: **500 active, internally source-checked Kaspa questions**, and **497 Study concepts** across the existing eleven topics. Kaspa difficulty is provisional: 108 easy, 208 medium, 184 hard.
- The overall bank contains **8,105 active questions**, of which **598** meet the recorded internal-review criteria. **7,402** additional reviewed questions are needed across eight category targets. Imported drafts do not count as reviewed.
- This is a repository checkpoint. A merge, deployment or production-check result must be recorded separately before calling the candidate live. The previous deployment result does not validate this change.
- Local validation on `codex/kaspa-500`: full `npm run verify` passed with **426 tests, zero failures and zero skips**, required real Redis 7.4.2, all bank/catalog/retirement checks, 310 security assertions and the economy stress baseline. Production dependency audit: zero reported vulnerabilities. Source anchors/hashes and edited documentation links passed checks. No layout change or physical-device acceptance is claimed.
- [The new evidence register](kaspa-500-review-2026-10-15.json) attaches source lines, symbols, full-file SHA-256 values and exact question hashes to all 250 additions. Evidence describes Rusty Kaspa snapshot `01b532e8b553523216471682649693af92f0fd16`, not universal present-day network behavior or release activation. All 34 used source files were checked against that snapshot's Git blob hashes.

## Founder decisions to preserve

1. Build **1,000 legitimate, distinct source-checked questions in each of eight categories before CCE resumes**. The immediate Kaspa milestone was 500; the eventual Kaspa target remains 1,000.
2. CCE intake, publication, new-game selection and new first-use credits remain held. Historical records and saved answer keys retain their existing compatibility.
3. Keep future contributor rewards small. **1 or 5 GEEK are unselected proposals**, not active rates or funded promises. Completing a question count cannot enable rewards automatically.
4. Continue developing the Geek Store, equipment, cosmetics and named lifelines. Purchases, paid inventory use and new monetary effects remain unfinished. Existing free features remain governed by their existing rules.
5. The **500-Geek NFT collection** is a separate project from the **500-question milestone**. Do not interchange these counts or silently change collection allocations.
6. Preserve founding materials and decisions so another person can continue the project. A broader founding archive, durable provenance inventory and 50-year roadmap were requested; they are **open work**, not completed by this content release.

## Next work

| Priority | Work | Acceptance |
| --- | --- | --- |
| 1 | Finish release verification for this 500-question candidate | Local checks passed as recorded above; inspect PR CI and exact commit/PR and deployment evidence before calling it live |
| 2 | Continue Kaspa from 500 toward 1,000 | Small original batches; review each key and distractor; compare learning facts, not just wording; broaden primary-source coverage before adding more implementation trivia |
| 3 | Review and fill the seven other categories | Each reaches 1,000 independently supported concepts with suitable tier capacity; imports remain drafts until individually checked |
| 4 | Establish the founding archive and project continuation record | Inventory supplied originals, provenance, duplicate status, decisions, open work and recovery instructions; separate verified evidence from founder recollection |
| 5 | Develop the long-term roadmap | Stage school integration, professional/public-service learning and potential government or military training partnerships behind explicit pilots and evidence; do not claim contracts or partners |
| 6 | Specify the contributor economy | Founder-selected rate, funded budgets, caps, qualifying use, abuse/correction rules and receipts before any separately reviewed reopening |

The imported-question workspace is for staged proposals; new authored questions stay under `server/questions/`. [Question Maintenance](QUESTION-MAINTENANCE.md) explains compatibility and validation. A source link or passing schema does not establish factual correctness. Difficulty remains provisional; no independent editorial certification is claimed.

## How to update this handoff

After each completed change, record the exact PR/commit, what changed, verification result, remaining blockers and the next action. Keep earlier milestones explicitly historical. Link new originals in an inventory without overwriting their provenance. Never write secrets, wallet seeds, private operator material or unconsented personal details into this public repository. Preserve unresolved founding timing claims until the original conversation and archived files establish the evidence.
