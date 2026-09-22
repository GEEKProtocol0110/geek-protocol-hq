# Geek Collectible Protocol

## Purpose

The Omniscient Grid is a planned collection of 500 unique Geek identities. GIGA is the community heart and A.C.E. is the protocol mind. The remaining identities span eight knowledge districts and ten functional archetypes. Collectibles are cosmetic identity and learning-history objects; they do not improve scores, odds, rewards, or leaderboard placement.

## Current Alpha boundary

- Avatar selection, sticker awards, inventory, reservations, and trades are server-owned application data.
- The interface labels the system `OFF-CHAIN ALPHA`.
- `onChainTransfersEnabled` is hard-coded to `false`.
- No existing avatar selection or sticker is represented as an NFT.
- No custody, signing, royalty, marketplace, bridge, or NFT transfer code exists in the Alpha path.

This lets the community test the game loop before an irreversible collection deployment.

## Collection blueprint

| Tier | Slots |
| --- | ---: |
| Common | 250 |
| Rare | 125 |
| Epic | 75 |
| Legendary | 40 |
| Elite | 8 |
| Mythic | 2 |
| Total | 500 |

The deterministic manifest model in `server/geek-collection.js` assigns every slot a stable number, tier, district, discipline, archetype, and art-production status. It does not pretend unfinished artwork exists. Slots 499 and 500 are reserved for GIGA and A.C.E.

## Sticker integrity model

1. The ranked server awards stickers from server-scored results.
2. The browser can request a trade but cannot write inventory.
3. Opening an offer atomically reserves the offered quantity.
4. Accepting an offer verifies both available balances and mutates both profiles in one Redis script.
5. Cancelling an offer releases the reservation atomically.
6. Quantities are integer-bounded. Offers expire after seven days; the next market read atomically releases their reservations before removing them from the open index.
7. Every successful create, accept, cancel, and avatar-selection action emits pseudonymous audit evidence.

## Kaspa integration path

Kaspa integration should use the maintained Rusty Kaspa WASM SDK for browser or Node wallet primitives and official node/RPC guidance for chain access. NFT standards and marketplace indexers are a separate application-layer dependency and must not be described as Kaspa consensus.

Before any on-chain Geek collection deployment:

- freeze and content-address all 500 images and metadata records;
- publish a complete provenance manifest and reproducible collection hash;
- pin the exact network, deployment transaction, supply, royalty, and authority policy;
- independently verify ownership against more than one data source where practical;
- require signed wallet challenges before associating an on-chain asset with a player;
- define recovery, compromised-wallet, delisting, and indexer-outage behavior;
- add anti-wash-trading limits and clear marketplace risk disclosures;
- commission independent application, smart/protocol-layer, and deployment-configuration reviews;
- keep deployment and transfers fail-closed until every audit gate is approved.

## Art production contract

Each finished Geek must preserve the stable slot ID and export a square source image, display derivative, thumbnail, accessible description, trait record, creator/provenance record, and content hash. Replacing an image after metadata freeze requires a public version change; silent replacement is prohibited.
