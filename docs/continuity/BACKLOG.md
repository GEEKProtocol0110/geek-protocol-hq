# Maintained backlog

Generated from the maintained JSON by `npm run continuity:write`. Update the source record, then regenerate. [Start Here](../../START-HERE.md).

P0 is the immediate product/recovery queue. Planned and proposed work is not automatically authorized implementation. An owner role labeled unassigned has no appointed person.

| ID | Priority | Status | Work | Owner |
| --- | --- | --- | --- | --- |
| CONT-001 | P0 | done | Publish the continuation system | Maintainer; release reviewed by founder |
| CONT-002 | P0 | planned | Make and verify an independent source backup | Founder or appointed repository custodian |
| ARCH-001 | P1 | blocked | Ingest founding originals and reconcile chronology | Founder supplies originals; archivist unassigned |
| BANK-001 | P0 | active | Grow Kaspa toward 1,000 reviewed concepts | Content maintainer; independent editor unassigned |
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
| COLL-001 | P2 | planned | Reconcile the 500-concept, five-tier artwork plan with the legacy runtime | Art lead and ownership reviewer unassigned |
| EDU-001 | P1 | planned | Design the first family or school learning pilot | Founder with educator partner unassigned |
| TECH-001 | P2 | proposed | Design institutional identity and learning exports | Integration maintainer unassigned |
| GOV-001 | P2 | proposed | Develop an unclassified public-service refresher pilot | Founder with agency sponsor unassigned |
| MIL-001 | P3 | proposed | Explore military and veteran professional learning | Founder with authorized institutional sponsor unassigned |
| ECO-001 | P1 | planned | Audit each ecosystem component and preserve its handoff | Maintainer for each repository unassigned |
| CHAIN-001 | P1 | done | Verify the TN10 test asset and wallet before a real pilot | Maintainer; founder controls the external testnet wallet |
| OPS-003 | P1 | done | Finish mint-availability monitoring for GitHub issue #14 | Maintainer; founder reviews release |
| CHAIN-002 | P1 | decision-needed | Evaluate KCC20 compatibility and preserve GEEK holder entitlements | Maintainer researches; founder selects policy; independent covenant reviewer unassigned |
| ARCH-002 | P1 | done | Preserve the founder-supplied theme roster and trait sheet | Maintainer archives; founder reviews interpretation |
| AUTH-002 | P0 | needs-evidence | Resolve mobile login when wallet message signing is unavailable | Maintainer implements and verifies; founder confirms physical-phone passkeys |
| UX-001 | P0 | done | Simplify first visits and close current reliability gaps | Maintainer |
| UX-002 | P1 | done | Bring GIGA, A.C.E. and seasonal cosmic styling throughout HQ | Maintainer |
| UX-003 | P1 | done | Reduce repeated character art and emphasize the neon-space background | Maintainer |
| UX-004 | P1 | done | Clarify the Kaspa onboarding identity and add playful Grid discoveries | Maintainer |
| UX-005 | P0 | needs-evidence | Contain mobile decoration and stabilize page edges | Maintainer |
| CONT-003 | P0 | done | Reconcile roadmap, stale drafts and current acceptance evidence | Maintainer |
| WALLET-001 | P1 | planned | Review and isolate the optional Testnet wallet lab retained from #119 | Wallet maintainer; independent wallet reviewer unassigned |
| CHAIN-003 | P2 | done | Review retained Testnet reward-desk amount and copy polish | Maintainer |
| PILOT-002 | P1 | planned | Review retained wallet-safety course and evaluation tooling | Pilot coordinator and instructor unassigned |
| ART-001 | P2 | blocked | Preserve paused original art and resume production only on founder direction | Founder supplies art; production maintainer unassigned |
| SEO-001 | P0 | done | Maintain metadata and link coverage for every HQ page | Maintainer |
| AUTH-003 | P0 | needs-evidence | Provide a cross-device account path beyond local passkey creation | Maintainer; family-account and recovery policy reviewed by founder |
| ACE-001 | P1 | needs-evidence | Build source-grounded A.C.E. tutoring and scoped operational automation | Maintainer; AI/content evaluation reviewer unassigned |
| PERF-001 | P1 | needs-evidence | Measure growth capacity and stage storage, delivery and worker improvements | Maintainer; performance/recovery reviewer unassigned |
| UX-006 | P0 | needs-evidence | Make returning login clear and keep advanced setup optional | Maintainer; founder confirms usability |
| UX-007 | P1 | needs-evidence | Add a five-word hunt and one-time rewarded challenges | Maintainer; founder confirms phone usability |
| GAME-001 | P1 | needs-evidence | Build a deep career challenge and mastery ladder | Maintainer; founder confirms phone/game usability |
| LAUNCH-001 | P0 | needs-evidence | Prove the core loop and close the first release scope | Maintainer implements and checks; founder supplies real-device and wallet approval; provider custodian unassigned |
| CHAIN-004 | P0 | blocked | Automate eligible Daily GEEKT test rewards | Maintainer; founder controls test funding and device acceptance |
| CHAIN-005 | P1 | needs-evidence | Recover player reward status after interruptions | Maintainer; founder confirms actual-phone behavior |

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

## BANK-001: Grow Kaspa toward 1,000 reviewed concepts

**P0 / active.** Owner: Content maintainer; independent editor unassigned. Dependencies: none.

Next action: #150 merged/deployed: 750 reviewed Kaspa / 8,355 active / 848 recorded reviews. Continue 250 distinct source-reviewed Kaspa concepts toward 1,000; independent editor remains unassigned. Preserve issued keys and all bank/economy holds.

Acceptance:

- 1,000 distinct source-checked Kaspa concepts with explanations and review dates.
- No padded variants; existing issued answers remain compatible.
- Tier capacity and bank/catalog/readiness checks pass.

Evidence/specification: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md), [docs/QUESTION-MAINTENANCE.md](../../docs/QUESTION-MAINTENANCE.md), [docs/kaspa-520-review-2026-10-15.json](../../docs/kaspa-520-review-2026-10-15.json), [docs/kaspa-540-review-2026-10-15.json](../../docs/kaspa-540-review-2026-10-15.json), [docs/kaspa-580-review-2026-10-15.json](../../docs/kaspa-580-review-2026-10-15.json), [docs/kaspa-600-review-2026-10-16.json](../../docs/kaspa-600-review-2026-10-16.json), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/KASPA-SCRIPT-REVIEW-2026-10-17.md](../../docs/KASPA-SCRIPT-REVIEW-2026-10-17.md), [docs/KASPA-700-REVIEW-2026-10-17.md](../../docs/KASPA-700-REVIEW-2026-10-17.md), [docs/kaspa-700-review-2026-10-17.json](../../docs/kaspa-700-review-2026-10-17.json), [docs/KASPA-750-REVIEW-2026-10-18.md](../../docs/KASPA-750-REVIEW-2026-10-18.md), [docs/kaspa-750-review-2026-10-18.json](../../docs/kaspa-750-review-2026-10-18.json).

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

Next action: Use the refreshed #137 runtime checklist. Preserve the earlier Quest-resume success, October 16 phone passkey success and limited mobile-edge improvement. Record returning saved-player login, four-chapter completion/replay and a two-person Royale run on actual devices.

Acceptance:

- Four Quest chapters retain completion/replay state.
- Phone sign-in/profile/Study flow passes.
- Two participants can start a partially filled Royale room and recover correctly.

Evidence/specification: [docs/FREE-BETA-READINESS.md](../../docs/FREE-BETA-READINESS.md).

## OPS-001: Verify operator access and managed-data recovery

**P0 / needs-evidence.** Owner: Founder; private account custodian unassigned. Dependencies: none.

Next action: Rerun isolated native Redis recovery and fresh-passkey return in candidate verification. Actual owner MFA/provider retention/isolated provider restore and production recovery timing still require private operator evidence; local RDB tests do not close this task.

Acceptance:

- Named account custodians can recover access without publishing credentials.
- Provider backup retention and isolated restore are measured.
- Restored sessions are revoked before any recovery exposure.
- Cleanup requires distinct explicit production/restored hosts even without application environment configuration, rejects malformed/ambiguous targeting, bounds provider requests without automatic write retries, and checks for remaining transient credentials.
- A native snapshot test rejects restored bearer cookies and one-time proofs after cleanup, then recovers the same player and saved progress with a fresh signed passkey proof; provider/device acceptance remains separate.

Evidence/specification: [docs/OPERATOR-SECURITY.md](../../docs/OPERATOR-SECURITY.md), [docs/BACKUP-RECOVERY.md](../../docs/BACKUP-RECOVERY.md), [docs/RESTORE-SAFETY.md](../../docs/RESTORE-SAFETY.md), [tests/recovery-safety.test.js](../../tests/recovery-safety.test.js), [tests/passkeys.test.js](../../tests/passkeys.test.js), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md).

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

## COLL-001: Reconcile the 500-concept, five-tier artwork plan with the legacy runtime

**P2 / planned.** Owner: Art lead and ownership reviewer unassigned. Dependencies: none.

Next action: DR-012 recovers the founder’s 500 concepts × five artwork tiers = 2,500-image direction from paused #120. Resolve repeated names, stable IDs and GIGA/A.C.E. anchors; specify versioned migration while retaining the older 500-slot runtime. Copies per artwork, mint supply and allocations remain unselected; art production stays paused.

Acceptance:

- 500 character concepts and five artwork tiers are distinct from collectible copies/mint supply.
- Duplicate names, anchors and versioned character-plus-tier mapping preserve existing IDs/saves.
- Original asset provenance is retained; new production and ownership remain disabled until their separate authorization/review.

Evidence/specification: [docs/GEEK-500-ART-BIBLE.md](../../docs/GEEK-500-ART-BIBLE.md), [docs/COLLECTIBLE-PROTOCOL.md](../../docs/COLLECTIBLE-PROTOCOL.md), [docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md](../../docs/GEEK-500-FOUNDING-ROSTER-REVIEW.md), [docs/GEEK-500-COLLECTION-STRUCTURE.md](../../docs/GEEK-500-COLLECTION-STRUCTURE.md), [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md).

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

**P1 / done.** Owner: Maintainer; founder controls the external testnet wallet. Dependencies: none.

Next action: Retain the final indexed-confirmed JSON export privately. The one-transfer manual pilot is complete; any repeat or automatic-signing rollout is separate scoped work.

Acceptance:

- Exact TN10 token deployment, decimals, sender and amount verified against the fixed indexer.
- Wallet provider and TN10 signing workflow exercised with recorded transaction evidence.
- One manual pilot transfer reconciled by the existing receipt desk; no Mainnet settlement enabled.
- Test deployment maximum, mint limit, premint and decimals match pinned GEEK; test ticker/network/deployment remain distinct.

Evidence/specification: [docs/TESTNET-REWARD-PILOT.md](../../docs/TESTNET-REWARD-PILOT.md), [docs/TESTNET-ASSET-SETUP.md](../../docs/TESTNET-ASSET-SETUP.md), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/GEEKT-FIRST-PAYOUT-2026-10-18.md](../../docs/GEEKT-FIRST-PAYOUT-2026-10-18.md).

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

Next action: Preserve the founder's October 16 phone success. The founder reported passkey creation failing in Amazon Silk on a family Fire tablet October 17. The candidate adds a bounded local provider check and device-specific help, without disabling external authenticators or bypassing proof. Validate the candidate, then retest on the actual tablet; installed versions and the cause remain unverified. A genuinely alternative account path is AUTH-003.

Acceptance:

- Exact server message copied/selected without modifying whitespace; selection copy runs during the tap, with Clipboard API/manual fallbacks.
- Denied/unavailable/stalled clipboard and expired/replaced challenges have usable, honest states; no copy action sends a signature or authenticates a player.
- Existing server signature, origin, replay, recovery and session protections pass; exact release/deployment and remaining phone acceptance recorded.
- Mobile guidance distinguishes wallet biometric unlock from message signing and offers guest play without implying saved-player recovery; no universal KasWare mobile support claim.
- Passkey enrollment and returning login preserve stable player/progress/name/time with origin, RP, user-verification, single-use and credential-uniqueness checks.
- Management uses fresh proof; session rotation, credential removal, wallet recovery invalidation, cancellation and bounded requests verified; exact deployment and real-phone results recorded separately.

Evidence/specification: [public/sign-in/index.html](../../public/sign-in/index.html), [public/sign-in/assets/sign-in.js](../../public/sign-in/assets/sign-in.js), [tests/sign-in-copy.test.js](../../tests/sign-in-copy.test.js), [docs/IDENTITY-PROTOCOL.md](../../docs/IDENTITY-PROTOCOL.md), [docs/MOBILE-LOGIN-COPY-RELEASE.md](../../docs/MOBILE-LOGIN-COPY-RELEASE.md), [docs/PASSKEY-LOGIN.md](../../docs/PASSKEY-LOGIN.md), [server/passkeys.js](../../server/passkeys.js), [tests/passkeys.test.js](../../tests/passkeys.test.js), [tests/passkey-client.test.js](../../tests/passkey-client.test.js), [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md).

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

## UX-002: Bring GIGA, A.C.E. and seasonal cosmic styling throughout HQ

**P1 / done.** Owner: Maintainer. Dependencies: none.

Next action: Shipped in PR #131 at 472249a0793b39e3c6f2f9cf5121167a0d970412. Preserve regression coverage; follow up on real-phone/narrow-viewport and rendered seasonal QA. Resume OPS-001 provider recovery evidence separately.

Acceptance:

- Existing GIGA and A.C.E. art and authored guide copy appear across public pages without changing selected player avatars or game state.
- Shared cosmic backgrounds and subtle code styling work at narrow widths; the old animation button is absent and motion respects reduced-motion/data-saver/visibility constraints.
- Each listed holiday has distinct page motifs, borders, guide greetings and character badges; Off and failed reads clear decoration.
- MLK Day and Juneteenth are absent from choices/automatic windows; old saved selections render Off and remain editable without an automatic data write.
- Relevant checks, exact release evidence and remaining verification limits are recorded.

Evidence/specification: [docs/HOLIDAY-THEMES.md](../../docs/HOLIDAY-THEMES.md), [public/assets/characters.js](../../public/assets/characters.js), [public/assets/atmosphere.css](../../public/assets/atmosphere.css), [public/assets/site.js](../../public/assets/site.js), [public/assets/holiday-theme.js](../../public/assets/holiday-theme.js), [tests/appearance.test.js](../../tests/appearance.test.js).

## UX-003: Reduce repeated character art and emphasize the neon-space background

**P1 / done.** Owner: Maintainer. Dependencies: none.

Next action: Shipped in PR #133 at 31be106bcecf01da78c18cd9afb37901f177d517. Keep the background emphasis; await founder-supplied character art before another broad rollout. Phone/other-seasonal visual QA remains a separate follow-up.

Acceptance:

- Newly injected GIGA/A.C.E. panels and portrait treatment are removed; established story guides and original art remain available.
- The large home portrait gives way to a decorative local constellation and stronger neon-space/coder backgrounds.
- Background layers remain aria-hidden, click-through and bounded for motion preferences; holiday greetings and the reduced holiday catalog still work.
- Relevant checks and actual release/browser evidence are recorded without claiming unperformed phone or seasonal QA.

Evidence/specification: [docs/HOLIDAY-THEMES.md](../../docs/HOLIDAY-THEMES.md), [public/assets/atmosphere.js](../../public/assets/atmosphere.js), [public/assets/atmosphere.css](../../public/assets/atmosphere.css), [public/assets/neon-constellation.svg](../../public/assets/neon-constellation.svg).

## UX-004: Clarify the Kaspa onboarding identity and add playful Grid discoveries

**P1 / done.** Owner: Maintainer. Dependencies: none.

Next action: Shipped in PR #135 at 4a12ec8b4cff78c6042ec6c65b7b6027d3af7352; preserve cosmetic isolation and direct learning links. Optional physical-phone discovery QA remains separate. Resume OPS-001.

Acceptance:

- Homepage, share metadata and project positioning describe a Kaspa onboarding ecosystem built for Proof of Learning.
- A small optional footer discovery supports typing and tapping without global keyboard handlers, tracking, storage, player mutations or rewards.
- Native disclosure, labeled controls, safe text output and visible focus keep the experience accessible.
- Relevant checks and release/browser evidence are recorded with their limits.

Evidence/specification: [docs/GRID-DISCOVERIES.md](../../docs/GRID-DISCOVERIES.md), [public/assets/easter-eggs.js](../../public/assets/easter-eggs.js), [tests/easter-eggs.test.js](../../tests/easter-eggs.test.js).

## UX-005: Contain mobile decoration and stabilize page edges

**P0 / needs-evidence.** Owner: Maintainer. Dependencies: none.

Next action: #145 is merged and deployed with direct CSS coverage and fail-closed decoration. Confirm Play, navigation and browser-bar/zoom stability on the actual phone; do not replace the earlier regression report with desktop acceptance.

Acceptance:

- Decorative code no longer extends beyond mobile sections; the home hero clips its decorative children.
- The shared page shell prevents decorative horizontal scrolling without disabling pinch zoom or vertical navigation.
- Mobile background geometry stays stable when browser chrome changes height.
- Relevant checks and actual release/browser evidence distinguish source/desktop checks from physical-phone acceptance.

Evidence/specification: [docs/MOBILE-ONBOARDING.md](../../docs/MOBILE-ONBOARDING.md), [public/assets/atmosphere.css](../../public/assets/atmosphere.css), [public/assets/home.css](../../public/assets/home.css), [public/assets/styles.css](../../public/assets/styles.css), [public/play/index.html](../../public/play/index.html), [scripts/site-pages.mjs](../../scripts/site-pages.mjs), [tests/atmosphere-client.test.js](../../tests/atmosphere-client.test.js).

## CONT-003: Reconcile roadmap, stale drafts and current acceptance evidence

**P0 / done.** Owner: Maintainer. Dependencies: none.

Next action: Roadmap checkpoint prepared in PR #139; #119 is closed as superseded with branch/head retained and all unshipped work tracked. #120 remains open/paused with the same head. Preserve the current record and resume OPS-001; final head/check/merge is in #139’s review record.

Acceptance:

- Every old PR changed-file blob is inventoried at an exact head and retained work has stable backlog IDs.
- Current roadmap, beta source/dependency evidence and limited founder phone observations agree.
- Superseded passkey draft cannot be mistaken for a merge candidate; paused art stays preserved.
- Continuity, repository, inventory and documentation checks pass; final PR/check/merge evidence is retained.

Evidence/specification: [docs/ROADMAP-CHECKPOINT.md](../../docs/ROADMAP-CHECKPOINT.md), [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/continuity/pr-reconciliation.json](../../docs/continuity/pr-reconciliation.json), [docs/FREE-BETA-READINESS.md](../../docs/FREE-BETA-READINESS.md).

## WALLET-001: Review and isolate the optional Testnet wallet lab retained from #119

**P1 / planned.** Owner: Wallet maintainer; independent wallet reviewer unassigned. Dependencies: none.

Next action: Start a fresh scoped branch from current main and review the pinned lab/SDK/backup files from superseded #119. Do not reuse its old authentication, lockfile or CSP wholesale. No new lab implementation is authorized by roadmap cleanup.

Acceptance:

- Reviewed artifact/SDK integrity and restrictive origin/CSP design.
- Locally generated Testnet-only material, encrypted backup and verified actual-device restore; no existing recovery phrase requested by login.
- Account passkeys remain distinct from wallet-key unlocking; independent security/recovery acceptance precedes any custody expansion.

Evidence/specification: [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/continuity/pr-reconciliation.json](../../docs/continuity/pr-reconciliation.json).

## CHAIN-003: Review retained Testnet reward-desk amount and copy polish

**P2 / done.** Owner: Maintainer. Dependencies: none.

Next action: Retain the final indexed-confirmed JSON export privately. The one-transfer manual pilot is complete; any repeat or automatic-signing rollout is separate scoped work.

Acceptance:

- Integer base units and validated decimals produce exact wallet amounts.
- Copy failures have usable manual selection and never send a transaction.
- One-send/same-hash reconciliation and existing Daily/receipt authorization remain unchanged.

Evidence/specification: [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/TESTNET-REWARD-PILOT.md](../../docs/TESTNET-REWARD-PILOT.md), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/FIRST-PROOF-LAUNCH.md](../../docs/FIRST-PROOF-LAUNCH.md), [docs/GEEKT-FIRST-PAYOUT-2026-10-18.md](../../docs/GEEKT-FIRST-PAYOUT-2026-10-18.md).

## PILOT-002: Review retained wallet-safety course and evaluation tooling

**P1 / planned.** Owner: Pilot coordinator and instructor unassigned. Dependencies: PILOT-001.

Next action: Review pinned course/evaluation files from superseded #119 against the pilot charter before extracting them. Appoint a coordinator and approve assessments/privacy/consent before recruitment.

Acceptance:

- Approved objective/assessment mapping, authority, accessibility/privacy and stop rules before any recruitment.
- Evaluation distinguishes missing follow-ups and descriptive paired results without treating them as verified learning outcomes.
- Real delivery/data disposition evidence stays private; no public learner records or automatic rewards.

Evidence/specification: [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/continuity/PILOT-CHARTER.md](../../docs/continuity/PILOT-CHARTER.md).

## ART-001: Preserve paused original art and resume production only on founder direction

**P2 / blocked.** Owner: Founder supplies art; production maintainer unassigned. Dependencies: none.

Next action: Keep #120 and its exact twenty original PNGs/tracker intact. Await founder resumption; review against current continuity before any merge.

Blocker: Founder paused further collection-art production; additional GIGA/A.C.E. art awaits supply.

Acceptance:

- Original filenames/bytes/provenance remain intact at the pinned paused head.
- 500 concepts × five artworks remain distinct from finished-image and collectible-supply counts.
- A separate founder resumption precedes additional generation/production; runtime migration remains COLL-001.

Evidence/specification: [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/continuity/pr-reconciliation.json](../../docs/continuity/pr-reconciliation.json), [docs/GEEK-500-COLLECTION-STRUCTURE.md](../../docs/GEEK-500-COLLECTION-STRUCTURE.md).

## SEO-001: Maintain metadata and link coverage for every HQ page

**P0 / done.** Owner: Maintainer. Dependencies: none.

Next action: Maintain catalog/CI as pages change; external blocked links remain unverified.

Acceptance:

- All public/operator HTML templates have maintained metadata and explicit indexing policy.
- Sitemap/canonical/share metadata and internal targets/fragments agree and are checked in CI.
- Actual candidate/PR/deployment evidence and external audit limits are recorded.

Evidence/specification: [docs/site-pages.json](../../docs/site-pages.json), [scripts/site-pages.mjs](../../scripts/site-pages.mjs), [docs/site-link-review-2026-10-17.json](../../docs/site-link-review-2026-10-17.json), [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md).

## AUTH-003: Provide a cross-device account path beyond local passkey creation

**P0 / needs-evidence.** Owner: Maintainer; family-account and recovery policy reviewed by founder. Dependencies: none.

Next action: Cross-flow real-Redis/P-256 test now covers Study, complete Daily, XP claim, tracked path, receiving tablet, sign-out and fresh passkey return. Validate on the actual phone/Silk pair, including revocation. Synthetic tests are not device acceptance.

Acceptance:

- Unsupported-passkey devices have a tested, explicit authorized sign-in path.
- Fresh proof, short expiry, replay protection, rate limits and device revocation preserve player ownership.
- Same-player access is clearly distinguished from unimplemented parent/child roles; real Silk/phone recovery acceptance is recorded without seed phrases or an address-only bypass.

Evidence/specification: [docs/PASSKEY-LOGIN.md](../../docs/PASSKEY-LOGIN.md), [docs/IDENTITY-PROTOCOL.md](../../docs/IDENTITY-PROTOCOL.md), [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md), [docs/TRUSTED-DEVICE-ACCESS.md](../../docs/TRUSTED-DEVICE-ACCESS.md), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [tests/passkeys.test.js](../../tests/passkeys.test.js).

## ACE-001: Build source-grounded A.C.E. tutoring and scoped operational automation

**P1 / needs-evidence.** Owner: Maintainer; AI/content evaluation reviewer unassigned. Dependencies: none.

Next action: #148 merged/deployed. Authored lesson help works; optional bounded Gateway path and private read-only readiness are installed. Select model/budget/data policy and record a bounded live citation/injection/usage evaluation before activation. Autonomous operational tools are not installed.

Acceptance:

- Tutor retrieves reviewed sources and keeps grading/reward authority deterministic.
- Typed role-checked tools, audit history, bounded budget/latency and authored fallback are tested.
- Citation/learning/injection evaluations and pilot evidence precede broader automation; existing publication, recovery and settlement gates remain enforced.

Evidence/specification: [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md), [docs/PRODUCT-ROADMAP.md](../../docs/PRODUCT-ROADMAP.md), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/ACE-TUTOR.md](../../docs/ACE-TUTOR.md), [server/ace-tutor.js](../../server/ace-tutor.js), [tests/ace-tutor.test.js](../../tests/ace-tutor.test.js), [tests/ace-client.test.js](../../tests/ace-client.test.js).

## PERF-001: Measure growth capacity and stage storage, delivery and worker improvements

**P1 / needs-evidence.** Owner: Maintainer; performance/recovery reviewer unassigned. Dependencies: none.

Next action: Local baseline recorded: 24 players/162 mixed requests/zero errors; fresh-process 10k/100k question growth; Study deployment content memoized. Gather phone/network and production saturation metrics, then evaluate compact indexes/versioned assets/durable workers. No hosting/database cutover is justified or performed yet.

Acceptance:

- Record p50/p95/error/memory/Redis/model metrics and saturation under representative load.
- Preserve issued answer keys, private/no-store boundaries and exactly-once receipt effects through retries.
- Provider restore and rollout/rollback evidence support any selected infrastructure change.

Evidence/specification: [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md), [docs/BACKUP-RECOVERY.md](../../docs/BACKUP-RECOVERY.md), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/PERFORMANCE-BASELINE.md](../../docs/PERFORMANCE-BASELINE.md), [scripts/performance-baseline.mjs](../../scripts/performance-baseline.mjs), [docs/performance/2026-10-17-readiness.json](../../docs/performance/2026-10-17-readiness.json).

## UX-006: Make returning login clear and keep advanced setup optional

**P0 / needs-evidence.** Owner: Maintainer; founder confirms usability. Dependencies: none.

Next action: Preserve the simplified login UI. New full saved-player journey regression passes internally; gather actual returning-phone/Silk clarity and recovery evidence.

Acceptance:

- Main page presents a clear returning Sign in and guest path without automatically expanding technical help.
- An authenticated session offers continuation and its actual player; setup and management are not mistaken for login.
- Existing passkey, wallet, device approval, single-use proof and fixed return-destination checks remain enforced.
- Relevant tests, rendered preview and actual release evidence are recorded; founder/device acceptance remains distinct.

Evidence/specification: [public/sign-in/index.html](../../public/sign-in/index.html), [public/sign-in/assets/sign-in.js](../../public/sign-in/assets/sign-in.js), [public/sign-in/assets/passkeys.js](../../public/sign-in/assets/passkeys.js), [tests/passkey-client.test.js](../../tests/passkey-client.test.js), [docs/TRUSTED-DEVICE-ACCESS.md](../../docs/TRUSTED-DEVICE-ACCESS.md), [tests/sign-in-state.test.js](../../tests/sign-in-state.test.js), [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md).

## UX-007: Add a five-word hunt and one-time rewarded challenges

**P1 / needs-evidence.** Owner: Maintainer; founder confirms phone usability. Dependencies: none.

Next action: #146 merged/deployed; verify the hunt, entry, clue links, task claims and My HQ journey on the actual phone. Keep independent review and unrelated background/login acceptance separate.

Acceptance:

- Five page-local, accessible discoveries reveal words without blocking learning or navigation.
- Challenges lists word clues, found/claimed state, automatic all-five bonus, existing-result tasks and clear career XP amounts.
- Resolved-player claims and XP commit atomically with audit; duplicate, concurrent, lost-response and forged requests cannot add extra XP. Claims outlive journey pruning and prestige resets.
- No tokens, game credits, scores, question answers, CCE activation or settlement changes; relevant tests and release evidence recorded.

Evidence/specification: [docs/REWARDED-CHALLENGES.md](../../docs/REWARDED-CHALLENGES.md), [server/rewarded-challenges.js](../../server/rewarded-challenges.js), [tests/rewarded-challenges.test.js](../../tests/rewarded-challenges.test.js), [tests/rewarded-challenges-client.test.js](../../tests/rewarded-challenges-client.test.js), [public/challenges/assets/rewarded.js](../../public/challenges/assets/rewarded.js).

## GAME-001: Build a deep career challenge and mastery ladder

**P1 / needs-evidence.** Owner: Maintainer; founder confirms phone/game usability. Dependencies: none.

Next action: #147 merged/deployed; gather actual-phone challenge tracking, filters, gameplay unlock/claim and My HQ feedback. Keep independent review and unrelated auth/background acceptance separate.

Acceptance:

- Casual players see three suggested goals while dedicated players can search/filter all 90 challenges across 18 Bronze-to-Diamond paths.
- Achievements share server eligibility with rewards; legacy 12 achievements, five-word hunt and two issued claim IDs remain compatible.
- Three tracked paths persist for the resolved player and advance with claimed tiers; 18 mastery emblems and round-end notices recognize progress.
- Permanent once-only receipts, atomic bounded multi-claim and profile/prestige CAS protect XP under replay, lost responses and concurrent updates. New mode/perfect counters are honestly prospective and commit with game results.
- Relevant tests, browser observations, exact release and remaining phone/independent-review limits are retained; no token settlement or CCE hold changes.

Evidence/specification: [docs/CAREER-MASTERY.md](../../docs/CAREER-MASTERY.md), [server/career-challenges.js](../../server/career-challenges.js), [tests/career-challenges.test.js](../../tests/career-challenges.test.js), [tests/rewarded-challenges.test.js](../../tests/rewarded-challenges.test.js), [tests/ranked-persistence.test.js](../../tests/ranked-persistence.test.js).

## LAUNCH-001: Prove the core loop and close the first release scope

**P0 / needs-evidence.** Owner: Maintainer implements and checks; founder supplies real-device and wallet approval; provider custodian unassigned. Dependencies: none.

Next action: First manual GEEKT pilot is complete. Retain its final confirmed export, then close saved-player return/Silk and provider recovery evidence and the remaining scoped beta scenarios. No additional transfer is needed for this receipt.

Acceptance:

- Owner desk checks the current same-browser Daily proof and native remaining run lifetime without renewing it; expired/ineligible runs cannot enable its queue button.
- Return from gameplay or browser back-forward cache refreshes private readiness without automatically queuing, signing or sending; late canceled responses cannot restore private state.
- Publish the exact checked change and retain live monitoring failures, real-device/wallet/provider gaps and the finite pilot scope.
- Founder reviews actual pilot results before a Beta label; full campaign, two-person Royale and capacity claims retain their existing acceptance checklist.

Evidence/specification: [docs/FIRST-PROOF-LAUNCH.md](../../docs/FIRST-PROOF-LAUNCH.md), [docs/TESTNET-REWARD-PILOT.md](../../docs/TESTNET-REWARD-PILOT.md), [tests/testnet-client.test.js](../../tests/testnet-client.test.js), [tests/testnet-rewards.test.js](../../tests/testnet-rewards.test.js), [docs/GEEKT-FIRST-PAYOUT-2026-10-18.md](../../docs/GEEKT-FIRST-PAYOUT-2026-10-18.md).

## CHAIN-004: Automate eligible Daily GEEKT test rewards

**P0 / blocked.** Owner: Maintainer; founder controls test funding and device acceptance. Dependencies: CHAIN-001.

Next action: Vercel project-create permission returned 403; founder/provider administrator must create the separate project with Root Directory workers/testnet. Then configure/fund the dedicated signer and verify one actual automatic payout. HQ release and offline tests do not satisfy live acceptance.

Blocker: Vercel API denied project creation with 403 forbidden in the existing team; no CLI or CLI credentials are available. Separate signer project, secrets, funding and actual automatic acceptance remain absent.

Acceptance:

- Owner enrolls a player once; eligible completed Daily and reward job commit together without copying run IDs.
- Dedicated TN10 signer persists exact signed commit/reveal before broadcast; concurrency, lost responses and restarts never create a second payment.
- Same-hash acceptance appears automatically for the enrolled player; private records stay private.
- Separate scheduled signer deployed, funded and one actual automatic transfer accepted; implementation/offline checks alone are insufficient.
- Mainnet settlement, CCE and collectible ownership remain disabled.

Evidence/specification: [docs/AUTOMATIC-GEEKT-REWARDS.md](../../docs/AUTOMATIC-GEEKT-REWARDS.md), [server/testnet-automatic.js](../../server/testnet-automatic.js), [workers/testnet/process.mjs](../../workers/testnet/process.mjs), [workers/testnet/signer.mjs](../../workers/testnet/signer.mjs), [tests/testnet-automatic.test.js](../../tests/testnet-automatic.test.js), [tests/testnet-worker.test.js](../../tests/testnet-worker.test.js).

## CHAIN-005: Recover player reward status after interruptions

**P1 / needs-evidence.** Owner: Maintainer; founder confirms actual-phone behavior. Dependencies: none.

Next action: Review and release PR #155, verify production delivery and actual-phone behavior. The private preview check was blocked by provider authentication; do not infer application acceptance. Keep separate signer activation with CHAIN-004.

Acceptance:

- Private canonical status reads recover from temporary network, HTTP and timeout failures with one bounded request and a 15-second polling interval.
- Queued or prepared payments report a pause when HQ automation is disabled; already confirmed payments retain their observed confirmation.
- A saved-run event during a pending read triggers a fresh read without overlapping requests; enrolled and confirmed views can discover later jobs.
- Lost access or enrollment clears the prior status; player changes, backgrounding and page-cache return invalidate late responses and request-specific deadlines.
- Focused client tests, full required checks and exact release evidence are recorded; synthetic DOM tests do not establish real-device or automatic payment acceptance.

Evidence/specification: [public/play/assets/testnet-status.js](../../public/play/assets/testnet-status.js), [tests/testnet-status-client.test.js](../../tests/testnet-status-client.test.js), [docs/AUTOMATIC-GEEKT-REWARDS.md](../../docs/AUTOMATIC-GEEKT-REWARDS.md).
