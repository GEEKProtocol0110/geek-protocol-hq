# Maintained backlog

Generated from the maintained JSON by `npm run continuity:write`. Update the source record, then regenerate. [Start Here](../../START-HERE.md).

P0 is the immediate product/recovery queue. Planned and proposed work is not automatically authorized implementation. An owner role labeled unassigned has no appointed person.

| ID | Priority | Status | Work | Owner |
| --- | --- | --- | --- | --- |
| CONT-001 | P0 | done | Publish the continuation system | Maintainer; release reviewed by founder |
| CONT-002 | P0 | planned | Make and verify an independent source backup | Founder or appointed repository custodian |
| ARCH-001 | P1 | blocked | Ingest founding originals and reconcile chronology | Founder supplies originals; archivist unassigned |
| BANK-001 | P0 | active | Grow Kaspa from 580 toward 1,000 reviewed concepts | Content maintainer; independent editor unassigned |
| BANK-002 | P1 | planned | Reach 1,000 reviewed Video games concepts | Content editor unassigned |
| BANK-003 | P1 | planned | Reach 1,000 reviewed Science fiction concepts | Content editor unassigned |
| BANK-004 | P1 | planned | Reach 1,000 reviewed Technology concepts | Content editor unassigned |
| BANK-005 | P1 | planned | Reach 1,000 reviewed Movies concepts | Content editor unassigned |
| BANK-006 | P1 | planned | Reach 1,000 reviewed History concepts | Content editor unassigned |
| BANK-007 | P1 | planned | Reach 1,000 reviewed Comics concepts | Content editor unassigned |
| BANK-008 | P1 | planned | Reach 1,000 reviewed Pop culture concepts | Content editor unassigned |
| PILOT-001 | P0 | needs-evidence | Complete the real-device free-beta pilot | Founder and consenting pilot participants |
| OPS-001 | P0 | needs-evidence | Verify operator access and managed-data recovery | Founder; private account custodian unassigned |
| OPS-002 | P1 | decision-needed | Appoint a successor and second trusted maintainer | Founder |
| ECON-001 | P1 | decision-needed | Specify funded contributor and learner rewards | Founder with economic and legal review |
| STORE-001 | P2 | planned | Finish the store and equipment experience | Product maintainer unassigned |
| COLL-001 | P2 | planned | Finish the 500-Geek art and ownership specification | Art lead and ownership reviewer unassigned |
| EDU-001 | P1 | planned | Design the first family or school learning pilot | Founder with educator partner unassigned |
| TECH-001 | P2 | proposed | Design institutional identity and learning exports | Integration maintainer unassigned |
| GOV-001 | P2 | proposed | Develop an unclassified public-service refresher pilot | Founder with agency sponsor unassigned |
| MIL-001 | P3 | proposed | Explore military and veteran professional learning | Founder with authorized institutional sponsor unassigned |
| ECO-001 | P1 | planned | Audit each ecosystem component and preserve its handoff | Maintainer for each repository unassigned |
| CHAIN-001 | P1 | needs-evidence | Verify the TN10 test asset and wallet before a real pilot | Maintainer; founder controls the external testnet wallet |
| OPS-003 | P1 | done | Finish mint-availability monitoring for GitHub issue #14 | Maintainer; founder reviews release |
| CHAIN-002 | P1 | decision-needed | Evaluate KCC20 compatibility and preserve GEEK holder entitlements | Maintainer researches; founder selects policy; independent covenant reviewer unassigned |
| ARCH-002 | P1 | done | Preserve the founder-supplied theme roster and trait sheet | Maintainer archives; founder reviews interpretation |
| AUTH-002 | P0 | needs-evidence | Resolve mobile login when wallet message signing is unavailable | Maintainer implements and verifies; founder confirms physical-phone passkeys |
| UX-001 | P0 | done | Simplify first visits and close current reliability gaps | Maintainer |

## CONT-001: Publish the continuation system

**P0 / done.** Owner: Maintainer; release reviewed by founder. Dependencies: none.

Next action: Maintain the record at each substantive checkpoint; independent backup and provider recovery remain separate tasks.

Acceptance:

- Start Here, state, backlog, decisions, history, assets, long-term vision and succession instructions are linked.
- Continuity validation and portable-source snapshot drill pass.
- Exact PR and verification evidence are retained.

Evidence/specification: [START-HERE.md](../../START-HERE.md), [docs/continuity/README.md](../../docs/continuity/README.md).

## CONT-002: Make and verify an independent source backup

**P0 / planned.** Owner: Founder or appointed repository custodian. Dependencies: CONT-001.

Next action: Run the source snapshot tool on the merged release, copy it to a separately controlled destination, and verify restore.

Acceptance:

- Committed source restores with matching Git tree and bundle digest.
- Private evidence records destination, custodian, date and restore result.
- Issues, releases, external files and component repositories have their own preservation inventory.

Evidence/specification: [docs/continuity/OPERATING-GUIDE.md](../../docs/continuity/OPERATING-GUIDE.md), [docs/BACKUP-RECOVERY.md](../../docs/BACKUP-RECOVERY.md).

## ARCH-001: Ingest founding originals and reconcile chronology

**P1 / blocked.** Owner: Founder supplies originals; archivist unassigned. Dependencies: none.

Next action: Supply the original conversation export and remaining founding files from the phone.

Blocker: Original conversation and remaining phone files have not been supplied in this working copy.

Acceptance:

- Each received file has an original filename, byte hash, provenance, privacy/licensing disposition and duplicate result.
- Originals remain unchanged; public derivatives are identified separately.
- The 23-hour/29-hour claims are reconciled only with timestamp evidence.

Evidence/specification: [docs/continuity/ARCHIVE-GUIDE.md](../../docs/continuity/ARCHIVE-GUIDE.md), [docs/continuity/assets.json](../../docs/continuity/assets.json).

## BANK-001: Grow Kaspa from 580 toward 1,000 reviewed concepts

**P0 / active.** Owner: Content maintainer; independent editor unassigned. Dependencies: none.

Next action: PR #118 merged at 606d06a861428f96b633152d32d3e8954e3e209d: 580 internally source-checked Kaspa concepts. Continue distinct primary-source facts toward 1,000 (420 remain). Introductory Study remains 537; independent editorial review is unassigned.

Acceptance:

- 1,000 distinct source-checked Kaspa concepts with explanations and review dates.
- No padded variants; existing issued answers remain compatible.
- Tier capacity and bank/catalog/readiness checks pass.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/QUESTION-MAINTENANCE.md](../../docs/QUESTION-MAINTENANCE.md), [docs/kaspa-520-review-2026-10-15.json](../../docs/kaspa-520-review-2026-10-15.json), [docs/kaspa-540-review-2026-10-15.json](../../docs/kaspa-540-review-2026-10-15.json), [docs/kaspa-580-review-2026-10-15.json](../../docs/kaspa-580-review-2026-10-15.json).

## BANK-002: Reach 1,000 reviewed Video games concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Video games batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-003: Reach 1,000 reviewed Science fiction concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Science fiction batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-004: Reach 1,000 reviewed Technology concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Technology batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-005: Reach 1,000 reviewed Movies concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Movies batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-006: Reach 1,000 reviewed History concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small History batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-007: Reach 1,000 reviewed Comics concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Comics batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## BANK-008: Reach 1,000 reviewed Pop culture concepts

**P1 / planned.** Owner: Content editor unassigned. Dependencies: none.

Next action: Review a small Pop culture batch against specific primary sources; correct or retire unsuitable drafts.

Acceptance:

- 1,000 distinct supported concepts in this category.
- Keys, distractors, licensing, explanations, scope and difficulty reviewed.
- Saved-game compatibility and generated counts verified.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/IMPORTED-QUESTION-REVIEW.md](../../docs/IMPORTED-QUESTION-REVIEW.md).

## PILOT-001: Complete the real-device free-beta pilot

**P0 / needs-evidence.** Owner: Founder and consenting pilot participants. Dependencies: none.

Next action: Record the remaining phone, saved Quest and two-person Royale outcomes against one exact release.

Acceptance:

- Four Quest chapters retain completion/replay state.
- Phone sign-in/profile/Study flow passes.
- Two participants can start a partially filled Royale room and recover correctly.

Evidence/specification: [docs/FREE-BETA-READINESS.md](../../docs/FREE-BETA-READINESS.md).

## OPS-001: Verify operator access and managed-data recovery

**P0 / needs-evidence.** Owner: Founder; private account custodian unassigned. Dependencies: none.

Next action: The offline restore-safety checks pass internally (489 full tests, 311 security assertions); see the associated PR for exact release status. Verify owner MFA, actual provider retention and a provider restore into an isolated destination next. Confirm both hosts independently, reconcile security changes after the backup point, and record evidence privately.

Acceptance:

- Named account custodians can recover access without publishing credentials.
- Provider backup retention and isolated restore are measured.
- Restored sessions are revoked before any recovery exposure.
- Cleanup requires distinct explicit production/restored hosts even without application environment configuration, rejects malformed/ambiguous targeting, bounds provider requests without automatic write retries, and checks for remaining transient credentials.
- A native snapshot test rejects restored bearer cookies and one-time proofs after cleanup, then recovers the same player and saved progress with a fresh signed passkey proof; provider/device acceptance remains separate.

Evidence/specification: [docs/OPERATOR-SECURITY.md](../../docs/OPERATOR-SECURITY.md), [docs/BACKUP-RECOVERY.md](../../docs/BACKUP-RECOVERY.md), [docs/RESTORE-SAFETY.md](../../docs/RESTORE-SAFETY.md), [tests/recovery-safety.test.js](../../tests/recovery-safety.test.js), [tests/passkeys.test.js](../../tests/passkeys.test.js).

## OPS-002: Appoint a successor and second trusted maintainer

**P1 / decision-needed.** Owner: Founder. Dependencies: none.

Next action: Select trusted people and record responsibilities and account access privately.

Acceptance:

- Successor and backup custodian accept roles.
- Least-privilege GitHub/hosting/database/domain access and independent recovery are exercised.
- Public role record contains no recovery secrets or private personal details.

Evidence/specification: [docs/continuity/SUCCESSION.md](../../docs/continuity/SUCCESSION.md).

## ECON-001: Specify funded contributor and learner rewards

**P1 / decision-needed.** Owner: Founder with economic and legal review. Dependencies: none.

Next action: Choose the contributor rate and qualification rules only after a funded budget and abuse controls are defined.

Acceptance:

- Rate, funding, caps, qualifying third-party use, correction, appeal and settlement receipts specified.
- All eight banks meet their 1,000 target before a separately reviewed CCE reopening.
- School or agency participation does not require speculative token use.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/ECONOMY-PROTOCOL.md](../../docs/ECONOMY-PROTOCOL.md).

## STORE-001: Finish the store and equipment experience

**P2 / planned.** Owner: Product maintainer unassigned. Dependencies: ECON-001.

Next action: Specify one small useful inventory flow while preserving existing free cosmetics and practice lifelines.

Acceptance:

- Prices and inventory rules are explicit if purchases are proposed.
- Server-authoritative grants/consumption and failure handling are reviewed.
- Paid items cannot buy correctness or assessment credit.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md).

## COLL-001: Finish the 500-Geek art and ownership specification

**P2 / planned.** Owner: Art lead and ownership reviewer unassigned. Dependencies: none.

Next action: Review the 18 repeated roster labels and incomplete trait PDF. Confirm whether historical 100/50/25/5/1 cells meant copies per archetype, recover missing sheet rows, and reconcile any proposed supply/theme/edition policy with the current 500-edition plan and GIGA/A.C.E. anchors before changing canon.

Acceptance:

- Exactly 500 editions in five tiers are reconciled.
- Art provenance, metadata and acquisition allocations approved.
- Ownership remains disabled until its separate reviewed implementation.

Evidence/specification: [docs/GEEK-500-ART-BIBLE.md](../../docs/GEEK-500-ART-BIBLE.md), [docs/COLLECTIBLE-PROTOCOL.md](../../docs/COLLECTIBLE-PROTOCOL.md), [docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md](../../docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md).

## EDU-001: Design the first family or school learning pilot

**P1 / planned.** Owner: Founder with educator partner unassigned. Dependencies: PILOT-001.

Next action: Use the pilot charter to select one age-appropriate objective, reviewed lesson and measurement plan.

Acceptance:

- Instructor-approved objective, content, safeguarding/data plan and accessible flow.
- Limited pilot scope, recruitment permission, owner and end date.
- Usability and delayed retention results recorded without overstating certification.

Evidence/specification: [docs/continuity/INSTITUTIONAL-PATH.md](../../docs/continuity/INSTITUTIONAL-PATH.md), [docs/continuity/PILOT-CHARTER.md](../../docs/continuity/PILOT-CHARTER.md).

## TECH-001: Design institutional identity and learning exports

**P2 / proposed.** Owner: Integration maintainer unassigned. Dependencies: EDU-001.

Next action: Ask the selected pilot which LMS and export workflow it needs before selecting an integration.

Acceptance:

- Synthetic-data tenant and role model reviewed.
- Selected export/standard has contract tests and data minimization.
- No claim of LTI, QTI, OneRoster or xAPI conformance without implementation and required verification.

Evidence/specification: [docs/continuity/INSTITUTIONAL-PATH.md](../../docs/continuity/INSTITUTIONAL-PATH.md).

## GOV-001: Develop an unclassified public-service refresher pilot

**P2 / proposed.** Owner: Founder with agency sponsor unassigned. Dependencies: PILOT-001.

Next action: Prepare the factual partner brief and identify one voluntary public-service training problem.

Acceptance:

- Sponsor, approved public content, objectives, procurement route and evaluation agreed.
- Legal entity, registration, accessibility and buyer-specific conditions verified before an offer.
- No claimed contract, certification or token obligation without an executed agreement.

Evidence/specification: [docs/continuity/PARTNER-BRIEF.md](../../docs/continuity/PARTNER-BRIEF.md), [docs/continuity/INSTITUTIONAL-PATH.md](../../docs/continuity/INSTITUTIONAL-PATH.md).

## MIL-001: Explore military and veteran professional learning

**P3 / proposed.** Owner: Founder with authorized institutional sponsor unassigned. Dependencies: GOV-001.

Next action: Begin with public, non-sensitive professional-development or transition-learning discovery.

Acceptance:

- Sponsor-approved scope, assessment authority and required hosting/data boundaries.
- Relevant procurement and personnel-reward rules reviewed for that engagement.
- No operational, controlled or personal military data enters the public Alpha.

Evidence/specification: [docs/continuity/INSTITUTIONAL-PATH.md](../../docs/continuity/INSTITUTIONAL-PATH.md).

## ECO-001: Audit each ecosystem component and preserve its handoff

**P1 / planned.** Owner: Maintainer for each repository unassigned. Dependencies: none.

Next action: Inspect the public repository directory one component at a time, starting with Geek Jr, Mini, Wallet and the widget.

Acceptance:

- Exact default-branch commit, owner, deployment, last verified behavior and next task recorded per component.
- Separate repository/source and external-release backups exist.
- HQ remains the central index while component histories remain intact.

Evidence/specification: [docs/continuity/repositories.json](../../docs/continuity/repositories.json).

## CHAIN-001: Verify the TN10 test asset and wallet before a real pilot

**P1 / needs-evidence.** Owner: Maintainer; founder controls the external testnet wallet. Dependencies: none.

Next action: PR #114 is merged and deployed. Founder refreshes the pilot tab and accepts the new run-loading control on the phone. Complete the next eligible Daily in the same browser/player, save and return immediately, load the run and queue within five minutes. Preserve the UTC daily lock, verify fee funds/batch state, export the receipt, then send/reconcile exactly one manual transfer.

Acceptance:

- Exact TN10 token deployment, decimals, sender and amount verified against the fixed indexer.
- Wallet provider and TN10 signing workflow exercised with recorded transaction evidence.
- One manual pilot transfer reconciled by the existing receipt desk; no Mainnet settlement enabled.
- Test deployment maximum, mint limit, premint and decimals match pinned GEEK; test ticker/network/deployment remain distinct.

Evidence/specification: [docs/TESTNET-REWARD-PILOT.md](../../docs/TESTNET-REWARD-PILOT.md), [docs/TESTNET-ASSET-SETUP.md](../../docs/TESTNET-ASSET-SETUP.md).

## OPS-003: Finish mint-availability monitoring for GitHub issue #14

**P1 / done.** Owner: Maintainer; founder reviews release. Dependencies: none.

Next action: Continue scheduled monitoring and investigate any new failed mint-status check. Preserve the fallback limitation and original outage evidence; no wallet transaction is needed to check status.

Acceptance:

- Fresh HQ mint status verifies the exact pinned deployment and internally consistent raw/display minted and remaining supply.
- Production monitoring flags outages, stale/mismatched payloads and invalid open/paused states; verified exhaustion passes.
- Exact historical twenty-check reports remain readable and are labeled Earlier coverage.
- Candidate tests, exact PR/commit and deployment/production evidence are recorded; no signing, settlement or new mint policy enabled.

Evidence/specification: [docs/MINT-AVAILABILITY-ISSUE-14.md](../../docs/MINT-AVAILABILITY-ISSUE-14.md), [docs/PRODUCTION-MONITORING.md](../../docs/PRODUCTION-MONITORING.md), [docs/continuity/github-issues.json](../../docs/continuity/github-issues.json).

## CHAIN-002: Evaluate KCC20 compatibility and preserve GEEK holder entitlements

**P1 / decision-needed.** Owner: Maintainer researches; founder selects policy; independent covenant reviewer unassigned. Dependencies: none.

Next action: Research PR #117 is merged at a4e34cd6c7146ed268729cb37b1bcb0ba051e5d7. Resolve the 144-billion/eight-decimal integer issue, select exact conforming artifacts and a test wallet, and specify a disabled prototype. Holder migration or funded deployment requires a separate concrete proposal; BANK-001 remains next product priority.

Acceptance:

- Current specification and implementation distinctions, pinned sources and research limits recorded.
- Existing holder and still-unminted GEEK accounting, decimal precision and integer bounds explicitly resolved.
- Artifact reproduction/conformance, independent review, wallet/network tests and recovery evidence required before integration.
- No supply change, migration, new signer, CCE reopening or Mainnet settlement implied by research.

Evidence/specification: [docs/KCC20-RESEARCH.md](../../docs/KCC20-RESEARCH.md), [docs/research/kcc20-2026-10-15.json](../../docs/research/kcc20-2026-10-15.json).

## ARCH-002: Preserve the founder-supplied theme roster and trait sheet

**P1 / done.** Owner: Maintainer archives; founder reviews interpretation. Dependencies: none.

Next action: Maintain the two originals and their hashes; ingest additional supplied files under ARCH-001 and resolve historical rarity/theme/edition interpretation under COLL-001. Archive completion does not approve a collection change.

Acceptance:

- Both original filenames and exact bytes, SHA-256, Git blobs, source and supplied date preserved; embedded PDF timestamp not independently verified.
- 500 ordered entries in ten groups, 482 exact distinct names and 18 repeated-label pairs recorded without deletion or renaming.
- PDF has 358 rows / 344 exact labels across 17 pages; empty final sections and misplaced Perfume Blending Geek preserved, with no invented missing rows or approved supply.
- Existing 500-edition manifest, five tiers, GIGA/A.C.E. anchors, art approvals and disabled ownership remain unchanged.

Evidence/specification: [docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md](../../docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md), [docs/continuity/founding/geek-roster-500.json](../../docs/continuity/founding/geek-roster-500.json), [docs/continuity/assets.json](../../docs/continuity/assets.json), [docs/continuity/founding/geek-trait-rarity-sheet.json](../../docs/continuity/founding/geek-trait-rarity-sheet.json).

## AUTH-002: Resolve mobile login when wallet message signing is unavailable

**P0 / needs-evidence.** Owner: Maintainer implements and verifies; founder confirms physical-phone passkeys. Dependencies: none.

Next action: Founder reported the phone passkey flow worked on October 16 at 2:35 AM Detroit. Preserve that success and the working session. Confirm returning sign-in to the intended saved player next; cross-device recovery, revocation and independent review remain separately unreported. Do not ask for another initial enrollment or unavailable KasWare message signing.

Acceptance:

- Exact server message copied/selected without modifying whitespace; selection copy runs during the tap, with Clipboard API/manual fallbacks.
- Denied/unavailable/stalled clipboard and expired/replaced challenges have usable, honest states; no copy action sends a signature or authenticates a player.
- Existing server signature, origin, replay, recovery and session protections pass; exact release/deployment and remaining phone acceptance recorded.
- Mobile guidance distinguishes wallet biometric unlock from message signing and offers guest play without implying saved-player recovery; no universal KasWare mobile support claim.
- Passkey enrollment and returning login preserve stable player/progress/name/time with origin, RP, user-verification, single-use and credential-uniqueness checks.
- Management uses fresh proof; session rotation, credential removal, wallet recovery invalidation, cancellation and bounded requests verified; exact deployment and real-phone results recorded separately.

Evidence/specification: [public/sign-in/index.html](../../public/sign-in/index.html), [public/sign-in/assets/sign-in.js](../../public/sign-in/assets/sign-in.js), [tests/sign-in-copy.test.js](../../tests/sign-in-copy.test.js), [docs/IDENTITY-PROTOCOL.md](../../docs/IDENTITY-PROTOCOL.md), [docs/MOBILE-LOGIN-COPY-RELEASE.md](../../docs/MOBILE-LOGIN-COPY-RELEASE.md), [docs/PASSKEY-LOGIN.md](../../docs/PASSKEY-LOGIN.md), [server/passkeys.js](../../server/passkeys.js), [tests/passkeys.test.js](../../tests/passkeys.test.js), [tests/passkey-client.test.js](../../tests/passkey-client.test.js).

## UX-001: Simplify first visits and close current reliability gaps

**P0 / done.** Owner: Maintainer. Dependencies: none.

Next action: Shipped in PR #127 at dfcb64f9ce3eb281f91ada9d3f6c7432c5b1855a; preserve regression coverage. Independent auth review, provider restore and physical-device recovery evidence remain tracked separately.

Acceptance:

- First visit has a clear guest, returning-passkey and save-current-player path; advanced wallet steps stay optional.
- Session refresh cannot undo newer protection or resurrect revoked sessions; failed refresh cannot partially rename a player.
- Provider requests have a deadline without automatic write retries; uncertainty prompts a saved-state check.
- Passkey protection and renamed leaderboard display agree with saved state.
- Full checks, exact PR/deployment evidence and remaining independent-review/restore work are recorded.

Evidence/specification: [docs/NEW-PLAYER-POLISH.md](../../docs/NEW-PLAYER-POLISH.md), [tests/passkeys.test.js](../../tests/passkeys.test.js), [tests/redis-transport.test.js](../../tests/redis-transport.test.js), [tests/profile-client.test.js](../../tests/profile-client.test.js).
