# Decision register

Generated from the maintained JSON by `npm run continuity:write`. Update the source record, then regenerate. [Start Here](../../START-HERE.md).

Founder direction, earlier product boundaries, implementation choices, proposals and unresolved questions retain distinct labels. Append a superseding record when changing a decision.

## DR-001: HQ is the central project record

**implementation-choice** · 2026-10-15.

Keep the canonical HQ repo as the continuation entry point; index component repos rather than create another competing master.

Basis: Founder requested this repo or a repo to preserve continuity; this is the maintainer's reversible implementation choice.

Evidence: [START-HERE.md](../../START-HERE.md).

## DR-002: Keep the bank-first CCE hold

**founder-direction** · 2026-10-15.

Require 1,000 legitimate source-reviewed concepts in each of eight categories before CCE resumes, plus separately approved economy rules.

Basis: Founder direction retained by PR #111; 500 is the completed intermediate Kaspa milestone.

Evidence: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md).

## DR-003: Contributor amount is not selected

**unresolved** · 2026-10-15.

1 or 5 GEEK are examples only. Do not convert a planning amount into a payable promise.

Basis: Founder requires small rewards; rate, funded budget and qualification are unfinished.

Evidence: [docs/BANK-FIRST-STORE.md](../../docs/BANK-FIRST-STORE.md).

## DR-004: Keep game credits and real settlement separate

**existing-boundary** · 2026-10-15.

Public Alpha credits are internal; treasury settlement and collection ownership remain disabled.

Basis: Existing product and audit boundaries.

Evidence: [docs/ECONOMY-PROTOCOL.md](../../docs/ECONOMY-PROTOCOL.md), [docs/COLLECTIBLE-PROTOCOL.md](../../docs/COLLECTIBLE-PROTOCOL.md).

## DR-005: Preserve the five-tier 500-Geek collection

**superseded** · 2026-10-15.

The edition plan is 500 in Common/Rare/Epic/Legendary/Mythic, separate from question counts.

Basis: Existing founder collection direction and manifest.

Evidence: [docs/GEEK-500-ART-BIBLE.md](../../docs/GEEK-500-ART-BIBLE.md).

## DR-006: Plan for schools and public service over fifty years

**founder-direction** · 2026-10-15.

Preserve school integration, government contracting and public-service/military refresher learning and rewards as a staged long-term ambition.

Basis: Founder request October 15, 2026. No contract, accreditation or implementation is implied.

Evidence: [docs/continuity/VISION-2076.md](../../docs/continuity/VISION-2076.md).

## DR-007: Pilot one learning outcome before institution-wide expansion

**proposal** · 2026-10-15.

Start with a bounded instructor-supported course and measured retention; expand after evidence.

Basis: Maintainer proposal for delivering the founder's long-term direction.

Evidence: [docs/continuity/PILOT-CHARTER.md](../../docs/continuity/PILOT-CHARTER.md).

## DR-008: Keep institutional learning usable without a wallet

**proposal** · 2026-10-15.

Use nonfinancial recognition first in a pilot; evaluate optional funded rewards separately with the institution.

Basis: Maintainer proposal, aligned with the current guest-first learning path; not a final institutional reward policy.

Evidence: [docs/continuity/INSTITUTIONAL-PATH.md](../../docs/continuity/INSTITUTIONAL-PATH.md).

## DR-009: Founding duration needs originals

**unresolved** · 2026-10-15.

Preserve the founder's 23-hour recollection and the earlier assistant kit's approximately 29-hour claim as unresolved; do not certify either.

Basis: Original conversation timestamps and deliverable inventory are not ingested.

Evidence: [docs/continuity/ARCHIVE-GUIDE.md](../../docs/continuity/ARCHIVE-GUIDE.md).

## DR-010: Succession is not yet assigned

**unresolved** · 2026-10-15.

Document the succession process now; the founder must appoint real trusted custodians privately.

Basis: A role description is not an account transfer or legal succession instrument.

Evidence: [docs/continuity/SUCCESSION.md](../../docs/continuity/SUCCESSION.md).

## DR-011: Mirror GEEK deployment tokenomics in GEEKT

**founder-direction** · 2026-10-15.

For TN10 rehearsal, mirror the pinned Mainnet maximum of 144 billion, 100,000 per mint, eight decimals and zero premint. Keep a separate test ticker, network and deployment identity.

Basis: Founder questioned the smaller test-supply proposal on October 15; it had not been deployed. Deployment-field parity is separate from wallet approval, rewards and settlement.

Evidence: [docs/TESTNET-ASSET-SETUP.md](../../docs/TESTNET-ASSET-SETUP.md), [docs/testnet/geekt-deploy.json](../../docs/testnet/geekt-deploy.json), [server/mint.js](../../server/mint.js).

## DR-013: Use GIGA/A.C.E. across HQ and revise seasonal decoration

**founder-direction** · 2026-10-16.

Reuse established GIGA and A.C.E. character art across public HQ pages, add more cosmic/coder character and richer per-page holiday decoration, remove the space-animation button, and remove MLK Day and Juneteenth from selectable/automatic themes. Preserve motion preferences and game clarity.

Basis: Founder request October 16, 2026; this visual scope does not resume the separate paused collection-art production draft.

Evidence: [docs/HOLIDAY-THEMES.md](../../docs/HOLIDAY-THEMES.md).

## DR-014: Reduce character prominence while more GIGA/A.C.E. art is pending

**founder-direction** · 2026-10-16.

Dial back the repeated GIGA/A.C.E. art and emphasize space/neon/glitch/coder backgrounds. Remove the new per-page character panels and large home portrait; retain established story contexts. Keep the revised holiday catalog, richer seasonal styling and removed motion button.

Basis: Founder correction October 16 after reviewing PR #131: more character artwork will be supplied later. This supersedes the broad character-prominence choice, not the retained holiday direction.

Evidence: [docs/HOLIDAY-THEMES.md](../../docs/HOLIDAY-THEMES.md). Supersedes DR-013.

## DR-015: Kaspa onboarding ecosystem and playful discoveries

**founder-direction** · 2026-10-16.

Position Geek Protocol as a Kaspa onboarding ecosystem built for Proof of Learning. Add modest optional Easter eggs that fit the Grid, preserving the dialed-back character direction and all learning/reward boundaries.

Basis: Founder clarified the ecosystem identity and asked about Easter eggs/fun on October 16, 2026.

Evidence: [docs/GRID-DISCOVERIES.md](../../docs/GRID-DISCOVERIES.md).

## DR-012: 500 character concepts, each with five rarity artworks

**founder-direction** · 2026-10-15.

Plan 500 Geek character concepts with Common, Rare, Epic, Legendary and Mythic artwork for every concept: 2,500 distinct planned images. This corrects the earlier interpretation of 500 total editions. Artwork count does not determine collectible copies per artwork, mint supply or acquisition allocations.

Basis: Founder clarified October 15, 2026: “So you see the direction I went with the 500 geek. 2500 different images.” Three supplied five-tier sets demonstrate the intended structure. Runtime manifest migration remains COLL-001 work. Recovered into main during October 16 PR reconciliation; later fourth-set intake remains preserved in paused PR #120. No art production or runtime migration resumed.

Evidence: [docs/GEEK-500-COLLECTION-STRUCTURE.md](../../docs/GEEK-500-COLLECTION-STRUCTURE.md), [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md), [docs/continuity/pr-reconciliation.json](../../docs/continuity/pr-reconciliation.json). Supersedes DR-005.

## DR-016: Regroup around beta loose ends, preservation and the reviewed learning path

**founder-direction** · 2026-10-16.

Reconcile older PRs and current roadmap first, then close remaining beta evidence and independent backup/provider-recovery evidence, continue reviewed Kaspa content, complete the existing manual Testnet receipt pilot and inspect ecosystem components. Preserve paused art and all economic/security holds.

Basis: Founder asked to regroup around the roadmap and loose ends, then approved the proposed roadmap-housekeeping/PR-reconciliation step on October 16. This does not authorize a new wallet, mainnet settlement, art production, recruitment or provider cutover.

Evidence: [docs/ROADMAP-CHECKPOINT.md](../../docs/ROADMAP-CHECKPOINT.md), [docs/PR-RECONCILIATION.md](../../docs/PR-RECONCILIATION.md).

## DR-017: Refresh all page metadata and prioritize device access, GEEKT and A.C.E. readiness

**founder-direction** · 2026-10-17.

Update HQ page/link metadata, investigate Amazon Silk enrollment, preserve a path for growing reviewed question content and plan A.C.E. as part of the product and operational automation. Complete the existing GEEKT pilot; existing proof, publication and Mainnet settlement holds remain applicable.

Basis: Founder request October 17: two essential suggestions and five system improvements; confirmed Amazon Silk on the family tablet. This establishes product direction, not completed device pairing, a model service or automatic token signing.

Evidence: [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md), [docs/site-pages.json](../../docs/site-pages.json).

## DR-018: Implement nearby same-player approval without inventing family roles

**implementation-choice** · 2026-10-17.

Implement a passkey-approved same-player tablet session with fresh proof, bounded single-use requests, explicit same-player consent and revocation. Parent/child relationships, email recovery, ACE model provisioning and autonomous settlement remain separate.

Basis: Founder Make it so on October 17 authorizes work on the two-essential/five-system roadmap. This implementation shares the existing player explicitly; it does not establish parental authority or grant a tablet fresh account-management proof.

Evidence: [docs/TRUSTED-DEVICE-ACCESS.md](../../docs/TRUSTED-DEVICE-ACCESS.md), [docs/PLATFORM-NEXT-STEPS.md](../../docs/PLATFORM-NEXT-STEPS.md).

## DR-019: Simplify login after the device-access usability regression

**founder-direction** · 2026-10-17.

Prioritize returning Sign in and guest play. Keep new-player saving, device linking, wallet message proof and access management optional and closed. Reuse the validated account-status response for session display rather than competing client checks; retain all server proof and account records.

Basis: Founder October 17: Now login is even more confusing. This corrects presentation and state coordination; no new authentication provider or recovery authority is added.

Evidence: [public/sign-in/index.html](../../public/sign-in/index.html), [public/sign-in/assets/passkeys.js](../../public/sign-in/assets/passkeys.js), [tests/passkey-client.test.js](../../tests/passkey-client.test.js).

## DR-020: Reward hidden-word discoveries and verified tasks with career XP

**founder-direction** · 2026-10-17.

Expand optional discoveries into five hidden words, a rewarded challenge list and one-time career XP claims. Existing toy terminal commands stay cosmetic; token settlement and all CCE holds remain unchanged. Use stable player-bound claims, server eligibility and atomic XP/receipt writes.

Basis: Founder October 17 asks to type hidden words for rewards, five words around the site, a rewarded challenge list and XP for completed tasks. Maintainer selects 25 XP per word plus a 75 XP set bonus, and two small scored-game milestones.

Evidence: [docs/REWARDED-CHALLENGES.md](../../docs/REWARDED-CHALLENGES.md), [docs/GRID-DISCOVERIES.md](../../docs/GRID-DISCOVERIES.md). Supersedes DR-015.

## DR-021: Offer accessible next goals and deep game-style mastery tracks

**founder-direction** · 2026-10-17.

Expand achievements and rewarded challenges into Bronze-to-Diamond career paths, category specialization, skill/mode/Gauntlet goals, mastery emblems, three saved tracked paths and a shared authoritative catalog. Keep a short recommended view for casual players and an optional searchable catalog for dedicated completionists. Preserve lifetime progress, prior receipts and all token/CCE holds.

Basis: Founder October 17 requests a modern game-style breadth/depth system using Call of Duty and Xbox achievements as examples, with goals for regular and expert players. Maintainer selects 18 five-tier paths, modest once-only XP, 18 emblems and honest new-counter start dates; no external platform integration or certification is claimed.

Evidence: [docs/CAREER-MASTERY.md](../../docs/CAREER-MASTERY.md), [docs/REWARDED-CHALLENGES.md](../../docs/REWARDED-CHALLENGES.md).

## DR-022: Advance the saved-player, GEEKT, ACE, capacity and reviewed-content roadmap

**founder-direction** · 2026-10-17.

Continue all five roadmap paths with concrete implementation and evidence: preserve saved-player access, prepare the manual GEEKT rehearsal, implement bounded lesson-grounded ACE with authored fallback and read-only readiness, measure capacity/recovery, and add distinct source-reviewed Kaspa content. Device acceptance, wallet approval, model/budget activation and provider restoration retain their separate real-world prerequisites.

Basis: Founder October 17 asks what is next, then approves all that. This does not invent a model spending amount, grant autonomous administrator/signing authority, bypass Daily eligibility or remove existing holds.

Evidence: [docs/PLAYER-READINESS-2026-10-17.md](../../docs/PLAYER-READINESS-2026-10-17.md), [docs/ACE-TUTOR.md](../../docs/ACE-TUTOR.md), [docs/PERFORMANCE-BASELINE.md](../../docs/PERFORMANCE-BASELINE.md).

## DR-023: Prioritize a finite proof run before further expansion

**founder-direction** · 2026-10-18.

Make the next release about demonstrating the existing learning and reward-receipt path, closing launch blockers and recording acceptance. Keep question growth and optional features from indefinitely expanding that scope. Public Alpha, full free-beta acceptance, testnet transfer proof, paid-model activation and Mainnet settlement remain distinct.

Basis: Founder October 18 Detroit: continue building, wrap this up and turn it on; improvement never stops but proving must be the start. This prioritizes implementation and proof, without fabricating device/wallet/provider evidence or overturning the bank-first CCE and economic holds.

Evidence: [docs/FIRST-PROOF-LAUNCH.md](../../docs/FIRST-PROOF-LAUNCH.md), [docs/FREE-BETA-READINESS.md](../../docs/FREE-BETA-READINESS.md).

## DR-024: Automate the testnet reward path after the first transfer proof

**founder-direction** · 2026-10-18.

Move from the proven manual receipt workflow to one-time owner test enrollment, automatic eligible Daily admission and a separately hosted scheduled TN10 signing/reconciliation service. Use a dedicated bounded testnet wallet, persistent replay locks and immutable signed transaction journals. This direction authorizes testnet automation; it does not open Mainnet, CCE or collectible settlement.

Basis: Founder October 18: Lol Manual pilot. This all needs to be automatic. The manual transfer is the baseline proof, not the finished player experience.

Evidence: [docs/AUTOMATIC-GEEKT-REWARDS.md](../../docs/AUTOMATIC-GEEKT-REWARDS.md), [docs/GEEKT-FIRST-PAYOUT-2026-10-18.md](../../docs/GEEKT-FIRST-PAYOUT-2026-10-18.md). Supersedes DR-023.

## DR-025: Use wallet-first sign-in and backend reward handling

**founder-direction** · 2026-10-24.

Present one wallet connect-and-sign-in action, retain optional saved-access recovery, and handle eligible reward destination selection, admission, payment retries and receipts on the server. Do not require players to use owner enrollment forms, transaction hashes or provider dashboards. Keep verified ownership, bounded TN10 approval and Mainnet settlement holds.

Basis: Founder October 24: This is too difficult for users. They need to log in with a wallet and everything else be taken care of on our end. This supersedes the passkey-first presentation in DR-019, without treating a connected address as authentication or granting public Mainnet payouts.

Evidence: [docs/WALLET-FIRST-ONBOARDING.md](../../docs/WALLET-FIRST-ONBOARDING.md), [public/sign-in/index.html](../../public/sign-in/index.html), [public/assets/wallet.js](../../public/assets/wallet.js), [server/testnet-automatic.js](../../server/testnet-automatic.js). Supersedes DR-019.
