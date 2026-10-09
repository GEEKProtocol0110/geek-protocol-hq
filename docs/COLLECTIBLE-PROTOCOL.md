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

The complete creative and production contract is documented in `docs/GEEK-500-ART-BIBLE.md`. The deterministic public manifest is generated at `public/data/geek-500.json` and checked during every verification run.

Recovered July 2025 character concepts are isolated in a separate, hashed legacy archive at `public/data/legacy-geek-art.json`. They are visible for historical continuity but remain unapproved, unmapped to edition numbers, non-transferable, and outside the mint contract until provenance and visual review are complete.

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


## Personal Geek character studio (October 5, 2026)

The free profile builder now offers a block-style Personal Geek alongside the existing GIGA robot. Personal characters support eight skin tones, seven hairstyles, seven hair colors, five eye colors, facial hair, glasses, three tops and three bottoms. Both styles retain fixed character palettes, chest emblems, footwear, backpacks/fins and cosmic effects. Native character-style radio controls and keyboard-operable Face & hair, Outfit and Extras tabs organize the editor. Previews remain local until explicit Save & equip; Undo restores the saved design, and Reset this style restores its starter.

Cosmetic schema version 2 uses the same session-authenticated customization endpoint and atomic profile-field patch. Its strict, complete fixed vocabulary accepts no arbitrary colors, markup, photo, reward, edition or ownership field. Existing version-1 robots normalize into version 2 with their original parts retained; reading does not overwrite the stored design. Version-1 clients can still save valid robot designs. The avatar ID remains `giga-builder`, and avatar switching preserves customization. Human-only controls are hidden in robot mode, and robot antennas cannot be saved on personal characters. Profile traits are not sent to analytics. No image upload, identity inference or face recognition is introduced.

This is a free off-chain profile character feature. It does not create NFT ownership, alter the 500-Geek supply, grant XP/credits/tokens, accept payment, or enable settlement. Unit and handler tests cover strict trait validation, version migration, persistence, avatar switching and preservation of concurrent profile fields.

## Character studio and earned effects (October 6, 2026)

The studio adds Everyday, Explorer, Night Signal and GIGA presets; palette swatches; Surprise me; authored front/back views and a portrait crop. Personal Geeks now have ten hairstyles and four tops, with caps and beanies for both styles. Previews, camera changes and randomization create no server write. Undo restores the saved design, and the browser warns before leaving an edited preview. Save & equip remains the only customization mutation. Existing v1/v2 designs and the same `giga-builder` ID remain compatible.

Two optional career effects extend the fixed v2 vocabulary: Explorer pulse at level 5 (or any prestige) and Prestige crown at Prestige 1. The server loads the authenticated durable player's current career and rejects locked effects with 403 before the existing CAS profile-field patch. Client progression, owned flags or markup cannot authorize the save. Collection responses provide the server-derived effect status; the studio allows a locked preview but disables saving that design. These unlocks are derived from the existing ledger and create no second grant record. Both remain available after an optional prestige reset. All other starter parts remain free. No photo upload, NFT edition, payment, scoring advantage or analytics trait is added.

The shared authored renderer displays the saved front view on the dashboard, Duel and Quest. A larger identity portrait and an editor link make the selected Geek visible at the dashboard entrance.

## Client save recovery (October 9, 2026)

Character saves have a 15-second request deadline covering both headers and response JSON. A stalled or failed reply unlocks editing and keeps the local draft, but cannot establish whether the server accepted the save. The page asks for a profile reconnect before another mutation; it does not assert that the saved character stayed unchanged. A successful read reconciles the draft with the server design, including clearing the unsaved label if the lost reply followed an accepted save.

Character saves, avatar selection and sticker actions share a client pending-write guard. Buttons are disabled while an action is pending, so repeated clicks cannot create multiple offers through that page. Failure marks the collection unavailable until a fresh successful read; writes are never automatically retried. Delayed collection reads from before a mutation or newer receipt cannot replace that receipt or re-enable failed-state controls. These are UX protections, not inventory authorization; the existing server checks, reservations, CAS patches and atomic trade rules remain authoritative.

`tests/profile-client.test.js` executes the shipped profile, character-studio and dashboard clients with synthetic DOM/API/timer fixtures. It covers stalled responses/bodies, preserved drafts, uncertain saves, integrated studio/trade guards, delayed collection refreshes, name-save races and prestige recovery. These automated checks do not establish physical-phone rendering or production saved-record acceptance.
