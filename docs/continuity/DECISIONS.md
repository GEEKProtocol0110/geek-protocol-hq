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

**existing-direction** · 2026-10-15.

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
