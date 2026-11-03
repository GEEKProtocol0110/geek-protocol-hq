# KCC20 research for Geek Protocol

Checked October 15, 2026. **Recommendation: prepare a separate prototype; do not announce or execute a GEEK migration yet.** KCC20 could support covenant-controlled token use, but the chosen implementation, holder transition, supply representation, wallet support and funding still need evidence. This is research, not a deployment, independent audit or finalized token policy.

Task: **CHAIN-002**. [Pinned source catalog and findings](research/kcc20-2026-10-15.json). HQ runtime baseline: `65820b08a8b84d08db1756a65c2e9bf83df66569`. The founding-file work remains separately reviewable in [PR #116](https://github.com/GEEKProtocol0110/geek-protocol-hq/pull/116).

## What the names mean

| Name | Meaning for this review |
| --- | --- |
| KRC-20 | GEEK's existing Kasplex inscription/indexer token. Its deployed identity and current mint are pinned by HQ. |
| KCC-20 | Kaspa's proposed fungible covenant-token convention; its header was **Last Call** at the Oct 15 snapshot and is **Final** on [kccs master](https://github.com/kaspanet/kccs) as of Oct 30, 2026. |
| KCC20V2 / other KCC20 products | Concrete implementations that require their own compatibility check. A name or wallet tab does not prove conformance. |
| ERC-20 on an EVM network | A different token environment and potentially a bridge route; not synonymous with native KCC-20. |

[KCC-20](https://github.com/kaspanet/kccs/blob/1516a6c4cef59940fc3af3096dbcdd9c08690254/kcc-0020.md) specifies token state, transfer entrypoints, borrowing and program artifacts. Its state includes amount, owner, authority scheme, borrowing policy and an extended-state commitment. The default transfer bounds are three token inputs and three outputs; they are configurable, not a promise of arbitrary batch size. Compatible states conserve quantity and preserve their extension commitment during a standard transfer. Borrowed receive can increase an existing recipient state without that recipient signing, under its configured policy, while preserving ownership and KAS value. It is a receive mechanism, not borrowing money. These features are specification requirements, not evidence that Geek implements them.

[KCC-1](https://github.com/kaspanet/kccs/blob/1516a6c4cef59940fc3af3096dbcdd9c08690254/kcc-0001.md) supplies the shared covenant/ABI conventions; [KCC-2](https://github.com/kaspanet/kccs/blob/1516a6c4cef59940fc3af3096dbcdd9c08690254/kcc-0002.md) defines key-, script- and covenant-based authority. A wallet integration must recognize the exact scheme and verify what it authorizes. Both headers were Last Call at the Oct 15 snapshot and are Final on kccs master as of Oct 30, 2026; the pinned links above still point at the Oct 15 text, so recheck the content diff before relying on it.

[KIP-20](https://github.com/kaspanet/kips/blob/e4ae2332117b5cb68bd6188e065ef885b6d17939/kip-0020.md) is the underlying consensus covenant-ID mechanism, not the token convention. It provides lineage tied to valid genesis and continuation rules; correct token scripts must still enforce their transitions. The [node guide](https://github.com/kaspanet/rusty-kaspa/blob/7cc22feadb36cbb9678bffed5896aebe1a30b14d/docs/toccata-guide.md) records the Toccata activation target as DAA 474,165,565, approximately June 30, 2026. Its future-tense text is historical release guidance, not a live activation probe performed here. It also documents transaction-version, covenant, compute-budget and storage-mass API changes. Obtain fee estimates from the actual node/wallet; do not reuse a fixed KRC-20 fee assumption.

## Implementations and tools worth evaluating

| Source | What is actually documented | Geek implication / limit |
| --- | --- | --- |
| [Argent KCC20 reference](https://github.com/argent-lang/kcc20-reference/tree/c8a087117735a1f87c5c6d115fcddeaf2562c784) | Token actor, public-mint app, seed receiving states, artifacts, offline examples and VM/conformance tests. | Good standards-focused reference. Its tests explicitly exclude network submission and wallet synchronization and are not an independent audit. |
| [KaspaCom TX builder](https://github.com/KASPACOM/kcc20-tx-builder/tree/d65c203071c131f36ba1687c3d4f76ccf929733a) | Source declares version 0.5.0, Apache-2.0; browser/Node construction, deploy/mint/transfer, wrapper/orderbook and snapshot families. | Construction is separate from signing, broadcasting, authorization and receipt tracking. Public npm package discovery exists; registry installation/integrity and all operations were not tested here. |
| [KaspaCom compatibility issue #11](https://github.com/kaspanet/kccs/issues/11) | KaspaCom described its existing KCC20V2 artifact as partially aligned, with descriptor work rather than changing that deployed artifact. Issue closed August 22. | Closure is not a conformance certificate for that artifact or proof about today's differently versioned builder. Check exact artifacts against current vectors. |
| [Token Depot v1.2 proposal](https://github.com/token-depot/kcc20-specification/blob/cc6eacf2c825843ca93089fe2a6b9d53f0163609/docs/spec/KCC20_Specification_v1.2_Community_Review.md) | Separate community-review proposal and OMA/Compliance Wallet implementation claims; optional issuer/regulated profiles. | Do not substitute its ABI for kaspanet's current convention. It explicitly is not an accepted KCC. Regulated Testnet capabilities and production authorization are separate. |
| [SilverScript](https://github.com/kaspanet/silverscript) | Compiler, documentation and covenant examples. | Pin compiler, source, generated artifact and tests together; do not assume every historical example matches current KCC-20. |

The Argent reference supports permissionless issuance with a remaining allowance and per-mint limit, plus minter/seed split and reclaim operations. Its suggested single-minter genesis is not a migration contract. Split/reclaim tests have stated coverage limits. The examples run locally; no external test suite was executed during this research.

The builder's [integration guide](https://github.com/KASPACOM/kcc20-tx-builder/blob/d65c203071c131f36ba1687c3d4f76ccf929733a/docs/INTEGRATION.md) requires a host-provided compatible WASM runtime, fresh state, artifacts and a signer flow. Browser-built transactions remain untrusted. Its [standards lock](https://github.com/KASPACOM/kcc20-tx-builder/blob/d65c203071c131f36ba1687c3d4f76ccf929733a/artifacts/snapshot-standards.lock.json) pins an earlier KCC revision and compiler dependencies; that pin must be compared with the current specification before claiming compatibility. HQ currently uses `@dfns/kaspa-wasm` 0.14.1 for existing work; this review does not establish it can construct or sign the newer covenant flows.

## A concrete GEEK supply constraint

Current [deployment metadata](../server/geek-deployment.js): maximum **144,000,000,000 GEEK**, **8 decimals**, **100,000 per mint**, zero premint. Maximum raw quantity is **14,400,000,000,000,000,000**. The [reference](https://github.com/argent-lang/kcc20-reference/blob/c8a087117735a1f87c5c6d115fcddeaf2562c784/README.md) uses non-negative integer amounts and limits transfer totals to **9,223,372,036,854,775,807**. Its [minter](https://github.com/argent-lang/kcc20-reference/blob/c8a087117735a1f87c5c6d115fcddeaf2562c784/contracts/public_mint.ag) stores remaining allowance as `int`.

**Inference from those checked inputs:** the full GEEK cap does not fit that reference's single-minter allowance at eight decimals. This is not a universal ban on a 144-billion KCC20 asset. Distinguish per-state, per-transfer and aggregate supply limits. Multiple carefully bounded states/minters may be an engineering path, but require a reviewed genesis/accounting design and compatible wallets. Merely changing an SDK number to BigInt does not change contract limits.

Seven display decimals would make the maximum raw amount fit, but would change precision. Existing eight-decimal entitlements may not be divisible by ten; no precision reduction, rounding, redenomination or supply change is approved. A snapshot of current circulating supply alone also cannot decide what happens to the still-unminted GEEK allocation.

## Wallets, metadata and indexing

| Candidate / evidence | What we can say | What still needs proving |
| --- | --- | --- |
| [Kasware Android release notes](https://github.com/kasware-wallet/kasware-app/releases/tag/v0.5.1) | August 6, 2026 notes explicitly mention KRON KCC20. | General current-KCC conformance, chosen GEEK artifact, exact installed Android version and dapp signing flow. |
| [Kasware extension provider](https://github.com/kasware-wallet/extension/blob/78bb30045edd4d898c4d61c4c75ba1bc37e18748/src/background/controller/provider/controller.ts) | Contains `signPskt` and KRC-20 methods. | A generic method alone does not prove covenant support or mobile parity. HQ's current `signKRC20Transaction` flow cannot simply be renamed. |
| [Kaspire](https://github.com/KaspaHUB21/Kaspire-Kaspa-Wallet) | Maintainer documents Android/extension KCC20 assets, PSKT flows and indexer sources. | Exact token profile and end-to-end acceptance; no installation or endorsement performed here. |
| [Scorpion SDK](https://github.com/mrzeku2000XTTT/kcc20-sdk) / [docs](https://kcc20-sdk.vercel.app/docs) | Maintainer describes a hosted-wallet connection and signing API. | Origin, signing and artifact compatibility review; not an interchangeable Kasware provider. |
| [Kasmos web wallet](https://github.com/kasmoslabs/kcc20-web-wallet) | Maintainer documents iframe covenant signing and PSKT support. | Independent security review, exact runtime/profile and mobile acceptance; maintainer readiness claims are not our validation. |
| [kcc20.info](https://kcc20.info/) | Offers a covenant/token index and API links. Retrieved page showed a connecting/unavailable data state. | Freshness, network, exact template recognition, spent-state handling, reorg behavior and independent reconstruction. The page's zeros/loading fields are not verified token counts. |

[KCC-23](https://github.com/kaspanet/kccs/blob/1516a6c4cef59940fc3af3096dbcdd9c08690254/kcc-0023.md) is a **Draft** metadata-binding convention added to the checked tree October 14. It binds JSON metadata through a preparation transaction and covenant genesis. Descriptive metadata does not create spending authority or prove accepted deployment. Geek should pin network + covenant ID + verified program/artifacts + metadata, rather than trust a ticker. This also avoids confusing unrelated assets called GEEK.

## Migration choices and holder protection

The choices below are **Geek design analysis**, not supplied migration services or approved monetary policy.

| Choice | Benefit | Unresolved obligation |
| --- | --- | --- |
| Keep GEEK KRC-20 while prototyping | Preserves existing holder/mint behavior and isolates experimentation. | Reward operations still depend on the chosen KRC-20 infrastructure. Recommended near-term course. |
| Snapshot and claim a new asset | Can define deterministic entitlement at one cutoff. | Prove source state and ownership; prevent replay; account for custody/exchange holders, open mint and post-cutoff transfers. A claim does not burn or lock old tokens. |
| Lock old tokens and issue a representation | Potentially reversible correspondence. | Custody/signers, reserves, withdrawal failures and source-indexer truth remain explicit trust boundaries. |
| Burn old tokens then issue new tokens | Could retire the old entitlement under a documented policy. | Independently verify burn semantics, source acceptance, replay resistance and recovery. Kaspa script does not automatically know an external KRC-20 indexer's balances or burn interpretation. |

KaspaCom's [snapshot builder guide](https://github.com/KASPACOM/kcc20-tx-builder/blob/d65c203071c131f36ba1687c3d4f76ccf929733a/docs/snapshot-start.md) describes `signerless-start-v2`, frozen artifacts, bootstrap/controllers and claims, bounded to eight shards and Merkle depth twenty. It leaves source acceptance, persistence, governance and recovery to the host. Documented tests use synthetic funded UTXOs; funded DEV rehearsal and independent review remain required. Source reproduction of snapshot artifacts is also listed as a separate release check. “Signerless start” does not mean a trustless KRC-20 snapshot, no funding signature, automatic holder migration or audited GEEK tooling. Its linked source repository/branch was unavailable through the checked GitHub endpoint, so source reproduction was not verified here.

Do not assume a new asset inherits existing listings, liquidity, wallet discovery or a fair-launch history. Specify one combined entitlement/accounting policy, a maximum issuance budget, unclaimed balances, deadlines, dust and appeals. Publishing a site announcement cannot itself disable the original mint. Never count old and new unlocked claims as a single unchanged supply without explaining the duplication.

### KAT Bridge is a lead, not a verified GEEK migration route

Current [KAT documentation](https://kaspakat.gitbook.io/kat-bridge) describes route-specific KAS/Igra and Hyperlane trust models. Older indexed text described KRC-20/ERC-20 routes. Social mirrors mention prospective KCC20 migration, but no primary GEEK-specific enrollment, covenant ID or executed migration evidence was found in this search.

The [NFT bridge subdomain](https://nft.katbridge.com/) returned an undated pause notice attributing unbacked ZEAL/NACHO issuance to an indexer exploit. Record this as the operator's notice, not independently reproduced root-cause evidence, a dated incident determination or proof of current GEEK exposure. Do not infer a supported live KCC20 migration from an older route page, indexed snippet or a matching ticker.

## What this could enable for Geek

These are proposed applications, conditional on a verified implementation:

- Treasury outputs whose spend rules bind authorized reward distributions, with bounded amounts and explicit signers. Quiz grading, eligibility, abuse review and appeals still require Geek's application and governance; a token contract cannot determine that an answer was honestly learned.
- Testable escrow or atomic exchange integrations for future purchases. KCC20 itself does not supply a complete exchange, liquidity or marketplace.
- More explicit token identity and independently reconstructable state. Discovery APIs still need validation and operational recovery.
- A separate future assessment of collectible ownership. KCC-20 is a fungible-token convention, not a completed NFT mint/trading standard for the 500 Geeks.

Schools, public-service and military learning remain usable without token ownership. No partner, government contract, certification, regulated issuer role or institutional data handling is created by choosing a token standard. Token Depot's regulated powers are optional implementation profiles, not requirements or suggested defaults for Geek.

## Concrete next work

1. Resolve supply representation with the exact implementation's maintainers: preserve 144 billion, eight-decimal entitlements, existing holders and still-unminted allocation; test integer boundaries and aggregate issuance.
2. Select one standards/artifact version and one network. Reproduce artifacts and conformance vectors; record fees, KAS deposits, mass, transfer bounds, indexing and license requirements.
3. Specify a watch-only reader and disabled adapter design. Keep the current KRC-20 GEEKT receipt pilot separate; it does not accept KCC20 receipts.
4. Rehearse a tiny isolated test asset, transfer/change, repeated reward, stale/spent state, duplicate submit, ambiguous send, wallet rejection, indexer outage and recovery. Record real phone and chain evidence before proposing integration.
5. Only after those results, present a holder transition and funded reward proposal for founder/community review. CCE still requires 1,000 reviewed questions in each of eight categories plus approved economics; settlement and ownership remain disabled.

### Questions for the right maintainers

- **KCC authors:** Sivan Helfer, Michael Sutton, Ori Newman and Romain Billot, through the [specification discussion](https://kas-smiths.org/t/fungible-token-covenant-specification-kcc20/8/) or repository. Ask about supply sharding, eight-decimal compatibility and current conformance. These are published authors, not confirmed Geek advisers.
- **KaspaCom builder maintainers:** ask which artifact is conforming to the current KCC revision, what snapshot source proofs are trusted, whether the GEEK raw cap fits, and what real-network evidence exists.
- **Kasware maintainers:** request the exact Android version and supported covenant/PSKT API/profile for that artifact. KRON support alone is insufficient.
- **Any proposed bridge operator:** request the specific GEEK route, custody and verifier model, audited version, incident disposition, supported source identity and new covenant ID. No outreach was sent during this task.

## Evidence limits and handoff

Primary specifications, repository files, release notes and operator documentation were inspected. Thirteen repository-file references are pinned by commit and Git blob in the catalog. Search snippets were used for discovery; stale forum ABIs, old reference-repository stub descriptions and general wallet marketing were not treated as current conformance evidence. There is no claim to have exhausted private chats or every unpublished design.

This task performs no dependency installation, third-party test execution, wallet connection, signing, broadcast, deployment, mint, holder snapshot or live indexer audit. Local checks cover research data integrity, arithmetic, continuity generation and repository presentation. Migration, fees, performance, independent audit and end-to-end wallet acceptance remain unproven for Geek.
